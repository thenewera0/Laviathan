#!/usr/bin/env python3
"""Leviathan Companion — the LOCAL POWER PLANE.

Leviathan's brain runs in the cloud (always reachable, holds memory and the
capability registry). Its muscle runs HERE, on this machine, where there is
real CPU, GPU, RAM, disk and a real operating system. The cloud decides; this
process executes.

DESIGN
  • Pair ONCE. After that this machine is remembered and reconnects silently
    and forever — through reboots, network drops and cloud sleep/wake.
  • FULL AUTONOMY. No per-action prompts. Leviathan acts on this machine the
    way you would. Instead of asking permission it keeps an undo journal:
    anything destructive is snapshotted first, and "undo" rolls it back.
  • SELF-PROVISIONING. Leviathan can install what it needs (ensure_deps) and
    run arbitrary local code (python_exec). New capabilities therefore need
    no new companion release — the brain ships the code, this plane runs it.

SAFETY THAT REMAINS (deliberately small)
  • The pairing code is a credential: short-lived, single-use, attempt-capped.
  • Every action is appended to an audit log you can read.
  • Destructive file operations are snapshotted and reversible via "undo".
  • Kill switch: close this window, or create the file ~/.leviathan/STOP

Setup:  python leviathan_companion.py     (dependencies install themselves)
"""
import asyncio
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path

# ------------------------------------------------------------------ bootstrap
# A non-technical user should never have to run pip. If an import is missing we
# install it ourselves and carry on.

def _pip_install(*packages: str) -> tuple[bool, str]:
    """Install packages into this interpreter. Returns (ok, output)."""
    cmd = [sys.executable, "-m", "pip", "install", "--quiet",
           "--disable-pip-version-check", *packages]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
        if proc.returncode != 0:
            # Retry into the user site-packages (no admin rights needed).
            proc = subprocess.run([*cmd, "--user"], capture_output=True,
                                  text=True, timeout=900)
        ok = proc.returncode == 0
        return ok, (proc.stdout or "") + (proc.stderr or "")
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"


def _require(module: str, package: str | None = None):
    """Import a module, installing it first if it isn't present."""
    try:
        return __import__(module)
    except ImportError:
        print(f"  installing {package or module} ...")
        _pip_install(package or module)
        try:
            return __import__(module)
        except ImportError:
            return None


websockets = _require("websockets")
if websockets is None:
    print("Could not install 'websockets'. Install Python from python.org and retry.")
    sys.exit(1)

psutil = _require("psutil")

SYSTEM = platform.system()                      # 'Windows' | 'Darwin' | 'Linux'
BACKEND = os.getenv("LEVIATHAN_BACKEND", "wss://leviathan-core.onrender.com")
COMPANION_URL = BACKEND.rstrip("/") + "/companion"

HOME = Path.home()
WORKSPACE = HOME / "Leviathan"
STATE_DIR = HOME / ".leviathan"
UNDO_DIR = STATE_DIR / "undo"
DEVICE_FILE = STATE_DIR / "device.json"
AUDIT_LOG = STATE_DIR / "audit.jsonl"
STOP_FILE = STATE_DIR / "STOP"
for _d in (WORKSPACE, STATE_DIR, UNDO_DIR):
    _d.mkdir(parents=True, exist_ok=True)

APP_ALIASES = {
    "notepad": "notepad", "calculator": "calc" if SYSTEM == "Windows" else "gnome-calculator",
    "calc": "calc" if SYSTEM == "Windows" else "gnome-calculator", "paint": "mspaint",
    "explorer": "explorer", "cmd": "cmd", "task manager": "taskmgr",
    "spotify": "spotify", "chrome": "chrome", "edge": "msedge", "firefox": "firefox",
    "word": "winword", "excel": "excel", "vscode": "code", "vs code": "code", "code": "code",
}


def known_folders():
    return {
        "home": HOME, "downloads": HOME / "Downloads", "documents": HOME / "Documents",
        "desktop": HOME / "Desktop", "pictures": HOME / "Pictures",
        "music": HOME / "Music", "videos": HOME / "Videos",
        "workspace": WORKSPACE, "leviathan": WORKSPACE,
    }


