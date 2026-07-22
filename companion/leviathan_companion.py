#!/usr/bin/env python3
"""Leviathan Companion — lets Leviathan see and operate THIS computer, and
see the devices on your own network. You run it; you own the machine.

It connects OUT to Leviathan over a WebSocket, prints a 6-digit pairing
code, and then serves commands. Everything it does is printed here.

CAPABILITIES
  Read (run instantly):
    • open folders / files / apps / URLs
    • list devices on your local network (ARP neighbour table)
    • report live vitals (CPU, RAM, disk, battery, uptime)
    • list running processes, read files, list folders, clipboard read
  Change state (guarded — see TRUSTED MODE):
    • run terminal commands, move/overwrite files outside the workspace
    • media control, lock, sleep, screenshot, notify, clipboard write,
      kill a process

TRUSTED MODE
  OFF by default: every state-changing action pauses and asks you to type
  'y' here. Say "enable trusted mode" to Leviathan (or press T here) to let
  state-changing actions run without a prompt for this session. Reads never
  prompt. Close this window (Ctrl+C) to end all control instantly.

Setup:  pip install websockets psutil
Run:    python leviathan_companion.py
"""
import asyncio
import json
import os
import platform
import re
import shutil
import subprocess
import sys
from pathlib import Path

try:
    import websockets
except ImportError:
    print("Missing dependency. Run:  pip install websockets psutil")
    sys.exit(1)

try:
    import psutil
except ImportError:
    psutil = None

BACKEND = os.getenv("LEVIATHAN_BACKEND", "wss://leviathan-core.onrender.com")
COMPANION_URL = BACKEND.rstrip("/") + "/companion"
SYSTEM = platform.system()  # 'Windows' | 'Darwin' | 'Linux'
WORKSPACE = Path.home() / "Leviathan"
WORKSPACE.mkdir(exist_ok=True)

TRUSTED = False  # session-wide: skip per-action confirm when True

APP_ALIASES = {
    "notepad": "notepad", "calculator": "calc" if SYSTEM == "Windows" else "gnome-calculator",
    "calc": "calc" if SYSTEM == "Windows" else "gnome-calculator", "paint": "mspaint",
    "explorer": "explorer", "cmd": "cmd", "task manager": "taskmgr",
    "spotify": "spotify", "chrome": "chrome", "edge": "msedge", "firefox": "firefox",
    "word": "winword", "excel": "excel", "vscode": "code", "vs code": "code", "code": "code",
}


def known_folders():
    home = Path.home()
    return {
        "home": home, "downloads": home / "Downloads", "documents": home / "Documents",
        "desktop": home / "Desktop", "pictures": home / "Pictures",
        "music": home / "Music", "videos": home / "Videos",
        "workspace": WORKSPACE, "leviathan": WORKSPACE,
    }


async def confirm(prompt: str) -> bool:
    """Ask the human at THIS console — unless trusted mode is on."""
    if TRUSTED:
        print(f"  [trusted] auto-allowed: {prompt}")
        return True
    print("\n" + "!" * 58)
    print(f"  LEVIATHAN WANTS TO: {prompt}")
    ans = await asyncio.to_thread(input, "  Allow this? [y/N] ")
    ok = ans.strip().lower() in ("y", "yes")
    print("  -> " + ("ALLOWED" if ok else "DENIED") + "\n")
    return ok


def _resolve(path_str: str) -> Path:
    p = Path(os.path.expanduser(os.path.expandvars(path_str)))
    return p if p.is_absolute() else WORKSPACE / p


def _in_workspace(p: Path) -> bool:
    try:
        p.resolve().relative_to(WORKSPACE.resolve())
        return True
    except ValueError:
        return False


# ----------------------------------------------------------- open / launch

