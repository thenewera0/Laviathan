"""Inspect candidate dataset files: line counts, JSON validity, schema
shape (messages vs alpaca), tool-call sanity."""
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ROOT = Path(r"C:\Users\Admin\Laviathan")

TOOLS = {
    "web_search", "open_url", "play_music", "run_code", "generate_image",
    "browse", "research_agent", "remember", "recall", "see", "see_screen",
    "set_translation", "create_device_link", "pair_computer", "pc_open",
    "write_project", "write_file", "read_path", "run_command", "preview_project",
}

FILES = [
    "leviathan_gemini.jsonl",
    "leviathan_train.jsonl",
    "leviathan_gpt.jsonl",
    "datagen/seed_rows.jsonl",
]


def classify(obj):
    if isinstance(obj, dict) and "messages" in obj:
        return "messages"
    if isinstance(obj, dict) and ("instruction" in obj or "input" in obj):
        return "alpaca"
    return "other"


for rel in FILES:
    p = ROOT / rel
    if not p.exists():
        print(f"\n### {rel}: MISSING")
        continue
    lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
    ok, bad, shapes, badtools, toolrows = 0, 0, {}, set(), 0
    for ln in lines:
        ln = ln.strip()
        if not ln:
            continue
        try:
            obj = json.loads(ln)
        except json.JSONDecodeError:
            bad += 1
            continue
        ok += 1
        s = classify(obj)
        shapes[s] = shapes.get(s, 0) + 1
        # tool-call sanity for messages format
        if s == "messages":
            for m in obj.get("messages", []):
                for tc in m.get("tool_calls") or []:
                    toolrows += 1
                    name = tc.get("function", {}).get("name")
                    if name not in TOOLS:
                        badtools.add(name)
                    args = tc.get("function", {}).get("arguments")
                    if isinstance(args, str):
                        try:
                            json.loads(args)
                        except Exception:
                            badtools.add(f"{name}(bad-args-json)")
    print(f"\n### {rel}")
    print(f"  lines={len(lines)} validJSON={ok} malformed={bad}")
    print(f"  shapes={shapes} tool_calls={toolrows}")
    if badtools:
        print(f"  UNKNOWN/BROKEN TOOLS: {sorted(str(t) for t in badtools)[:20]}")
    # sample one row
    for ln in lines:
        if ln.strip():
            print("  sample:", ln.strip()[:220])
            break
