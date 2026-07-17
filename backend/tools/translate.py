"""set_translation — flips the session into live translation mode.

While active, every utterance is translated directly (no tool loop) and
spoken in the target language's voice. The user exits by saying
"stop translating" (checked in loop.py before translation happens).
"""

LANG_CODES = {
    "arabic": "ar", "bengali": "bn", "chinese": "zh", "dutch": "nl",
    "english": "en", "french": "fr", "german": "de", "hindi": "hi",
    "indonesian": "id", "italian": "it", "japanese": "ja", "korean": "ko",
    "malayalam": "ml", "marathi": "mr", "portuguese": "pt", "russian": "ru",
    "spanish": "es", "tamil": "ta", "telugu": "te", "thai": "th",
    "turkish": "tr", "urdu": "ur", "vietnamese": "vi",
}


async def run(session, language: str = "", off: bool = False) -> dict:
    if off or not language:
        session.translate_lang = None
        session.translate_lang_name = None
        await session.send({"type": "translation", "lang": None})
        return {"status": "translation mode off"}

    name = language.strip().lower()
    code = LANG_CODES.get(name)
    if not code:
        return {
            "error": f"unknown language '{language}' — supported: "
            + ", ".join(sorted(LANG_CODES))
        }
    session.translate_lang = code
    session.translate_lang_name = name.capitalize()
    await session.send({"type": "translation", "lang": code, "name": name})
    return {
        "status": f"live translation to {name} is ON. Everything the user "
        "says will now be translated and spoken aloud. They say 'stop "
        "translating' to end it. Confirm briefly."
    }
