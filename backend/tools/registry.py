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
    devices,
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
            "'https://gmail.com', 'calculator'. Requires a paired PC. If "
            "several PCs are paired, set 'device' to a name to target one, "
            "or omit it to open on ALL of them at once."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "target": {
                    "type": "string",
                    "description": "folder name/path, app name, file path, or url to open",
                },
                "device": {
                    "type": "string",
                    "description": "optional device name; omit to target all paired PCs",
                },
            },
            "required": ["target"],
        },
    },
    {
        "name": "write_project",
        "description": (
            "Build a whole app/website/software project on the user's "
            "paired PC: write ALL its files at once into ~/Leviathan/<name> "
            "and show the code on screen. Use for 'build me an app/site/"
            "tool'. Clarify the idea first if vague, then generate real, "
            "complete, runnable files. Prefer single-page web apps "
            "(index.html + css + js) unless the user asks otherwise."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "short project folder name, kebab-case"},
                "files": {
                    "type": "array",
                    "description": "every file in the project",
                    "items": {
                        "type": "object",
                        "properties": {
                            "path": {"type": "string", "description": "path relative to the project, e.g. 'index.html' or 'src/app.js'"},
                            "content": {"type": "string", "description": "the full file contents"},
                        },
                        "required": ["path", "content"],
                    },
                },
                "device": {
                    "type": "string",
                    "description": "optional device name; omit to write on all paired PCs",
                },
            },
            "required": ["name", "files"],
        },
    },
    {
        "name": "write_file",
        "description": (
            "Write or overwrite a single file on the paired PC (relative "
            "paths land in ~/Leviathan). Use to save a snippet or edit one "
            "file of a project. Shows the code on screen."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "file path"},
                "content": {"type": "string", "description": "full file contents"},
            },
            "required": ["path", "content"],
        },
    },
    {
        "name": "read_path",
        "description": (
            "Read a file's contents (to inspect or FIX code) or list a "
            "folder on the paired PC. Use before editing so you change the "
            "real current file."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "file path to read, or folder to list"},
            },
            "required": ["path"],
        },
    },
    {
        "name": "run_command",
        "description": (
            "Run a terminal command on the paired PC (e.g. 'npm install', "
            "'python app.py', 'npm run build'). The companion asks the "
            "user to confirm before it runs. Use to install deps, build, "
            "or start a project you wrote. With several PCs paired, set "
            "'device' to target one, or omit to run on ALL at once."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "the shell command"},
                "device": {
                    "type": "string",
                    "description": "optional device name; omit to run on all paired PCs",
                },
            },
            "required": ["command"],
        },
    },
    {
        "name": "preview_project",
        "description": (
            "Open a web project's index.html in the user's browser as a "
            "live preview. Use after write_project for static/single-page "
            "web apps."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "the project folder name"},
            },
            "required": ["name"],
        },
    },
    {
        "name": "create_device_link",
        "description": (
            "Mint a consent link that lets another device share its camera "
            "or screen with this session over WebRTC. The other person must "
            "open the link and explicitly approve in their browser; the "
            "link stays valid for this whole session, reconnects after "
            "drops, serves one device at a time, and either side can stop "
            "it. Use when the user asks to 'link my phone', 'see through "
            "another device', 'connect that laptop'. This is always "
            "consensual — refuse any covert framing."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "purpose": {
                    "type": "string",
                    "enum": ["camera", "screen"],
                    "description": "what the other device will be asked to "
                    "share. Use 'camera' for a phone or tablet — mobile "
                    "browsers CANNOT share their screen. Use 'screen' only "
                    "for a desktop/laptop. Default to 'camera' when unsure.",
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
    {
        "name": "list_network_devices",
        "description": (
            "List the devices on the user's OWN local network (phones, TVs, "
            "printers, other computers) as seen by a paired PC — IP, MAC, "
            "and name. Read-only, like the device list in a router. Use for "
            "'what's on my network' / 'what devices are connected'. Needs a "
            "paired computer."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "device": {"type": "string", "description": "hostname to query; omit for all paired PCs"},
            },
            "required": [],
        },
    },
    {
        "name": "device_vitals",
        "description": (
            "Live health of the user's paired PC(s): CPU, memory, disk, "
            "battery, uptime. Use for 'how's my computer', 'is it running "
            "hot', 'how much memory is free'. Also updates the on-screen "
            "vitals. Needs a paired computer."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "device": {"type": "string", "description": "hostname; omit for all paired PCs"},
            },
            "required": [],
        },
    },
    {
        "name": "control_media",
        "description": (
            "Control media playback/volume on a paired PC. Use for 'pause', "
            "'next song', 'turn it up', 'mute'."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["play_pause", "next", "prev", "vol_up", "vol_down", "mute"],
                },
                "device": {"type": "string", "description": "hostname; omit for all"},
            },
            "required": ["action"],
        },
    },
    {
        "name": "system_action",
        "description": (
            "Do a system action on a paired PC: lock the screen, sleep it, "
            "take a screenshot, show a notification, or read/write the "
            "clipboard. lock/sleep/clipboard-write ask the user to confirm "
            "on the PC unless trusted mode is on."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "action": {
                    "type": "string",
                    "enum": ["lock", "sleep", "screenshot", "notify",
                             "clipboard_get", "clipboard_set"],
                },
                "value": {"type": "string", "description": "text for notify / clipboard_set"},
                "device": {"type": "string", "description": "hostname; omit for all"},
            },
            "required": ["action"],
        },
    },
    {
        "name": "list_processes",
        "description": (
            "List the top running processes by memory on a paired PC. Use "
            "for 'what's using my memory', 'what's running'."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "device": {"type": "string", "description": "hostname; omit for all"},
            },
            "required": [],
        },
    },
    {
        "name": "kill_process",
        "description": (
            "Close/terminate processes matching a name on a paired PC (e.g. "
            "'close Chrome'). Asks the user to confirm on the PC unless "
            "trusted mode is on."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "process name to close, e.g. 'chrome'"},
                "device": {"type": "string", "description": "hostname; omit for all"},
            },
            "required": ["name"],
        },
    },
    {
        "name": "set_trusted",
        "description": (
            "Turn TRUSTED MODE on or off for a paired PC. When on, "
            "state-changing actions (run, lock, sleep, kill, clipboard "
            "write) run WITHOUT asking the user to confirm each time. Only "
            "enable when the user explicitly asks to trust the machine."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "on": {"type": "boolean", "description": "true to enable, false to disable"},
                "device": {"type": "string", "description": "hostname; omit for all"},
            },
            "required": ["on"],
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
    "write_project": computer.write_project,
    "write_file": computer.write_file,
    "read_path": computer.read_path,
    "run_command": computer.run_command,
    "preview_project": computer.preview_project,
    "list_network_devices": devices.list_network_devices,
    "device_vitals": devices.device_vitals,
    "control_media": devices.control_media,
    "system_action": devices.system_action,
    "list_processes": devices.list_processes,
    "kill_process": devices.kill_process,
    "set_trusted": devices.set_trusted,
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
    "write_project": "forging a new work — {name}",
    "write_file": "inscribing — {path}",
    "read_path": "studying — {path}",
    "run_command": "asking your leave to run — {command}",
    "preview_project": "raising a preview — {name}",
    "list_network_devices": "sensing the currents of your network",
    "device_vitals": "reading the pulse of your machine",
    "control_media": "conducting the sound — {action}",
    "system_action": "reaching into the machine — {action}",
    "list_processes": "counting the living threads",
    "kill_process": "silencing — {name}",
    "set_trusted": "deepening our trust",
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
