"""Persistence for schedules (reminders + routines).

Survives backend restarts: on Supabase it uses a tiny app_state(key,value)
table; without Supabase it falls back to a local JSON file. Personal-scale
data, so the whole list is loaded, mutated in memory, and saved on change.
"""
import json
from pathlib import Path

from config import settings

DATA = Path(__file__).resolve().parent.parent / "data"
DATA.mkdir(exist_ok=True)
FILE = DATA / "schedules.json"
KEY = "schedules_v1"


async def _ensure_table(conn):
    await conn.execute(
        "CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT)"
    )


async def load() -> list[dict]:
    if settings.supabase_db_url:
        from brain import memory

        pool = await memory._pg_pool()
        async with pool.acquire() as conn:
            await _ensure_table(conn)
            row = await conn.fetchrow("SELECT value FROM app_state WHERE key=$1", KEY)
            return json.loads(row["value"]) if row and row["value"] else []
    if FILE.exists():
        try:
            return json.loads(FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return []
    return []


async def save(items: list[dict]) -> None:
    payload = json.dumps(items, ensure_ascii=False)
    if settings.supabase_db_url:
        from brain import memory

        pool = await memory._pg_pool()
        async with pool.acquire() as conn:
            await _ensure_table(conn)
            await conn.execute(
                "INSERT INTO app_state(key, value) VALUES($1,$2) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                KEY, payload,
            )
        return
    FILE.write_text(payload, encoding="utf-8")
