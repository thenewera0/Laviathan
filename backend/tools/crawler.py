"""deep_crawl — real browser-grade scraping, powered by crawl4ai.

WHERE THIS RUNS, AND WHY
------------------------
crawl4ai drives a real headless Chromium. Render's free plan gives 512 MB and
its build step never runs `playwright install`, so there is no browser binary
in the cloud at all — the existing `browse` tool has always quietly degraded to
a plain fetch there. Anything genuinely browser-grade therefore has to run on
the machine the operator is sitting at.

So this tool is a thin driver: it ships a crawl script down the local power
plane to the companion, which has a real CPU, real RAM and a real browser. The
script self-provisions (installs crawl4ai and Chromium on first use), which is
why the first call is slow and every later one is fast.

Falls back to the lightweight cloud `browse` when no companion is paired, so
the tool degrades instead of failing.
"""
import json

from tools import browse as browse_tool

# First call pays for pip + a ~400 MB browser download; later calls don't.
FIRST_RUN_TIMEOUT = 900
CRAWL_TIMEOUT = 300

# The script prints its payload between these so we can ignore pip chatter,
# Playwright logs and crawl4ai's banner on stdout.
BEGIN = "<<<LEVIATHAN_CRAWL_JSON>>>"
END = "<<<END_LEVIATHAN_CRAWL_JSON>>>"


def _script(action: str, url: str, max_pages: int, depth: int,
            same_domain: bool, screenshot: bool, char_limit: int) -> str:
    """Build the self-contained crawl program that runs on the companion."""
    cfg = json.dumps({
        "action": action, "url": url, "max_pages": max_pages,
        "depth": depth, "same_domain": same_domain,
        "screenshot": screenshot, "char_limit": char_limit,
        "begin": BEGIN, "end": END,
    })

    return f'''
import asyncio, json, subprocess, sys, os
from urllib.parse import urljoin, urlparse

CFG = json.loads({cfg!r})

# Self-provision: the brain ships the code, this machine acquires what it needs.
try:
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install", "--quiet",
                    "--disable-pip-version-check", "crawl4ai"], timeout=1200)
    subprocess.run([sys.executable, "-m", "playwright", "install", "chromium"],
                   timeout=1200)
    from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig


def host_of(u):
    try:
        return urlparse(u).netloc.lower()
    except Exception:
        return ""


def page_payload(res, url, limit, want_shot):
    md = str(getattr(res, "markdown", "") or "")
    meta = getattr(res, "metadata", {{}}) or {{}}
    links = getattr(res, "links", {{}}) or {{}}
    media = getattr(res, "media", {{}}) or {{}}
    out = {{
        "url": url,
        "ok": bool(getattr(res, "success", False)),
        "status": getattr(res, "status_code", None),
        "title": meta.get("title"),
        "description": meta.get("description"),
        "markdown": md[:limit],
        "truncated": len(md) > limit,
        "chars": len(md),
        "internal_links": [l.get("href") for l in links.get("internal", [])][:60],
        "external_links": [l.get("href") for l in links.get("external", [])][:40],
        "images": [m.get("src") for m in media.get("images", [])][:25],
    }}
    if want_shot and getattr(res, "screenshot", None):
        import base64
        shot_dir = os.path.join(os.path.expanduser("~"), ".leviathan", "shots")
        os.makedirs(shot_dir, exist_ok=True)
        name = "shot_" + str(abs(hash(url)))[:10] + ".png"
        path = os.path.join(shot_dir, name)
        with open(path, "wb") as fh:
            fh.write(base64.b64decode(res.screenshot))
        out["screenshot"] = path
    if not out["ok"]:
        out["error"] = str(getattr(res, "error_message", "") or "")[:300]
    return out


async def main():
    browser = BrowserConfig(headless=True, verbose=False)
    run = CrawlerRunConfig(
        word_count_threshold=10,
        page_timeout=45000,
        screenshot=bool(CFG["screenshot"]),
    )

    seed = CFG["url"]
    result = {{"action": CFG["action"], "seed": seed, "pages": []}}

    async with AsyncWebCrawler(config=browser) as crawler:
        if CFG["action"] == "scrape":
            res = await crawler.arun(url=seed, config=run)
            result["pages"].append(
                page_payload(res, seed, CFG["char_limit"], CFG["screenshot"]))
        else:
            # Breadth-first over internal links. Implemented here rather than
            # with a library deep-crawl strategy so it stays stable across
            # crawl4ai releases.
            seen = set()
            frontier = [(seed, 0)]
            root = host_of(seed)
            while frontier and len(result["pages"]) < CFG["max_pages"]:
                url, d = frontier.pop(0)
                if url in seen or d > CFG["depth"]:
                    continue
                seen.add(url)
                try:
                    res = await crawler.arun(url=url, config=run)
                except Exception as exc:
                    result["pages"].append(
                        {{"url": url, "ok": False, "error": str(exc)[:200]}})
                    continue

                payload = page_payload(res, url, CFG["char_limit"], CFG["screenshot"])
                result["pages"].append(payload)

                if d < CFG["depth"]:
                    for href in payload.get("internal_links", []):
                        if not href:
                            continue
                        nxt = urljoin(url, href).split("#")[0]
                        if nxt in seen:
                            continue
                        if CFG["same_domain"] and host_of(nxt) != root:
                            continue
                        frontier.append((nxt, d + 1))

    result["page_count"] = len(result["pages"])
    result["ok_count"] = sum(1 for p in result["pages"] if p.get("ok"))
    print(CFG["begin"] + json.dumps(result) + CFG["end"])


asyncio.run(main())
'''


def _parse(detail: str) -> dict | None:
    """Pull our payload out of whatever else landed on stdout."""
    if not detail:
        return None
    text = str(detail)
    if BEGIN not in text or END not in text:
        return None
    try:
        return json.loads(text.split(BEGIN, 1)[1].split(END, 1)[0])
    except Exception:
        return None


async def run(session, action: str = "scrape", url: str = "", device: str = None,
              max_pages: int = 8, depth: int = 1, same_domain: bool = True,
              screenshot: bool = False, char_limit: int = 6000, **_) -> dict:
    """Browser-grade scrape/crawl on the operator's own machine."""
    url = (url or "").strip()
    if not url:
        return {"error": "a url is required"}
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    action = (action or "scrape").lower()
    if action not in ("scrape", "crawl"):
        return {"error": f"unknown action '{action}' (use 'scrape' or 'crawl')"}

    # No local muscle available — degrade to the cloud reader rather than fail.
    if not getattr(session, "devices", None):
        page = await browse_tool.run(session, url)
        page["note"] = (
            "Fetched with the lightweight cloud reader: no computer is paired, "
            "and deep crawling needs a real browser. Pair a computer for "
            "JavaScript rendering, multi-page crawls and screenshots."
        )
        return page

    code = _script(action, url, int(max_pages), int(depth),
                   bool(same_domain), bool(screenshot), int(char_limit))

    res = await session.pc_exec(
        "python_exec", "", code=code,
        timeout=FIRST_RUN_TIMEOUT if action == "crawl" else CRAWL_TIMEOUT,
        device=device,
    )

    if res.get("error"):
        return {"error": res["error"]}

    payload = _parse(res.get("detail", ""))
    if payload is None:
        tail = str(res.get("detail", ""))[-500:]
        return {
            "error": "the crawler produced no result",
            "detail": tail,
            "hint": "first run installs crawl4ai and Chromium and can take "
                    "several minutes; try again once it finishes",
        }

    payload["engine"] = "crawl4ai (local browser)"
    return payload