def do_open(target: str):
    t = target.strip()
    low = t.lower()
    import webbrowser
    if low.startswith(("http://", "https://")):
        webbrowser.open(t)
        return True, f"opened url {t}"
    if "." in low and low.split(".")[-1] in ("com", "org", "net", "io", "ai", "dev", "app"):
        webbrowser.open("https://" + t)
        return True, f"opened url https://{t}"
    folders = known_folders()
    if low in folders:
        return _open_path(folders[low])
    p = _resolve(t)
    if p.exists():
        return _open_path(p)
    return _launch_app(t)


def _open_path(path: Path):
    if not path.exists():
        return False, f"path not found: {path}"
    if SYSTEM == "Windows":
        os.startfile(str(path))
    elif SYSTEM == "Darwin":
        subprocess.Popen(["open", str(path)])
    else:
        subprocess.Popen(["xdg-open", str(path)])
    return True, f"opened {path}"


def _launch_app(name: str):
    cmd = APP_ALIASES.get(name.lower().strip(), name)
    try:
        if SYSTEM == "Windows":
            subprocess.Popen(f'start "" {cmd}', shell=True)
        elif SYSTEM == "Darwin":
            subprocess.Popen(["open", "-a", cmd])
        else:
            if not shutil.which(cmd):
                return False, f"'{name}' is not installed or on PATH"
            subprocess.Popen([cmd])
        return True, f"launched {name}"
    except OSError as exc:
        return False, f"could not launch {name}: {exc}"


# ----------------------------------------------------------- files

def do_write_file(path_str: str, content: str):
    p = _resolve(path_str)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return True, f"wrote {p} ({len(content)} chars)"


def do_read_file(path_str: str):
    p = _resolve(path_str)
    if not p.exists():
        return False, f"not found: {p}"
    try:
        return True, p.read_text(encoding="utf-8")[:20000]
    except UnicodeDecodeError:
        return False, f"{p} is not text"


def do_make_dir(path_str: str):
    p = _resolve(path_str)
    p.mkdir(parents=True, exist_ok=True)
    return True, f"created folder {p}"


def do_list_dir(path_str: str):
    p = _resolve(path_str or "workspace")
    if not p.is_dir():
        return False, f"not a folder: {p}"
    entries = sorted(f"{'[dir] ' if c.is_dir() else '      '}{c.name}" for c in p.iterdir())
    return True, f"{p}:\n" + "\n".join(entries[:200])


def do_move(src_str: str, dst_str: str):
    src, dst = _resolve(src_str), _resolve(dst_str)
    if not src.exists():
        return False, f"source not found: {src}"
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(dst))
    return True, f"moved {src} -> {dst}"


def do_run(command: str):
    try:
        proc = subprocess.run(command, shell=True, capture_output=True, text=True,
                              timeout=120, cwd=str(WORKSPACE))
        out = (proc.stdout or "")[-6000:]
        err = (proc.stderr or "")[-2000:]
        detail = f"exit {proc.returncode}\n{out}" + (f"\n[stderr]\n{err}" if err else "")
        return proc.returncode == 0, detail
    except subprocess.TimeoutExpired:
        return False, "command timed out after 120s"


# ----------------------------------------------------------- network devices

def do_list_devices():
    """Devices on the local network, from this machine's ARP neighbour
    table (read-only — the same list your router shows)."""
    try:
        if SYSTEM == "Windows":
            raw = subprocess.run(["arp", "-a"], capture_output=True, text=True, timeout=15).stdout
        else:
            raw = subprocess.run(["arp", "-a"], capture_output=True, text=True, timeout=15).stdout
    except Exception as exc:
        return False, f"could not read ARP table: {exc}"
    devices = []
    for line in raw.splitlines():
        ip = re.search(r"(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})", line)
        mac = re.search(r"([0-9a-fA-F]{2}[:-]){5}[0-9a-fA-F]{2}", line)
        if ip and mac:
            addr = ip.group(1)
            name = ""
            try:
                import socket
                name = socket.gethostbyaddr(addr)[0]
            except Exception:
                pass
            devices.append({"ip": addr, "mac": mac.group(0).replace("-", ":").lower(),
                            "name": name})
    # de-dupe by ip
    seen, uniq = set(), []
    for d in devices:
        if d["ip"] not in seen and not d["ip"].endswith(".255"):
            seen.add(d["ip"]); uniq.append(d)
    lines = [f"{d['ip']:16} {d['mac']:18} {d['name']}" for d in uniq]
    return True, f"{len(uniq)} devices on your network:\n" + "\n".join(lines[:80])