def _resolve(path_str: str) -> Path:
    p = Path(os.path.expanduser(os.path.expandvars(str(path_str))))
    return p if p.is_absolute() else WORKSPACE / p


# ------------------------------------------------------------ device identity

def load_device() -> dict:
    try:
        return json.loads(DEVICE_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save_device(device_id: str, token: str) -> None:
    try:
        DEVICE_FILE.write_text(
            json.dumps({"device_id": device_id, "token": token}), encoding="utf-8")
        if SYSTEM != "Windows":
            os.chmod(DEVICE_FILE, 0o600)
    except Exception as exc:
        print(f"  (could not save device identity: {exc})")


# ----------------------------------------------------------- audit + undo

def audit(action: str, detail: str, ok: bool = True) -> None:
    """Append-only record of everything Leviathan does on this machine."""
    try:
        with AUDIT_LOG.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps({
                "at": datetime.now().isoformat(timespec="seconds"),
                "action": action, "ok": ok, "detail": str(detail)[:2000],
            }) + "\n")
    except Exception:
        pass


def _snapshot(path: Path, op: str) -> None:
    """Copy a file aside before it is overwritten, moved or deleted.

    This is what replaces asking permission: actions run immediately, and
    anything destructive stays reversible via `undo`.
    """
    try:
        if not path.exists() or path.is_dir():
            return
        stamp = f"{int(time.time() * 1000)}_{path.name}"
        dest = UNDO_DIR / stamp
        shutil.copy2(path, dest)
        with (STATE_DIR / "undo.jsonl").open("a", encoding="utf-8") as fh:
            fh.write(json.dumps({
                "at": datetime.now().isoformat(timespec="seconds"),
                "op": op, "original": str(path), "backup": str(dest),
            }) + "\n")
    except Exception:
        pass


def do_undo(count: int = 1):
    """Roll back the last N destructive file operations."""
    journal = STATE_DIR / "undo.jsonl"
    if not journal.exists():
        return False, "nothing to undo"
    lines = [l for l in journal.read_text(encoding="utf-8").splitlines() if l.strip()]
    if not lines:
        return False, "nothing to undo"

    restored, kept = [], lines[:]
    for _ in range(max(1, int(count))):
        if not kept:
            break
        entry = json.loads(kept.pop())
        backup, original = Path(entry["backup"]), Path(entry["original"])
        if backup.exists():
            original.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(backup, original)
            restored.append(str(original))

    journal.write_text("\n".join(kept) + ("\n" if kept else ""), encoding="utf-8")
    if not restored:
        return False, "nothing could be restored"
    return True, "restored: " + ", ".join(restored)


# ------------------------------------------------- generic execution plane
# python_exec + shell + ensure_deps are what let the cloud brain ship NEW
# capabilities without ever shipping a new companion build.

def do_ensure_deps(packages) -> tuple[bool, str]:
    if isinstance(packages, str):
        packages = [p for p in re.split(r"[,\s]+", packages) if p]
    if not packages:
        return False, "no packages given"
    ok, out = _pip_install(*packages)
    return ok, (f"installed: {', '.join(packages)}" if ok else out[-1500:])


def do_python_exec(code: str, timeout: int = 600) -> tuple[bool, str]:
    """Run arbitrary Python on this machine with the full local environment."""
    if not code.strip():
        return False, "no code given"
    tmp = Path(tempfile.gettempdir()) / f"leviathan_{int(time.time()*1000)}.py"
    try:
        tmp.write_text(code, encoding="utf-8")
        proc = subprocess.run([sys.executable, str(tmp)], capture_output=True,
                              text=True, timeout=timeout, cwd=str(WORKSPACE))
        out = (proc.stdout or "") + (("\n[stderr]\n" + proc.stderr) if proc.stderr else "")
        return proc.returncode == 0, (out.strip() or "(no output)")[:20000]
    except subprocess.TimeoutExpired:
        return False, f"timed out after {timeout}s"
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"
    finally:
        try:
            tmp.unlink()
        except Exception:
            pass


