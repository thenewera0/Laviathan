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
    record_key_usage,
    revoke_api_key,
    validate_api_key,
)
from brain.gateway import gateway
from brain.loop import BrainSession
from config import settings
from fastapi import File, Header, HTTPException, UploadFile
from tools import workflow_library
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
@app.get("/v1/health")
async def health():
    return {"status": "surfaced", "gateway": "online"}


@app.get("/v1/models")
async def list_models():
    """OpenAI-compatible models list endpoint."""
    # These IDs are verified against each provider's live model list. Clients
    # copy them straight out of here, so a stale entry becomes a hard failure
    # downstream — which is exactly how "leviathan-auto" broke the fallback.
    # Older friendly IDs still work via MODEL_ALIASES in the gateway.
    return {
        "object": "list",
        "data": [
            {"id": "leviathan-auto", "object": "model", "created": 1700000000, "owned_by": "leviathan"},
            {"id": "gemini-2.5-flash", "object": "model", "created": 1700000000, "owned_by": "google"},
            {"id": "llama-3.3-70b-versatile", "object": "model", "created": 1700000000, "owned_by": "groq"},
            {"id": "qwen/qwen3.6-27b", "object": "model", "created": 1700000000, "owned_by": "groq"},
            {"id": "nvidia/nemotron-3-super-120b-a12b:free", "object": "model", "created": 1700000000, "owned_by": "openrouter"},
            {"id": "mistral-small-latest", "object": "model", "created": 1700000000, "owned_by": "mistral"},
            {"id": "command-a-03-2025", "object": "model", "created": 1700000000, "owned_by": "cohere"},
        ],
    }


