# Data sources & batch roadmap

Goal: a model that **answers in the user's own language and regional register**
— honest, high-quality, Indian-first but globally complete — trained toward
**10,000+ rows across 5–10 batches**.

## How the dataset is built

`python datagen/build_dataset.py` is the single entry point. It:
1. loads `datagen/seed_rows.jsonl` (95 hand-curated rows),
2. generates the grounded core (tool-calls, DB, research, math, JSON-IO, code),
3. auto-loads every `datagen/batches/batch*.py` plugin (each returns rows),
4. dedupes by input and writes `leviathan_train.jsonl`, validating as it goes.

Add a batch = drop a `batchN_*.py` in `datagen/batches/` exposing `rows()`.
Nothing else to wire.

## External sources — what we actually use, and how

Honest assessment of the AI4Bharat repos and where each fits:

| Repo | What it really is | Use in this project |
|---|---|---|
| [NPTEL2020-Indian-English-Speech](https://github.com/AI4Bharat/NPTEL2020-Indian-English-Speech-Dataset) | Indian-accented **English speech** (ASR: audio + transcripts) | **Not used for text SFT.** It's speech data; transcripts are lecture sentences, not instructions. Relevant only if we later train STT, which Leviathan already delegates to Whisper. |
| [IndicVoices](https://github.com/AI4Bharat/IndicVoices) | Multilingual **speech corpus**, 22 languages (ASR/TTS) | **Not used for text SFT**, same reason. A future STT/TTS effort could use it. |
| [IndicTrans2](https://github.com/AI4Bharat/IndicTrans2) | SOTA **translation model**, En↔22 Indic langs | **Used as an augmentation engine** in `augment_indic.py` — translates our verified English/Hindi prose rows into 20+ Indic languages on Kaggle (GPU). This is how bulk Indic coverage is produced without hand-forging unverifiable text. |
| [indic-numtowords](https://github.com/AI4Bharat/indic-numtowords) | Number → words **library**, Indic langs | **Used as a verbalizer** in `augment_indic.py` to generate correct number/currency-in-words rows. |

Why we don't just clone the speech repos: they're large ASR corpora, not
Alpaca instruction data — pulling them in would bloat the repo and teach
nothing about instruction-following.

### Verified external instruction datasets (wired into `ingest_external.py`)

Checked Jul 2026 — exact IDs, licences, and schemas confirmed on Hugging Face.
`datagen/ingest_external.py` pulls these on Kaggle, runs a **QC pass** on every
candidate, then **stratified-samples** to an **enforced blend** (not just caps).
All three permit commercial use **with attribution** — keep the attribution
block in your model card.

**QC pass** (per candidate): length bounds; drop echoes (input == output),
refusal/boilerplate openers, replacement-char `�` rows, and repetitive
degenerate output; require balanced code fences for code; require
**script-consistency** for language rows (e.g. a row labelled Tamil whose
answer is actually Latin or Devanagari is dropped — catches mislabeled/empty
data); dedupe by both input key and normalized output (cross-source).

**Enforced blend** (`BLEND` in the script): each source has a *target* count,
and rows are drawn **round-robin across strata** — aya by language,
indic-align by config, code by length band — so no single language/config/band
dominates. A drained stratum redistributes to the others; a source that can't
meet its target reports the **shortfall** instead of being silently backfilled
(which would break the ratio). The script prints a realized-composition report.

| Dataset (HF id) | Licence | Size | Why | Our mapping |
|---|---|---|---|---|
| `bigcode/self-oss-instruct-sc2-exec-filter-50k` | ODC-BY | 50.7k | **Coding depth**, execution-validated, open-model synthetic (no closed-model distillation → clean provenance) | `instruction`→instruction, `response`→output |
| `CohereForAI/aya_dataset` | Apache-2.0 | 202k | **Human-written** multilingual instructions; we keep the 10+ Indian languages → directly serves "reply in the user's language" | `inputs`→input, `targets`→output, mirror instruction |
| `ai4bharat/indic-align` | CC-BY-4.0 | many configs (Anudesh 36.8k, Dolly_T 15k, WikiHow 20.3k, …) | **Indic instruction/conversation** breadth across 14+ languages | first user/assistant turn of single-turn rows |

Considered but **not** auto-ingested:
- **Function-calling sets** (`glaiveai/glaive-function-calling-v2` Apache-2.0,
  `NousResearch/hermes-function-calling-v1` Apache-2.0) — their tool schemas
  differ from Leviathan's `registry.py` contract. Mixing them risks teaching a
  *different* tool format. We keep tool-calls native to `build_dataset.py`. Use
  these only if you first remap them onto Leviathan's exact tool names/args.
- **UPDESH** (9.5M, 13 Indic langs) and **IndicLLMSuite / IndicAlign-Instruct**
  (74.8M pairs) — enormous; sample a high-quality slice rather than ingesting
  whole. Good source for a later mega-batch.

**Attribution block for the model card:**
```
Training data includes:
- bigcode/self-oss-instruct-sc2-exec-filter-50k (ODC-BY)
- CohereForAI/aya_dataset (Apache-2.0)
- ai4bharat/indic-align (CC-BY-4.0)
- AI4Bharat IndicTrans2 (translation augmentation) and indic-numtowords
```

## Register-mirroring contract (Batch 2)

The model must reply in the **same** language/variety the user used:
British / American / Australian / Indian English, Hinglish, Hindi, and (via
IndicTrans2) the other Indic languages — matching spelling, vocabulary, and
idiom, never caricaturing, never inventing live data. `batch2_register.py`
teaches this with parallel same-question/six-register sets, explicit
"talk to me in X" requests, Indian-English idiom handled naturally,
practical Hinglish/Hindi Q&A, number/currency localization (lakh/crore vs
million), and verified Indic-script greeting anchors.

## Batch roadmap to 10k+

1. **Batch 1 (done)** — grounded core: tool-calls, DB, research, math,
   JSON-IO, code/refactor, CLI/error/ML knowledge, consent/safety. (~2,000)
2. **Batch 2 (done)** — language & register mirroring. (~250 hand-authored)
3. **Batch 3 (script ready)** — external ingestion via `ingest_external.py`
   on Kaggle: self-oss-instruct (code) + Aya (Indian-language human
   instructions) + indic-align. (~10k, QC'd + stratified to an enforced blend)
4. **Batch 3b (script ready)** — IndicTrans2 augmentation of batch-2 prose
   into 20+ Indic languages (`augment_indic.py`, on Kaggle). (~1,500)
5. **Batch 4** — domain depth for the resort/hospitality + agriculture users:
   bookings, guest comms, inventory, crop/mandi/weather advisories.
6. **Batch 5** — coding depth specific to Leviathan's own codebase: bug-fix
   diffs, multi-file reasoning, the router/tool contract.
7. **Batch 6** — multi-turn conversations (context carry, follow-ups,
   clarifying questions) rather than single-shot rows.
8. **Batch 7–10** — safety/refusal breadth, long-form research/report style,
   non-Indian global registers, and evaluation-driven gap-filling from real
   test failures.

At full blend (core ~2.1k + Batch 2 + `ingest_external.py` ~10k + `augment_indic.py`
~1.5k) the training set clears the **10,000+** target with a balanced mix.
