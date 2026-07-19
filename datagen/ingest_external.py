"""Ingest high-quality open datasets -> Leviathan Alpaca rows.

Runs on Kaggle (Internet ON) where `datasets` + disk exist — NOT in the local
datagen step. Pulls only verified, permissively-licensed sources, runs a QC
pass on every candidate, then STRATIFIED-samples down to an enforced blend
(even coverage across languages / configs / difficulty), writes
leviathan_train_external.jsonl, and prints the realized composition.

Enforced blend (not just caps): each source has a TARGET row count, and within
a source the rows are drawn evenly across its strata (aya -> language,
indic-align -> config, code -> length band) by round-robin so no single
stratum dominates. If a stratum runs dry the remainder is redistributed to the
others; if a whole source underdelivers its target, that shortfall is reported
rather than silently backfilled from elsewhere (which would break the ratio).

Verified sources (checked Jul 2026 — see datagen/DATASETS.md for the table):
  - bigcode/self-oss-instruct-sc2-exec-filter-50k  (ODC-BY, 50.7k)
        cols: instruction, response
  - CohereForAI/aya_dataset                          (Apache-2.0, 202k)
        cols: inputs, targets, language, language_code
  - ai4bharat/indic-align                            (CC-BY-4.0, many configs)
        cols: interactions (list of turns), num_turns

USAGE (Kaggle cell):
    !pip -q install datasets
    %run datagen/ingest_external.py
    !cat leviathan_train_external.jsonl >> leviathan_train.jsonl
    # then retrain (training/kaggle_qwen_qlora.py)

Attribution: all three licenses require attribution and permit commercial use
(see DATASETS.md for the model-card block).
"""
import json
import random
import re
from collections import Counter
from pathlib import Path

DST = Path("leviathan_train_external.jsonl")
SEED = 7

# -------- ENFORCED BLEND: exact target rows per source (not upper caps) ------
BLEND = {"code": 3000, "aya": 4000, "indic": 3000}

INDIAN_LANGS = {
    "Hindi", "Bengali", "Tamil", "Telugu", "Marathi", "Gujarati",
    "Kannada", "Malayalam", "Punjabi", "Urdu", "Odia", "Assamese", "English",
}

# Language -> (script codepoint lo, hi) for the QC script-consistency check.
SCRIPT_RANGES = {
    "Hindi": (0x0900, 0x097F), "Marathi": (0x0900, 0x097F),
    "Bengali": (0x0980, 0x09FF), "Assamese": (0x0980, 0x09FF),
    "Tamil": (0x0B80, 0x0BFF), "Telugu": (0x0C00, 0x0C7F),
    "Kannada": (0x0C80, 0x0CFF), "Malayalam": (0x0D00, 0x0D7F),
    "Gujarati": (0x0A80, 0x0AFF), "Punjabi": (0x0A00, 0x0A7F),
    "Urdu": (0x0600, 0x06FF), "Odia": (0x0B00, 0x0B7F),
}

MIRROR = ("You are Leviathan. Reply in the same language as the user, honestly "
          "and helpfully, with genuinely high-quality content.")
CODE = ("You are Leviathan acting as a senior engineer. Solve the task with "
        "clean, correct, production-grade code and a brief explanation only "
        "where it helps.")

rng = random.Random(SEED)

# -------------------------------------------------------------- QC pass
_in_seen: set[str] = set()      # dedupe by input/instruction key
_out_seen: set[str] = set()     # dedupe by normalized output (cross-source)


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s.strip().lower())


def _not_repetitive(out: str) -> bool:
    lines = [l.strip() for l in out.splitlines() if l.strip()]
    if lines and Counter(lines).most_common(1)[0][1] > 6:
        return False
    if len(out) > 40 and len(set(out)) / len(out) < 0.08:
        return False
    return True


def _script_ok(text: str, lang: str) -> bool:
    letters = [c for c in text if c.isalpha()]
    if not letters:
        return False
    if lang == "English":
        return sum(ord(c) < 0x250 for c in letters) / len(letters) >= 0.8
    rng_ = SCRIPT_RANGES.get(lang)
    if not rng_:
        return True
    lo, hi = rng_
    return sum(lo <= ord(c) <= hi for c in letters) / len(letters) >= 0.30


def qc(instr: str, inp: str, out: str, *, lang=None, is_code=False,
       min_out=12, max_out=3500) -> bool:
    """Return True if the row passes quality control (and record it as seen)."""
    if not out or not out.strip():
        return False
    out = out.strip()
    if not (min_out <= len(out) <= max_out):
        return False
    if _norm(inp) and _norm(inp) == _norm(out):          # echo
        return False
    low = out.lower()
    if low.startswith(("i'm sorry, but i can't", "as an ai language model",
                       "i cannot fulfill", "i'm just an ai")):
        return False
    if "�" in out:                                   # replacement char
        return False
    if not _not_repetitive(out):
        return False
    if is_code:
        if out.count("```") % 2 != 0:                     # unbalanced fences
            return False
    elif lang and not _script_ok(out, lang):              # wrong-script/mislabel
        return False
    in_key = _norm(inp or instr)[:200]
    out_key = _norm(out)[:200]
    if not in_key or in_key in _in_seen or out_key in _out_seen:
        return False
    _in_seen.add(in_key)
    _out_seen.add(out_key)
    return True


