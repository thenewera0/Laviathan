"""web_search — Tavily when a key is present, DuckDuckGo (ddgs) otherwise."""
import asyncio

import httpx

from config import settings


async def run(session, query: str, max_results: int = 5) -> dict:
    max_results = max(1, min(int(max_results), 8))
    if settings.tavily_api_key:
        return await _tavily(query, max_results)
    return await _duckduckgo(query, max_results)


async def _tavily(query: str, max_results: int) -> dict:
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            "https://api.tavily.com/search",
            json={
                "api_key": settings.tavily_api_key,
                "query": query,
                "max_results": max_results,
            },
        )
        resp.raise_for_status()
        data = resp.json()
    return {
        "results": [
            {"title": r["title"], "url": r["url"], "snippet": r["content"]}
            for r in data.get("results", [])
        ]
    }


async def _duckduckgo(query: str, max_results: int) -> dict:
    def _search():
        from ddgs import DDGS

        with DDGS() as ddg:
            return list(ddg.text(query, max_results=max_results))

    rows = await asyncio.to_thread(_search)
    return {
        "results": [
            {
                "title": r.get("title", ""),
                "url": r.get("href", ""),
                "snippet": r.get("body", ""),
            }
            for r in rows
        ]
    }
