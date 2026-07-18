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
    session.companion = entry
    try:
        import json

        await entry["ws"].send_text(json.dumps({"type": "paired"}))
    except Exception:
        return {"error": "that companion just disconnected — restart it"}
    await session.send({"type": "companion", "status": "online"})
    return {
        "status": "paired with the user's PC. You can now open folders, "
        "files, applications, and URLs on it with pc_open."
    }


async def pc_open(session, target: str) -> dict:
    return await session.pc_exec("open", target)


async def write_file(session, path: str, content: str) -> dict:
    """Write one file to the PC (workspace-relative unless absolute)."""
    res = await session.pc_exec("write_file", path, content=content)
    if "detail" in res or res.get("ok"):
        await session.send({
            "type": "action", "action": "show_code",
            "files": [{"path": path, "content": content}], "project": None,
        })
    return res


async def write_project(session, name: str, files: list) -> dict:
    """Write a whole project (many files) into ~/Leviathan/<name> and show
    it in the code panel. files: [{path, content}, ...] with paths RELATIVE
    to the project folder."""
    if not isinstance(files, list) or not files:
        return {"error": "files must be a non-empty list of {path, content}"}
    written = []
    for f in files:
        rel = str(f.get("path", "")).lstrip("/\\")
        content = f.get("content", "")
        if not rel:
            continue
        full = f"{name}/{rel}"
        res = await session.pc_exec("write_file", full, content=content)
        if res.get("error"):
            return {"error": f"failed writing {full}: {res['error']}"}
        written.append({"path": rel, "content": content})
    await session.send({
        "type": "action", "action": "show_code",
        "project": name, "files": written,
    })
    return {
        "status": f"wrote {len(written)} files into the '{name}' project on "
        "the user's PC and showed the code on screen. Offer to open or "
        "preview it next.",
        "files": [w["path"] for w in written],
    }


async def read_path(session, path: str) -> dict:
    """Read a file (to inspect or fix it) or list a folder."""
    if path.rstrip("/\\").split("/")[-1].count(".") == 0 and not path.endswith(
        (".", "/")
    ):
        # no extension -> treat as folder listing
        res = await session.pc_exec("list_dir", path)
    else:
        res = await session.pc_exec("read_file", path)
    return res


async def run_command(session, command: str) -> dict:
    """Run a terminal command on the PC — the companion asks the user to
    confirm before it executes."""
    return await session.pc_exec("run", command)


async def preview_project(session, name: str) -> dict:
    """Open a web project's index.html in the PC's browser as a preview."""
    return await session.pc_exec("open", f"{name}/index.html")
