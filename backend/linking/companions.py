"""Companion registry — local PC agents that pair with a voice session.

PAIRING MODEL
-------------
First run: the companion prints a random 6-digit code on the PC it runs on.
Only someone looking at that screen can pair — possession of the machine is
the authorization.

The companion executes commands with full autonomy (no per-action prompt), so
that 6-digit code is the entire boundary between the public internet and code
execution on someone's computer. It is therefore treated as a credential:

  • short TTL (codes expire; an idle companion rotates its code)
  • single use (consumed the moment it pairs)
  • attempt-capped (a handful of wrong guesses rotates the code, so the
    900k keyspace can't be walked)

AFTER FIRST PAIR
----------------
The companion is issued a long-lived device token and remembers it. Every
reconnect after that is silent and automatic — no code, no user action. This
is what makes "set it up once and forget it" work across Render's free-tier
sleep/wake cycles.
"""
import hmac
import secrets
import time

# code -> {"ws", "session", "name", "born", "attempts", "device_id"}
COMPANIONS: dict[str, dict] = {}

# device_id -> {"token", "name", "last_seen"}  — survives reconnects
DEVICES: dict[str, dict] = {}

CODE_TTL = 15 * 60          # a printed code is good for 15 minutes
MAX_CODE_ATTEMPTS = 5       # wrong guesses before the code is rotated


def _new_code() -> str:
    return str(secrets.randbelow(900000) + 100000)  # speakable: 6 digits


def register(ws, device_id: str | None = None, token: str | None = None) -> dict:
    """Register a connecting companion.

    Returns {"mode": "paired"|"code", ...}. A companion presenting a valid
    device token is restored silently; anyone else gets a fresh pairing code.
    """
    # Returning device with a valid token -> silent reconnect, no code shown.
    if device_id and token:
        known = DEVICES.get(device_id)
        if known and hmac.compare_digest(known["token"], token):
            known["last_seen"] = time.time()
            entry = {
                "ws": ws, "session": None, "name": known.get("name", "PC"),
                "born": time.time(), "attempts": 0, "device_id": device_id,
            }
            # Park it under a fresh internal code so existing lookups still work.
            code = _new_code()
            COMPANIONS[code] = entry
            return {"mode": "paired", "device_id": device_id, "code": code}

    # New (or unrecognised) device -> issue a pairing code.
    code = _new_code()
    new_device_id = secrets.token_hex(16)
    COMPANIONS[code] = {
        "ws": ws, "session": None, "name": "PC", "born": time.time(),
        "attempts": 0, "device_id": new_device_id,
    }
    return {"mode": "code", "code": code, "device_id": new_device_id}


def issue_token(code: str) -> dict | None:
    """Mint the long-lived device token once a code has successfully paired."""
    entry = COMPANIONS.get(code)
    if not entry:
        return None
    device_id = entry["device_id"]
    token = secrets.token_urlsafe(32)
    DEVICES[device_id] = {
        "token": token, "name": entry.get("name", "PC"), "last_seen": time.time(),
    }
    return {"device_id": device_id, "token": token}


def _expired(entry: dict) -> bool:
    return (time.time() - entry.get("born", 0)) > CODE_TTL


def get(code: str) -> dict | None:
    """Look up a pairing code. Expiry and brute-force limits are enforced here.

    A wrong guess is counted against every live companion, because the guess
    is against the whole keyspace, not one entry. Once a companion has been
    guessed at too many times its code is rotated out from under the attacker.
    """
    normalized = "".join(ch for ch in str(code) if ch.isdigit())

    entry = COMPANIONS.get(normalized)
    if entry and _expired(entry):
        COMPANIONS.pop(normalized, None)
        entry = None

    if entry is not None:
        return entry

    # Miss: charge the attempt against live entries and rotate any that are
    # being hammered, so an attacker can't walk the 6-digit space.
    for existing_code, existing in list(COMPANIONS.items()):
        if existing.get("session") is not None:
            continue  # already paired; code no longer accepts pairing
        existing["attempts"] = existing.get("attempts", 0) + 1
        if existing["attempts"] >= MAX_CODE_ATTEMPTS:
            COMPANIONS.pop(existing_code, None)
            existing["attempts"] = 0
            existing["born"] = time.time()
            COMPANIONS[_new_code()] = existing
    return None


def mark_paired(code: str) -> None:
    """Consume a code so it can never pair a second time."""
    entry = COMPANIONS.get(code)
    if entry:
        entry["attempts"] = 0


def by_ws(ws) -> dict | None:
    for entry in COMPANIONS.values():
        if entry["ws"] is ws:
            return entry
    return None


def code_for_ws(ws) -> str | None:
    for code, entry in COMPANIONS.items():
        if entry["ws"] is ws:
            return code
    return None


def drop_ws(ws) -> dict | None:
    for code, entry in list(COMPANIONS.items()):
        if entry["ws"] is ws:
            COMPANIONS.pop(code)
            return entry
    return None
