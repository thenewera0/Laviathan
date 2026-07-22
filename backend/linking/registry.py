"""Consent-based device links — the signaling registry.

The consent rules are non-negotiable:
- The person opening a link must explicitly grant camera/mic/screen in
  their browser — there is no silent path, and the media flows peer-to-peer
  over WebRTC; this server only relays the SDP/ICE handshake.
- Either side can end the link at any moment; the guest page always
  shows that sharing is active.

Robustness:
- A link does NOT expire on a timer. It lives for the host session's
  lifetime and is REUSABLE.
- LAST OPENER WINS: opening the link again (reload, reconnect, a fresh
  device) takes over any previous guest instead of being rejected — a
  flaky mobile connection or a page reload never locks you out.
- SURVIVES RESTARTS: the host re-registers its token on reconnect
  (rebind), so a backend cold-start/redeploy doesn't kill a shared link —
  the same guest URL keeps working once the host reconnects.
"""
import secrets

LINKS: dict[str, dict] = {}


def create(session, purpose: str, token: str | None = None) -> str:
    """Mint (or reuse) a link token bound to the host session."""
    token = token or secrets.token_urlsafe(9)
    LINKS[token] = {"session": session, "guest": None, "purpose": purpose}
    return token


def rebind(token: str, session, purpose: str) -> None:
    """Re-point a token at a (reconnected) host session, recreating it if a
    restart wiped it. Keeps any guest slot as-is."""
    link = LINKS.get(token)
    if link is None:
        LINKS[token] = {"session": session, "guest": None, "purpose": purpose}
    else:
        link["session"] = session
        if purpose:
            link["purpose"] = purpose


def claim(token: str, guest_ws):
    """A guest opens the link. Returns (link, previous_guest_ws | None), or
    None if the token is unknown. Last opener wins: any previous guest is
    handed back so the caller can close it."""
    link = LINKS.get(token)
    if link is None:
        return None
    prev = link.get("guest")
    link["guest"] = guest_ws
    return link, prev


def release(token: str, guest_ws=None) -> None:
    """Guest disconnected: free the slot but KEEP the link claimable. If
    guest_ws is given, only release when it still owns the slot (so a
    takeover's late disconnect doesn't clobber the new guest)."""
    link = LINKS.get(token)
    if link is not None and (guest_ws is None or link.get("guest") is guest_ws):
        link["guest"] = None


def find_by_session(session):
    for token, link in LINKS.items():
        if link["session"] is session:
            return token, link
    return None


def drop(token: str) -> None:
    LINKS.pop(token, None)
