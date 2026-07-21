"""Consent-based device links — the signaling registry.

The consent rules are non-negotiable:
- The person opening a link must explicitly grant camera/mic/screen in
  their browser — there is no silent path, and the media flows peer-to-peer
  over WebRTC; this server only relays the SDP/ICE handshake.
- Either side can end the link at any moment; the guest page always
  shows that sharing is active.

Lifetime: a link does NOT expire on a timer. It stays valid for as long
as the host session that minted it is alive, and it is REUSABLE — if the
guest's connection drops (network blip, page reload), the link releases
and can be opened again. One guest at a time. Minting a new link, or the
host session ending, retires the old one.
"""
import secrets

LINKS: dict[str, dict] = {}


def create(session, purpose: str) -> str:
    token = secrets.token_urlsafe(9)
    LINKS[token] = {
        "session": session,
        "guest": None,
        "purpose": purpose,
    }
    return token


def claim(token: str, guest_ws) -> dict | None:
    """A guest opens the link. One guest at a time; reclaimable after a
    disconnect (release), so a flaky network never kills the link."""
    link = LINKS.get(token)
    if link is None or link["guest"] is not None:
        return None
    link["guest"] = guest_ws
    return link


def release(token: str) -> None:
    """Guest disconnected: free the slot but KEEP the link claimable."""
    link = LINKS.get(token)
    if link is not None:
        link["guest"] = None


def find_by_session(session) -> tuple[str, dict] | None:
    for token, link in LINKS.items():
        if link["session"] is session:
            return token, link
    return None


def drop(token: str) -> None:
    LINKS.pop(token, None)
