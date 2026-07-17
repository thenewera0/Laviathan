"""Long-term memory — embed -> store -> cosine top-k recall.

Two interchangeable backends behind the same three functions:
- Supabase Postgres + pgvector when SUPABASE_DB_URL is set (deployment;
  use the SESSION POOLER connection string — the direct host is
  IPv6-only and unreachable from most hosts including Render free).
- Local SQLite otherwise (backend/data/memory.db, gitignored).

Embeddings come from Gemini; without a Gemini key, recall degrades to
keyword-overlap scoring so memory still functions.
"""
import asyncio
import json
import math
import re
import sqlite3
import time
from pathlib import Path

import httpx

from config import settings

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / "memory.db"

EMBED_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "gemini-embedding-001:embedContent"
)
EMBED_DIM = 768
DEDUPE_SIMILARITY = 0.92  # near-duplicates update instead of accumulating


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            embedding TEXT,           -- json array or NULL (keyword mode)
            created_at REAL NOT NULL,
            last_used REAL NOT NULL
        )"""
    )
    return conn


async def _embed(text: str) -> list[float] | None:
    if not settings.gemini_api_key:
        return None
    payload = {
        "content": {"parts": [{"text": text[:4000]}]},
        "outputDimensionality": EMBED_DIM,
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                EMBED_URL,
                headers={"x-goog-api-key": settings.gemini_api_key},
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()["embedding"]["values"]
    except (httpx.HTTPError, KeyError):
        return None


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0


def _keyword_score(query: str, text: str) -> float:
    q = set(re.findall(r"[a-z0-9']+", query.lower()))
    t = set(re.findall(r"[a-z0-9']+", text.lower()))
    return len(q & t) / len(q) if q else 0.0


def _rows() -> list[tuple]:
    def _read():
        with _connect() as conn:
            return conn.execute(
                "SELECT id, text, embedding FROM memories"
            ).fetchall()

    return _read()


# ------------------------------------------------------- pgvector backend

_pool = None
_pool_lock = None


async def _pg_pool():
    global _pool, _pool_lock
    import asyncio as _aio

    import asyncpg

    if _pool_lock is None:
        _pool_lock = _aio.Lock()
    async with _pool_lock:
        if _pool is None:
            _pool = await asyncpg.create_pool(
                settings.supabase_db_url, min_size=0, max_size=2,
                ssl="require", command_timeout=30,
            )
    return _pool


def _vec(emb: list[float]) -> str:
    return "[" + ",".join(f"{x:.7g}" for x in emb) + "]"


async def _pg_remember(text: str, emb: list[float] | None) -> str:
    pool = await _pg_pool()
    async with pool.acquire() as conn:
        if emb:
            row = await conn.fetchrow(
                "SELECT id, 1 - (embedding <=> $1::vector) AS sim FROM memories "
                "WHERE embedding IS NOT NULL ORDER BY embedding <=> $1::vector LIMIT 1",
                _vec(emb),
            )
            if row and row["sim"] >= DEDUPE_SIMILARITY:
                await conn.execute(
                    "UPDATE memories SET text=$1, embedding=$2::vector, last_used=now() WHERE id=$3",
                    text, _vec(emb), row["id"],
                )
                return "refreshed an existing memory"
        await conn.execute(
            "INSERT INTO memories (text, embedding) VALUES ($1, $2::vector)",
            text, _vec(emb) if emb else None,
        )
        return "remembered"


async def _pg_recall(query: str, k: int, min_score: float) -> list[str]:
    pool = await _pg_pool()
    q_emb = await _embed(query)
    async with pool.acquire() as conn:
        if q_emb:
            rows = await conn.fetch(
                "SELECT id, text, 1 - (embedding <=> $1::vector) AS score FROM memories "
                "WHERE embedding IS NOT NULL ORDER BY embedding <=> $1::vector LIMIT $2",
                _vec(q_emb), k,
            )
            picked = [(r["id"], r["text"]) for r in rows if r["score"] >= min_score]
        else:
            rows = await conn.fetch("SELECT id, text FROM memories")
            scored = sorted(
                ((_keyword_score(query, r["text"]), r["id"], r["text"]) for r in rows),
                reverse=True,
            )
            picked = [(mid, t) for s, mid, t in scored[:k] if s >= 0.25]
        if picked:
            await conn.execute(
                "UPDATE memories SET last_used=now() WHERE id = ANY($1::bigint[])",
                [mid for mid, _ in picked],
            )
    return [t for _, t in picked]


async def _pg_count() -> int:
    pool = await _pg_pool()
    async with pool.acquire() as conn:
        return await conn.fetchval("SELECT COUNT(*) FROM memories")


# ------------------------------------------------------------- public API

async def remember(text: str) -> str:
    """Store one durable fact. Near-duplicates refresh the existing row."""
    text = text.strip()
    if not text:
        return "nothing to remember"
    emb = await _embed(text)
    if settings.supabase_db_url:
        return await _pg_remember(text, emb)

    def _write() -> str:
        with _connect() as conn:
            now = time.time()
            if emb:
                for mid, _mtext, memb in conn.execute(
                    "SELECT id, text, embedding FROM memories WHERE embedding IS NOT NULL"
                ).fetchall():
                    if _cosine(emb, json.loads(memb)) >= DEDUPE_SIMILARITY:
                        conn.execute(
                            "UPDATE memories SET text=?, embedding=?, last_used=? WHERE id=?",
                            (text, json.dumps(emb), now, mid),
                        )
                        return "refreshed an existing memory"
            conn.execute(
                "INSERT INTO memories (text, embedding, created_at, last_used) VALUES (?,?,?,?)",
                (text, json.dumps(emb) if emb else None, now, now),
            )
            return "remembered"

    return await asyncio.to_thread(_write)


async def recall(query: str, k: int = 4, min_score: float = 0.35) -> list[str]:
    """Top-k memories relevant to the query."""
    if settings.supabase_db_url:
        return await _pg_recall(query, k, min_score)
    rows = await asyncio.to_thread(_rows)
    if not rows:
        return []
    q_emb = await _embed(query)

    scored: list[tuple[float, int, str]] = []
    for mid, text, emb_json in rows:
        if q_emb and emb_json:
            score = _cosine(q_emb, json.loads(emb_json))
        else:
            score = _keyword_score(query, text)
            min_score = min(min_score, 0.25)
        scored.append((score, mid, text))
    scored.sort(reverse=True)

    picked = [(mid, text) for score, mid, text in scored[:k] if score >= min_score]
    if picked:
        def _touch():
            with _connect() as conn:
                conn.executemany(
                    "UPDATE memories SET last_used=? WHERE id=?",
                    [(time.time(), mid) for mid, _ in picked],
                )

        await asyncio.to_thread(_touch)
    return [text for _, text in picked]


async def count() -> int:
    if settings.supabase_db_url:
        return await _pg_count()

    def _count():
        with _connect() as conn:
            return conn.execute("SELECT COUNT(*) FROM memories").fetchone()[0]

    return await asyncio.to_thread(_count)
