"""Tool registry — neutral schemas for function calling + dispatch.

Neutral schema shape: {name, description, parameters(JSON Schema)}.
The router converts per provider (OpenAI-style for OpenRouter, function
declarations for Gemini).
"""
import json
from typing import Any, Awaitable, Callable

from tools import (
    browse,
    browser_actions,
    code_run,
    computer,
    device_link,
    image,
    memory_tools,
    research,
    search,
    translate,
    vision,
)


async def _see_screen(session, question: str = "What is on the screen?") -> dict:
    return await vision.run(session, question, source="screen")

TOOL_SCHEMAS: list[dict] = [
    {
        "name": "web_search",
        "description": (
            "Search the live web. Use for anything time-sensitive, factual "
            "claims you are unsure of, or when the user asks to look "
            "something up. Returns titles, urls, snippets."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "search query"},
                "max_results": {"type": "integer", "description": "1-8, default 5"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "open_url",
        "description": (
            "Present a website to the user (opens on their screen as a "
            "link card). Use when they ask to open or visit a site."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "http(s) url to open"},
                "reason": {"type": "string", "description": "why, one short phrase"},
            },
            "required": ["url"],
        },
    },
    {
        "name": "play_music",
        "description": (
            "Find and play a song or video for the user (embedded player). "
            "Use when they ask to play, hear, or put on music."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "song/artist/video to play"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "run_code",
        "description": (
            "Execute Python inside an isolated Docker sandbox (no network, "
            "no filesystem). Use for calculation, data wrangling, or "
            "demonstrating code. Print what should be returned."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "python source to run"},
                "language": {"type": "string", "description": "only 'python' for now"},
            },
            "required": ["code"],
        },
    },
    {
        "name": "generate_image",
        "description": (
            "Create an image from a text prompt and show it to the user. "
            "High-effort: if the request is vague, ask ONE clarifying "
            "question (subject, style, mood) BEFORE calling this."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": "detailed image prompt: subject, style, lighting, mood",
                },
                "aspect": {
                    "type": "string",
                    "enum": ["square", "wide", "tall"],
                    "description": "aspect ratio, default square",
                },
            },
            "required": ["prompt"],
        },
    },
    {
        "name": "browse",
        "description": (
            "Read a specific web page (rendered like a real browser) and "
            "return its text. Use when the user names a page or when a "
            "search snippet is not enough. For general questions, prefer "
            "web_search first."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "http(s) page to read"},
                "purpose": {"type": "string", "description": "what to look for"},
            },
            "required": ["url"],
        },
    },
    {
        "name": "research_agent",
        "description": (
            "Launch DEEP multi-source background research (minutes, not "
            "seconds): plans queries, reads several pages, writes a "
            "sourced report shown on screen. High-effort: if the topic is "
            "vague, ask ONE clarifying question first. For quick facts "
            "use web_search instead. Returns immediately; the report "
            "arrives later."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "topic": {"type": "string", "description": "the research question"},
                "focus": {"type": "string", "description": "optional angle to emphasize"},
            },
            "required": ["topic"],
        },
    },
    {
        "name": "remember",
        "description": (
            "Store one durable fact about the user or their world in "
            "long-term memory (name, preference, project, deadline). "
            "Call it whenever the user shares something worth keeping — "
            "silently, no announcement needed."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "fact": {
                    "type": "string",
                    "description": "one self-contained fact, third person: 'The user …'",
                },
            },
            "required": ["fact"],
        },
    },
    {
        "name": "recall",
        "description": (
            "Search long-term memory deliberately ('what did I tell you "
            "about X?'). Routine relevant memories are already injected "
            "each turn — use this only for explicit memory questions."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "what to search memory for"},
            },
            "required": ["query"],
        },
    },
    {
        "name": "see",
        "description": (
            "Look through the user's camera and answer a question about "
            "what is visible. The user is asked for camera permission."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "what to look for or describe",
                },
            },
            "required": ["question"],
        },
    },
    {
        "name": "see_screen",
        "description": (
            "Look at the user's screen (they pick which window to share) "
            "and answer a question about it. Use when asked about 'my "
            "screen', an error they're seeing, a page they're on."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "what to look for on the screen",
                },
            },
            "required": ["question"],
        },
    },
    {
        "name": "pair_computer",
        "description": (
            "Pair with the user's PC so you can control it. The user runs "
            "the Leviathan companion on their computer; it prints a "
            "6-digit code they read to you. Call this with that code once. "
            "If no PC is paired and the user asks to open something on "
            "their computer, tell them to start the companion first."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "code": {"type": "string", "description": "the 6-digit pairing code"},
            },
            "required": ["code"],
        },
    },
    {
        "name": "pc_open",
        "description": (
            "Open something on the user's paired PC: a folder, a file, an "
            "application, or a website. Examples of target: 'Downloads', "
            "'notepad', 'C:/Users/Admin/report.pdf', 'spotify', "
            "'https://gmail.com', 'calculator'. Requires a paired PC."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "target": {
                    "type": "string",
                    "description": "folder name/path, app name, file path, or url to open",
                },
            },
            "required": ["target"],
        },
    },
    {
        "name": "create_device_link",
        "description": (
            "Mint a ONE-TIME consent link that lets another device share "
            "its camera or screen with this session over WebRTC. The "
            "other person must open the link and explicitly approve in "
            "their browser; the link expires in 10 minutes and either "
            "side can stop it. Use when the user asks to 'link my phone', "
            "'see through another device', 'connect that laptop'. This is "
            "always consensual — refuse any covert framing."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "purpose": {
                    "type": "string",
                    "enum": ["camera", "screen"],
                    "description": "what the other device will be asked to share",
                },
            },
            "required": [],
        },
    },
    {
        "name": "set_translation",
        "description": (
            "Turn LIVE TRANSLATION mode on: after this, everything the "
            "user says is translated into the target language and spoken "
            "aloud, until they say 'stop translating'. Use when asked to "
            "'translate everything I say' / 'speak in French for me'. For "
            "a single phrase, just translate it yourself instead."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "language": {
                    "type": "string",
                    "description": "target language name, e.g. 'spanish'",
                },
                "off": {
                    "type": "boolean",
                    "description": "true to turn translation mode off",
                },
            },
            "required": [],
        },
    },
]

