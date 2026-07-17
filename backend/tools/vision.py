"""see — asks the client for a camera frame, then reads it with Gemini
vision. The camera activates only when this tool runs, and the browser's
permission prompt + indicator make that visible.
"""
import httpx

from config import settings

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "{model}:generateContent"
)


async def run(
    session, question: str = "What do you see?", source: str = "camera"
) -> dict:
    if not settings.gemini_api_key:
        return {
            "error": "vision requires a GEMINI_API_KEY on the backend — "
            "tell the user this sense is not yet connected"
        }

    frame_b64 = await session.request_frame(source)
    if not frame_b64:
        return {
            "error": f"no {source} frame arrived — the user may have "
            "denied access or cancelled the picker"
        }

    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"inlineData": {"mimeType": "image/jpeg", "data": frame_b64}},
                    {
                        "text": "You are the eyes of a voice assistant, "
                        + (
                            "looking at the user's screen. "
                            if source == "screen"
                            else "looking through the user's camera. "
                        )
                        + f"Answer concisely for speech: {question}"
                    },
                ],
            }
        ],
        "generationConfig": {"maxOutputTokens": 300},
    }
    async with httpx.AsyncClient(timeout=45) as client:
        resp = await client.post(
            GEMINI_URL.format(model=settings.gemini_model),
            headers={"x-goog-api-key": settings.gemini_api_key},
            json=payload,
        )
        resp.raise_for_status()
        data = resp.json()
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        return {"error": "vision model returned no description"}
    return {"observation": text}
