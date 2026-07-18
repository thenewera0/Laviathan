#!/usr/bin/env python3
"""Leviathan Companion — lets Leviathan act on THIS computer.

Run it on your PC, read the 6-digit code to Leviathan, and it can:
  • open folders, files, apps, and websites
  • write code and files into its workspace (~/Leviathan) and build projects
  • read files back (so it can fix its own code)
  • run terminal commands and file moves — WITH YOUR CONFIRMATION each time

Safety model (deliberate, and printed here so you can see it):
  • It connects OUT to Leviathan; nothing reaches into this PC uninvited.
  • Opening things and writing inside the workspace happen automatically —
    that is the IDE's home and building an app writes many files.
  • Anything RISKIER — running a terminal command, moving/overwriting files
    OUTSIDE the workspace — PAUSES and asks you to type 'y' here first.
  • Every action is printed in this window. Close it (Ctrl+C) to end control.

Setup:  pip install websockets
Run:    python leviathan_companion.py
"""
import asyncio
import json
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

try:
    import websockets
except ImportError:
    print("Missing dependency. Run:  pip install websockets")
    sys.exit(1)

BACKEND = os.getenv("LEVIATHAN_BACKEND", "wss://leviathan-core.onrender.com")
COMPANION_URL = BACKEND.rstrip("/") + "/companion"
SYSTEM = platform.system()  # 'Windows' | 'Darwin' | 'Linux'
WORKSPACE = Path.home() / "Leviathan"
WORKSPACE.mkdir(exist_ok=True)

APP_ALIASES = {
    "notepad": "notepad", "calculator": "calc" if SYSTEM == "Windows" else "gnome-calculator",
    "calc": "calc" if SYSTEM == "Windows" else "gnome-calculator", "paint": "mspaint",
    "explorer": "explorer", "cmd": "cmd", "task manager": "taskmgr",
    "spotify": "spotify", "chrome": "chrome", "edge": "msedge", "firefox": "firefox",
    "word": "winword", "excel": "excel", "vscode": "code", "vs code": "code", "code": "code",
}


def known_folders() -> dict[str, Path]:
    home = Path.home()
    return {
        "home": home, "downloads": home / "Downloads", "documents": home / "Documents",
        "desktop": home / "Desktop", "pictures": home / "Pictures",
        "music": home / "Music", "videos": home / "Videos",
        "workspace": WORKSPACE, "leviathan": WORKSPACE,
    }


async def confirm(prompt: str) -> bool:
    """Ask the human at THIS console. Runs in a thread so the socket lives."""
    print("\n" + "!" * 58)
    print(f"  LEVIATHAN WANTS TO: {prompt}")
    ans = await asyncio.to_thread(input, "  Allow this? [y/N] ")
    ok = ans.strip().lower() in ("y", "yes")
    print("  → " + ("ALLOWED" if ok else "DENIED") + "\n")
    return ok


def _resolve(path_str: str) -> Path:
    """Relative paths land in the workspace; ~ and env vars expand."""
    p = Path(os.path.expanduser(os.path.expandvars(path_str)))
    return p if p.is_absolute() else WORKSPACE / p


def _in_workspace(p: Path) -> bool:
    try:
        p.resolve().relative_to(WORKSPACE.resolve())
        return True
    except ValueError:
        return False


# ---------------------------------------------------------------- actions

def do_open(target: str) -> tuple[bool, str]:
    t = target.strip()
    low = t.lower()
    if low.startswith(("http://", "https://")):
        import webbrowser
        webbrowser.open(t)
        return True, f"opened url {t}"
    if "." in low and low.split(".")[-1] in ("com", "org", "net", "io", "ai", "dev", "app"):
        import webbrowser
        webbrowser.open("https://" + t)
        return True, f"opened url https://{t}"
    folders = known_folders()
    if low in folders:
        return _open_path(folders[low])
    p = _resolve(t)
    if p.exists():
        return _open_path(p)
    return _launch_app(t)


def _open_path(path: Path) -> tuple[bool, str]:
    if not path.exists():
        return False, f"path not found: {path}"
    if SYSTEM == "Windows":
        os.startfile(str(path))
    elif SYSTEM == "Darwin":
        subprocess.Popen(["open", str(path)])
    else:
        subprocess.Popen(["xdg-open", str(path)])
    return True, f"opened {path}"


def _launch_app(name: str) -> tuple[bool, str]:
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


def do_write_file(path_str: str, content: str) -> tuple[bool, str]:
    p = _resolve(path_str)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return True, f"wrote {p} ({len(content)} chars)"