_IMPL: dict[str, Callable[..., Awaitable[dict]]] = {
    "web_search": search.run,
    "open_url": browser_actions.open_url,
    "play_music": browser_actions.play_music,
    "run_code": code_run.run,
    "generate_image": image.run,
    "see": vision.run,
    "browse": browse.run,
    "research_agent": research.run,
    "remember": memory_tools.remember,
    "recall": memory_tools.recall,
    "see_screen": _see_screen,
    "set_translation": translate.run,
    "create_device_link": device_link.run,
    "pair_computer": computer.pair_computer,
    "pc_open": computer.pc_open,
}

# One quiet line for the ThoughtStream while each tool works
THOUGHT_LINES = {
    "web_search": "casting a net across the surface — {query}",
    "open_url": "surfacing a doorway — {url}",
    "play_music": "listening for — {query}",
    "run_code": "running code in the sealed chamber",
    "generate_image": "condensing an image — {prompt}",
    "see": "opening an eye",
    "browse": "reading the currents of — {url}",
    "research_agent": "beginning a deep descent — {topic}",
    "remember": "committing to the deep memory",
    "recall": "dredging the deep memory — {query}",
    "see_screen": "gazing upon the surface glass",
    "set_translation": "raising a bridge between tongues",
    "create_device_link": "extending a tendril to another shore",
    "pair_computer": "clasping hands with your machine",
    "pc_open": "reaching into your machine — {target}",
}


def thought_for(name: str, args: dict) -> str:
    template = THOUGHT_LINES.get(name, f"working: {name}")
    try:
        return template.format(**{k: str(v)[:80] for k, v in args.items()})
    except (KeyError, IndexError):
        return template


async def execute(session, name: str, args: dict) -> str:
    """Run a tool; always returns a JSON string for the model."""
    impl = _IMPL.get(name)
    if impl is None:
        return json.dumps({"error": f"unknown tool: {name}"})
    try:
        result: Any = await impl(session, **args)
    except TypeError as exc:  # bad/missing arguments from the model
        result = {"error": f"bad arguments for {name}: {exc}"}
    except Exception as exc:  # tool failure is information, not a crash
        result = {"error": f"{type(exc).__name__}: {exc}"}
    return json.dumps(result, ensure_ascii=False)[:8000]
