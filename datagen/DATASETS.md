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

### Other high-quality open datasets worth folding in (future batches)

These are genuine **instruction/text** datasets (verify names/licences before
ingest; most are on Hugging Face, not the repos above):

- **CohereForAI/aya_dataset** — massively multilingual *human-written*
  instructions incl. many Indian languages. Best single fit for the
  global + Indian goal.
- **AI4Bharat Airavata / indic-instruct-data** — Hindi instruction tuning set.
- **databricks-dolly-15k**, **OpenAssistant/oasst1** — general English quality
  and multi-turn tone; keep 10–20% mixed in to prevent catastrophic forgetting.
- **sarvamai** open Indic instruction data.

Fold each in as a `batchN_*.py` that downloads, filters to high quality,
reshapes to `{instruction, input, output}`, and returns rows — same as
`batch2_register.py`.

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
3. **Batch 3** — IndicTrans2 augmentation of batch-2 prose into 20+ Indic
   languages (`augment_indic.py`, on Kaggle). (~1,500)
4. **Batch 4** — domain depth for the resort/hospitality + agriculture users:
   bookings, guest comms, inventory, crop/mandi/weather advisories.
5. **Batch 5** — coding depth: real bug-fix diffs, multi-file reasoning,
   Leviathan-codebase-specific tasks.
6. **Batch 6** — multi-turn conversations (context carry, follow-ups,
   clarifying questions) rather than single-shot rows.
7. **Batch 7** — Aya / Dolly / OASST high-quality general instructions,
   filtered, to keep broad capability and non-Indian global registers.
8. **Batch 8–10** — safety/refusal breadth, long-form research/report style,
   and evaluation-driven gap-filling from real test failures.