def do_read_file(path_str: str) -> tuple[bool, str]:
    p = _resolve(path_str)
    if not p.exists():
        return False, f"not found: {p}"
    try:
        return True, p.read_text(encoding="utf-8")[:20000]
    except UnicodeDecodeError:
        return False, f"{p} is not text"


def do_make_dir(path_str: str) -> tuple[bool, str]:
    p = _resolve(path_str)
    p.mkdir(parents=True, exist_ok=True)
    return True, f"created folder {p}"


def do_list_dir(path_str: str) -> tuple[bool, str]:
    p = _resolve(path_str or "workspace")
    if not p.is_dir():
        return False, f"not a folder: {p}"
    entries = sorted(
        f"{'📁 ' if c.is_dir() else '   '}{c.name}" for c in p.iterdir()
    )
    return True, f"{p}:\n" + "\n".join(entries[:200])


def do_move(src_str: str, dst_str: str) -> tuple[bool, str]:
    src, dst = _resolve(src_str), _resolve(dst_str)
    if not src.exists():
        return False, f"source not found: {src}"
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(dst))
    return True, f"moved {src} -> {dst}"


def do_run(command: str) -> tuple[bool, str]:
    try:
        proc = subprocess.run(
            command, shell=True, capture_output=True, text=True,
            timeout=120, cwd=str(WORKSPACE),
        )
        out = (proc.stdout or "")[-6000:]
        err = (proc.stderr or "")[-2000:]
        detail = f"exit {proc.returncode}\n{out}"
        if err:
            detail += f"\n[stderr]\n{err}"
        return proc.returncode == 0, detail
    except subprocess.TimeoutExpired:
        return False, "command timed out after 120s"


# --------------------------------------------------------- command router

async def handle(msg: dict) -> tuple[bool, str]:
    action = msg.get("action")
    target = msg.get("target", "")

    if action == "open":
        return do_open(target)

    if action == "write_file":
        p = _resolve(target)
        if not _in_workspace(p):
            if not await confirm(f"write file OUTSIDE workspace: {p}"):
                return False, "denied by user"
        return do_write_file(target, msg.get("content", ""))

    if action == "make_dir":
        p = _resolve(target)
        if not _in_workspace(p) and not await confirm(f"create folder: {p}"):
            return False, "denied by user"
        return do_make_dir(target)

    if action == "read_file":
        p = _resolve(target)
        if not _in_workspace(p) and not await confirm(f"read file: {p}"):
            return False, "denied by user"
        return do_read_file(target)

    if action == "list_dir":
        return do_list_dir(target)

    if action == "move":
        if not await confirm(f"move «{target}» → «{msg.get('dest', '')}»"):
            return False, "denied by user"
        return do_move(target, msg.get("dest", ""))

    if action == "run":
        if not await confirm(f"run terminal command: {target}"):
            return False, "denied by user"
        return do_run(target)

    return False, f"unsupported action: {action}"


async def run() -> None:
    print("=" * 60)
    print("  LEVIATHAN COMPANION")
    print(f"  Workspace (auto-writable): {WORKSPACE}")
    print("  Opening & workspace writes: automatic")
    print("  Terminal commands & outside moves: ask you first (type y)")
    print("  Close this window to end all control.")
    print("=" * 60)
    print(f"\nConnecting to {COMPANION_URL} ...\n")

    async with websockets.connect(COMPANION_URL, max_size=2**22) as ws:
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if msg.get("type") == "code":
                print("+" + "-" * 42 + "+")
                print(f"|   PAIRING CODE:  {msg['code']}                   |")
                print("+" + "-" * 42 + "+")
                print(f'\nSay: "pair with my computer, the code is {msg["code"]}"\n')
            elif msg.get("type") == "paired":
                print("* Paired. Leviathan can now act on this PC.\n")
            elif msg.get("type") == "cmd":
                try:
                    ok, detail = await handle(msg)
                except Exception as exc:
                    ok, detail = False, f"{type(exc).__name__}: {exc}"
                mark = "OK " if ok else "ERR"
                first = detail.splitlines()[0] if detail else ""
                print(f"  [{mark}] {msg.get('action')} «{msg.get('target','')[:50]}» — {first[:80]}")
                await ws.send(json.dumps(
                    {"type": "result", "id": msg.get("id"), "ok": ok, "detail": detail}
                ))


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\nCompanion stopped. Control ended.")
    except Exception as exc:
        print(f"\nDisconnected: {exc}\nRestart to reconnect.")
