"""Leviathan Core — FastAPI app + WebSocket gateway.

Run:  uvicorn main:app --reload --port 8000
"""
import json
from pathlib import Path

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from brain.api_keys import (
    check_key_rate_limit,
    generate_api_key,
    list_api_keys,
    revoke_api_key,
    validate_api_key,
)
from brain.gateway import gateway
from brain.loop import BrainSession
from config import settings
from fastapi import File, Header, HTTPException, UploadFile
from voice import neural_tts, stt

app = FastAPI(title="Leviathan Core & AI Gateway", version="0.3.0")

# Uploads directory
UPLOADS_DIR = Path(__file__).parent / "media" / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

# Generated media (HF images etc.) served to the client
MEDIA_DIR = Path(__file__).parent / "media"
MEDIA_DIR.mkdir(exist_ok=True)
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "surfaced", "gateway": "online"}


@app.get("/v1/gateway/stats")
async def gateway_stats_endpoint():
    """Real-time AI Gateway provider health & rate budget stats."""
    return {
        "status": "online",
        "providers": gateway.get_gateway_stats(),
    }


# ---------------------------------------------------------------- AI Gateway APIs

@app.post("/v1/chat")
async def gateway_chat(
    request: Request,
    x_api_key: str = Header(None, alias="X-API-Key"),
    authorization: str = Header(None, alias="Authorization"),
):
    """Protected AI Gateway Chat Endpoint with Task Routing & Rate Budgeting."""
    api_key = x_api_key
    if not api_key and authorization and authorization.startswith("Bearer "):
        api_key = authorization.split("Bearer ")[1].strip()

    client_host = request.client.host if request.client else ""
    is_local_web = client_host in ("127.0.0.1", "localhost", "::1")

    if is_local_web:
        valid_key = True
        key_id = "local"
    else:
        valid_key, key_id = validate_api_key(api_key)

    if not valid_key:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing X-API-Key header. Generate a key in the Leviathan Dashboard.",
        )

    # Check key sliding window rate limit
    if not check_key_rate_limit(key_id):
        raise HTTPException(
            status_code=429,
            detail="API Key rate limit exceeded (max 60 requests/min). Please slow down.",
        )

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    prompt = body.get("prompt")
    system_prompt = body.get("system_prompt", "You are Leviathan AI, an advanced intelligent agent.")
    messages = body.get("messages", [])
    model = body.get("model")
    temperature = float(body.get("temperature", 0.7))
    files = body.get("files", [])

    if not messages and prompt:
        messages = [{"role": "user", "content": prompt}]

    if not messages:
        raise HTTPException(status_code=400, detail="Either 'prompt' or 'messages' array is required.")

    result = await gateway.chat_completion(
        messages=messages,
        model=model,
        system_prompt=system_prompt,
        temperature=temperature,
        has_files=bool(files),
    )
    return result


@app.post("/v1/chat/completions")
async def gateway_chat_completions(
    request: Request,
    x_api_key: str = Header(None, alias="X-API-Key"),
    authorization: str = Header(None, alias="Authorization"),
):
    """OpenAI-Compatible Chat Endpoint."""
    res = await gateway_chat(request, x_api_key, authorization)
    if not res.get("success"):
        raise HTTPException(status_code=500, detail=res.get("reply"))

    return {
        "id": f"chatcmpl-{settings.active_model}",
        "object": "chat.completion",
        "created": 1700000000,
        "model": res.get("model", "leviathan-auto"),
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": res.get("reply", ""),
                },
                "finish_reason": "stop",
            }
        ],

        "provider_used": res.get("provider", "gateway"),
    }


# ---------------------------------------------------------------- API Key Management

@app.post("/v1/keys/generate")
async def generate_key_endpoint(request: Request):
    """Generate a new internal API key."""
    try:
        try:
            body = await request.json()
        except Exception:
            body = {}
        label = body.get("label", "App Key")
        new_key = generate_api_key(label=label)
        return {"success": True, "key_info": new_key}
    except Exception as err:
        print(f"Key generation failed: {err}")
        raise HTTPException(status_code=500, detail=f"Key generation failed: {str(err)}")


@app.get("/v1/keys")
async def list_keys_endpoint():
    """List all active API key prefixes."""
    try:
        keys = list_api_keys()
        return {"success": True, "keys": keys}
    except Exception as err:
        print(f"Key listing failed: {err}")
        return {"success": True, "keys": []}


@app.delete("/v1/keys/{key_id}")
async def revoke_key_endpoint(key_id: str):
    """Revoke an API key."""
    try:
        success = revoke_api_key(key_id)
        if not success:
            raise HTTPException(status_code=404, detail="Key ID not found")
        return {"success": True, "message": "Key revoked"}
    except HTTPException:
        raise
    except Exception as err:
        print(f"Key revocation failed: {err}")
        raise HTTPException(status_code=500, detail=f"Key revocation failed: {str(err)}")


# ---------------------------------------------------------------- File Upload Route

@app.post("/v1/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload files (images, pdfs, docs) for Chat Studio context."""
    ext = Path(file.filename).suffix
    file_id = f"doc_{Path(file.filename).stem}_{int(settings.port)}{ext}"
    target_path = UPLOADS_DIR / file_id
    with target_path.open("wb") as buffer:
        content = await file.read()
        buffer.write(content)

    return {
        "success": True,
        "filename": file.filename,
        "url": f"/media/uploads/{file_id}",
        "size": len(content),
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
