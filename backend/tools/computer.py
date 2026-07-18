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
    result = await session.pc_exec("open", target)
    return result