@app.get("/v1/models/{model_id}")
async def retrieve_model(model_id: str):
    """OpenAI-compatible model retrieval endpoint."""
    return {
        "id": model_id,
        "object": "model",
        "created": 1700000000,
        "owned_by": "leviathan",
    }


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

    if api_key:
        valid_key, key_id = validate_api_key(api_key)
    elif is_local_web:
        valid_key = True
        key_id = "local"
    else:
        valid_key = False
        key_id = "invalid"

    if not valid_key:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing X-API-Key header. Generate a key in the Leviathan Dashboard.",
        )

    # Check key sliding window rate limit
    if not check_key_rate_limit(key_id):
        raise HTTPException(
            status_code=429,
            detail="API Key rate limit exceeded. Heavy AI workloads (UNRESTRICTED tier) should optimize concurrency.",
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
    raw_max_tokens = body.get("max_tokens") or body.get("max_output_tokens")
    max_tokens = None
    if raw_max_tokens:
        try:
            max_tokens = int(raw_max_tokens)
        except ValueError:
            max_tokens = None

    if not messages and prompt:
        messages = [{"role": "user", "content": prompt}]

    if not messages:
        raise HTTPException(status_code=400, detail="Either 'prompt' or 'messages' array is required.")

    result = await gateway.chat_completion(
        messages=messages,
        model=model,
        system_prompt=system_prompt,
        temperature=temperature,
        max_tokens=max_tokens,
        has_files=bool(files),
        response_format=body.get("response_format"),
    )

    if result.get("success"):
        reply_text = result.get("reply", "")
        prompt_len = sum(len(m.get("content", "")) for m in messages)
        p_tok = max(1, prompt_len // 4)
        c_tok = max(1, len(reply_text) // 4)
        record_key_usage(key_id, p_tok, c_tok)
        result["usage"] = {
            "prompt_tokens": p_tok,
            "completion_tokens": c_tok,
            "total_tokens": p_tok + c_tok,
        }

    return result


@app.post("/v1/chat/completions")
async def gateway_chat_completions(
    request: Request,
    x_api_key: str = Header(None, alias="X-API-Key"),
    authorization: str = Header(None, alias="Authorization"),
):
    """OpenAI-Compatible Chat Completion Endpoint (streaming + non-streaming)."""
    import time

    from fastapi.responses import StreamingResponse

    try:
        body = await request.json()
    except Exception:
        body = {}
    stream = bool(body.get("stream"))

    res = await gateway_chat(request, x_api_key, authorization)
    now_ts = int(time.time())
    cmpl_id = f"chatcmpl-{now_ts}"
    model_id = res.get("model", "leviathan-auto")

    if not res.get("success"):
        # Honest, retryable error — NEVER a mock string a client can't parse.
        detail = res.get("reply", "All upstream AI providers are unavailable")
        if not stream:
            raise HTTPException(status_code=503, detail=detail)

        async def err_gen():
            payload = {
                "error": {"message": detail, "type": "upstream_unavailable",
                          "code": 503}
            }
            yield f"data: {json.dumps(payload)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(err_gen(), media_type="text/event-stream",
                                 status_code=503)

    content = res.get("reply", "")

    if not stream:
        return {
            "id": cmpl_id,
            "object": "chat.completion",
            "created": now_ts,
            "model": model_id,
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": content},
                "finish_reason": "stop",
            }],
            "usage": {
                "prompt_tokens": max(1, len(content) // 8),
                "completion_tokens": max(1, len(content) // 4),
                "total_tokens": max(2, len(content) // 3),
            },
            "provider": res.get("provider", "gateway"),
        }

    # Streaming: emit valid OpenAI SSE chunks so streaming clients parse the
    # full response (the gateway resolves the completion, then we stream it).
    async def gen():
        base = {"id": cmpl_id, "object": "chat.completion.chunk",
                "created": now_ts, "model": model_id}
        first = dict(base, choices=[{"index": 0, "delta": {"role": "assistant"},
                                     "finish_reason": None}])
        yield f"data: {json.dumps(first)}\n\n"
        step = 480
        for i in range(0, len(content), step):
            chunk = dict(base, choices=[{"index": 0,
                         "delta": {"content": content[i:i + step]},
                         "finish_reason": None}])
            yield f"data: {json.dumps(chunk)}\n\n"
        last = dict(base, choices=[{"index": 0, "delta": {},
                                    "finish_reason": "stop"}])
        yield f"data: {json.dumps(last)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream")


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


# ---------------------------------------------------------------- n8n Workflow Library

@app.get("/v1/workflows/categories")
async def workflow_categories():
    """List every integration category in the workflow library with counts."""
    return await workflow_library.run(None, action="browse_categories")


@app.get("/v1/workflows/search")
async def workflow_search(q: str = "", category: str = "", limit: int = 30):
    """Relevance-ranked search across the workflow catalog."""
    return await workflow_library.run(
        None, action="search", query=q, category=category, limit=limit
    )


@app.get("/v1/workflows/{workflow_id}")
async def workflow_details(workflow_id: str):
    """Fetch a workflow's full JSON (nodes/connections) from GitHub."""
    res = await workflow_library.run(None, action="get_details", id=workflow_id)
    if not res.get("success"):
        raise HTTPException(status_code=404, detail=res.get("error", "Workflow not found"))
    return res


@app.post("/v1/workflows/deploy")
async def workflow_deploy(request: Request):
    """Import a library workflow into the connected n8n instance."""
    try:
        body = await request.json()
    except Exception:
        body = {}

    workflow_id = str(body.get("id") or "").strip()
    raw_url = body.get("github_raw_url") or ""
    if not workflow_id and not raw_url:
        raise HTTPException(status_code=400, detail="Provide a workflow 'id' or 'github_raw_url'")

    res = await workflow_library.run(
        None,
        action="deploy",
        id=workflow_id,
        github_raw_url=raw_url,
        name=body.get("name", ""),
    )
    if not res.get("success"):
        # n8n unreachable / unconfigured is the operator's setup problem, not a
        # bad request — surface it as 502 with the real reason.
        raise HTTPException(status_code=502, detail=res.get("error", "Deploy failed"))
    return res


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

    # A returning device presents its token in the query string and is restored
    # silently; a new one gets a pairing code to show on its screen.
    device_id = ws.query_params.get("device_id")
    token = ws.query_params.get("token")
    reg = companions.register(ws, device_id=device_id, token=token)

    if reg["mode"] == "paired":
        await ws.send_text(json.dumps({"type": "reconnected",
                                       "device_id": reg["device_id"]}))
    else:
        await ws.send_text(json.dumps({"type": "code", "code": reg["code"]}))

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
