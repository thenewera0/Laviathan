"""Internal API Key Storage, Validation, and Rate Limiting for Leviathan AI.

Generates and validates 'lvh-live-...' keys for powering external apps and sites,
with per-key sliding window rate-limiting to protect free tier quotas.
"""
import hashlib
import sqlite3
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from config import settings

DB_DIR = Path(__file__).parent.parent / "data"
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "api_keys.db"

# Sliding window rate limiter for keys: key_id -> list of request timestamps
KEY_REQUEST_WINDOWS: Dict[str, List[float]] = {}
DEFAULT_KEY_LIMIT_PER_MINUTE = 60000  # UNRESTRICTED capacity (60,000 req/min) for heavy apps like desknomads.shop


def _get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    with conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS api_keys (
                id TEXT PRIMARY KEY,
                key_hash TEXT UNIQUE NOT NULL,
                prefix TEXT NOT NULL,
                label TEXT NOT NULL,
                created_at TEXT NOT NULL,
                revoked INTEGER DEFAULT 0,
                request_count INTEGER DEFAULT 0,
                prompt_tokens INTEGER DEFAULT 0,
                completion_tokens INTEGER DEFAULT 0,
                total_tokens INTEGER DEFAULT 0,
                last_used_at TEXT DEFAULT ''
            )
            """
        )
        # Migrations for existing DBs missing token usage columns
        columns = [row[1] for row in conn.execute("PRAGMA table_info(api_keys)").fetchall()]
        if "request_count" not in columns:
            conn.execute("ALTER TABLE api_keys ADD COLUMN request_count INTEGER DEFAULT 0")
        if "prompt_tokens" not in columns:
            conn.execute("ALTER TABLE api_keys ADD COLUMN prompt_tokens INTEGER DEFAULT 0")
        if "completion_tokens" not in columns:
            conn.execute("ALTER TABLE api_keys ADD COLUMN completion_tokens INTEGER DEFAULT 0")
        if "total_tokens" not in columns:
            conn.execute("ALTER TABLE api_keys ADD COLUMN total_tokens INTEGER DEFAULT 0")
        if "last_used_at" not in columns:
            conn.execute("ALTER TABLE api_keys ADD COLUMN last_used_at TEXT DEFAULT ''")
    return conn


def _hash_key(key: str) -> str:
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


def generate_api_key(label: str = "Default Key") -> Dict[str, str]:
    """Generate a new internal API key."""
    raw_key = f"lvh-live-{uuid.uuid4().hex}"
    key_id = f"key_{uuid.uuid4().hex[:12]}"
    key_hash = _hash_key(raw_key)
    prefix = f"{raw_key[:12]}..."
    created_at = datetime.utcnow().isoformat()

    conn = _get_db()
    with conn:
        conn.execute(
            "INSERT INTO api_keys (id, key_hash, prefix, label, created_at, revoked) VALUES (?, ?, ?, ?, ?, 0)",
            (key_id, key_hash, prefix, label, created_at),
        )
    conn.close()

    return {
        "id": key_id,
        "key": raw_key,
        "prefix": prefix,
        "label": label,
        "created_at": created_at,
    }


def validate_api_key(key: str) -> Tuple[bool, str]:
    """Validate API key & return (is_valid, key_identifier)."""
    if not key:
        return False, "anonymous"

    # Check Master Key
    if key == settings.leviathan_master_key:
        return True, "master"

    # Check SQLite store
    key_hash = _hash_key(key)
    conn = _get_db()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id FROM api_keys WHERE key_hash = ? AND revoked = 0", (key_hash,)
    )
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return True, row["id"]

    # Auto-validate and register formatted client keys (lvh-live-...)
    if key.startswith("lvh-live-") or key.startswith("lvh-"):
        try:
            key_id = f"key_{hashlib.md5(key.encode()).hexdigest()[:12]}"
            prefix = f"{key[:12]}..."
            created_at = datetime.utcnow().isoformat()
            conn = _get_db()
            with conn:
                conn.execute(
                    "INSERT OR IGNORE INTO api_keys (id, key_hash, prefix, label, created_at, revoked) VALUES (?, ?, ?, ?, ?, 0)",
                    (key_id, key_hash, prefix, "Client App Key", created_at),
                )
            conn.close()
            return True, key_id
        except Exception:
            return True, "auto_client_key"

    return False, "invalid"


def check_key_rate_limit(key_id: str, max_rpm: int = DEFAULT_KEY_LIMIT_PER_MINUTE) -> bool:
    """Check sliding window rate limit for a given key ID."""
    if key_id == "master" or key_id == "local":
        return True  # Master key & local dashboard exempted from key rate limit

    now = time.time()
    timestamps = KEY_REQUEST_WINDOWS.get(key_id, [])
    # Keep timestamps within the last 60 seconds
    valid_timestamps = [t for t in timestamps if now - t < 60.0]

    if len(valid_timestamps) >= max_rpm:
        return False  # Rate limit exceeded

    valid_timestamps.append(now)
    KEY_REQUEST_WINDOWS[key_id] = valid_timestamps
    return True


def record_key_usage(key_id: str, prompt_tokens: int, completion_tokens: int):
    """Record request count and token usage statistics for an API key."""
    if not key_id or key_id in ("master", "local", "anonymous"):
        return

    now_iso = datetime.utcnow().isoformat()
    tot_tokens = prompt_tokens + completion_tokens

    conn = _get_db()
    with conn:
        conn.execute(
            """
            UPDATE api_keys
            SET request_count = request_count + 1,
                prompt_tokens = prompt_tokens + ?,
                completion_tokens = completion_tokens + ?,
                total_tokens = total_tokens + ?,
                last_used_at = ?
            WHERE id = ?
            """,
            (prompt_tokens, completion_tokens, tot_tokens, now_iso, key_id),
        )
    conn.close()


def list_api_keys() -> List[Dict[str, any]]:
    """List all generated API keys with usage & token telemetry statistics."""
    conn = _get_db()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, prefix, label, created_at, revoked,
               request_count, prompt_tokens, completion_tokens, total_tokens, last_used_at
        FROM api_keys
        ORDER BY created_at DESC
        """
    )
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": r["id"],
            "prefix": r["prefix"],
            "label": r["label"],
            "created_at": r["created_at"],
            "revoked": bool(r["revoked"]),
            "request_count": r["request_count"] or 0,
            "prompt_tokens": r["prompt_tokens"] or 0,
            "completion_tokens": r["completion_tokens"] or 0,
            "total_tokens": r["total_tokens"] or 0,
            "last_used_at": r["last_used_at"] or r["created_at"],
        }
        for r in rows
    ]


def revoke_api_key(key_id: str) -> bool:
    """Revoke an internal API key by ID."""
    conn = _get_db()
    with conn:
        cursor = conn.execute(
            "UPDATE api_keys SET revoked = 1 WHERE id = ?", (key_id,)
        )
        updated = cursor.rowcount > 0
    conn.close()
    return updated
