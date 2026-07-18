"""pair_computer / pc_open — control of the user's OWN PC through the
companion agent they run on it.

Scope is deliberate: open folders, files, applications, URLs. Arbitrary
shell execution is excluded — a voice loop misheard once should never be
able to delete a directory. The companion prints every action it takes.
"""
from linking import companions


async def pair_computer(session, code: str) -> dict:
    entry = companions.get(code)
    if entry is None:
        return {
            "error": "no companion with that code. The user must run the "
            "companion on their PC (python companion/leviathan_companion.py) "
            "and read you the 6-digit code it prints."
        }
    entry["session"] = session
    name = str(entry.get("name") or "PC")
    # unique key if two devices share a hostname
    key = name.lower()
    n = 2
    while key in session.devices and session.devices[key] is not entry:
        key = f"{name.lower()} {n}"
        n += 1
    session.devices[key] = entry
    try:
        import json

        await entry["ws"].send_text(json.dumps({"type": "paired"}))
    except Exception:
        session.devices.pop(key, None)
        return {"error": "that companion just disconnected — restart it"}
    await session._broadcast_devices()
    return {
        "status": f"paired with '{name}'. Devices now paired: "
        + ", ".join(session.device_names())
        + ". Target one device by name, or omit the device to act on ALL "
        "of them at once."
    }


async def pc_open(session, target: str, device: str = None) -> dict:
    return await session.pc_exec("open", target, device=device)


async def write_file(session, path: str, content: str, device: str = None) -> dict:
    """Write one file to the PC (workspace-relative unless absolute)."""
    res = await session.pc_exec("write_file", path, content=content, device=device)
    await session.send({
        "type": "action", "action": "show_code",
        "files": [{"path": path, "content": content}], "project": None,
    })
    return res


async def write_project(session, name: str, files: list, device: str = None) -> dict:
    """Write a whole project (many files) into ~/Leviathan/<name> and show
    it in the code panel."""
    if not isinstance(files, list) or not files:
        return {"error": "files must be a non-empty list of {path, content}"}
    written = []
    for f in files:
        rel = str(f.get("path", "")).lstrip("/\\")
        content = f.get("content", "")
        if not rel:
            continue
        res = await session.pc_exec(
            "write_file", f"{name}/{rel}", content=content, device=device)
        if res.get("error"):
            return {"error": f"failed writing {name}/{rel}: {res['error']}"}
        written.append({"path": rel, "content": content})
    await session.send({
        "type": "action", "action": "show_code",
        "project": name, "files": written,
    })
    return {
        "status": f"wrote {len(written)} files into the '{name}' project"
        + (f" on {device}" if device else " on the user's PC")
        + " and showed the code on screen. Offer to preview or run it next.",
        "files": [w["path"] for w in written],
    }


async def read_path(session, path: str, device: str = None) -> dict:
    """Read a file (to inspect or fix it) or list a folder."""
    leaf = path.rstrip("/\\").split("/")[-1]
    if leaf.count(".") == 0 and not path.endswith((".", "/")):
        return await session.pc_exec("list_dir", path, device=device)
    return await session.pc_exec("read_file", path, device=device)


async def run_command(session, command: str, device: str = None) -> dict:
    """Run a terminal command on the PC(s) — companion asks to confirm."""
    return await session.pc_exec("run", command, device=device)


async def preview_project(session, name: str, device: str = None) -> dict:
    """Open a web project's index.html in the PC's browser as a preview."""
    return await session.pc_exec("open", f"{name}/index.html", device=device)