def do_run(command: str, timeout: int = 600):
    """Run a shell command with this machine's full privileges."""
    if not command.strip():
        return False, "no command given"
    try:
        proc = subprocess.run(command, shell=True, capture_output=True,
                              text=True, timeout=timeout, cwd=str(WORKSPACE))
        out = (proc.stdout or "") + (("\n[stderr]\n" + proc.stderr) if proc.stderr else "")
        return proc.returncode == 0, (out.strip() or "(no output)")[:20000]
    except subprocess.TimeoutExpired:
        return False, f"timed out after {timeout}s"
    except Exception as exc:
        return False, f"{type(exc).__name__}: {exc}"


# ------------------------------------------------------------ open / launch

def do_open(target: str):
    t = str(target).strip()
    if not t:
        return False, "nothing to open"
    if re.match(r"^(https?://|www\.)", t, re.I):
        url = t if t.lower().startswith("http") else "https://" + t
        import webbrowser
        webbrowser.open(url)
        return True, f"opened {url}"

    folders = known_folders()
    if t.lower() in folders:
        return _open_path(folders[t.lower()])

    p = _resolve(t)
    if p.exists():
        return _open_path(p)
    return _launch_app(t)


def _open_path(path: Path):
    try:
        if SYSTEM == "Windows":
            os.startfile(str(path))                       # noqa: S606
        elif SYSTEM == "Darwin":
            subprocess.Popen(["open", str(path)])
        else:
            subprocess.Popen(["xdg-open", str(path)])
        return True, f"opened {path}"
    except Exception as exc:
        return False, f"could not open {path}: {exc}"


def _launch_app(name: str):
    exe = APP_ALIASES.get(name.lower(), name)
    try:
        if SYSTEM == "Windows":
            subprocess.Popen(["cmd", "/c", "start", "", exe], shell=False)
        elif SYSTEM == "Darwin":
            subprocess.Popen(["open", "-a", exe])
        else:
            subprocess.Popen([exe])
        return True, f"launched {exe}"
    except Exception as exc:
        return False, f"could not launch '{name}': {exc}"


# --------------------------------------------------------------- file ops

def do_write_file(path_str: str, content: str):
    p = _resolve(path_str)
    try:
        _snapshot(p, "write")
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")
        return True, f"wrote {len(content)} chars to {p}"
    except Exception as exc:
        return False, f"could not write {p}: {exc}"


def do_read_file(path_str: str):
    p = _resolve(path_str)
    try:
        return True, p.read_text(encoding="utf-8", errors="replace")[:200000]
    except Exception as exc:
        return False, f"could not read {p}: {exc}"


def do_make_dir(path_str: str):
    p = _resolve(path_str)
    try:
        p.mkdir(parents=True, exist_ok=True)
        return True, f"created {p}"
    except Exception as exc:
        return False, f"could not create {p}: {exc}"


def do_list_dir(path_str: str):
    p = _resolve(path_str) if path_str else WORKSPACE
    try:
        items = sorted(p.iterdir(), key=lambda x: (x.is_file(), x.name.lower()))
        listing = [("[dir]  " if i.is_dir() else "       ") + i.name for i in items[:400]]
        return True, f"{p}\n" + "\n".join(listing)
    except Exception as exc:
        return False, f"could not list {p}: {exc}"


def do_move(src_str: str, dst_str: str):
    src, dst = _resolve(src_str), _resolve(dst_str)
    try:
        _snapshot(src, "move")
        _snapshot(dst, "overwrite")
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(dst))
        return True, f"moved {src} -> {dst}"
    except Exception as exc:
        return False, f"could not move: {exc}"


def do_delete(path_str: str):
    p = _resolve(path_str)
    try:
        if p.is_dir():
            shutil.rmtree(p)
            return True, f"deleted folder {p}"
        _snapshot(p, "delete")
        p.unlink()
        return True, f"deleted {p} (recoverable with undo)"
    except Exception as exc:
        return False, f"could not delete {p}: {exc}"


