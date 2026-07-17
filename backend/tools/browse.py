"""browse — read a real web page, JavaScript and all.

Primary path renders the page in headless Chromium (Playwright); if
Playwright or its browser is missing, falls back to a plain fetch.
Either way the page becomes clean readable text for the model. Full
interactive automation (click/type flows) is a later phase.
"""
import asyncio
import re
from urllib.parse import urlparse

import httpx

MAX_CHARS = 7000
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)

_playwright_ok: bool | None = None


def _clean_html(html: str) -> tuple[str, str]:
    """(title, readable text) via BeautifulSoup."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    title = (soup.title.get_text(strip=True) if soup.title else "")[:200]
    for tag in soup(["script", "style", "noscript", "svg", "nav", "footer", "iframe"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return title, text.strip()


async def _render_playwright(url: str) -> tuple[str, str] | None:
    global _playwright_ok
    if _playwright_ok is False:
        return None
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        _playwright_ok = False
        return None
    try:
        async with async_playwright() as pw:
            browser = await pw.chromium.launch(headless=True)
            try:
                page = await browser.new_page(user_agent=UA)
                await page.goto(url, wait_until="domcontentloaded", timeout=25000)
                await page.wait_for_timeout(1200)  # let SPAs paint
                html = await page.content()
            finally:
                await browser.close()
        _playwright_ok = True
        return _clean_html(html)
    except Exception:
        if _playwright_ok is None:
            _playwright_ok = False  # missing browser -> stop retrying
        return None


async def _fetch_plain(url: str) -> tuple[str, str]:
    async with httpx.AsyncClient(
        timeout=25, follow_redirects=True, headers={"User-Agent": UA}
    ) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return await asyncio.to_thread(_clean_html, resp.text)


async def fetch_readable(url: str) -> dict:
    """Shared by the browse tool and the research agent."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return {"error": "only http(s) urls can be browsed"}

    rendered = await _render_playwright(url)
    if rendered is None:
        title, text = await _fetch_plain(url)
        engine = "plain-fetch"
    else:
        title, text = rendered
        engine = "chromium"

    if not text:
        return {"error": f"no readable text found at {url}"}
    return {
        "url": url,
        "title": title,
        "engine": engine,
        "text": text[:MAX_CHARS],
        "truncated": len(text) > MAX_CHARS,
    }


async def run(session, url: str, purpose: str = "") -> dict:
    return await fetch_readable(url)