# ----------------------------------------------------------- vitals / procs

def do_vitals():
    if psutil is None:
        return False, "psutil not installed — run: pip install psutil"
    import time as _t
    cpu = psutil.cpu_percent(interval=0.4)
    vm = psutil.virtual_memory()
    du = psutil.disk_usage(str(Path.home().anchor or "/"))
    up = int(_t.time() - psutil.boot_time())
    batt = None
    try:
        b = psutil.sensors_battery()
        if b:
            batt = f"{int(b.percent)}%{' (charging)' if b.power_plugged else ''}"
    except Exception:
        pass
    detail = json.dumps({
        "host": platform.node(), "os": f"{SYSTEM} {platform.release()}",
        "cpu_percent": cpu, "memory_percent": vm.percent,
        "memory_used_gb": round(vm.used / 1e9, 1), "memory_total_gb": round(vm.total / 1e9, 1),
        "disk_percent": du.percent, "disk_free_gb": round(du.free / 1e9, 1),
        "battery": batt, "uptime_hours": round(up / 3600, 1),
    })
    return True, detail


def do_proc_list():
    if psutil is None:
        return False, "psutil not installed — run: pip install psutil"
    procs = []
    for p in psutil.process_iter(["name", "cpu_percent", "memory_percent"]):
        try:
            procs.append((p.info["name"] or "?", p.info.get("memory_percent") or 0,
                          p.info.get("cpu_percent") or 0))
        except Exception:
            continue
    procs.sort(key=lambda x: x[1], reverse=True)
    lines = [f"{n[:30]:30} mem {m:4.1f}%  cpu {c:4.1f}%" for n, m, c in procs[:20]]
    return True, "top processes by memory:\n" + "\n".join(lines)


def do_proc_kill(name: str):
    if psutil is None:
        return False, "psutil not installed"
    killed = 0
    for p in psutil.process_iter(["name"]):
        try:
            if name.lower() in (p.info["name"] or "").lower():
                p.terminate(); killed += 1
        except Exception:
            continue
    return (killed > 0), f"terminated {killed} process(es) matching '{name}'"


# ----------------------------------------------------------- media / system

def do_media(action: str):
    keys = {"play_pause": 0xB3, "next": 0xB0, "prev": 0xB1,
            "vol_up": 0xAF, "vol_down": 0xAE, "mute": 0xAD}
    try:
        if SYSTEM == "Windows":
            import ctypes
            vk = keys.get(action)
            if vk is None:
                return False, f"unknown media action: {action}"
            ctypes.windll.user32.keybd_event(vk, 0, 0, 0)
            ctypes.windll.user32.keybd_event(vk, 0, 2, 0)
            return True, f"media: {action}"
        if SYSTEM == "Darwin":
            m = {"play_pause": "playpause", "next": "next track", "prev": "previous track"}
            if action in m:
                subprocess.run(["osascript", "-e", f'tell application "Music" to {m[action]}'])
                return True, f"media: {action}"
            if action == "vol_up":
                subprocess.run(["osascript", "-e", "set volume output volume (output volume of (get volume settings) + 10)"])
            elif action == "vol_down":
                subprocess.run(["osascript", "-e", "set volume output volume (output volume of (get volume settings) - 10)"])
            elif action == "mute":
                subprocess.run(["osascript", "-e", "set volume with output muted"])
            return True, f"media: {action}"
        # Linux
        if action in ("play_pause", "next", "prev") and shutil.which("playerctl"):
            subprocess.run(["playerctl", {"play_pause": "play-pause", "next": "next", "prev": "previous"}[action]])
            return True, f"media: {action}"
        return False, "media control not supported on this system"
    except Exception as exc:
        return False, f"media error: {exc}"