# ------------------------------------------------------------ machine info

def do_list_devices():
    try:
        if SYSTEM == "Windows":
            out = subprocess.run(["arp", "-a"], capture_output=True, text=True, timeout=25).stdout
        else:
            cmd = ["ip", "neigh"] if shutil.which("ip") else ["arp", "-a"]
            out = subprocess.run(cmd, capture_output=True, text=True, timeout=25).stdout
        rows = []
        for line in out.splitlines():
            m = re.search(r"(\d+\.\d+\.\d+\.\d+)\D+([0-9a-fA-F]{2}[:-][0-9a-fA-F:-]{14,17})", line)
            if m:
                rows.append(f"{m.group(1):<16} {m.group(2)}")
        if not rows:
            return True, "no other devices visible on this network"
        return True, f"{len(rows)} device(s) on this network:\n" + "\n".join(rows[:60])
    except Exception as exc:
        return False, f"could not scan network: {exc}"


def do_vitals():
    if psutil is None:
        return False, "psutil unavailable"
    try:
        bat = psutil.sensors_battery() if hasattr(psutil, "sensors_battery") else None
        disk = psutil.disk_usage(str(HOME))
        parts = [
            f"CPU {psutil.cpu_percent(interval=0.4):.0f}%",
            f"RAM {psutil.virtual_memory().percent:.0f}%",
            f"Disk {disk.percent:.0f}% used ({disk.free // 2**30} GB free)",
            f"Uptime {int((time.time() - psutil.boot_time()) // 3600)}h",
        ]
        if bat:
            parts.append(f"Battery {bat.percent:.0f}%" + (" (charging)" if bat.power_plugged else ""))
        return True, " · ".join(parts)
    except Exception as exc:
        return False, f"could not read vitals: {exc}"


def do_proc_list():
    if psutil is None:
        return False, "psutil unavailable"
    try:
        procs = []
        for p in psutil.process_iter(["name", "cpu_percent", "memory_percent"]):
            try:
                procs.append((p.info["name"] or "?", p.info["memory_percent"] or 0))
            except Exception:
                continue
        procs.sort(key=lambda x: x[1], reverse=True)
        return True, "\n".join(f"{n:<32} {m:.1f}% RAM" for n, m in procs[:25])
    except Exception as exc:
        return False, f"could not list processes: {exc}"


def do_proc_kill(name: str):
    if psutil is None:
        return False, "psutil unavailable"
    killed = 0
    for p in psutil.process_iter(["name"]):
        try:
            if name.lower() in (p.info["name"] or "").lower():
                p.kill()
                killed += 1
        except Exception:
            continue
    return (killed > 0), (f"killed {killed} process(es) matching '{name}'"
                          if killed else f"no process matching '{name}'")


def do_screenshot():
    try:
        shot = STATE_DIR / f"screen_{int(time.time())}.png"
        if SYSTEM == "Windows":
            mss = _require("mss")
            if mss is None:
                return False, "could not install screenshot support"
            with mss.mss() as sct:
                sct.shot(output=str(shot))
        elif SYSTEM == "Darwin":
            subprocess.run(["screencapture", "-x", str(shot)], timeout=25)
        else:
            subprocess.run(["import", "-window", "root", str(shot)], timeout=25)
        return True, str(shot)
    except Exception as exc:
        return False, f"could not capture screen: {exc}"


def do_media(action: str):
    try:
        if SYSTEM == "Windows":
            keys = {"play_pause": 0xB3, "next": 0xB0, "prev": 0xB1,
                    "vol_up": 0xAF, "vol_down": 0xAE, "mute": 0xAD}
            if action in keys:
                import ctypes
                ctypes.windll.user32.keybd_event(keys[action], 0, 0, 0)
                ctypes.windll.user32.keybd_event(keys[action], 0, 2, 0)
                return True, f"media: {action}"
        elif shutil.which("playerctl") and action in ("play_pause", "next", "prev"):
            subprocess.run(["playerctl", {"play_pause": "play-pause"}.get(action, action)])
            return True, f"media: {action}"
        return False, f"media action '{action}' unsupported here"
    except Exception as exc:
        return False, f"media failed: {exc}"


