#!/usr/bin/env python3
"""Leviathan Companion — lets Leviathan open things on THIS computer.

Run it on your PC, read the 6-digit code to Leviathan ("pair with my
computer, the code is ..."), and then say things like "open my Downloads
folder" or "launch Notepad".

Safety, by design:
- It connects OUT to Leviathan; nothing can reach into this PC uninvited.
- It ONLY opens folders, files, apps, and URLs. It does NOT run arbitrary
  shell commands and will NOT delete or modify anything.
- Every action it performs is printed here, in plain sight.
- Close this window (Ctrl+C) and all control ends instantly.

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

# Friendly names -> what to actually open. Extend freely.
APP_ALIASES = {
    "notepad": "notepad",
    "calculator": "calc" if SYSTEM == "Windows" else "gnome-calculator",
    "calc": "calc" if SYSTEM == "Windows" else "gnome-calculator",
    "paint": "mspaint",
    "explorer": "explorer",
    "files": "explorer" if SYSTEM == "Windows" else "xdg-open",
    "cmd": "cmd",
    "terminal": "cmd" if SYSTEM == "Windows" else "x-terminal-emulator",
    "task manager": "taskmgr",
    "settings": "start ms-settings:" if SYSTEM == "Windows" else "",
    "spotify": "spotify",
    "chrome": "chrome",
    "edge": "msedge",
    "firefox": "firefox",
    "word": "winword",
    "excel": "excel",
    "vscode": "code",
    "vs code": "code",
    "code": "code",
}

# Common folders by spoken name
def known_folders() -> dict[str, Path]:
    home = Path.home()
    return {
        "home": home,
        "downloads": home / "Downloads",
        "documents": home / "Documents",
        "desktop": home / "Desktop",
        "pictures": home / "Pictures",
        "music": home / "Music",
        "videos": home / "Videos",
    }


def _open_path(path: Path) -> tuple[bool, str]:
    if not path.exists():
        return False, f"path not found: {path}"
    if SYSTEM == "Windows":
        os.startfile(str(path))  # noqa: S606 — opens with the default handler
    elif SYSTEM == "Darwin":
        subprocess.Popen(["open", str(path)])
    else:
        subprocess.Popen(["xdg-open", str(path)])
    return True, f"opened {path}"


def _open_url(url: str) -> tuple[bool, str]:
    import webbrowser

    webbrowser.open(url)
    return True, f"opened url {url}"


def _launch_app(name: str) -> tuple[bool, str]:
    key = name.lower().strip()
    cmd = APP_ALIASES.get(key, key)
    if not cmd:
        return False, f"don't know how to open '{name}'"
    try:
        if SYSTEM == "Windows":
            # 'start' resolves apps on PATH and registered app names
            subprocess.Popen(f'start "" {cmd}', shell=True)
        elif SYSTEM == "Darwin":
            subprocess.Popen(["open", "-a", cmd])
        else:
            if shutil.which(cmd):
                subprocess.Popen([cmd])
            else:
                return False, f"'{name}' is not installed or not on PATH"
        return True, f"launched {name}"
    except OSError as exc:
        return False, f"could not launch {name}: {exc}"


def handle_open(target: str) -> tuple[bool, str]:
    t = target.strip()
    low = t.lower()

    if low.startswith(("http://", "https://")):
        return _open_url(t)
    if "." in low and low.split(".")[-1] in ("com", "org", "net", "io", "ai", "dev"):
        return _open_url("https://" + t)

    folders = known_folders()
    if low in folders:
        return _open_path(folders[low])

    p = Path(os.path.expanduser(os.path.expandvars(t)))
    if p.exists():
        return _open_path(p)

    return _launch_app(t)


async def run() -> None:
    print("=" * 58)
    print("  LEVIATHAN COMPANION")
    print("  This lets Leviathan OPEN folders, files, apps, and sites")
    print("  on this PC. It cannot run shell commands or delete anything.")
    print("  Close this window to end all control.")
    print("=" * 58)
    print(f"\nConnecting to {COMPANION_URL} ...\n")

    async with websockets.connect(COMPANION_URL, max_size=2**20) as ws:
        paired = False
        async for raw in ws:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if msg.get("type") == "code":
                print("╔" + "═" * 40 + "╗")
                print(f"║   PAIRING CODE:  {msg['code']}                 ║")
                print("╚" + "═" * 40 + "╝")
                print('\nTell Leviathan: "pair with my computer, the code'
                      f' is {msg["code"]}"\n')

            elif msg.get("type") == "paired":
                paired = True
                print("✓ Paired. Leviathan can now open things here.\n")

            elif msg.get("type") == "cmd":
                action = msg.get("action")
                target = msg.get("target", "")
                if action == "open":
                    ok, detail = handle_open(target)
                else:
                    ok, detail = False, f"unsupported action: {action}"
                mark = "✓" if ok else "✗"
                print(f"  {mark} open «{target}» — {detail}")
                await ws.send(json.dumps(
                    {"type": "result", "id": msg.get("id"), "ok": ok, "detail": detail}
                ))
        if not paired:
            print("Connection closed before pairing.")


if __name__ == "__main__":
    try:
        asyncio.run(run())
    except KeyboardInterrupt:
        print("\nCompanion stopped. Control ended.")
    except Exception as exc:
        print(f"\nDisconnected: {exc}\nRestart to reconnect.")
