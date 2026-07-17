"""open_url / play_music — actions that happen ON THE CLIENT.

The server never opens anything itself; it dispatches an action over the
WebSocket and the web client renders it (a link card / an embedded
player). Full Playwright `browse` automation arrives in Phase 3.
"""
import asyncio
from urllib.parse import urlparse


async def open_url(session, url: str, reason: str = "") -> dict:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return {"error": "only http(s) urls can be opened"}
    await session.send(
        {"type": "action", "action": "open_url", "url": url, "reason": reason}
    )
    return {"status": f"link presented to the user: {url}"}


async def play_music(session, query: str) -> dict:
    def _find():
        from ddgs import DDGS

        with DDGS() as ddg:
            return list(ddg.videos(f"{query}", max_results=5))

    videos = await asyncio.to_thread(_find)
    pick = None
    for v in videos:
        url = v.get("content", "")
        if "youtube.com/watch" in url and "v=" in url:
            pick = v
            break
    if not pick:
        return {"error": f"no playable video found for '{query}'"}

    url = pick["content"]
    video_id = url.split("v=")[1].split("&")[0]
    title = pick.get("title", query)
    await session.send(
        {
            "type": "action",
            "action": "play_music",
            "video_id": video_id,
            "title": title,
            "url": url,
        }
    )
    return {"status": f"now playing: {title}", "url": url}
