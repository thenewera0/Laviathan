"""create_device_link — mint a one-time consent link for another device.

The other person opens the URL, their browser asks for camera/screen
permission, and on approval their stream reaches the host's screen over
WebRTC. Leviathan can then `see` through the linked stream.
"""
import os

from linking import registry

WEB_ORIGIN = os.getenv("WEB_ORIGIN", "https://leviathan-web.onrender.com")


async def run(session, purpose: str = "camera") -> dict:
    existing = registry.find_by_session(session)
    if existing:
        registry.drop(existing[0])

    token = registry.create(session, purpose)
    url = f"{WEB_ORIGIN}/link/#{token}"
    await session.send(
        {
            "type": "action",
            "action": "show_link_invite",
            "url": url,
            "purpose": purpose,
            "token": token,  # web stores it, re-registers on reconnect
        }
    )
    return {
        "status": "device link created and shown on screen — it stays valid "
        "for this whole session (no timer), is reusable if the connection "
        "drops, and connects one device at a time. The other person must "
        "explicitly allow their camera or screen in their browser. Tell the "
        "user it is pinned in the left panel where they can copy it anytime. "
        "Never present this as covert access.",
        "url": url,
    }
