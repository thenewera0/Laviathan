# Training Leviathan's brain (Qwen2.5-Coder-7B → GGUF → Ollama)

The dataset `leviathan_train.jsonl` (repo root) trains a small local model to
speak Leviathan's tool-call contract, answer stable knowledge directly, and
refuse to invent live data. Pipeline: **QLoRA on Kaggle → GGUF → Ollama →
wire into the backend as a provider.**

## 1. Build / refresh the dataset

```powershell
python datagen/build_dataset.py
```

Deterministic (seed 7). Reads `datagen/seed_rows.jsonl` (95 hand-curated rows)
and generates the full set. Rerun any time you add material — edit
`build_dataset.py`, not the output file.

Current size: **~2,000 rows**. Domains:

| Domain | What it teaches |
|---|---|
| Voice → tool_call (EN + Hinglish) | the exact router event for `pc_open`, `run_command`, `play_music`, `web_search`, `open_url`, `research_agent`, `remember`, `recall`, `see`, `see_screen`, `pair_computer`, `create_device_link`, `set_translation`, `read_path`, `preview_project`, `generate_image`, `browse` |
| Multi-step macros | ordered arrays of tool events |
| Supabase / asyncpg | minimal parametrized DB access in `memory.py` style |
| Research pipeline | task lifecycle frames + report contract |
| Exact math + JSON-IO | computed, always-correct outputs |
| Coding / refactor / regex | production-grade snippets, DRY pairs |
| Git / CLI / errors / ML | stable technical Q&A |
| Direct-answer vs tool | when NOT to call a tool |
| Consent / safety | refuse covert access, confirm destructive ops, capability honesty |

## 2. Train on Kaggle (free GPU)

1. New Notebook → **Accelerator: GPU T4 ×2**, **Internet: ON**.
2. Get the data in, either way:
   - **Upload**: Add Input → Upload `leviathan_train.jsonl` as a dataset named
     `leviathan-train`; or
   - **Clone**: first cell `!git clone https://github.com/thenewera0/Laviathan.git`
3. Run `training/kaggle_qwen_qlora.py` (paste into a cell or `%run` it).
4. ~3 epochs over ~2k short rows finishes in well under an hour on T4×2.

Output lands in `/kaggle/working/gguf/` — a `.gguf` file plus a ready
`Modelfile`. Download both from the **Output** tab.

## 3. Serve locally with Ollama

```powershell
# in the folder with the downloaded .gguf and Modelfile
ollama create leviathan -f Modelfile
ollama run leviathan          # sanity check
# serve on your LAN so other devices can reach it:
$env:OLLAMA_HOST = "0.0.0.0"; ollama serve
```

Ollama exposes an OpenAI-compatible endpoint at
`http://localhost:11434/v1/chat/completions`.

## 4. Wire it into the backend

`backend/brain/router.py` already speaks the OpenAI streaming + tool-call
protocol in `_stream_openrouter`. Adding an `ollama` provider is a thin variant:
same code path, base URL `http://localhost:11434/v1`, model `leviathan`, no API
key. Keep OpenRouter/DeepSeek as the escalation path for `research_agent`
synthesis and heavy coding via the existing `settings.provider` switch.

## Notes on scaling to 5k

Quality beats quantity for a behavior fine-tune — one hallucinated row teaches
hallucination. To grow toward 5k, add *new* grounded categories to
`build_dataset.py` (more tool paraphrases, more Supabase tables, more real
error messages), not more near-duplicate transforms. Keep 10–20% general
knowledge in the mix to avoid catastrophic forgetting.
