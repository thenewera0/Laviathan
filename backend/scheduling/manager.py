"""Proactive scheduler — reminders and daily routines that fire on their
own and reach the user through a live session.

- reminders: fire once at an absolute time. If nobody is connected when it
  comes due, it's delivered the moment a session reconnects (never lost).
- routines: fire every day at HH:MM, injected as if the user asked it, so
  it runs the full tool loop and speaks the result (e.g. a morning brief).

Single-user model (like memory): delivery goes to the most recently
connected session. Times use LEVIATHAN_TZ (default Asia/Kolkata).
"""
import asyncio
import os
import uuid
from datetime import datetime

try:
    from zoneinfo import ZoneInfo
    TZ = ZoneInfo(os.getenv("LEVIATHAN_TZ", "Asia/Kolkata"))
except Exception:  # pragma: no cover
    TZ = None

from scheduling import store

_items: list[dict] = []
_sessions: list = []  # active BrainSessions, most-recent last
_started = False


def now() -> datetime:
    return datetime.now(TZ) if TZ else datetime.now()


def _target():
    return _sessions[-1] if _sessions else None


async def start():
    global _started, _items
    if _started:
        return
    _started = True
    try:
        _items = await store.load()  # a DB hiccup must never crash startup
    except Exception:
        _items = []
    asyncio.create_task(_loop())


async def register(session):
    _sessions.append(session)
    # deliver any reminder that came due while nobody was connected
    for it in _items:
        if it["kind"] == "reminder" and not it.get("done") and _due(it):
            await _fire(it, session)
    await _persist()


def unregister(session):
    if session in _sessions:
        _sessions.remove(session)


def _due(it: dict) -> bool:
    try:
        return now() >= datetime.fromisoformat(it["fire_at"])
    except (KeyError, ValueError):
        return False


async def _safe_save():
    try:
        await store.save(_items)
    except Exception:
        pass  # stays in memory this session; persists on the next change


async def _persist():
    # keep only active items (drop fired one-shot reminders)
    global _items
    _items = [i for i in _items if not (i["kind"] == "reminder" and i.get("done"))]
    await _safe_save()


async def _fire(it: dict, session) -> None:
    it["done"] = True  # reminders are one-shot
    if session is None:
        return
    try:
        if it["kind"] == "reminder":
            await session.send({"type": "announce",
                                "text": f"A reminder for you: {it['text']}"})
        else:  # routine — run the instruction through the normal loop
            await session.handle({"type": "user_text", "text": it["text"]})
    except Exception:
        it["done"] = False  # delivery failed; try again next tick


async def _loop():
    while True:
        await asyncio.sleep(25)
        try:
            target = _target()
            today = now().strftime("%Y-%m-%d")
            hhmm = now().strftime("%H:%M")
            changed = False
            for it in _items:
                if it["kind"] == "reminder" and not it.get("done") and _due(it):
                    await _fire(it, target); changed = True
                elif it["kind"] == "routine":
                    if it.get("at_time") == hhmm and it.get("last_fired") != today:
                        it["last_fired"] = today
                        if target is not None:
                            await session_route(it, target)
                        changed = True
            if changed:
                await _persist()
        except Exception:
            pass


async def session_route(it, target):
    try:
        await target.handle({"type": "user_text", "text": it["text"]})
    except Exception:
        pass


# ---------------------------------------------------------------- public API

async def add_reminder(text: str, fire_at: datetime) -> dict:
    it = {"id": uuid.uuid4().hex[:8], "kind": "reminder", "text": text,
          "fire_at": fire_at.isoformat(), "done": False,
          "created": now().isoformat()}
    _items.append(it)
    await _safe_save()
    return it


async def add_routine(text: str, at_time: str) -> dict:
    it = {"id": uuid.uuid4().hex[:8], "kind": "routine", "text": text,
          "at_time": at_time, "last_fired": None, "created": now().isoformat()}
    _items.append(it)
    await _safe_save()
    return it


def active() -> list[dict]:
    return [i for i in _items if not (i["kind"] == "reminder" and i.get("done"))]


async def cancel(match: str) -> int:
    global _items
    m = (match or "").lower().strip()
    before = len(_items)
    _items = [i for i in _items
              if not (m and (m in i["id"] or m in i["text"].lower() or m == "all"))]
    removed = before - len(_items)
    if removed:
        await store.save(_items)
    return removed
