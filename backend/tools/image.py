"""generate_image — FLUX.1-schnell via HF Inference when HF_TOKEN is set,
otherwise Pollinations (keyless, free). Either way the client receives a
show_image action and the model receives the URL.
"""
import time
import urllib.parse
from pathlib import Path

import httpx

from config import settings

MEDIA_DIR = Path(__file__).resolve().parent.parent / "media"
MEDIA_DIR.mkdir(exist_ok=True)

SIZES = {"square": (1024, 1024), "wide": (1280, 720), "tall": (720, 1280)}


async def run(session, prompt: str, aspect: str = "square") -> dict:
    width, height = SIZES.get(aspect, SIZES["square"])

    if settings.hf_token:
        url = await _huggingface(prompt, width, height)
    else:
        encoded = urllib.parse.quote(prompt[:800])
        url = (
            f"https://image.pollinations.ai/prompt/{encoded}"
            f"?width={width}&height={height}&nologo=true&model=flux"
        )

    await session.send(
        {"type": "action", "action": "show_image", "url": url, "title": prompt[:120]}
    )
    return {"status": "image generated and shown to the user", "url": url}


async def _huggingface(prompt: str, width: int, height: int) -> str:
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
            headers={"Authorization": f"Bearer {settings.hf_token}"},
            json={
                "inputs": prompt,
                "parameters": {"width": width, "height": height},
            },
        )
        resp.raise_for_status()
    name = f"img_{int(time.time() * 1000)}.png"
    (MEDIA_DIR / name).write_bytes(resp.content)
    return f"http://localhost:{settings.port}/media/{name}"
