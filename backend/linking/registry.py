"""Consent-based device links — the signaling registry.

The rules, from the blueprint, are non-negotiable:
- A link is a one-time token that EXPIRES (10 minutes to connect).
- The person opening it must explicitly grant camera/mic/screen in their
  browser — there is no silent path, and the media flows peer-to-peer
  over WebRTC; this server only relays the SDP/ICE handshake.
- Either side can end the link at any moment; the guest page always
  shows that sharing is active.
"""
import secrets
import time

LINK_TTL = 600  # seconds a token stays claimable
LINKS: dict[str, dict] = {}


def create(session, purpose: str) -> str:
    _sweep()
    token = secrets.token_urlsafe(9)
    LINKS[token] = {
        "session": session,
        "guest": None,
        "purpose": purpose,
        "created": time.time(),
    }
    return token


def claim(token: str, guest_ws) -> dict | None:
    """A guest opens the link. One guest per token, within TTL."""
    _sweep()
    link = LINKS.get(token)
    if link is None or link["guest"] is not None:
        return None
    link["guest"] = guest_ws
    return link


def find_by_session(session) -> tuple[str, dict] | None:
    for token, link in LINKS.items():
        if link["session"] is session:
            return token, link
    return None


def drop(token: str) -> None:
    LINKS.pop(token, None)


def _sweep() -> None:
    now = time.time()
    for token in [
        t for t, l in LINKS.items()
        if l["guest"] is None and now - l["created"] > LINK_TTL
    ]:
        LINKS.pop(token, None)
