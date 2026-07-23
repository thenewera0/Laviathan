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
from voice import neural_tts, stt

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
        "neural_tts": neural_tts.available(),
    }


@app.post("/tts")
async def tts(request: Request):
    """Signature neural voice: text -> audio (edge-tts primary, Gemini
    fallback). 503 -> client uses its pinned browser voice."""
    from fastapi import Response

    body = await request.json()
    text = (body.get("text") or "").strip()
    if not text:
        return Response(status_code=400)
    result = await neural_tts.synthesize(text, body.get("voice"))
    if not result:
        return Response(status_code=503)
    audio, mime = result
    return Response(content=audio, media_type=mime)


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
            if msg.get("type") == "hello":
                entry = companions.by_ws(ws)
                if entry:
                    entry["name"] = str(msg.get("name") or "PC")
            elif msg.get("type") == "result":
                entry = companions.by_ws(ws)
                if entry and entry["session"] is not None:
                    entry["session"].resolve_pc(msg)
    except WebSocketDisconnect:
        entry = companions.drop_ws(ws)
        if entry and entry["session"] is not None:
            session = entry["session"]
            # remove this device from the session's roster
            for dname, dentry in list(session.devices.items()):
                if dentry is entry:
                    session.devices.pop(dname, None)
            try:
                await session._broadcast_devices()
            except Exception:
                pass


@app.websocket("/link/{token}")
async def link_endpoint(ws: WebSocket, token: str):
    """Guest side of a device link: pure SDP/ICE relay, nothing stored."""
    from linking import registry as links

    await ws.accept()
    claimed = links.claim(token, ws)
    if claimed is None:
        # Token unknown: the host never made this link, or a restart wiped
        # it and the host hasn't reconnected yet. Actionable message.
        await ws.send_text(json.dumps({"type": "link_invalid"}))
        await ws.close()
        return
    link, prev_guest = claimed

    # Last opener wins: kick any stale/previous guest off this token.
    if prev_guest is not None and prev_guest is not ws:
        try:
            await prev_guest.send_text(json.dumps({"type": "link_superseded"}))
            await prev_guest.close()
        except Exception:
            pass

    host = link["session"]
    try:
        # If the host session is gone (its main tab closed), tell the guest
        # clearly instead of a dead half-connection.
        try:
            await host.send({"type": "link_guest_joined", "purpose": link["purpose"]})
        except Exception:
            await ws.send_text(json.dumps({"type": "link_host_offline"}))
            await ws.close()
            return
        await ws.send_text(json.dumps({"type": "link_ready", "purpose": link["purpose"]}))
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if msg.get("type") == "signal":
                # host may have reconnected: re-fetch the current session
                cur = links.LINKS.get(token, link)["session"]
                try:
                    await cur.send({"type": "link_signal", "data": msg.get("data")})
                except Exception:
                    await ws.send_text(json.dumps({"type": "link_host_offline"}))
                    break
    except WebSocketDisconnect:
        pass
    finally:
        # Release only if THIS guest still owns the slot (a takeover may
        # have replaced us), keeping the token claimable for reconnects.
        links.release(token, ws)
        try:
            await host.send({"type": "link_closed"})
        except Exception:
            pass


@app.on_event("startup")
async def _start_scheduler():
    from scheduling import manager
    await manager.start()


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    from scheduling import manager

    await ws.accept()
    session = BrainSession(ws)
    await session.send_meta()
    await manager.register(session)  # proactive delivery target
    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue
            try:
                await session.handle(msg)
            except Exception:
                # one bad message/handler must never drop the whole session
                pass
    except WebSocketDisconnect:
        session._cancel_current()
    finally:
        manager.unregister(session)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)
