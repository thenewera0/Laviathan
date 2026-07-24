# LEVIATHAN — Phases 1–4: Voice · Tools · Memory & Research · Multimodal

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

**Phase 4:** it watches, gestures back, and speaks other tongues —

| Capability | What happens | Needs |
|---|---|---|
| **gestures** (opt-in toggle, bottom-left) | MediaPipe reads one hand ON-DEVICE: open palm = hush + dismiss · 👍/👎 = yes/no · V-sign = start listening without the wake word | camera, Chrome/Edge |
| **gaze-follow** | while gestures are on, the entity leans toward your actual face instead of the cursor (face detection on-device, nothing uploaded) | camera |
| `see_screen` | "what's on my screen?" → you pick a window in the browser's share dialog, ONE frame goes to Gemini vision, sharing stops | GEMINI_API_KEY |
| `set_translation` | "translate everything I say into Spanish" → every utterance is translated and SPOKEN in a matching voice until you say "stop translating" | — |

Honest limits: mic recognition stays English (Web Speech `en-US`), so
live translation is English → target for now; gesture models (~8 MB)
download from Google's CDN the first time you toggle gestures on.

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

## Control your PC (companion)

Let Leviathan open folders, files, apps, and websites on your computer by
voice. Run the companion **on that PC**:

```powershell
cd companion
pip install -r requirements.txt
python leviathan_companion.py
```

It prints a 6-digit code. Tell Leviathan *"pair with my computer, the
code is 123456"*, then say things like *"open my Downloads folder"*,
*"launch Notepad"*, *"open spotify"*, *"open gmail.com"*.

Safety by design: the companion connects **out** to Leviathan (nothing
reaches into your PC uninvited); it **only opens** things — no shell
commands, no deleting or modifying files; every action is printed in its
window; closing the window ends all control instantly. Point it at a
local backend with `LEVIATHAN_BACKEND=ws://localhost:8000`.

## Multi-Provider AI Gateway & Failover

Leviathan AI includes a built-in **FastAPI AI Gateway** supporting automatic failover across free-tier AI providers.

- **Supported Providers**: Google Gemini, Groq Cloud, OpenRouter, Mistral AI, Cohere, Hugging Face.
- **Failover Logic**: When a provider returns `HTTP 429` or an error, the Gateway automatically retries with the next available provider, placing rate-limited providers on a 60-second cooldown.
- **Protected Endpoint**: `POST /v1/chat` & `POST /v1/chat/completions` (requires `X-API-Key` or Bearer token).
- **API Keys Manager**: Generate, list, and revoke single-channel internal API keys (`lvh-live-...`) directly in the Leviathan Dashboard under **API KEYS**.

### How to Add a New AI Provider to the Gateway

To extend the Gateway with a new provider (e.g. Venice AI, Ollama, DeepSeek):

1. **Add Key to `backend/config.py` & `.env`**:
   ```python
   newprovider_api_key: str = os.getenv("NEWPROVIDER_API_KEY", "")
   ```

2. **Add Provider Handler to `backend/brain/gateway.py`**:
   ```python
   async def _call_newprovider(self, messages: List[Dict[str, str]], model: Optional[str], temperature: float) -> str:
       url = "https://api.newprovider.com/v1/chat"
       headers = {"Authorization": f"Bearer {settings.newprovider_api_key}"}
       async with httpx.AsyncClient(timeout=45.0) as client:
           resp = await client.post(url, headers=headers, json={"messages": messages})
           resp.raise_for_status()
           return resp.json()["reply"]
   ```

3. **Register in Provider Chain**:
   In `AIGateway.get_active_providers()` and `_call_provider()`, add `"newprovider"` to the execution list.

---

## Deployment & Keep-Alive

### Render.com Deployment Settings
- **Service Type**: Web Service (Python)
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Environment Variables**: Add `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `MISTRAL_API_KEY`, `LEVIATHAN_MASTER_KEY`, etc.

### Cron-Job.org Keep-Alive Setup (No Downtime)
1. Go to [cron-job.org](https://cron-job.org).
2. Create a new Cron Job with URL: `https://your-leviathan-backend.onrender.com/health`.
3. Set schedule to **Every 12 minutes**.
4. Save. This keeps the free Render instance active 24/7 with zero cold starts!