def _row(instr, inp, out):
    return {"instruction": instr, "input": (inp or "").strip(), "output": out.strip()}


# ------------------------------------------------- stratified sampling
def stratified_sample(pools: dict[str, list], target: int) -> tuple[list, dict]:
    """Round-robin draw `target` rows evenly across non-empty strata.

    Returns (sampled_rows, realized_per_stratum). Fair by construction: each
    pass takes one row from every stratum that still has rows, so coverage is
    balanced and any shortfall is spread, not concentrated.
    """
    buckets = {k: v[:] for k, v in pools.items() if v}
    for v in buckets.values():
        rng.shuffle(v)
    out, realized = [], Counter()
    while len(out) < target and any(buckets.values()):
        for k in list(buckets):
            if not buckets[k]:
                continue
            out.append(buckets[k].pop())
            realized[k] += 1
            if len(out) >= target:
                break
    return out, dict(realized)


# ------------------------------------------------------- source collectors
# Each returns {stratum: [rows]} of QC-passing candidates (NOT yet sampled).

def collect_code() -> dict[str, list]:
    from datasets import load_dataset
    ds = load_dataset("bigcode/self-oss-instruct-sc2-exec-filter-50k", split="train")
    pools: dict[str, list] = {"short": [], "medium": [], "long": []}
    for r in ds:
        instr, resp = r.get("instruction", ""), r.get("response", "")
        if not qc(CODE, instr, resp, is_code=True, min_out=40):
            continue
        band = "short" if len(resp) < 600 else "medium" if len(resp) < 1500 else "long"
        pools[band].append(_row(CODE, instr, resp))
    print(f"[code] candidates: " + ", ".join(f"{k}={len(v)}" for k, v in pools.items()))
    return pools


def collect_aya() -> dict[str, list]:
    from datasets import load_dataset
    ds = load_dataset("CohereForAI/aya_dataset", split="train")
    pools: dict[str, list] = {}
    for r in ds:
        lang = r.get("language")
        if lang not in INDIAN_LANGS:
            continue
        inp, tgt = r.get("inputs", ""), r.get("targets", "")
        if qc(MIRROR, inp, tgt, lang=lang):
            pools.setdefault(lang, []).append(_row(MIRROR, inp, tgt))
    print(f"[aya] candidates by language: "
          + ", ".join(f"{k}={len(v)}" for k, v in sorted(pools.items())))
    return pools


def _first_pair(interactions):
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


def collect_indic() -> dict[str, list]:
    from datasets import load_dataset
    pools: dict[str, list] = {}
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
            if user and asst and qc(MIRROR, user, asst):
                pools.setdefault(config, []).append(_row(MIRROR, user, asst))
                got += 1
        print(f"[indic] {config}: {got} candidates")
    return pools


# ---------------------------------------------------------------- main
def main():
    plan = [("code", collect_code), ("aya", collect_aya), ("indic", collect_indic)]
    all_rows, report = [], {}
    for name, collect in plan:
        try:
            pools = collect()
        except Exception as exc:
            print(f"[{name}] FAILED to load: {exc}")
            report[name] = {"target": BLEND[name], "got": 0, "shortfall": BLEND[name]}
            continue
        target = BLEND[name]
        sampled, realized = stratified_sample(pools, target)
        all_rows.extend(sampled)
        report[name] = {
            "target": target, "got": len(sampled),
            "shortfall": max(0, target - len(sampled)),
            "per_stratum": realized,
        }

    rng.shuffle(all_rows)
    with DST.open("w", encoding="utf-8", newline="\n") as f:
        for r in all_rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print("\n===== enforced-blend report =====")
    total = len(all_rows)
    for name, info in report.items():
        pct = 100 * info["got"] / total if total else 0
        line = f"{name:6} target={info['target']:5} got={info['got']:5} ({pct:4.1f}%)"
        if info["shortfall"]:
            line += f"  SHORTFALL={info['shortfall']}"
        print(line)
        if info.get("per_stratum"):
            print("        strata: " + ", ".join(
                f"{k}={v}" for k, v in sorted(info["per_stratum"].items())))
    print(f"total external rows: {total} -> {DST}")
    if any(i["shortfall"] for i in report.values()):
        print("NOTE: a source underdelivered its target — lower its BLEND target "
              "or loosen its QC to restore the intended ratio.")
    print("Keep source attribution in the model card (see DATASETS.md).")


if __name__ == "__main__":
    main()
