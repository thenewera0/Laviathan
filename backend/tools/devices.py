"""Device powers — Leviathan sees and operates the user's OWN paired PCs
and their local network, through the companion agent. All consensual:
the companion runs on machines the user controls, and state-changing
actions are guarded (confirm-first, or trusted mode) on the companion.

Every tool takes an optional `device` (hostname). Omit it to act on all
paired devices at once; name one to target it.
"""
import json


async def list_network_devices(session, device: str = None) -> dict:
    """Devices on the user's local network (read-only ARP neighbour list)."""
    return await session.pc_exec("list_devices", "", device=device)


async def device_vitals(session, device: str = None) -> dict:
    """Live CPU/RAM/disk/battery/uptime for the paired PC(s). Also feeds
    the dashboard Core Vitals with real numbers."""
    res = await session.pc_exec("vitals", "", device=device)
    # push real vitals to the on-screen dashboard where possible
    detail = res.get("detail") if isinstance(res, dict) else None
    if isinstance(detail, str):
        try:
            await session.send({"type": "vitals", "device": res.get("device"),
                                "data": json.loads(detail)})
        except (json.JSONDecodeError, Exception):
            pass
    # fan-out shape (multiple devices)
    if isinstance(res, dict) and "results" in res:
        for name, r in res["results"].items():
            if isinstance(r, dict) and isinstance(r.get("detail"), str):
                try:
                    await session.send({"type": "vitals", "device": name,
                                        "data": json.loads(r["detail"])})
                except Exception:
                    pass
    return res


async def control_media(session, action: str, device: str = None) -> dict:
    """Media keys: play_pause | next | prev | vol_up | vol_down | mute."""
    return await session.pc_exec("media", action, device=device)


async def system_action(session, action: str, value: str = "", device: str = None) -> dict:
    """OS actions: lock | sleep | screenshot | notify | clipboard_get |
    clipboard_set. lock/sleep/clipboard_set are guarded on the companion."""
    return await session.pc_exec("system", action, value=value, device=device)


async def list_processes(session, device: str = None) -> dict:
    """Top running processes by memory on the paired PC(s)."""
    return await session.pc_exec("proc_list", "", device=device)


async def kill_process(session, name: str, device: str = None) -> dict:
    """Terminate processes matching a name (guarded/confirm-first)."""
    return await session.pc_exec("proc_kill", name, device=device)


async def set_trusted(session, on: bool = True, device: str = None) -> dict:
    """Turn trusted mode on/off — when on, state-changing actions run
    without a per-action confirm on that device for this session."""
    return await session.pc_exec("set_trusted", "on" if on else "off", device=device)
