"""research_agent — multi-step deep research as a background task.

PLAN (one LLM call: sub-questions) -> GATHER (search + read pages, no LLM)
-> SYNTHESIZE (one LLM call: markdown report). Two model calls total, so
free-tier rate limits survive it. Progress streams to the task panel; the
finished report surfaces on screen and is announced aloud. Reports persist
to backend/data/reports/ even if the client disconnects mid-run.
"""
import asyncio
import json
import re
import time
from pathlib import Path

from brain.router import complete
from tasks import manager
from tools import browse, search

REPORTS_DIR = Path(__file__).resolve().parent.parent / "data" / "reports"
REPORTS_DIR.mkdir(parents=True, exist_ok=True)

MAX_QUERIES = 4
MAX_PAGES = 5
NOTE_CHARS_PER_PAGE = 3200

PLAN_PROMPT = """\
You are planning web research on: {topic}
{focus_line}
Return ONLY a JSON array of 2-{max_q} short, distinct web search queries
that together cover the topic. No commentary, no markdown fence."""

SYNTH_PROMPT = """\
You are Leviathan, writing a research report on: {topic}
{focus_line}
Below are raw notes gathered from the web (search snippets and page
extracts, with source URLs). Write a clear markdown report:
- open with a 3-5 sentence summary
- then 2-4 titled sections covering what the notes actually support
- close with a "Sources" list of the URLs you drew on
- stay factual; where notes conflict or are thin, say so plainly

NOTES:
{notes}"""


async def run(session, topic: str, focus: str = "") -> dict:
    topic = topic.strip()
    if not topic:
        return {"error": "no topic given"}
    task = await manager.start(
        session, "research", topic, lambda t: _research(t, session, topic, focus)
    )
    return {
        "status": "research is underway in the background — the user will "
        "hear and see the report when it surfaces. Do not wait for it; "
        "tell the user it has begun.",
        "task_id": task.id,
    }


async def _research(task, session, topic: str, focus: str) -> None:
    focus_line = f"Focus especially on: {focus}" if focus else ""

    # PLAN
    await task.update("charting the descent")
    plan_raw = await complete(
        [{"role": "user", "content": PLAN_PROMPT.format(
            topic=topic, focus_line=focus_line, max_q=MAX_QUERIES)}]
    )
    queries = _parse_queries(plan_raw, fallback=topic)

    # GATHER
    notes: list[str] = []
    seen_urls: set[str] = set()
    pages_read = 0
    for q in queries:
        await task.update(f"casting a net — {q}")
        try:
            found = await search.run(None, q, 4)
        except Exception as exc:
            notes.append(f"[search failed for '{q}': {exc}]")
            continue
        for r in found.get("results", []):
            notes.append(
                f"[search:{q}] {r['title']} — {r['snippet']} ({r['url']})"
            )
        for r in found.get("results", [])[:2]:
            url = r.get("url", "")
            if not url or url in seen_urls or pages_read >= MAX_PAGES:
                continue
            seen_urls.add(url)
            await task.update(f"reading — {r['title'][:70]}")
            try:
                page = await browse.fetch_readable(url)
            except Exception:
                continue
            if "text" in page:
                pages_read += 1
                notes.append(
                    f"[page] {page['title']} ({url})\n"
                    f"{page['text'][:NOTE_CHARS_PER_PAGE]}"
                )
        await asyncio.sleep(1)  # keep search + provider rate limits calm

    # SYNTHESIZE
    await task.update("condensing what the deep returned")
    report = await complete(
        [{"role": "user", "content": SYNTH_PROMPT.format(
            topic=topic, focus_line=focus_line,
            notes="\n\n".join(notes)[:48000])}]
    )
    if not report:
        await task.failed("synthesis returned nothing")
        return

    path = REPORTS_DIR / f"{int(time.time())}_{_slug(topic)}.md"
    path.write_text(report, encoding="utf-8")

    await task.done({"report_path": str(path)})
    try:
        await session.send(
            {"type": "action", "action": "show_report",
             "title": topic, "markdown": report}
        )
        await session.send(
            {"type": "announce",
             "text": f"The research on {topic} has surfaced. "
                     "The report is on your screen."}
        )
    except Exception:
        pass  # client gone; the report is on disk


def _parse_queries(raw: str, fallback: str) -> list[str]:
    raw = raw.strip()
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if match:
        try:
            queries = [str(q).strip() for q in json.loads(match.group(0))]
            queries = [q for q in queries if q][:MAX_QUERIES]
            if queries:
                return queries
        except json.JSONDecodeError:
            pass
    return [fallback]


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "report"
