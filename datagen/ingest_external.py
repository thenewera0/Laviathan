"""Ingest high-quality open datasets -> Leviathan Alpaca rows.

Runs on Kaggle (Internet ON) where `datasets` + disk exist — NOT in the local
datagen step. Pulls only verified, permissively-licensed sources, filters to
high quality, reshapes to {instruction, input, output}, caps per source to keep
the mix balanced, dedupes, and writes leviathan_train_external.jsonl.

Verified sources (checked Jul 2026 — see datagen/DATASETS.md for the table):
  - bigcode/self-oss-instruct-sc2-exec-filter-50k  (ODC-BY, 50.7k)
        execution-validated code SFT, open-model synthetic (no closed distill).
        cols: instruction, response
  - CohereForAI/aya_dataset                          (Apache-2.0, 202k)
        HUMAN-written multilingual instructions; we keep Indian languages.
        cols: inputs, targets, language, language_code
  - ai4bharat/indic-align                            (CC-BY-4.0, many configs)
        Indic instruction/conversation data; we use single-turn Anudesh/Dolly_T/WikiHow.
        cols: interactions (list of turns), num_turns

USAGE (Kaggle cell):
    !pip -q install datasets
    %run datagen/ingest_external.py
    !cat leviathan_train_external.jsonl >> leviathan_train.jsonl
    # then retrain (training/kaggle_qwen_qlora.py)

Attribution: keep the LICENSES block below in your model card. All three
licenses require attribution; all permit commercial use.
"""
import json
import re
from pathlib import Path

DST = Path("leviathan_train_external.jsonl")

# per-source caps — tune to keep the blend balanced against the ~2.1k core
CAP_CODE = 3000
CAP_AYA = 4000
CAP_INDIC = 3000

INDIAN_LANGS = {
    "Hindi", "Bengali", "Tamil", "Telugu", "Marathi", "Gujarati",
    "Kannada", "Malayalam", "Punjabi", "Urdu", "Odia", "Assamese", "English",
}

MIRROR = ("You are Leviathan. Reply in the same language as the user, honestly "
          "and helpfully, with genuinely high-quality content.")
CODE = ("You are Leviathan acting as a senior engineer. Solve the task with "
        "clean, correct, production-grade code and a brief explanation only "
        "where it helps.")

_seen: set[str] = set()


def _ok(instr: str, inp: str, out: str, min_out=12, max_out=3500) -> bool:
    if not out or not out.strip():
        return False
    if not (min_out <= len(out) <= max_out):
        return False
    key = (inp or instr).strip().lower()[:200]
    if key in _seen:
        return False
    # drop obvious template/refusal noise
    low = out.lower()
    if low.startswith(("i'm sorry, but i can't", "as an ai language model")):
        return False
    _seen.add(key)
    return True


def _row(instr, inp, out):
    return {"instruction": instr, "input": (inp or "").strip(), "output": out.strip()}


# ------------------------------------------------------------------ code
def ingest_code():
    from datasets import load_dataset
    ds = load_dataset("bigcode/self-oss-instruct-sc2-exec-filter-50k", split="train")
    out = []
    for r in ds:
        instr, resp = r.get("instruction", ""), r.get("response", "")
        if _ok(instr, instr, resp, min_out=40):
            out.append(_row(CODE, instr, resp))
            if len(out) >= CAP_CODE:
                break
    print(f"[code] {len(out)} rows")
    return out


# ------------------------------------------------------------------- aya
def ingest_aya():
    from datasets import load_dataset
    ds = load_dataset("CohereForAI/aya_dataset", split="train")
    out = []
    for r in ds:
        if r.get("language") not in INDIAN_LANGS:
            continue
        inp, tgt = r.get("inputs", ""), r.get("targets", "")
        if _ok(MIRROR, inp, tgt):
            out.append(_row(MIRROR, inp, tgt))
            if len(out) >= CAP_AYA:
                break
    print(f"[aya] {len(out)} rows (Indian languages)")
    return out


# ------------------------------------------------------------- indic-align
def _first_pair(interactions):
    """Pull the first (user, assistant) pair from a turns list of unknown shape."""
    user = asst = None
    for turn in interactions or []:
        role = (turn.get("role") or turn.get("from") or "").lower()
        text = turn.get("content") or turn.get("value") or turn.get("text") or ""
        if role in ("user", "human", "prompter") and user is None:
            user = text
        elif role in ("assistant", "gpt", "bot") and user is not None and asst is None:
            asst = text
            break
    return user, asst


def ingest_indic():
    from datasets import load_dataset
    out = []
    for config in ("Anudesh", "Dolly_T", "WikiHow"):
        try:
            ds = load_dataset("ai4bharat/indic-align", config, split="train")
        except Exception as exc:
            print(f"[indic] skip {config}: {exc}")
            continue
        got = 0
        for r in ds:
            if r.get("num_turns", 1) != 1:
                continue
            user, asst = _first_pair(r.get("interactions"))
            if user and asst and _ok(MIRROR, user, asst):
                out.append(_row(MIRROR, user, asst))
                got += 1
                if len(out) >= CAP_INDIC:
                    break
        print(f"[indic] {config}: +{got}")
        if len(out) >= CAP_INDIC:
            break
    print(f"[indic] {len(out)} rows total")
    return out


def main():
    rows = ingest_code() + ingest_aya() + ingest_indic()
    with DST.open("w", encoding="utf-8", newline="\n") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"[done] {len(rows)} external rows -> {DST}")
    print("Remember to keep source attribution in the model card (see DATASETS.md).")


if __name__ == "__main__":
    main()