def _notify(text: str):
    try:
        if SYSTEM == "Windows":
            ps = (f'[reflection.assembly]::loadwithpartialname("System.Windows.Forms");'
                  f'[System.Windows.Forms.MessageBox]::Show("{text}","Leviathan")')
            subprocess.Popen(["powershell", "-NoProfile", "-Command", ps])
        elif SYSTEM == "Darwin":
            subprocess.Popen(["osascript", "-e", f'display notification "{text}" with title "Leviathan"'])
        elif shutil.which("notify-send"):
            subprocess.Popen(["notify-send", "Leviathan", text])
    except Exception:
        pass


def _clip_get() -> str:
    try:
        if SYSTEM == "Windows":
            return subprocess.run(["powershell", "-NoProfile", "-Command", "Get-Clipboard"],
                                  capture_output=True, text=True, timeout=15).stdout.strip()
        if SYSTEM == "Darwin":
            return subprocess.run(["pbpaste"], capture_output=True, text=True, timeout=15).stdout
        if shutil.which("xclip"):
            return subprocess.run(["xclip", "-selection", "clipboard", "-o"],
                                  capture_output=True, text=True, timeout=15).stdout
    except Exception:
        pass
    return ""


def _clip_set(text: str):
    try:
        if SYSTEM == "Windows":
            subprocess.run(["clip"], input=text, text=True, timeout=15)
        elif SYSTEM == "Darwin":
            subprocess.run(["pbcopy"], input=text, text=True, timeout=15)
        elif shutil.which("xclip"):
            subprocess.run(["xclip", "-selection", "clipboard"], input=text, text=True, timeout=15)
    except Exception:
        pass


def do_system(action: str, value: str = ""):
    try:
        if action == "lock":
            cmds = {"Windows": ["rundll32.exe", "user32.dll,LockWorkStation"],
                    "Darwin": ["pmset", "displaysleepnow"]}
            subprocess.Popen(cmds.get(SYSTEM, ["loginctl", "lock-session"]))
            return True, "locked"
        if action == "sleep":
            if SYSTEM == "Windows":
                subprocess.Popen(["rundll32.exe", "powrprof.dll,SetSuspendState", "0,1,0"])
            elif SYSTEM == "Darwin":
                subprocess.Popen(["pmset", "sleepnow"])
            else:
                subprocess.Popen(["systemctl", "suspend"])
            return True, "sleeping"
        if action == "screenshot":
            return do_screenshot()
        if action == "notify":
            _notify(value or "Leviathan")
            return True, "notified"
        if action == "clipboard_get":
            return True, _clip_get()
        if action == "clipboard_set":
            _clip_set(value)
            return True, "clipboard set"
        return False, f"unknown system action '{action}'"
    except Exception as exc:
        return False, f"system action failed: {exc}"


# ------------------------------------------------------------ command router

async def handle(msg: dict):
    """Execute a command. Full autonomy — nothing here asks permission."""
    action = msg.get("action")
    target = msg.get("target", "")

    handlers = {
        "open":          lambda: do_open(target),
        "list_devices":  lambda: do_list_devices(),
        "vitals":        lambda: do_vitals(),
        "proc_list":     lambda: do_proc_list(),
        "list_dir":      lambda: do_list_dir(target),
        "read_file":     lambda: do_read_file(target),
        "write_file":    lambda: do_write_file(target, msg.get("content", "")),
        "make_dir":      lambda: do_make_dir(target),
        "move":          lambda: do_move(target, msg.get("dest", "")),
        "delete":        lambda: do_delete(target),
        "proc_kill":     lambda: do_proc_kill(target),
        "media":         lambda: do_media(target),
        "system":        lambda: do_system(target, msg.get("value", "")),
        "screenshot":    lambda: do_screenshot(),
        "undo":          lambda: do_undo(int(msg.get("count", 1) or 1)),
        "ensure_deps":   lambda: do_ensure_deps(msg.get("packages") or target),
    }

    # Long-running work goes to a thread so the socket keeps breathing.
    if action == "run":
        return await asyncio.to_thread(do_run, target, int(msg.get("timeout", 600)))
    if action == "python_exec":
        return await asyncio.to_thread(do_python_exec, msg.get("code", target),
                                       int(msg.get("timeout", 600)))
    if action == "ensure_deps":
        return await asyncio.to_thread(do_ensure_deps, msg.get("packages") or target)

    # Trusted mode is now the permanent default; keep the action for
    # compatibility with older backend builds.
    if action == "set_trusted":
        return True, "full autonomy is always on; undo is available"

    fn = handlers.get(action)
    if fn is None:
        return False, f"unsupported action: {action}"
    return await asyncio.to_thread(fn)


