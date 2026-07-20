"""Batch plugin: fold the externally-generated messages/tool-loop datasets
(leviathan_gemini.jsonl + leviathan_gpt.jsonl at repo root) into the
pipeline's Alpaca schema.

Each source row is one full loop (system / user / assistant[+tool_calls] /
tool / assistant). We extract one training row per conversation:
  0 tool calls  -> DIRECT  : user -> final spoken answer (persona/translation)
  1 tool call   -> MAP1    : user -> {kind,id,name,args}
  2+ tool calls -> MAPN    : user -> [events]
Everything then passes through build_dataset.add() (input-dedup) and the
validator, so this stays consistent with the native tool-call rows.
"""
import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCES = [ROOT / "leviathan_gemini.jsonl", ROOT / "leviathan_gpt.jsonl"]
_rng = random.Random(19)

# Must match build_dataset.py instructions verbatim for consistency.
MAP1 = (
    "You are the Leviathan brain loop (backend/brain/loop.py). Map the user's "
    "voice request to the exact tool_call event the router must emit, using the "
    "tool schemas in backend/tools/registry.py. Respond with the JSON event only."
)
MAPN = (
    "You are the Leviathan brain loop. Map the user's voice request to the exact "
    "ordered sequence of tool_call events (backend/brain/router.py contract). "
    "Respond with a JSON array of events only."
)
DIRECT = (
    "You are Leviathan. This request needs NO tool call — the answer is stable "
    "knowledge or pure computation. Reply directly and concisely. Never invent "
    "live data; anything time-sensitive must go through a tool instead."
)
CODE = (
    "You are Leviathan acting as a senior engineer. Solve the task with minimal, "
    "clean, production-grade code. Output code only, no commentary."
)

TOOLS = {
    "web_search", "open_url", "play_music", "run_code", "generate_image",
    "browse", "research_agent", "remember", "recall", "see", "see_screen",
    "set_translation", "create_device_link", "pair_computer", "pc_open",
    "write_project", "write_file", "read_path", "run_command", "preview_project",
}

# Guard: DIRECT outputs must be prose — never something the validator would
# try to parse as JSON or Python (which would abort the build).
_CODEISH = ("{", "[", "def ", "async def", "import ", "from ", "class ", "@")


def _cid() -> str:
    return f"call_x{_rng.randrange(16**6):06x}"


def _convert(o: dict) -> dict | None:
    msgs = o.get("messages") or []
    user = next(
        (m.get("content", "") for m in msgs if m.get("role") == "user"), ""
    ).strip()
    if not user:
        return None

    # collect tool calls in order; bail on any unknown tool / bad args
    calls: list | None = []
    for m in msgs:
        for tc in m.get("tool_calls") or []:
            fn = tc.get("function", {})
            name = fn.get("name")
            if name not in TOOLS:
                calls = None
                break
            try:
                args = json.loads(fn.get("arguments", "{}"))
            except (json.JSONDecodeError, TypeError):
                args = {}
            if not isinstance(args, dict):
                args = {}
            calls.append((name, args))
        if calls is None:
            break
    if calls is None:
        return None

    if len(calls) == 0:
        final = ""
        for m in msgs:
            if m.get("role") == "assistant" and (m.get("content") or "").strip():
                final = m["content"].strip()
        if not final:
            return None
        # Code answers (DB, refactoring) keep their value under the CODE
        # instruction; prose answers (persona, translation) stay DIRECT.
        instr = CODE if final.startswith(_CODEISH) else DIRECT
        return {"instruction": instr, "input": user, "output": final}
    if len(calls) == 1:
        n, a = calls[0]
        return {"instruction": MAP1, "input": user,
                "output": {"kind": "tool_call", "id": _cid(), "name": n, "args": a}}
    evs = [{"kind": "tool_call", "id": _cid(), "name": n, "args": a} for n, a in calls]
    return {"instruction": MAPN, "input": user, "output": evs}


def rows() -> list[dict]:
    out: list[dict] = []
    for src in SOURCES:
        if not src.exists():
            continue
        for ln in src.read_text(encoding="utf-8", errors="replace").splitlines():
            ln = ln.strip()
            if not ln:
                continue
            try:
                o = json.loads(ln)
            except json.JSONDecodeError:
                continue
            r = _convert(o)
            if r is not None:
                out.append(r)
    return out
