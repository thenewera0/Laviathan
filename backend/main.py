"""Leviathan Core — FastAPI app + WebSocket gateway.

Run:  uvicorn main:app --reload --port 8000
"""
import json
from pathlib import Path

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from brain.loop import BrainSession
from config import settings
from voice import stt

app = FastAPI(title="Leviathan Core", version="0.2.0")

# Generated media (HF images etc.) served to the client
MEDIA_DIR = Path(__file__).parent / "media"
MEDIA_DIR.mkdir(exist_ok=True)
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")

# No cookies/credentials are used, so a wildcard origin is safe here;
# the WebSocket carries no secrets and auth arrives in a later phase.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {
        "status": "surfaced",
        "provider": settings.provider,
        "model": settings.active_model,
        "server_stt": stt.available(),
    }


@app.post("/stt")
async def transcribe(request: Request):
    if not stt.available():
        return {"error": "server STT disabled", "text": ""}
    audio = await request.body()
    return {"text": stt.transcribe(audio)}


@app.websocket("/companion")
async def companion_endpoint(ws: WebSocket):
    """A local PC companion connects, gets a pairing code, and relays
    command results back to whichever session paired with it."""
    from linking import companions

    await ws.accept()
    code = companions.register(ws)
    await ws.send_text(json.dumps({"type": "code", "code": code}))
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if msg.get("type") == "result":
                entry = companions.by_ws(ws)
                if entry and entry["session"] is not None:
                    entry["session"].resolve_pc(msg)
    except WebSocketDisconnect:
        entry = companions.drop_ws(ws)
        if entry and entry["session"] is not None:
            entry["session"].companion = None
            try:
                await entry["session"].send(
                    {"type": "companion", "status": "offline"}
                )
            except Exception:
                pass


@app.websocket("/link/{token}")
async def link_endpoint(ws: WebSocket, token: str):
    """Guest side of a device link: pure SDP/ICE relay, nothing stored."""
    from linking import registry as links

    await ws.accept()
    link = links.claim(token, ws)
    if link is None:
        await ws.send_text(json.dumps({"type": "link_invalid"}))
        await ws.close()
        return

    host = link["session"]
    try:
        await host.send({"type": "link_guest_joined", "purpose": link["purpose"]})
        await ws.send_text(json.dumps({"type": "link_ready", "purpose": link["purpose"]}))
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if msg.get("type") == "signal":
                await host.send({"type": "link_signal", "data": msg.get("data")})
    except WebSocketDisconnect:
        pass
    finally:
        links.drop(token)
        try:
            await host.send({"type": "link_closed"})
        except Exception:
            pass


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    session = BrainSession(ws)
    await session.send_meta()
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            await session.handle(msg)
    except WebSocketDisconnect:
        session._cancel_current()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
