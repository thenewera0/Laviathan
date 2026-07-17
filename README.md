# LEVIATHAN — Phases 1–3: Voice · Tools · Memory & Research

A voice-driven agentic AI companion. You speak, it hears, it reasons, it
**acts**, and it answers aloud — while looking alive: a fluid, iridescent
deep-sea entity whose form is its state.

**Phase 1:** wake word ("leviathan") · push-to-talk (hold Space) ·
speech → LLM → spoken reply, streaming over WebSocket · barge-in (talk over
it and it yields) · the living entity UI with five states (idle drift /
listening focus + voice ripple / thinking veins / speaking pulse / error
recoil) · word-by-word serif captions · in-session conversation memory.

**Phase 2:** function calling + the first six tools —

| Tool | What happens | Needs |
|---|---|---|
| `web_search` | live search (DuckDuckGo keyless; Tavily if keyed) | nothing |
| `open_url` | a link card surfaces on screen (+ new tab) | nothing |
| `play_music` | finds the song, embeds a player | nothing |
| `run_code` | Python in an isolated Docker sandbox — never the host | Docker Desktop |
| `generate_image` | FLUX image, shown in the UI (Pollinations keyless; HF if keyed) | nothing |
| `see` | one camera frame → Gemini vision describes it | GEMINI_API_KEY |

While it works, tool activity streams into the UI as a live
**ThoughtStream** ("casting a net across the surface — …") instead of a
spinner. The clarify-before-acting rule guards the high-effort tools:
a vague "make me an image" gets one focused question first.

**Phase 3:** it remembers you, reads real pages, and researches in the
background —

| Capability | What happens | Needs |
|---|---|---|
| `remember` / `recall` | durable facts stored with Gemini embeddings in a local SQLite vector store; relevant memories auto-surface every turn ("CURRENTS OF MEMORY") | nothing (better with GEMINI_API_KEY) |
| `browse` | reads a full page rendered in headless Chromium (falls back to plain fetch) | `playwright install chromium` |
| `research_agent` | background job: plans queries → searches → reads up to 5 pages → writes a sourced markdown report; progress shows in a **task panel**, the finished report surfaces on screen and is announced aloud; reports persist to `backend/data/reports/` | nothing |

Try: *"my name is Sam and I prefer metric units — remember that"* (then
ask *"what units do I like?"* in a later session) · *"read
example.com/some-article and give me the gist"* · *"research the current
state of solid-state batteries"* — then keep talking; the report
surfaces when it's ready.

**Architecture note (honest deviation):** the blueprint names
Supabase/pgvector and Celery+Redis. Neither exists on a fresh machine,
so Phase 3 ships the same *semantics* on local infrastructure — SQLite
vector store with cosine recall ([memory.py](backend/brain/memory.py)),
asyncio background tasks ([manager.py](backend/tasks/manager.py)) —
behind interfaces shaped so pgvector/Celery can replace them without
touching callers. Working software today; scale-out later.

---

## Layout

```
backend/            FastAPI + WebSocket gateway (all model keys live here)
  main.py           app + /ws + /health + optional /stt
  config.py         loads backend/.env — keys NEVER leave the backend
  brain/            router (OpenRouter → Gemini → mock) · think loop · persona
  voice/            optional server-side faster-whisper STT
web/                Next.js PWA
  components/Entity R3F entity — custom vertex/fragment shaders
  lib/              voice engine · WebSocket client · zustand store
```

## Setup