def do_screenshot():
    out = WORKSPACE / "screenshot.png"
    try:
        if SYSTEM == "Darwin":
            subprocess.run(["screencapture", "-x", str(out)], timeout=15)
        else:
            try:
                from PIL import ImageGrab
                ImageGrab.grab().save(out)
            except ImportError:
                if SYSTEM == "Linux" and shutil.which("scrot"):
                    subprocess.run(["scrot", str(out)], timeout=15)
                else:
                    return False, "screenshot needs Pillow (pip install pillow)"
        return True, f"screenshot saved to {out}"
    except Exception as exc:
        return False, f"screenshot error: {exc}"


def do_system(action: str, value: str = ""):
    try:
        if action == "lock":
            if SYSTEM == "Windows":
                import ctypes; ctypes.windll.user32.LockWorkStation()
            elif SYSTEM == "Darwin":
                subprocess.run(["pmset", "displaysleepnow"])
            else:
                subprocess.run(["loginctl", "lock-session"])
            return True, "locked the screen"
        if action == "sleep":
            if SYSTEM == "Windows":
                subprocess.run(["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"])
            elif SYSTEM == "Darwin":
                subprocess.run(["pmset", "sleepnow"])
            else:
                subprocess.run(["systemctl", "suspend"])
            return True, "put the machine to sleep"
        if action == "screenshot":
            return do_screenshot()
        if action == "notify":
            _notify(value or "Leviathan")
            return True, f"notification shown: {value}"
        if action == "clipboard_get":
            return True, _clip_get()
        if action == "clipboard_set":
            _clip_set(value)
            return True, "clipboard set"
        return False, f"unknown system action: {action}"
    except Exception as exc:
        return False, f"system error: {exc}"


def _notify(text: str):
    if SYSTEM == "Darwin":
        subprocess.run(["osascript", "-e", f'display notification "{text}" with title "Leviathan"'])
    elif SYSTEM == "Linux" and shutil.which("notify-send"):
        subprocess.run(["notify-send", "Leviathan", text])
    elif SYSTEM == "Windows":
        ps = f'powershell -c "New-BurntToastNotification -Text \'Leviathan\',\'{text}\'" 2>$null || msg %username% "{text}"'
        subprocess.run(ps, shell=True)


def _clip_get() -> str:
    if SYSTEM == "Windows":
        return subprocess.run(["powershell", "-c", "Get-Clipboard"], capture_output=True, text=True).stdout.strip()[:4000]
    if SYSTEM == "Darwin":
        return subprocess.run(["pbpaste"], capture_output=True, text=True).stdout[:4000]
    if shutil.which("xclip"):
        return subprocess.run(["xclip", "-selection", "clipboard", "-o"], capture_output=True, text=True).stdout[:4000]
    return "(clipboard read unavailable)"


def _clip_set(text: str):
    if SYSTEM == "Windows":
        subprocess.run("clip", input=text, text=True, shell=True)
    elif SYSTEM == "Darwin":
        subprocess.run(["pbcopy"], input=text, text=True)
    elif shutil.which("xclip"):
        subprocess.run(["xclip", "-selection", "clipboard"], input=text, text=True)


# --------------------------------------------------------- command router

READ_ACTIONS = {"open", "read_file", "list_dir", "list_devices", "vitals",
                "proc_list", "make_dir", "write_file"}  # open/workspace-write are safe