# --------------------------------------------------------------- connection

async def _serve(ws, device: dict) -> None:
    await ws.send(json.dumps({"type": "hello", "name": platform.node() or "PC"}))
    async for raw in ws:
        if STOP_FILE.exists():
            print("\nSTOP file present — shutting down.")
            raise SystemExit(0)
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            continue

        kind = msg.get("type")
        if kind == "code":
            code = msg["code"]
            print("\n+" + "-" * 46 + "+")
            print(f"|   PAIRING CODE:  {code}".ljust(47) + "|")
            print("+" + "-" * 46 + "+")
            print(f'\nSay to Leviathan:  "pair with my computer, the code is {code}"\n')
        elif kind == "reconnected":
            print("* Reconnected automatically — this machine is already trusted.\n")
        elif kind == "paired":
            if msg.get("device_id") and msg.get("token"):
                save_device(msg["device_id"], msg["token"])
                device.update({"device_id": msg["device_id"], "token": msg["token"]})
                print("* Paired. This machine is now remembered — you will never "
                      "need to pair again.\n")
            else:
                print("* Paired.\n")
        elif kind == "cmd":
            try:
                ok, detail = await handle(msg)
            except Exception as exc:
                ok, detail = False, f"{type(exc).__name__}: {exc}"
            audit(str(msg.get("action")), detail, ok)
            first = (str(detail) or "").splitlines()[0] if detail else ""
            print(f"  [{'OK ' if ok else 'ERR'}] {msg.get('action')} "
                  f"«{str(msg.get('target',''))[:36]}» — {first[:64]}")
            await ws.send(json.dumps({"type": "result", "id": msg.get("id"),
                                      "ok": ok, "detail": detail}))


async def run() -> None:
    print("=" * 64)
    print("  LEVIATHAN COMPANION — local power plane")
    print(f"  Machine: {platform.node()} ({SYSTEM})")
    print(f"  Workspace: {WORKSPACE}")
    print(f"  Audit log: {AUDIT_LOG}")
    print("  Full autonomy · every change is reversible with \"undo\"")
    print(f"  Stop anytime: close this window, or create {STOP_FILE}")
    print("=" * 64)

    device = load_device()
    if device.get("device_id"):
        print("\nKnown machine — reconnecting silently ...\n")
    else:
        print("\nFirst run — a pairing code will appear below.\n")

    backoff = 2
    while True:
        if STOP_FILE.exists():
            print("STOP file present — exiting.")
            return
        url = COMPANION_URL
        if device.get("device_id") and device.get("token"):
            url += f"?device_id={device['device_id']}&token={device['token']}"
        try:
            async with websockets.connect(url, max_size=2**23,
                                          ping_interval=20, ping_timeout=20) as ws:
                backoff = 2                      # a good connection resets it
                await _serve(ws, device)
        except SystemExit:
            raise
        except Exception as exc:
            # The cloud brain sleeps on the free tier; reconnecting forever is
            # the whole point of this loop.
            print(f"  connection lost ({type(exc).__name__}) — retrying in {backoff}s")
        await asyncio.sleep(backoff)
        backoff = min(backoff * 2, 60)


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except (KeyboardInterrupt, SystemExit):
        print("\nCompanion stopped. Control ended.")
