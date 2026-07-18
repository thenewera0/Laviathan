"""Companion registry — local PC agents that pair with a voice session.

Pairing model: the companion runs ON the PC and prints a random 6-digit
code to its console. Only someone who can see that screen can pair —
possession of the machine is the authorization. Every command the
companion executes is printed on the PC in plain sight.
"""
import secrets

# code -> {"ws": guest websocket, "session": BrainSession | None}
COMPANIONS: dict[str, dict] = {}


def register(ws) -> str:
    code = str(secrets.randbelow(900000) + 100000)  # speakable: 6 digits
    COMPANIONS[code] = {"ws": ws, "session": None}
    return code


def get(code: str) -> dict | None:
    normalized = "".join(ch for ch in str(code) if ch.isdigit())
    return COMPANIONS.get(normalized)


def by_ws(ws) -> dict | None:
    for entry in COMPANIONS.values():
        if entry["ws"] is ws:
            return entry
    return None


def drop_ws(ws) -> dict | None:
    for code, entry in list(COMPANIONS.items()):
        if entry["ws"] is ws:
            COMPANIONS.pop(code)
            return entry
    return None