async def handle(msg: dict):
    global TRUSTED
    action = msg.get("action")
    target = msg.get("target", "")

    # --- reads & safe actions (instant) ---
    if action == "open":
        return do_open(target)
    if action == "list_devices":
        return do_list_devices()
    if action == "vitals":
        return do_vitals()
    if action == "proc_list":
        return do_proc_list()
    if action == "list_dir":
        return do_list_dir(target)
    if action == "read_file":
        p = _resolve(target)
        if not _in_workspace(p) and not await confirm(f"read file: {p}"):
            return False, "denied by user"
        return do_read_file(target)
    if action == "write_file":
        p = _resolve(target)
        if not _in_workspace(p) and not await confirm(f"write OUTSIDE workspace: {p}"):
            return False, "denied by user"
        return do_write_file(target, msg.get("content", ""))
    if action == "make_dir":
        p = _resolve(target)
        if not _in_workspace(p) and not await confirm(f"create folder: {p}"):
            return False, "denied by user"
        return do_make_dir(target)

    # --- trusted-mode toggle ---
    if action == "set_trusted":
        TRUSTED = str(target).lower() in ("on", "true", "1", "yes")
        print(f"\n>>> TRUSTED MODE {'ON — state changes run without asking' if TRUSTED else 'OFF'} <<<\n")
        return True, f"trusted mode {'on' if TRUSTED else 'off'}"

    # --- state-changing (guarded) ---
    if action == "run":
        if not await confirm(f"run terminal command: {target}"):
            return False, "denied by user"
        return do_run(target)
    if action == "move":
        if not await confirm(f"move '{target}' -> '{msg.get('dest','')}'"):
            return False, "denied by user"
        return do_move(target, msg.get("dest", ""))
    if action == "media":
        return do_media(target)
    if action == "proc_kill":
        if not await confirm(f"kill process: {target}"):
            return False, "denied by user"
        return do_proc_kill(target)
    if action == "system":
        sub = target
        if sub in ("lock", "sleep", "clipboard_set") and not await confirm(f"system {sub}"):
            return False, "denied by user"
        return do_system(sub, msg.get("value", ""))

    return False, f"unsupported action: {action}"


async def _key_listener():
    """Press T here to toggle trusted mode locally."""
    global TRUSTED
    while True:
        line = await asyncio.to_thread(input)
        if line.strip().lower() == "t":
            TRUSTED = not TRUSTED
            print(f">>> TRUSTED MODE {'ON' if TRUSTED else 'OFF'} <<<")


async def run():
    print("=" * 62)
    print("  LEVIATHAN COMPANION")
    print(f"  Machine: {platform.node()} ({SYSTEM})   Workspace: {WORKSPACE}")
    print("  Reads run instantly · state changes ask you (unless trusted)")
    print("  Press 'T' + Enter to toggle trusted mode · Ctrl+C to end")
    if psutil is None:
        print("  NOTE: install psutil for vitals/processes: pip install psutil")
    print("=" * 62)
    print(f"\nConnecting to {COMPANION_URL} ...\n")

    async with websockets.connect(COMPANION_URL, max_size=2**22) as ws:
        await ws.send(json.dumps({"type": "hello", "name": platform.node() or "PC"}))
        asyncio.create_task(_key_listener())
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if msg.get("type") == "code":
                print("+" + "-" * 44 + "+")
                print(f"|   PAIRING CODE:  {msg['code']}   ".ljust(45) + "|")
                print("+" + "-" * 44 + "+")
                print(f'\nSay: "pair with my computer, the code is {msg["code"]}"\n')
            elif msg.get("type") == "paired":
                print("* Paired. Leviathan can now act on this machine.\n")
            elif msg.get("type") == "cmd":
                try:
                    ok, detail = await handle(msg)
                except Exception as exc:
                    ok, detail = False, f"{type(exc).__name__}: {exc}"
                first = (detail or "").splitlines()[0] if detail else ""
                print(f"  [{'OK ' if ok else 'ERR'}] {msg.get('action')} «{str(msg.get('target',''))[:40]}» — {first[:70]}")
                await ws.send(json.dumps({"type": "result", "id": msg.get("id"),
                                          "ok": ok, "detail": detail}))


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\nCompanion stopped. Control ended.")
    except Exception as exc:
        print(f"\nDisconnected: {exc}\nRestart to reconnect.")
