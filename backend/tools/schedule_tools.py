"""Proactive tools — reminders, daily routines, and a daily briefing.
Leviathan acts on its own: it delivers reminders aloud, and routines run
the full tool loop at their time (so a 'morning brief' actually searches
and speaks)."""
from datetime import datetime, timedelta

from scheduling import manager


def _parse_hhmm(at_time: str):
    at = at_time.strip().lower().replace(".", ":")
    # accept "8", "8am", "8:30", "20:00", "8 pm"
    ampm = None
    if "am" in at:
        ampm, at = "am", at.replace("am", "").strip()
    elif "pm" in at:
        ampm, at = "pm", at.replace("pm", "").strip()
    parts = at.split(":")
    try:
        hh = int(parts[0])
        mm = int(parts[1]) if len(parts) > 1 else 0
    except ValueError:
        return None
    if ampm == "pm" and hh < 12:
        hh += 12
    if ampm == "am" and hh == 12:
        hh = 0
    if not (0 <= hh < 24 and 0 <= mm < 60):
        return None
    return f"{hh:02d}:{mm:02d}"


async def set_reminder(session, text: str, in_minutes: int = None,
                       at_time: str = None) -> dict:
    """Remind the user once. Give in_minutes OR at_time (HH:MM)."""
    text = (text or "").strip()
    if not text:
        return {"error": "what should I remind you about?"}
    n = manager.now()
    if in_minutes is not None:
        try:
            fire_at = n + timedelta(minutes=float(in_minutes))
        except (TypeError, ValueError):
            return {"error": "in_minutes must be a number"}
    elif at_time:
        hhmm = _parse_hhmm(at_time)
        if not hhmm:
            return {"error": f"couldn't read the time '{at_time}'"}
        hh, mm = map(int, hhmm.split(":"))
        fire_at = n.replace(hour=hh, minute=mm, second=0, microsecond=0)
        if fire_at <= n:
            fire_at += timedelta(days=1)  # next occurrence
    else:
        return {"error": "say when — in_minutes or at_time"}
    await manager.add_reminder(text, fire_at)
    return {"status": f"reminder set for {fire_at.strftime('%H:%M')} — "
            f"I'll tell you: {text}"}


async def set_routine(session, instruction: str, at_time: str) -> dict:
    """Run an instruction every day at at_time (e.g. a morning briefing).
    The instruction runs as if the user said it, so tools fire and the
    result is spoken."""
    instruction = (instruction or "").strip()
    if not instruction:
        return {"error": "what should the routine do?"}
    hhmm = _parse_hhmm(at_time or "")
    if not hhmm:
        return {"error": f"couldn't read the time '{at_time}'"}
    await manager.add_routine(instruction, hhmm)
    return {"status": f"daily routine set for {hhmm}: {instruction}"}


async def list_schedules(session) -> dict:
    """List active reminders and routines."""
    items = manager.active()
    if not items:
        return {"schedules": "nothing scheduled"}
    lines = []
    for it in items:
        if it["kind"] == "reminder":
            when = it["fire_at"][11:16]
            lines.append(f"reminder @ {when}: {it['text']} (id {it['id']})")
        else:
            lines.append(f"daily @ {it['at_time']}: {it['text']} (id {it['id']})")
    return {"schedules": lines}


async def cancel_schedule(session, which: str) -> dict:
    """Cancel by id, matching text, or 'all'."""
    removed = await manager.cancel(which)
    return {"status": f"cancelled {removed} item(s)" if removed
            else "nothing matched"}