### 1. Backend

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate          # (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env          # then add a key (optional — see below)
uvicorn main:app --reload --port 8000
```

Sanity check: http://localhost:8000/health should report `"status": "surfaced"`.

**Keys (optional to start):** put an `OPENROUTER_API_KEY`
(openrouter.ai — free-tier models available) or `GEMINI_API_KEY`
(aistudio.google.com) in `backend/.env`. With **no key at all** Leviathan
runs a mock brain so you can verify the whole voice loop first.

### 2. Web

```powershell
cd web
npm install
npm run dev
```

Open **http://localhost:3000** in **Chrome or Edge** (the Web Speech API
lives there; Firefox/Safari fall back to push-to-talk-less viewing).

### 3. Speak to it

1. Click **“click to surface”** (one gesture — the browser requires it to
   unlock mic + audio) and allow the microphone.
2. Say **“leviathan”**, then your request — or **hold Space** while you talk.
3. Talk over it any time: it stops and listens (barge-in).

If the frontend must reach a non-local backend, set
`NEXT_PUBLIC_LEVIATHAN_WS=ws://host:8000/ws` in `web/.env.local`.

## How Phase 1 hears and speaks (and what upgrades later)

Voice runs **in the browser** for Phase 1 — Web Speech API for recognition
and wake-word spotting, `speechSynthesis` (pitched low, slowed) for the
voice. Zero install, lowest latency, works today.

The blueprint's local stack is already socketed in: enable
`LEVIATHAN_SERVER_STT=1` + install `faster-whisper` (uncomment it in
`requirements.txt`) for server-side transcription via `POST /stt`; Piper
TTS and openWakeWord slot into `backend/voice/` when voice *quality*
becomes the priority over setup cost.

## Hard rules already enforced

- **Keys live only in `backend/.env`** (gitignored). The browser talks to
  the backend over WebSocket; it never sees a provider key.
- **Clarify before acting** is in the system prompt: vague high-effort
  requests get one focused question with options before any work starts.
- Reduced motion is respected (`prefers-reduced-motion` stills the entity).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `○ SEVERED` in the top-left | backend not running on :8000 — start uvicorn |
| `MIC DENIED` | grant mic permission in the address bar, reload |
| Wake word never triggers | Chrome/Edge only; check the mic works; or hold Space |
| Replies are canned lines about "add a key" | that's the mock brain — add a key to `backend/.env`, restart uvicorn |
| Free OpenRouter model errors | free-tier models rate-limit; retry or switch `OPENROUTER_MODEL` |

## Deployment (all free tiers)

| Piece | Where | Notes |
|---|---|---|
| `backend/` | **Render** free web service (Singapore) | `uvicorn main:app --host 0.0.0.0 --port $PORT`; health check `/health` |
| `web/` | **Render** static site (or Vercel) | `npm install && npm run build`, publish `web/out` (static export) |
| memory | **Supabase** pgvector (Mumbai) | set `SUPABASE_DB_URL` on the backend — SESSION POOLER string only |
| keep-awake | **GitHub Actions** cron | [.github/workflows/keepalive.yml](.github/workflows/keepalive.yml) pings `/health` every 10 min so the free instance never sleeps |

Free-tier truths:
- Render free = 750 instance-hours/month. One always-awake service ≈ 720.
  Keep exactly one free backend per workspace.
- The free instance has 512 MB RAM — Chromium is not installed there, so
  `browse` uses its plain-fetch fallback in the cloud (full rendering
  still works locally). `run_code` needs Docker and reports itself
  unavailable in the cloud. Reports/media on disk are ephemeral; memory
  is NOT — it lives in Supabase.
- Set secrets ONLY in Render env vars (`GEMINI_API_KEY`,
  `SUPABASE_DB_URL`). Never commit them — this repo is public.
- Supabase pauses free projects after ~7 days of inactivity; Leviathan's
  per-turn recall counts as activity when it's used.
- Frontend needs `NEXT_PUBLIC_LEVIATHAN_WS=wss://<backend>.onrender.com/ws`
  at build time.

## Next: Phase 4 — Multimodal & Gestures

Live translation, MediaPipe hand gestures, gaze-follow from the webcam
(replacing the cursor stand-in), and screen understanding. Per the
blueprint: Phases 1–3 must run end-to-end before Phase 4 begins.
