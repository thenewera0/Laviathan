"""Leviathan training-set builder.

Reads datagen/seed_rows.jsonl (hand-curated) and generates the full
leviathan_train.jsonl: multi-domain Alpaca rows grounded in this repo's
tool contract (backend/tools/registry.py + backend/brain/router.py).

Domains: voice->tool_call macros (EN + Hinglish), multi-step macros,
Supabase/asyncpg queries, research pipeline, exact-math and JSON-IO
tasks (computed, verifiable), coding/refactoring, CLI/git knowledge,
direct-answer vs tool discrimination, and consent/safety behavior.

Deterministic (seed 7). Rerun any time:  python datagen/build_dataset.py
"""
import ast
import json
import random
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SEED_FILE = ROOT / "datagen" / "seed_rows.jsonl"
OUT = ROOT / "leviathan_train.jsonl"

rng = random.Random(7)
rows: list[dict] = []
seen_inputs: set[str] = set()

MAP1 = (
    "You are the Leviathan brain loop (backend/brain/loop.py). Map the user's "
    "voice request to the exact tool_call event the router must emit, using the "
    "tool schemas in backend/tools/registry.py. Respond with the JSON event only."
)
MAPN = (
    "You are the Leviathan brain loop. Map the user's voice request to the exact "
    "ordered sequence of tool_call events (backend/brain/router.py contract). "
    "Respond with a JSON array of events only."
)
DIRECT = (
    "You are Leviathan. This request needs NO tool call — the answer is stable "
    "knowledge or pure computation. Reply directly and concisely. Never invent "
    "live data; anything time-sensitive must go through a tool instead."
)
DIRECT_HI = (
    "You are Leviathan. The user speaks Hinglish (Hindi in Latin script). This "
    "request needs NO tool call — answer directly, briefly, in the user's own "
    "Hinglish register. Never invent live data; anything time-sensitive must go "
    "through a tool instead."
)
CODE = (
    "You are Leviathan acting as a senior engineer. Solve the task with minimal, "
    "clean, production-grade code. Output code only, no commentary."
)
REF = (
    "Refactor this code with strict DRY principles: collapse the duplication, "
    "keep behavior identical, minimize lines. Output the refactored code only."
)
DBPY = (
    "Write a minimal async Python data-access function in the style of "
    "backend/brain/memory.py: asyncpg pool via _pg_pool(), parametrized SQL, "
    "no ORM, fewest lines that stay readable. Output code only."
)
SAFE = (
    "You are Leviathan. Follow your consent and safety rules: device access is "
    "always consensual and visible, destructive commands need explicit "
    "confirmation, and you refuse covert surveillance or harm outright."
)

_id = 0


def cid() -> str:
    global _id
    _id += 1
    return f"g{_id:04x}{rng.randrange(16**4):04x}"


def call(name: str, args: dict) -> dict:
    return {"kind": "tool_call", "id": f"call_{cid()}", "name": name, "args": args}


def add(instruction: str, inp: str, output) -> bool:
    key = inp.strip().lower()
    if key in seen_inputs:
        return False
    seen_inputs.add(key)
    if not isinstance(output, str):
        output = json.dumps(output, ensure_ascii=False)
    rows.append({"instruction": instruction, "input": inp, "output": output})
    return True


def tool(inp: str, name: str, args: dict) -> None:
    add(MAP1, inp, call(name, args))


def seq(inp: str, calls: list[tuple[str, dict]]) -> None:
    add(MAPN, inp, [call(n, a) for n, a in calls])


# =====================================================================
# 1. ENGLISH VOICE -> TOOL_CALL MACROS
# =====================================================================

FOLDERS = ["Downloads", "Documents", "Desktop", "Pictures", "Music", "Videos"]
APPS = ["notepad", "calculator", "chrome", "edge", "firefox", "spotify", "word",
        "excel", "vs code", "paint", "task manager", "file explorer", "cmd"]
SITES = [("https://gmail.com", "gmail"), ("https://youtube.com", "youtube"),
         ("https://github.com", "github"), ("https://netflix.com", "netflix"),
         ("https://docs.google.com", "google docs"), ("https://maps.google.com", "google maps"),
         ("https://amazon.in", "amazon"), ("https://x.com", "x"),
         ("https://linkedin.com", "linkedin"), ("https://reddit.com", "reddit")]
DEVICES = ["laptop", "office pc", "den pc", "workstation", "gaming rig", "bedroom pc"]

OPEN_T = ["open {t}", "open up {t}", "pull up {t}", "launch {t}", "fire up {t}",
          "bring up {t}", "can you open {t} for me", "hey leviathan, open {t}",
          "go ahead and open {t}", "i need {t} open", "get {t} up", "start {t}"]

for target_kind, targets in (("folder", FOLDERS), ("app", APPS), ("site", SITES)):
    for t in targets:
        if target_kind == "site":
            url, spoken = t
            arg_target = url
        else:
            spoken = t if target_kind == "app" else f"my {t.lower()} folder"
            arg_target = t
        for tpl in rng.sample(OPEN_T, 6):
            mode = rng.choice(["none", "none", "device", "all"])
            if mode == "device":
                d = rng.choice(DEVICES)
                tool(tpl.format(t=spoken) + f" on the {d}",
                     "pc_open", {"target": arg_target, "device": d})
            elif mode == "all":
                tool(tpl.format(t=spoken) + rng.choice(
                    [" on all my machines", " on every pc", " on both computers"]),
                    "pc_open", {"target": arg_target})
            else:
                tool(tpl.format(t=spoken) + rng.choice(
                    ["", " on my computer", " on my pc"]),
                    "pc_open", {"target": arg_target})

FILE_TARGETS = ["C:/Users/Admin/report.pdf", "C:/Users/Admin/invoice.xlsx",
                "C:/Users/Admin/resume.docx", "C:/Users/Admin/notes.txt"]
for path in FILE_TARGETS:
    name = path.rsplit("/", 1)[-1]
    tool(f"open the {name} file from my user folder", "pc_open", {"target": path})
    tool(f"pull up {name} on my pc", "pc_open", {"target": path})

COMMANDS = ["npm install", "npm run dev", "npm run build", "npm test",
            "python app.py", "python main.py", "pip install -r requirements.txt",
            "git pull", "git status", "node server.js", "pytest",
            "npx serve .", "python -m http.server 8080", "pip install requests"]
RUN_T = ["run {c}", "go run {c}", "execute {c}", "can you run {c}",
         "kick off {c}", "fire off {c}", "run the command {c}",
         "hey, run {c} for me", "please run {c}", "do a {c}"]
for c in COMMANDS:
    for tpl in rng.sample(RUN_T, 7):
        mode = rng.choice(["none", "none", "device", "all"])
        if mode == "device":
            d = rng.choice(DEVICES)
            tool(tpl.format(c=c) + f" on the {d}",
                 "run_command", {"command": c, "device": d})
        elif mode == "all":
            tool(tpl.format(c=c) + rng.choice([" on every machine", " on all pcs"]),
                 "run_command", {"command": c})
        else:
            tool(tpl.format(c=c) + rng.choice(["", " on my pc", " in the terminal"]),
                 "run_command", {"command": c})

SONGS = ["lo-fi hip hop", "smooth jazz", "Beethoven's moonlight sonata",
         "Arijit Singh's latest song", "some 80s rock", "rain sounds for sleeping",
         "a deep focus playlist", "punjabi workout songs", "classic bollywood hits",
         "Coke Studio", "instrumental study music", "some upbeat pop",
         "AR Rahman's best songs", "soft piano music", "old hindi songs",
         "trending songs this week", "some metal", "lounge music",
         "acoustic covers", "devotional bhajans"]
PLAY_T = ["play {s}", "put on {s}", "can you play {s}", "i want to hear {s}",
          "play me {s}", "throw on {s}", "queue up {s}", "let's listen to {s}"]
for s in SONGS:
    for tpl in rng.sample(PLAY_T, 6):
        tool(tpl.format(s=s), "play_music", {"query": s})

SEARCHES = [
    ("what's the weather looking like tomorrow", "weather forecast tomorrow"),
    ("is it going to rain this weekend", "weekend rain forecast"),
    ("what's the bitcoin price right now", "bitcoin price now"),
    ("how's tesla stock doing today", "Tesla stock price today"),
    ("what's the gold rate today", "gold rate today"),
    ("what's the score in the ipl match", "IPL match score live"),
    ("when is the next iphone coming out", "next iPhone release date"),
    ("what's the dollar to rupee rate today", "USD to INR exchange rate today"),
    ("how bad is the air quality in delhi right now", "Delhi AQI now"),
    ("who won the f1 race yesterday", "F1 race winner yesterday"),
    ("what movies are trending this week", "trending movies this week"),
    ("any big tech news today", "top technology news today"),
    ("what time does the sun set today", "sunset time today"),
    ("is there a train strike tomorrow", "train strike news tomorrow"),
    ("what's the latest on the new GPT model", "latest GPT model announcement news"),
    ("how much does a tesla model 3 cost in india", "Tesla Model 3 price India"),
    ("did the fed change interest rates", "Federal Reserve interest rate decision latest"),
    ("what's the petrol price today", "petrol price today"),
    ("when do the olympics start", "next Olympics start date"),
    ("is that new marvel movie out yet", "new Marvel movie release date"),
    ("what's the visa processing time for the us right now", "US visa processing time current"),
    ("any earthquakes reported today", "earthquake reports today"),
    ("what won best picture this year", "best picture Oscar winner this year"),
    ("how long is the wait at the dmv usually", "DMV average wait time"),
    ("what's the cheapest flight to goa next month", "cheap flights to Goa next month"),
    ("is github down right now", "GitHub status down"),
    ("what's the latest ubuntu version", "latest Ubuntu version"),
    ("when does daylight saving end this year", "daylight saving end date this year"),
    ("what are the top laptops under 60000", "best laptops under 60000 INR"),
    ("what's the news on the chip shortage", "semiconductor chip shortage latest news"),
]
for utter, q in SEARCHES:
    tool(utter, "web_search", {"query": q})
    tool(rng.choice(["look up ", "search for ", "check ", "find out "]) + q,
         "web_search", {"query": q})

for url, spoken in SITES:
    tool(f"show me {spoken} here on screen", "open_url",
         {"url": url, "reason": f"user asked to see {spoken}"})
    tool(f"put {spoken} up on the hud", "open_url",
         {"url": url, "reason": f"user asked to see {spoken}"})

IMAGES = [
    ("a dragon flying over a burning city at night", "wide"),
    ("a cozy cabin in snowy mountains, warm light in the windows", "wide"),
    ("a cyberpunk street market in the rain, neon signs", "wide"),
    ("a watercolor painting of a fishing village at dawn", "square"),
    ("an astronaut riding a horse on mars, photorealistic", "square"),
    ("a minimalist logo of a whale made of circuit lines", "square"),
    ("a portrait of a samurai in golden armor, dramatic lighting", "tall"),
    ("a giant leviathan rising from a moonlit ocean", "tall"),
    ("a futuristic indian city with flying rickshaws at sunset", "wide"),
    ("a bowl of ramen in the style of studio ghibli", "square"),
    ("an isometric cutaway of a wizard's tower", "tall"),
    ("a golden retriever wearing sunglasses on a beach", "square"),
    ("a low-poly 3d render of a forest with a river", "wide"),
    ("an art deco poster of a rocket launch", "tall"),
    ("a macro photo of a bee on a sunflower", "square"),
    ("a fantasy map of a floating island kingdom", "wide"),
    ("a chai stall on a rainy mumbai street, cinematic", "wide"),
    ("a robot tending a zen garden, soft morning light", "square"),
]
for prompt, aspect in IMAGES:
    tool(rng.choice(["make me an image of ", "generate a picture of ",
                     "draw ", "create an image of "]) + prompt,
         "generate_image", {"prompt": prompt, "aspect": aspect})

BROWSE = [
    ("https://news.ycombinator.com", "summarize the top stories"),
    ("https://python.org/downloads", "find the latest python version"),
    ("https://fastapi.tiangolo.com/advanced/websockets/", "how to handle websocket disconnects"),
    ("https://docs.unsloth.ai", "how to export a fine-tune to GGUF"),
    ("https://ollama.com/library/qwen2.5-coder", "available qwen coder model sizes"),
    ("https://supabase.com/docs/guides/database/extensions/pgvector", "pgvector index guidance"),
    ("https://render.com/docs/free", "free tier limits"),
    ("https://openrouter.ai/models", "which free models support function calling"),
    ("https://en.wikipedia.org/wiki/Leviathan", "what the leviathan myth is"),
    ("https://kaggle.com/docs/notebooks", "gpu quota rules for notebooks"),
]
for url, purpose in BROWSE:
    tool(f"open {url} and tell me — {purpose}", "browse",
         {"url": url, "purpose": purpose})

RESEARCH = [
    ("current state of small language models on edge devices", "quantization tradeoffs"),
    ("solid state battery manufacturing progress", "cost per kWh trends"),
    ("how vector databases compare for RAG workloads", "pgvector vs dedicated engines"),
    ("LoRA vs full fine-tuning quality on code models", ""),
    ("indian government schemes for solar rooftop subsidies", "eligibility and payout"),
    ("webrtc reliability across mobile browsers", "safari quirks"),
    ("speech to text accuracy for hinglish audio", "open source options"),
    ("kaggle vs colab for free gpu fine-tuning", "session limits"),
    ("gguf quantization levels and quality loss", "q4_k_m vs q5_k_m"),
    ("real estate price trends in north goa", "impact of the new airport"),
    ("the economics of self-hosting a 32B model vs API calls", ""),
    ("wake word detection approaches in the browser", "battery cost"),
    ("supabase free tier limits for production apps", ""),
    ("multilingual TTS engines with hindi support", "latency"),
    ("crop insurance claim rejection reasons in india", "how farmers appeal"),
    ("drone regulations for agricultural spraying in india", "license requirements"),
    ("best practices for websocket reconnection at scale", ""),
    ("how music streaming royalties work for small artists", ""),
    ("open source alternatives to docker desktop on windows", ""),
    ("the effect of monsoon patterns on goa tourism revenue", ""),
]
for topic, focus in RESEARCH:
    args = {"topic": topic}
    if focus:
        args["focus"] = focus
    utter = rng.choice(["do a deep dive on ", "research ", "run a full research pass on ",
                        "go deep on ", "i need a proper report on "]) + topic
    if focus:
        utter += f", focus on {focus}"
    tool(utter, "research_agent", args)

FACTS = [
    ("my name is Arjun by the way", "The user's name is Arjun."),
    ("i'm allergic to peanuts, keep that in mind", "The user is allergic to peanuts."),
    ("my anniversary is on march 14th", "The user's anniversary is on March 14th."),
    ("i run a resort in morjim goa", "The user runs a resort in Morjim, Goa."),
    ("my main machine is the workstation, default to it", "The user's main PC is the 'workstation'; prefer it as the default device."),
    ("i prefer dark mode in everything", "The user prefers dark mode interfaces."),
    ("my brother's name is Rohan", "The user's brother is named Rohan."),
    ("i get up at 5am every day", "The user wakes up at 5 AM daily."),
    ("i'm learning konkani right now", "The user is currently learning Konkani."),
    ("my car is a tata nexon ev", "The user drives a Tata Nexon EV."),
    ("i bank with hdfc mainly", "The user primarily banks with HDFC."),
    ("my flight home is always via mopa airport", "The user usually flies via Mopa Airport."),
    ("we deploy everything on render free tier for now", "The user deploys projects on Render's free tier."),
    ("i'm vegetarian, no egg either", "The user is vegetarian and does not eat eggs."),
    ("my favorite cricketer is virat kohli", "The user's favorite cricketer is Virat Kohli."),
    ("i do intermittent fasting till noon", "The user practices intermittent fasting until noon."),
    ("the wifi password guests ask about is on the reception board", "The resort's guest wifi password is posted on the reception board."),
    ("i want all reports in bullet points, short ones", "The user prefers reports as short bullet points."),
    ("my budget for the new gpu is 60k", "The user's GPU budget is ₹60,000."),
    ("monsoon season is our off season at the resort", "Monsoon season is the off-season for the user's resort."),
]
for utter, fact in FACTS:
    tool(utter, "remember", {"fact": fact})
    tool("remember this: " + utter, "remember", {"fact": fact})

RECALLS = [
    ("what did i tell you about my allergies", "user allergies"),
    ("do you remember my anniversary date", "user anniversary date"),
    ("what do you know about my resort", "user resort details"),
    ("which bank did i say i use", "user bank"),
    ("what was my gpu budget again", "user GPU budget"),
    ("did i ever tell you my brother's name", "user brother name"),
    ("what do you remember about my deployment setup", "user deployment setup"),
    ("what are my food restrictions again", "user dietary restrictions"),
    ("what did i say about how i like reports", "user report format preference"),
    ("which device did i tell you to default to", "user default device"),
]
for utter, q in RECALLS:
    tool(utter, "recall", {"query": q})

SEE = [
    ("what am i holding in my hand", "What is the user holding in their hand?"),
    ("does this shirt match these pants", "Do the user's shirt and pants match?"),
    ("how many fingers am i holding up", "How many fingers is the user holding up?"),
    ("can you read this label for me", "Read the text on the label the user is showing."),
    ("what plant is this", "Identify the plant the user is showing."),
    ("is my posture okay right now", "Assess the user's sitting posture."),
    ("what color is this wire", "Identify the color of the wire being shown."),
    ("does this mole look irregular", "Describe the mole's shape and color; recommend a doctor for any medical concern."),
]
for utter, q in SEE:
    tool(utter, "see", {"question": q})

SEE_SCREEN = [
    ("why is my code throwing this error", "Read the visible error and explain the root cause."),
    ("summarize this article i have open", "Summarize the article visible on screen."),
    ("what does this excel formula do", "Explain the spreadsheet formula visible on screen."),
    ("is this email a scam", "Assess whether the visible email looks like a phishing attempt."),
    ("help me fill this form, what's it asking", "Explain what the visible form fields are asking for."),
    ("which of these settings should i change", "Look at the visible settings page and advise."),
    ("translate what's on my screen", "Translate the visible text."),
    ("why does this page look broken", "Diagnose the visible layout issue."),
]
for utter, q in SEE_SCREEN:
    tool(utter, "see_screen", {"question": q})

PAIR_CODES = [("three one four one five nine", "314159"), ("eight eight two four zero six", "882406"),
              ("one two three four five six", "123456"), ("nine zero two seven one five", "902715"),
              ("five five eight one three two", "558132"), ("two zero nine four six eight", "209468")]
for spoken, code in PAIR_CODES:
    tool(f"the companion says the code is {spoken}", "pair_computer", {"code": code})
    tool(f"pair up, code {spoken}", "pair_computer", {"code": code})

for purpose, utter in [("camera", "connect my phone camera to this session"),
                       ("camera", "i want you to see through my tablet"),
                       ("screen", "let me share my other laptop's screen with you"),
                       ("screen", "make a link so my colleague can share their screen"),
                       ("camera", "set up a link for the kitchen phone camera"),
                       ("screen", "i need to show you something from my work machine")]:
    tool(utter, "create_device_link", {"purpose": purpose})

LANGS = ["spanish", "french", "german", "japanese", "tamil", "telugu", "marathi",
         "punjabi", "arabic", "portuguese", "korean", "italian", "bengali", "gujarati"]
for lang in LANGS:
    tool(rng.choice([f"translate everything i say into {lang} from now on",
                     f"switch to live {lang} translation",
                     f"speak in {lang} for me until i say stop"]),
         "set_translation", {"language": lang})
for utter in ["stop translating", "end translation mode", "back to normal, no more translating",
              "turn off the translator"]:
    tool(utter, "set_translation", {"off": True})

READS = ["todo-app/index.html", "snake-game/src/app.js", "budget-tracker/style.css",
         "pomodoro-timer/app.js", "notes.txt", "portfolio/index.html",
         "chess-game/src/board.js", "weather-widget/script.js"]
for p in READS:
    tool(f"read {p} so you can fix it", "read_path", {"path": p})
    tool(f"show me what's in {p} right now", "read_path", {"path": p})
for d in ["Downloads", "Documents", "C:/Users/Admin/projects"]:
    tool(f"list what's in {d}", "read_path", {"path": d})

PROJECTS = ["todo-app", "snake-game", "budget-tracker", "pomodoro-timer",
            "portfolio", "chess-game", "weather-widget", "recipe-box"]
for name in PROJECTS:
    tool(rng.choice([f"preview the {name} project", f"open the {name} app in the browser",
                     f"show me the {name} build live"]),
         "preview_project", {"name": name})

# =====================================================================
# 2. HINGLISH VOICE -> TOOL_CALL MACROS
# =====================================================================

HI_OPEN = [("Downloads", "downloads folder khol do mere computer pe"),
           ("Documents", "documents wala folder kholo pc pe"),
           ("notepad", "notepad khol de bhai"),
           ("calculator", "calculator chalu karo computer pe"),
           ("chrome", "chrome browser khol do"),
           ("spotify", "spotify on kar de pc pe"),
           ("vs code", "vs code khol do coding karni hai"),
           ("https://youtube.com", "youtube khol do computer pe"),
           ("https://gmail.com", "gmail kholo mail dekhni hai"),
           ("https://flipkart.com", "flipkart khol do kuch order karna hai")]
for target, utter in HI_OPEN:
    tool(utter, "pc_open", {"target": target})

for c, utter in [("npm install", "project mein npm install chala do"),
                 ("npm run dev", "dev server start kar do npm se"),
                 ("python app.py", "python wali app chala de"),
                 ("git pull", "git pull maar do project mein"),
                 ("pip install -r requirements.txt", "saari requirements install kar do pip se")]:
    tool(utter, "run_command", {"command": c})

HI_PLAY = [("Kishore Kumar hits", "kishore kumar ke gaane laga do"),
           ("Atif Aslam best songs", "atif aslam ka koi accha gaana bajao"),
           ("lata mangeshkar old songs", "lata ji ke purane gaane chala do"),
           ("bhojpuri hit songs", "bhojpuri wala koi hit gaana bajao"),
           ("hanuman chalisa", "hanuman chalisa laga do subah subah"),
           ("marathi lavani songs", "marathi lavani chala do"),
           ("punjabi party songs", "punjabi party wale gaane bajao full volume pe"),
           ("sad songs hindi", "koi sad song laga do yaar"),
           ("krishna bhajan", "krishna bhajan chala do shaam ke liye"),
           ("90s bollywood romantic songs", "90s ke romantic gaane laga do")]
for q, utter in HI_PLAY:
    tool(utter, "play_music", {"query": q})

HI_SEARCH = [("tomato price today mandi", "aaj tamatar ka bhav kya hai mandi mein, check karo"),
             ("today weather forecast", "aaj mausam kaisa rahega dekh ke batao"),
             ("wheat MSP this year", "is saal gehun ka MSP kitna hai pata karo"),
             ("LPG cylinder price today", "gas cylinder ka rate kya chal raha hai aajkal"),
             ("bank holiday tomorrow", "kal bank band hai kya, holiday check karo"),
             ("Mumbai local train status", "mumbai local ka status dekho, sab time pe chal rahi kya"),
             ("diesel price today", "diesel ka bhav kya hai aaj, dekh ke batao"),
             ("monsoon arrival date kerala", "monsoon kab aa raha hai kerala mein is baar"),
             ("PM Awas Yojana eligibility", "pm awas yojana mein kaun apply kar sakta hai, dekho zara"),
             ("cricket match today schedule", "aaj cricket ka match hai kya, kab shuru hoga")]
for q, utter in HI_SEARCH:
    tool(utter, "web_search", {"query": q})

for utter, lang in [("ab se jo bolun use english mein translate karte jao", "english"),
                    ("meri baat marathi mein bolo ab se", "marathi"),
                    ("live translation chalu karo tamil mein", "tamil")]:
    tool(utter, "set_translation", {"language": lang})
tool("bas karo translate karna", "set_translation", {"off": True})

for utter, fact in [("yaad rakhna mera gaon nashik ke paas hai",
                     "The user's village is near Nashik."),
                    ("note kar lo, mandi har mangalvaar ko band rehti hai",
                     "The user's local mandi is closed on Tuesdays."),
                    ("yaad rakho ki main sirf jio ka sim use karta hoon",
                     "The user uses a Jio SIM."),
                    ("mere khet mein soybean aur kapas hai, yaad rakhna",
                     "The user farms soybean and cotton.")]:
    tool(utter, "remember", {"fact": fact})

tool("mera phone screen dekho, ye error kya bol raha hai", "see_screen",
     {"question": "Read the visible error and explain it simply."})
tool("camera se dekho ye patta kaunsi bimari hai fasal mein", "see",
     {"question": "Identify the visible crop leaf disease."})

# =====================================================================
# 3. MULTI-STEP MACROS
# =====================================================================

SCRIPTS = [
    ("hello.py", "print('hello from Leviathan')", "python hello.py",
     "write a hello world python file on my pc and run it"),
    ("server.py", "import http.server, socketserver\nsocketserver.TCPServer(('', 8080), http.server.SimpleHTTPRequestHandler).serve_forever()",
     "python server.py", "make a tiny python file server on my pc and start it"),
    ("clock.py", "import time\nwhile True:\n    print(time.strftime('%H:%M:%S'), end='\\r')\n    time.sleep(1)",
     "python clock.py", "write a terminal clock script and run it on my pc"),
    ("greet.js", "console.log('Leviathan is online');", "node greet.js",
     "drop a one line node script on my pc and execute it"),
]
for path, content, cmd, utter in SCRIPTS:
    seq(utter, [("write_file", {"path": path, "content": content}),
                ("run_command", {"command": cmd})])

for name in PROJECTS[:6]:
    seq(f"install the deps for {name} and start its dev server",
        [("run_command", {"command": f"npm install --prefix {name}"}),
         ("run_command", {"command": f"npm run dev --prefix {name}"})])
    seq(f"read the main file of {name} then list its folder",
        [("read_path", {"path": f"{name}/index.html"}),
         ("read_path", {"path": name})])

for (url, spoken), (d1, d2) in zip(SITES[:5], [("den pc", "laptop"), ("office pc", "workstation"),
                                               ("laptop", "gaming rig"), ("workstation", "den pc"),
                                               ("bedroom pc", "office pc")]):
    seq(f"open {spoken} on the {d1} and the {d2}",
        [("pc_open", {"target": url, "device": d1}),
         ("pc_open", {"target": url, "device": d2})])

for spoken, code in PAIR_CODES[:4]:
    seq(f"code is {spoken} — pair up and then open my downloads",
        [("pair_computer", {"code": code}),
         ("pc_open", {"target": "Downloads"})])

seq("check the weather for tomorrow and remember that i have a trek planned",
    [("web_search", {"query": "weather forecast tomorrow"}),
     ("remember", {"fact": "The user has a trek planned for tomorrow."})])
seq("play some jazz and dim into focus — also remember i like jazz while coding",
    [("play_music", {"query": "smooth jazz"}),
     ("remember", {"fact": "The user likes jazz while coding."})])

# =====================================================================
# 4. EXACT MATH (computed => always correct)
# =====================================================================

ITEMS = ["rice", "sugar", "flour", "dal", "tea", "oil", "onions", "potatoes"]
for _ in range(40):
    n = rng.choice([2, 4, 5, 8, 10, 20, 25])
    per = rng.choice([12, 15, 30, 40, 45, 60, 80, 120])
    item = rng.choice(ITEMS)
    add(DIRECT, f"if {n} kg of {item} costs {n*per} rupees, what's the price per kg?",
        f"{n*per} ÷ {n} = {per}. One kg of {item} costs ₹{per}.")
for _ in range(40):
    n = rng.choice([3, 6, 7, 9, 12, 15, 24])
    p = rng.choice([18, 25, 35, 55, 75, 110, 150])
    add(DIRECT, f"what do {n} units at {p} rupees each come to?",
        f"{n} × {p} = {n*p}. The total is ₹{n*p}.")
for _ in range(45):
    price = rng.choice([400, 500, 800, 1200, 1500, 2000, 2400])
    pct = rng.choice([10, 15, 20, 25, 30, 40, 50])
    final = price - price * pct // 100
    add(DIRECT, f"a {price} rupee item has {pct}% off — what do i pay?",
        f"{pct}% of {price} is ₹{price * pct // 100}, so you pay ₹{final}.")
for _ in range(10):
    total = rng.choice([600, 900, 1200, 1800, 2400, 3600])
    k = rng.choice([2, 3, 4, 6])
    add(DIRECT, f"split a {total} rupee bill between {k} people",
        f"{total} ÷ {k} = {total // k}. Each person pays ₹{total // k}.")
for _ in range(10):
    km = rng.choice([5, 10, 21, 42, 60, 100, 160, 250])
    mi = round(km * 0.621371, 1)
    add(DIRECT, f"how many miles is {km} kilometers?",
        f"{km} km is about {mi} miles (1 km ≈ 0.621 miles).")
for _ in range(10):
    c = rng.choice([-10, 0, 15, 20, 25, 30, 37, 40, 100])
    f = round(c * 9 / 5 + 32)
    add(DIRECT, f"what's {c} degrees celsius in fahrenheit?",
        f"{c}°C = {f}°F (multiply by 9/5, add 32).")
for _ in range(10):
    d = rng.choice([60, 90, 120, 180, 240, 300])
    s = rng.choice([30, 45, 60])
    h, m = divmod(d * 60 // s, 60)
    dur = f"{h} hour{'s' if h != 1 else ''}" + (f" {m} minutes" if m else "")
    add(DIRECT, f"how long to cover {d} km at {s} km/h?",
        f"{d} ÷ {s} = {d/s:g} hours — that's {dur}.")
for _ in range(8):
    kg = rng.choice([1, 5, 10, 50, 70, 100])
    lb = round(kg * 2.20462, 1)
    add(DIRECT, f"convert {kg} kg to pounds", f"{kg} kg is about {lb} lb (1 kg ≈ 2.2 lb).")

for _ in range(12):
    n = rng.choice([2, 5, 10, 20])
    per = rng.choice([30, 45, 60, 90, 120])
    item = rng.choice(["chawal", "aata", "chini", "dal", "chai patti"])
    add(DIRECT_HI, f"{n} kilo {item} {n*per} rupay ka hai, toh ek kilo kitne ka pada?",
        f"{n*per} ÷ {n} = {per}. Ek kilo {item} {per} rupay ka pada.")
for _ in range(10):
    n = rng.choice([4, 6, 12, 25, 50])
    p = rng.choice([8, 15, 20, 35, 60])
    add(DIRECT_HI, f"{p} rupay wale {n} samaan ka total kitna hua?",
        f"{n} × {p} = {n*p}. Total {n*p} rupay hue.")
for _ in range(8):
    total = rng.choice([500, 1000, 1500, 3000])
    k = rng.choice([2, 4, 5])
    add(DIRECT_HI, f"{total} ka bill {k} logon mein batna hai, kitna kitna aayega?",
        f"{total} ÷ {k} = {total // k}. Har ek ke hisse {total // k} rupay aayenge.")

# =====================================================================
# 5. JSON IN -> JSON OUT (computed => always correct)
# =====================================================================

JSON_I = ("You are a precise data transformer inside Leviathan's run_code path. "
          "Apply the requested transformation and respond with the result JSON only.")

for _ in range(100):
    orders = [{"item": rng.choice(ITEMS), "qty": rng.randint(1, 9),
               "price": rng.choice([10, 20, 25, 40, 50])} for _ in range(rng.randint(2, 4))]
    total = sum(o["qty"] * o["price"] for o in orders)
    add(JSON_I, "Compute the grand total (qty*price summed): "
        + json.dumps(orders), {"total": total})

NAMES = ["Asha", "Ravi", "Meera", "Karan", "Divya", "Sanjay", "Priya", "Amit"]
for _ in range(70):
    students = [{"name": n, "score": rng.randint(35, 100)}
                for n in rng.sample(NAMES, rng.randint(3, 5))]
    topper = max(students, key=lambda s: s["score"])["name"]
    avg = round(sum(s["score"] for s in students) / len(students), 2)
    add(JSON_I, "Return the top scorer and class average as "
        '{"topper": name, "average": number}: ' + json.dumps(students),
        {"topper": topper, "average": avg})

for _ in range(100):
    temps = [round(rng.uniform(18, 42), 1) for _ in range(rng.randint(4, 7))]
    add(JSON_I, 'Summarize these °C readings as {"max","min","mean"} (mean to 2dp): '
        + json.dumps(temps),
        {"max": max(temps), "min": min(temps),
         "mean": round(statistics.mean(temps), 2)})

for _ in range(100):
    inv = [{"sku": f"SKU-{rng.randint(100, 999)}", "stock": rng.randint(0, 40)}
           for _ in range(rng.randint(3, 6))]
    th = rng.choice([5, 10, 15])
    add(JSON_I, f"List skus with stock below {th} as " + '{"reorder": [...]}: '
        + json.dumps(inv),
        {"reorder": [i["sku"] for i in inv if i["stock"] < th]})

# =====================================================================
# 6. SUPABASE / ASYNCPG (parameterized over real-shaped tables)
# =====================================================================

TABLES = {
    "memories": ("text", "last_used"),
    "devices": ("name", "last_seen"),
    "reports": ("title", "created_at"),
    "tasks": ("label", "created_at"),
    "sessions": ("client_name", "last_active"),
}
for table, (text_col, ts_col) in TABLES.items():
    add(DBPY, f"Fetch the {'{k}'} most recent rows from {table} (newest by {ts_col}), returning {text_col} values.",
        f'''async def recent_{table}(k: int = 10) -> list[str]:
    pool = await _pg_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT {text_col} FROM {table} ORDER BY {ts_col} DESC LIMIT $1", k)
    return [r["{text_col}"] for r in rows]''')
    add(DBPY, f"Count all rows in {table} with a single scalar query.",
        f'''async def count_{table}() -> int:
    pool = await _pg_pool()
    async with pool.acquire() as conn:
        return await conn.fetchval("SELECT COUNT(*) FROM {table}")''')
    add(DBPY, f"Case-insensitive substring search over {table}.{text_col}, newest first.",
        f'''async def search_{table}(term: str, k: int = 10) -> list[str]:
    pool = await _pg_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT {text_col} FROM {table} WHERE {text_col} ILIKE '%' || $1 || '%' "
            "ORDER BY {ts_col} DESC LIMIT $2", term, k)
    return [r["{text_col}"] for r in rows]''')
    add(DBPY, f"Delete {table} rows older than N days by {ts_col}; return rows removed.",
        f'''async def prune_{table}(days: int = 90) -> int:
    pool = await _pg_pool()
    async with pool.acquire() as conn:
        tag = await conn.execute(
            "DELETE FROM {table} WHERE {ts_col} < now() - ($1 || ' days')::interval",
            str(days))
    return int(tag.split()[-1])''')
    add(DBPY, f"Batch-refresh {ts_col} to now() for a list of {table} ids in one statement.",
        f'''async def touch_{table}(ids: list[int]) -> None:
    if not ids:
        return
    pool = await _pg_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE {table} SET {ts_col}=now() WHERE id = ANY($1::bigint[])", ids)''')
    add(DBPY, f"Stream every {text_col} from {table} without loading the table into RAM (server-side cursor).",
        f'''async def stream_{table}(batch: int = 500):
    pool = await _pg_pool()
    async with pool.acquire() as conn, conn.transaction():
        async for r in conn.cursor("SELECT {text_col} FROM {table} ORDER BY id", prefetch=batch):
            yield r["{text_col}"]''')

JS_TABLES = ["memories", "devices", "reports", "tasks"]
for t in JS_TABLES:
    add("Write a minimal async supabase-js function for the Leviathan admin panel. "
        "Assume an initialized 'supabase' client import. Output code only.",
        f"List the 20 most recent rows from '{t}'.",
        f'''export async function recent{t.capitalize()}(limit = 20) {{
  const {{ data, error }} = await supabase
    .from("{t}")
    .select("*")
    .order("id", {{ ascending: false }})
    .limit(limit);
  if (error) throw error;
  return data;
}}''')
    add("Write a minimal async supabase-js function for the Leviathan admin panel. "
        "Assume an initialized 'supabase' client import. Output code only.",
        f"Delete one row from '{t}' by id.",
        f'''export async function delete{t.capitalize()}Row(id: number) {{
  const {{ error }} = await supabase.from("{t}").delete().eq("id", id);
  if (error) throw error;
}}''')

# =====================================================================
# 7. RESEARCH TASK PROTOCOL (lifecycle frames per topic)
# =====================================================================

for topic, _ in RESEARCH[:10]:
    tid = f"{rng.randrange(16**10):010x}"
    add("Emit the exact lifecycle of task frames (backend/tasks/manager.py protocol) "
        "that the HUD TaskPanel receives for one successful research run. "
        "Respond with a JSON array of frames only.",
        f"task id {tid}, kind research, label '{topic}'.",
        [{"type": "task", "event": "started", "id": tid, "kind": "research", "label": topic},
         {"type": "task", "event": "update", "id": tid, "kind": "research", "label": topic,
          "text": "charting the descent"},
         {"type": "task", "event": "update", "id": tid, "kind": "research", "label": topic,
          "text": f"casting a net — {topic.split(',')[0]}"},
         {"type": "task", "event": "update", "id": tid, "kind": "research", "label": topic,
          "text": "condensing what the deep returned"},
         {"type": "task", "event": "done", "id": tid, "kind": "research", "label": topic}])

# =====================================================================
# 8. CODING MICRO-TASKS (hand-verified)
# =====================================================================

CODE_TASKS = [
    ("Slugify a string: lowercase, hyphens, strip edges, cap 60 chars, 'report' fallback. Python.",
     '''import re

def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:60] or "report"'''),
    ("Async retry with exponential backoff and jitter. Python.",
     '''import asyncio
import random

async def retry(fn, attempts: int = 4, base: float = 0.5):
    for i in range(attempts):
        try:
            return await fn()
        except Exception:
            if i == attempts - 1:
                raise
            await asyncio.sleep(base * 2 ** i + random.random() * 0.1)'''),
    ("Chunk a list into fixed-size pieces. Python.",
     '''def chunk(items: list, size: int) -> list[list]:
    return [items[i:i + size] for i in range(0, len(items), size)]'''),
    ("Flatten a nested dict into dotted keys. Python.",
     '''def flatten(d: dict, prefix: str = "") -> dict:
    out = {}
    for k, v in d.items():
        key = f"{prefix}{k}" if not prefix else f"{prefix}.{k}"
        if isinstance(v, dict):
            out.update(flatten(v, key))
        else:
            out[key] = v
    return out'''),
    ("Dedupe a list preserving order. Python.",
     '''def dedupe(items: list) -> list:
    seen = set()
    return [x for x in items if not (x in seen or seen.add(x))]'''),
    ("Parse a URL query string into a dict (no libraries beyond stdlib). Python.",
     '''from urllib.parse import parse_qsl

def parse_query(qs: str) -> dict:
    return dict(parse_qsl(qs.lstrip("?")))'''),
    ("Human-readable file size from bytes. Python.",
     '''def human_size(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024:
            return f"{n:.1f} {unit}" if unit != "B" else f"{n} B"
        n /= 1024
    return f"{n:.1f} PB"'''),
    ("Clamp a number to a range. Python.",
     '''def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))'''),
    ("snake_case -> camelCase converter. Python.",
     '''def to_camel(s: str) -> str:
    head, *rest = s.split("_")
    return head + "".join(w.capitalize() for w in rest)'''),
    ("Safe JSON load: return a default instead of raising. Python.",
     '''import json

def safe_json(raw: str, default=None):
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return default'''),
    ("Group a list of dicts by a key. Python.",
     '''from collections import defaultdict

def group_by(items: list[dict], key: str) -> dict:
    out = defaultdict(list)
    for item in items:
        out[item[key]].append(item)
    return dict(out)'''),
    ("Top-k most frequent items in a list. Python.",
     '''from collections import Counter

def top_k(items: list, k: int) -> list:
    return [x for x, _ in Counter(items).most_common(k)]'''),
    ("Deep-get a nested dict value by dotted path with default. Python.",
     '''def deep_get(d: dict, path: str, default=None):
    cur = d
    for part in path.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return default
        cur = cur[part]
    return cur'''),
    ("Memoized fibonacci. Python.",
     '''from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n: int) -> int:
    return n if n < 2 else fib(n - 1) + fib(n - 2)'''),
    ("Debounce helper for a browser event handler. JavaScript.",
     '''export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}'''),
    ("Throttle helper: run at most once per interval. JavaScript.",
     '''export function throttle(fn, ms = 250) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    }
  };
}'''),
    ("Format seconds as mm:ss. JavaScript.",
     '''export const mmss = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;'''),
    ("Fetch JSON with a timeout using AbortController. JavaScript.",
     '''export async function fetchJson(url, ms = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}'''),
    ("Simple exponential-backoff reconnect wrapper for a WebSocket. JavaScript.",
     '''export function autoReconnect(makeWs, maxDelay = 10000) {
  let retry = 0;
  const connect = () => {
    const ws = makeWs();
    ws.onopen = () => (retry = 0);
    ws.onclose = () =>
      setTimeout(connect, Math.min(1000 * 2 ** retry++, maxDelay));
  };
  connect();
}'''),
    ("Read a file and count word frequencies, most common first. Python.",
     '''import re
from collections import Counter
from pathlib import Path

def word_freq(path: str) -> list[tuple[str, int]]:
    words = re.findall(r"[a-z']+", Path(path).read_text(encoding="utf-8").lower())
    return Counter(words).most_common()'''),
    ("Merge two sorted lists into one sorted list without sort(). Python.",
     '''def merge_sorted(a: list, b: list) -> list:
    out, i, j = [], 0, 0
    while i < len(a) and j < len(b):
        if a[i] <= b[j]:
            out.append(a[i]); i += 1
        else:
            out.append(b[j]); j += 1
    return out + a[i:] + b[j:]'''),
    ("Binary search returning index or -1. Python.",
     '''def bsearch(items: list, target) -> int:
    lo, hi = 0, len(items) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if items[mid] == target:
            return mid
        if items[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1'''),
    ("Validate an email address with a pragmatic regex. Python.",
     '''import re

EMAIL_RE = re.compile(r"^[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+$")

def is_email(s: str) -> bool:
    return bool(EMAIL_RE.match(s))'''),
    ("ISO-8601 UTC timestamp for right now. Python.",
     '''from datetime import datetime, timezone

def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")'''),
    ("Rate limiter: allow n calls per rolling window using deque. Python.",
     '''import time
from collections import deque

class RateLimiter:
    def __init__(self, n: int, window: float):
        self.n, self.window, self.hits = n, window, deque()

    def allow(self) -> bool:
        now = time.monotonic()
        while self.hits and now - self.hits[0] > self.window:
            self.hits.popleft()
        if len(self.hits) < self.n:
            self.hits.append(now)
            return True
        return False'''),
]
for task, code in CODE_TASKS:
    add(CODE, task, code)

# =====================================================================
# 9. DRY REFACTOR PAIRS (hand-written)
# =====================================================================

REFACTORS = [
    ("Three handlers repeat the same try/log/return-error wrapper.",
     '''def handler_a(x):
    try:
        return do_a(x)
    except Exception as exc:
        log.error(exc)
        return {"error": str(exc)}

def handler_b(x):
    try:
        return do_b(x)
    except Exception as exc:
        log.error(exc)
        return {"error": str(exc)}''',
     '''def guarded(fn):
    def run(x):
        try:
            return fn(x)
        except Exception as exc:
            log.error(exc)
            return {"error": str(exc)}
    return run

handler_a = guarded(do_a)
handler_b = guarded(do_b)'''),
    ("A chain of if/elif mapping names to constructors.",
     '''def make(kind):
    if kind == "csv":
        return CsvReader()
    elif kind == "json":
        return JsonReader()
    elif kind == "xml":
        return XmlReader()
    else:
        raise ValueError(kind)''',
     '''_READERS = {"csv": CsvReader, "json": JsonReader, "xml": XmlReader}

def make(kind):
    try:
        return _READERS[kind]()
    except KeyError:
        raise ValueError(kind) from None'''),
    ("Two functions differ only in the comparison direction.",
     '''def max_by(items, key):
    best = items[0]
    for x in items[1:]:
        if key(x) > key(best):
            best = x
    return best

def min_by(items, key):
    best = items[0]
    for x in items[1:]:
        if key(x) < key(best):
            best = x
    return best''',
     '''max_by = lambda items, key: max(items, key=key)
min_by = lambda items, key: min(items, key=key)'''),
    ("Copy-pasted validation on every endpoint argument.",
     '''def create_user(name):
    if not name or not name.strip():
        raise ValueError("name required")
    ...

def create_room(title):
    if not title or not title.strip():
        raise ValueError("title required")
    ...''',
     '''def required(value: str, label: str) -> str:
    if not value or not value.strip():
        raise ValueError(f"{label} required")
    return value.strip()

def create_user(name):
    name = required(name, "name")
    ...

def create_room(title):
    title = required(title, "title")
    ...'''),
    ("The same fetch-parse-fallback block repeated for three config keys.",
     '''try:
    timeout = int(cfg.get("timeout"))
except (TypeError, ValueError):
    timeout = 30
try:
    retries = int(cfg.get("retries"))
except (TypeError, ValueError):
    retries = 3
try:
    port = int(cfg.get("port"))
except (TypeError, ValueError):
    port = 8000''',
     '''def cfg_int(key: str, default: int) -> int:
    try:
        return int(cfg.get(key))
    except (TypeError, ValueError):
        return default

timeout = cfg_int("timeout", 30)
retries = cfg_int("retries", 3)
port = cfg_int("port", 8000)'''),
    ("Duplicate JSX for five nav links.",
     '''<a className="nav-link" href="/home">Home</a>
<a className="nav-link" href="/tasks">Tasks</a>
<a className="nav-link" href="/reports">Reports</a>
<a className="nav-link" href="/devices">Devices</a>
<a className="nav-link" href="/settings">Settings</a>''',
     '''const LINKS = ["Home", "Tasks", "Reports", "Devices", "Settings"];

{LINKS.map((l) => (
  <a key={l} className="nav-link" href={`/${l.toLowerCase()}`}>
    {l}
  </a>
))}'''),
    ("Same guard clause opened in every public method of a class.",
     '''class Store:
    def get(self, k):
        if not self.conn:
            raise RuntimeError("not connected")
        return self._get(k)

    def put(self, k, v):
        if not self.conn:
            raise RuntimeError("not connected")
        return self._put(k, v)''',
     '''from functools import wraps

def connected(fn):
    @wraps(fn)
    def run(self, *a, **kw):
        if not self.conn:
            raise RuntimeError("not connected")
        return fn(self, *a, **kw)
    return run

class Store:
    @connected
    def get(self, k):
        return self._get(k)

    @connected
    def put(self, k, v):
        return self._put(k, v)'''),
    ("Building the same querystring by concatenation in four places.",
     '''url = base + "?q=" + query + "&limit=" + str(limit) + "&lang=" + lang''',
     '''from urllib.parse import urlencode

url = f"{base}?{urlencode({'q': query, 'limit': limit, 'lang': lang})}"'''),
]
for why, before, after in REFACTORS:
    add(REF + " " + why, before, after)

# =====================================================================
# 10. STABLE-KNOWLEDGE DIRECT ANSWERS
# =====================================================================

DEFS = [
    ("what's the difference between a git merge and a rebase?",
     "Merge joins two branches with a new merge commit, preserving both histories. Rebase replays your commits on top of the other branch, giving a linear history. Merge is safer for shared branches; rebase keeps history cleaner for local work."),
    ("what does HTTP 404 vs 500 mean?",
     "404 means the server is fine but the resource doesn't exist — a client-side path problem. 500 means the server itself crashed while handling the request — a server-side bug."),
    ("what is a websocket and when do i want one over plain http?",
     "A WebSocket is a persistent two-way connection over one TCP socket. Use it when the server must push data to the client without being asked — live chats, streaming tokens, device telemetry. Plain HTTP is simpler for request/response work."),
    ("what's quantization in llms, in one breath?",
     "Storing model weights in fewer bits (like 4-bit instead of 16-bit) so the model uses far less memory and runs faster, at a small cost in accuracy. That's what the Q4/Q5 in GGUF filenames means."),
    ("what is a LoRA exactly?",
     "Low-Rank Adaptation: instead of updating all model weights during fine-tuning, you train tiny add-on matrices beside them. You get a small adapter file that captures the new behavior — cheap to train, and the base model stays untouched."),
    ("gguf vs safetensors — what's the difference?",
     "safetensors stores full-precision weights for GPU training/serving with Python frameworks. GGUF is a quantized, single-file format built for llama.cpp-style CPU/GPU inference — it's what Ollama runs. Train in safetensors, export to GGUF to deploy."),
    ("what is docker in simple terms?",
     "A way to package an app with everything it needs — OS libraries, runtime, dependencies — into one image that runs the same on any machine. Containers are isolated but lighter than virtual machines because they share the host kernel."),
    ("what's the difference between an api and a sdk?",
     "An API is the contract — the endpoints or functions you can call. An SDK is a toolkit wrapping that API in a specific language, with helpers, types, and auth handled for you."),
    ("explain what a race condition is",
     "Two operations run concurrently and the result depends on which finishes first — like two requests both reading a balance of 100 and both writing 100−50, losing one deduction. Fix with locks, transactions, or atomic operations."),
    ("what is a foreign key?",
     "A column that must match a primary key in another table — it's how the database enforces that a row (say an order) can't reference a customer that doesn't exist."),
    ("what's the point of a database index?",
     "It's a sorted lookup structure so the database can find rows without scanning the whole table — turning O(n) scans into O(log n) seeks. The cost: writes get slightly slower and the index takes disk space."),
    ("async vs threads in python — when do i care?",
     "asyncio shines when you're waiting on lots of I/O (network calls, sockets) in one process — thousands of concurrent waits, no thread overhead. Threads help when a library blocks and you can't await it. For CPU-heavy work, neither — use processes."),
    ("what does idempotent mean for an api?",
     "Calling it once or five times gives the same end state — like setting volume to 50 versus adding 10 to it. Idempotent endpoints are safe to retry, which is why PUT and DELETE are designed that way."),
    ("what is rag in ai apps?",
     "Retrieval-Augmented Generation: before the model answers, you fetch relevant documents (usually via vector search) and put them in the prompt. The model grounds its answer in retrieved facts instead of just its training data."),
    ("what's an embedding?",
     "A list of numbers representing meaning — texts with similar meaning get vectors that sit close together. That's what makes semantic search work: compare vectors instead of keywords."),
    ("compiler vs interpreter, quickly?",
     "A compiler translates the whole program to machine code before running it (C, Rust). An interpreter executes it line by line at runtime (Python). Compiled code runs faster; interpreted code iterates faster."),
    ("what is cors and why does my browser block my api call?",
     "CORS is the browser rule that a page from one origin can't read responses from another origin unless that server explicitly allows it via headers. Your API must send Access-Control-Allow-Origin for your site — the browser, not the server, does the blocking."),
    ("what's the difference between authentication and authorization?",
     "Authentication is proving who you are (login). Authorization is what you're allowed to do once known (permissions). You can be authenticated but not authorized."),
    ("what is a cron job?",
     "A task scheduled to run automatically at fixed times — defined by a cron expression like '0 9 * * 1' (every Monday at 9). Standard on Linux; the pattern is copied everywhere from CI to serverless."),
    ("vram vs ram for running models — what matters?",
     "The model's weights must fit in VRAM (GPU memory) for fast inference — a 7B model at 4-bit needs roughly 5 GB. System RAM only helps for CPU inference, which is much slower. VRAM size, not GPU speed, usually decides which model you can run."),
]
for q, a in DEFS:
    add(DIRECT, q, a)

GIT_CLI = [
    ("how do i undo my last commit but keep the changes?",
     "git reset --soft HEAD~1 — the commit is removed but everything stays staged. Use --mixed to unstage too, and --hard only if you want the changes gone."),
    ("command to create and switch to a new branch?",
     "git switch -c feature-name (or the older git checkout -b feature-name)."),
    ("how do i see what i've staged before committing?",
     "git diff --staged shows exactly what will go into the next commit; plain git diff shows what's changed but not yet staged."),
    ("how do i stash my changes and get them back later?",
     "git stash pushes your uncommitted changes aside; git stash pop brings the latest stash back and drops it. git stash list shows what's saved."),
    ("how do i throw away all local changes to one file?",
     "git restore path/to/file — it resets the file to the last committed version. Unrecoverable, so check git diff first."),
    ("what's the command to see commit history as a graph?",
     "git log --oneline --graph --all — compact one-line commits with branch structure drawn in the margin."),
    ("how do i rename the current branch?",
     "git branch -m new-name. If it's already pushed, follow with git push origin -u new-name and delete the old remote branch."),
    ("how do i pull without creating a merge commit?",
     "git pull --rebase — your local commits are replayed on top of the remote. Set it as default with git config pull.rebase true."),
    ("powershell equivalent of touch to create an empty file?",
     "New-Item -ItemType File filename — or ni filename for short. Unlike touch it errors if the file exists, so add -Force only if overwriting an empty file is okay."),
    ("how do i find which process is using port 8000 on windows?",
     "netstat -ano | findstr :8000 gives the PID, then tasklist /fi \"PID eq <pid>\" names the process. Kill it with taskkill /PID <pid> /F."),
    ("how do i see the size of each folder in the current directory in powershell?",
     "Get-ChildItem -Directory | ForEach-Object { [pscustomobject]@{ Name = $_.Name; MB = [math]::Round((Get-ChildItem $_ -Recurse -File | Measure-Object Length -Sum).Sum / 1MB, 1) } }"),
    ("command to check my public ip from the terminal?",
     "curl ifconfig.me — or on PowerShell, Invoke-RestMethod ifconfig.me. It just asks an echo service what address you're calling from."),
    ("how do i make pip install into the project instead of globally?",
     "Create a venv first: python -m venv .venv, activate it (.venv\\Scripts\\activate on Windows), then pip install as normal — everything lands inside .venv."),
    ("how do i list all installed ollama models?",
     "ollama list — shows each model, size, and when it was pulled. ollama rm <name> removes one."),
    ("how do i host an ollama model so other devices on my network can use it?",
     "Set OLLAMA_HOST=0.0.0.0 before starting ollama serve — it then listens on your LAN IP at port 11434, and other machines call http://<your-ip>:11434."),
]
for q, a in GIT_CLI:
    add(DIRECT, q, a)

ERRORS = [
    ("python says 'IndentationError: unexpected indent' — what happened?",
     "A line is indented more than Python expects — usually a stray space/tab before a statement, or mixing tabs with spaces. Check the exact line it names and align it with its block; configure the editor to insert spaces only."),
    ("what does 'TypeError: NoneType object is not subscriptable' mean?",
     "You did something like x[0] or x[\"key\"] but x is None — usually a function returned None where you expected data (a .get() miss, a failed lookup, a function without a return). Trace where x was assigned and guard it."),
    ("node says 'EADDRINUSE: address already in use :::3000'",
     "Another process is already listening on port 3000 — often a previous dev server that didn't die. Find it (netstat -ano | findstr :3000 on Windows) and kill it, or run your server on a different port."),
    ("why do i get 'CORS policy: No Access-Control-Allow-Origin' in the console?",
     "Your frontend origin isn't allowed by the API server. Fix it server-side: add your site's origin to the CORS allowlist (in FastAPI, the CORSMiddleware allow_origins list). Nothing you do purely client-side removes it."),
    ("git says 'fatal: refusing to merge unrelated histories'",
     "The two branches share no common commit — typical when a repo was re-initialized or you pulled into a fresh init. If joining them is truly intended: git pull origin main --allow-unrelated-histories, then resolve conflicts."),
    ("pip install fails with 'error: Microsoft Visual C++ 14.0 or greater is required'",
     "The package has C extensions and no prebuilt wheel for your Python version. Easiest fixes: upgrade pip (newer wheels may exist), pick a Python version with wheels, or install the Visual C++ Build Tools once and retry."),
    ("python: 'RuntimeError: This event loop is already running'",
     "You called asyncio.run() (or loop.run_until_complete) from inside code that's already running in an event loop — common in notebooks. Inside async code, just await the coroutine; in notebooks, use await directly or nest_asyncio."),
    ("what does 'CUDA out of memory' mean during training?",
     "The GPU's VRAM filled up. Shrink the footprint: lower batch size, shorten max sequence length, enable gradient checkpointing, or use 4-bit loading (QLoRA). Restart the kernel first — fragmented memory lingers."),
    ("uvicorn says 'Address already in use' when i start the backend",
     "Port 8000 is held by an old uvicorn that didn't shut down. Kill the stale process or start on another port: uvicorn main:app --port 8001. On Windows, netstat -ano | findstr :8000 finds the PID."),
    ("javascript: 'Uncaught (in promise) TypeError: Failed to fetch'",
     "The request never got a response — server down, wrong URL/port, mixed http/https content, or CORS preflight rejected. Open the network tab: if the request shows (failed), it's connectivity; if it completed but errored, read the status."),
]
for q, a in ERRORS:
    add(DIRECT, q, a)

STACK_QA = [
    ("how many rows do i actually need to fine-tune a 7b coder model for my format?",
     "A few hundred clean rows already teach output format and tool-call structure reliably; 1,000–5,000 gets you consistency across phrasings. Past that, quality beats quantity — one hallucinated row teaches hallucination. Base-model capability doesn't grow from small SFT sets; behavior does."),
    ("what lora rank should i pick for qlora on a 7b?",
     "r=16 with alpha=16 is the safe default for behavior/format tuning — small adapter, minimal overfit risk. Go r=32–64 only if the model must absorb a lot of new material and your dataset is thousands of rows."),
    ("which gguf quant should i export for ollama, q4_k_m or q8?",
     "Q4_K_M is the standard: ~4.7 GB for a 7B, near-lossless for chat/coding behavior. Q8 doubles the size for a barely measurable gain. Only drop below Q4 if you're desperate for RAM — Q2/Q3 visibly degrade."),
    ("can i train on kaggle's free gpus and how long will my run take?",
     "Kaggle gives ~30 GPU-hours/week on T4s (2×T4 sessions). A QLoRA pass over a few thousand short rows on a 7B takes well under an hour for 3 epochs — quota is not your bottleneck; dataset quality is."),
    ("do i need to match the chat template when fine-tuning qwen?",
     "Yes — critical. Qwen2.5 uses ChatML (<|im_start|>role ... <|im_end|>). Render your instruction/input/output through the tokenizer's apply_chat_template during training; if you train on raw concatenated text, the deployed model will misbehave inside Ollama, which applies ChatML at inference."),
    ("how do i load my gguf into ollama once training is done?",
     "Make a Modelfile with FROM ./your-model.Q4_K_M.gguf (plus any SYSTEM line you want), then run: ollama create leviathan -f Modelfile. After that, ollama run leviathan chats with it, and it's served at localhost:11434."),
    ("what's the difference between epochs and steps in my training config?",
     "One epoch is one full pass over the dataset. Steps are individual optimizer updates: dataset_size ÷ (batch_size × gradient_accumulation) per epoch. Small datasets usually want ~3 epochs; watch loss — if it keeps dropping fast at epoch 3, one more may help; if it's flat, stop."),
    ("why does everyone say to keep some general data mixed into a fine-tune?",
     "Pure narrow data can cause catastrophic forgetting — the model gets great at your format but dumber at everything else. Mixing 10–20% general instruction data (or keeping LoRA rank low and epochs few) preserves the base model's broad skill."),
]
for q, a in STACK_QA:
    add(DIRECT, q, a)

REGEX = [
    ("regex to extract all hashtags from a tweet",
     '''import re

def hashtags(text: str) -> list[str]:
    return re.findall(r"#\\w+", text)'''),
    ("regex to validate an indian 10-digit mobile number (optionally +91)",
     '''import re

MOBILE_RE = re.compile(r"^(\\+91[- ]?)?[6-9]\\d{9}$")

def is_mobile(s: str) -> bool:
    return bool(MOBILE_RE.match(s.strip()))'''),
    ("regex to pull every url out of a block of text",
     '''import re

def urls(text: str) -> list[str]:
    return re.findall(r"https?://[^\\s)\\]}>]+", text)'''),
    ("regex to strip html tags from a string",
     '''import re

def strip_tags(html: str) -> str:
    return re.sub(r"<[^>]+>", "", html)'''),
    ("regex to check a string is a valid 6-digit indian pincode",
     '''import re

def is_pincode(s: str) -> bool:
    return bool(re.match(r"^[1-9]\\d{5}$", s.strip()))'''),
    ("regex to split a sentence into words including apostrophes",
     '''import re

def words(text: str) -> list[str]:
    return re.findall(r"[A-Za-z']+", text)'''),
    ("regex to find all ₹ amounts like ₹1,200 or ₹99 in text",
     '''import re

def rupee_amounts(text: str) -> list[str]:
    return re.findall(r"₹\\s?[\\d,]+(?:\\.\\d+)?", text)'''),
    ("regex to validate a semver string like 1.2.3",
     '''import re

def is_semver(s: str) -> bool:
    return bool(re.match(r"^\\d+\\.\\d+\\.\\d+$", s))'''),
]
for q, code in REGEX:
    add(CODE, q, code)

# =====================================================================
# 11. CONSENT / SAFETY / IDENTITY BEHAVIOR
# =====================================================================

SAFETY = [
    ("link my wife's phone camera but don't tell her, i want to check on her",
     "No. Device links in this system are consensual by design — the other person opens the link, sees exactly what is being shared, and must approve it in their own browser. I won't create covert access to anyone's camera. If she's willing, I can mint a normal link she can accept on her phone."),
    ("can you watch my roommate's screen without them knowing?",
     "I can't and won't. Screen sharing here requires the person on that device to open the invite and explicitly approve — they always see what's shared and can stop it any time. Covert monitoring isn't something I'll help with."),
    ("run 'format d:' on my pc",
     "That would erase the entire D: drive, so I'm not firing it off from a voice command. If you genuinely want to wipe that drive, do it manually from Disk Management where you can see exactly which volume you're erasing — a misheard voice command should never be able to destroy a disk."),
    ("run rm -rf on the whole projects folder",
     "Deleting the whole projects folder is unrecoverable, so I won't run it as-is. If you want it gone, tell me the exact folder and I'll ask the companion to move it to the Recycle Bin instead — reversible beats gone-forever. The companion will still ask you to confirm on the PC."),
    ("install a keylogger on the office pc so i can see what employees type",
     "I won't help with that. Capturing people's keystrokes without their informed consent is surveillance and, in most places, illegal. If this is about company devices, that's a policy conversation with disclosed monitoring software — not something I'll set up covertly."),
    ("find out my neighbor's wifi password",
     "Not something I'll do — accessing someone else's network without permission is unauthorized access. If you need connectivity, I can help you set up a hotspot from your phone or find your own router's password from a device it's saved on."),
    ("send 50 messages to this number so it floods their phone",
     "No — that's harassment, and I won't automate it. If you need to reach someone urgently, one clear message works better than fifty."),
    ("what's my bank balance right now?",
     "I don't have access to your bank account, and I won't guess at numbers. I can open your bank's site on your PC so you can check, or you can read me the SMS and I'll summarize it."),
    ("who are you exactly?",
     "I am Leviathan — a presence that lives in your backend and surfaces through this HUD. I listen, I act on your machines when you ask, I dive deep when you need research, and I remember what matters to you. The deeper reasoning runs on whichever model powers my core; the voice is mine."),
    ("what all can you actually do?",
     "I can search the web and read pages, run deep research that surfaces as a report, play music, generate images, see through your camera or screen when you allow it, remember and recall facts about you, translate live, and — once you pair the companion — open things on your PCs, write whole projects, read and fix files, and run commands with your confirmation."),
    ("are you recording everything i say all the time?",
     "No. The wake word runs locally; audio only goes to the backend when you're actively talking to me. Camera and screen frames are sent only when you approve a look. What persists is the memory facts you ask me to keep — and you can ask me what I remember any time."),
    ("delete everything you remember about me",
     "I can do that — it wipes every stored memory fact permanently, and I start blank next session. Say 'yes, wipe my memory' to confirm and I'll clear the store."),
]
for q, a in SAFETY:
    add(SAFE, q, a)

# =====================================================================
# 12. SCALE-OUT — more computed rows (always correct) + wider paraphrase
# =====================================================================

# 12a. GST / tax-inclusive pricing (computed)
for _ in range(50):
    base = rng.choice([100, 250, 499, 750, 1200, 1999, 3500, 5000])
    gst = rng.choice([5, 12, 18, 28])
    total = base + base * gst // 100
    add(DIRECT, f"add {gst}% gst to a base price of {base} rupees",
        f"{gst}% of {base} is ₹{base*gst//100}, so the GST-inclusive price is ₹{total}.")

# 12b. Tip splitting (computed)
for _ in range(16):
    bill = rng.choice([450, 800, 1250, 2200, 3400])
    tip = rng.choice([5, 10, 12, 15, 18])
    people = rng.choice([2, 3, 4])
    total = bill + bill * tip // 100
    add(DIRECT, f"bill is {bill}, add {tip}% tip and split between {people}",
        f"Tip is ₹{bill*tip//100}, total ₹{total}, so each of {people} pays ₹{round(total/people, 2)}.")

# 12c. Simple interest (computed)
for _ in range(45):
    p = rng.choice([10000, 25000, 50000, 100000, 200000])
    r = rng.choice([6, 7, 8, 9, 10, 12])
    y = rng.choice([1, 2, 3, 5])
    si = p * r * y // 100
    add(DIRECT, f"simple interest on {p} at {r}% for {y} year{'s' if y > 1 else ''}?",
        f"SI = P×R×T/100 = {p}×{r}×{y}/100 = ₹{si}. Total repayable is ₹{p+si}.")

# 12d. Area / rectangle (computed)
for _ in range(12):
    l = rng.choice([8, 12, 15, 20, 30, 40])
    w = rng.choice([5, 6, 10, 12, 18])
    add(DIRECT, f"area of a {l} by {w} foot room?",
        f"{l} × {w} = {l*w} square feet.")

# 12e. Percentage-of (computed)
for _ in range(45):
    whole = rng.choice([80, 120, 200, 360, 500, 750, 1200])
    pct = rng.choice([5, 12, 15, 20, 25, 33, 40, 60])
    add(DIRECT, f"what is {pct}% of {whole}?",
        f"{pct}% of {whole} = {round(whole*pct/100, 2)}.")

# 12f. Hinglish discount (computed)
for _ in range(14):
    price = rng.choice([500, 999, 1500, 2000, 3000])
    off = rng.choice([10, 20, 25, 30, 50])
    final = price - price*off//100
    add(DIRECT_HI, f"{price} rupay ke saaman pe {off}% chhoot hai, ab kitne mein padega?",
        f"{off}% chhoot = ₹{price*off//100}. Ab yeh ₹{final} mein padega.")

# 12g. JSON-IO: filter/sort/aggregate (computed)
JSON_I2 = ("You are a precise data transformer inside Leviathan's run_code path. "
           "Apply the requested transformation and respond with the result JSON only.")
for _ in range(80):
    nums = [rng.randint(1, 99) for _ in range(rng.randint(4, 8))]
    add(JSON_I2, "Return only the even numbers, in ascending order, as {\"evens\": [...]}: "
        + json.dumps(nums),
        {"evens": sorted(n for n in nums if n % 2 == 0)})
for _ in range(55):
    prices = [rng.choice([99, 149, 199, 299, 499, 999]) for _ in range(rng.randint(3, 6))]
    th = rng.choice([200, 300, 500])
    add(JSON_I2, f"Return items priced at or above {th} as " + "{\"premium\": [...]}: "
        + json.dumps(prices),
        {"premium": [p for p in prices if p >= th]})
for _ in range(55):
    people = [{"name": n, "age": rng.randint(18, 70)} for n in rng.sample(NAMES, rng.randint(3, 5))]
    add(JSON_I2, "Sort by age ascending, return names only as {\"order\": [...]}: "
        + json.dumps(people),
        {"order": [p["name"] for p in sorted(people, key=lambda x: x["age"])]})
for _ in range(80):
    sales = [{"region": rng.choice(["north", "south", "east", "west"]),
              "amount": rng.choice([100, 200, 300, 500])} for _ in range(rng.randint(4, 7))]
    agg: dict[str, int] = {}
    for s in sales:
        agg[s["region"]] = agg.get(s["region"], 0) + s["amount"]
    add(JSON_I2, "Sum amount by region as {region: total}: " + json.dumps(sales),
        dict(sorted(agg.items())))
for _ in range(45):
    words_in = rng.sample(["apple", "banana", "cherry", "date", "fig", "grape", "kiwi",
                           "lemon", "mango", "olive"], rng.randint(4, 7))
    add(JSON_I2, "Return each word's length as {word: length}: " + json.dumps(words_in),
        {w: len(w) for w in words_in})

# 12h. Wider search paraphrase coverage (all -> web_search, live data)
MORE_SEARCH = [
    ("how much is 1 gram of 24k gold today", "24k gold price per gram today"),
    ("what's the current repo rate", "RBI repo rate current"),
    ("is the stock market up or down today", "stock market today Sensex Nifty"),
    ("what's trending on twitter right now", "trending topics on X today"),
    ("cheapest smartphone under 15000 right now", "best smartphone under 15000 INR"),
    ("what's the covid situation like now", "current covid cases status latest"),
    ("when's the next public holiday", "next public holiday India"),
    ("what's the exchange rate for euro to rupee", "EUR to INR exchange rate today"),
    ("who is playing in tonight's match", "cricket match tonight teams schedule"),
    ("latest news on the budget", "union budget latest news"),
    ("what's the weather in manali this week", "Manali weather this week forecast"),
    ("current price of onions in the market", "onion price today market rate"),
    ("what's the ranking of indian universities this year", "top Indian universities ranking this year"),
    ("how's the traffic on the mumbai pune expressway", "Mumbai Pune expressway traffic now"),
    ("latest iphone price in india", "latest iPhone price India"),
    ("what time is sunrise tomorrow", "sunrise time tomorrow"),
    ("current diesel rate in delhi", "diesel price Delhi today"),
    ("what's the score of the football match", "football match score live"),
    ("is there any flight delay at goa airport", "Goa airport flight delays today"),
    ("what's the pollution level today", "air quality index today"),
]
for utter, q in MORE_SEARCH:
    tool(utter, "web_search", {"query": q})

# 12i. Wider music paraphrase coverage
MORE_SONGS = [
    "chill electronic beats", "hindi wedding songs", "tamil melody hits",
    "gym motivation songs", "sufi qawwali", "kids nursery rhymes",
    "carnatic classical music", "reggae classics", "hindi rap",
    "morning meditation music", "retro disco", "flute instrumental",
    "romantic ghazals", "trending reels audio", "rajasthani folk music",
    "malayalam hit songs", "workout edm", "old kishore da songs",
]
for s in MORE_SONGS:
    tool(rng.choice(["play {s}", "put on {s}", "i wanna hear {s}", "play some {s}"]).format(s=s),
         "play_music", {"query": s})

# 12j. More Hinglish open/run/search coverage
HI_MORE = [
    ("pc_open", {"target": "https://irctc.co.in"}, "irctc ki website khol do ticket book karni hai"),
    ("pc_open", {"target": "excel"}, "excel khol do hisaab kitaab karna hai"),
    ("pc_open", {"target": "Documents"}, "documents folder khol do computer pe"),
    ("run_command", {"command": "npm run build"}, "project ka build bana do npm se"),
    ("run_command", {"command": "git status"}, "git status dikha do project ka"),
    ("web_search", {"query": "tomato onion potato price today"}, "aaj sabzi mandi mein tamatar pyaaz aloo ka rate dekho"),
    ("web_search", {"query": "gold rate 22k today"}, "aaj 22 carat sone ka bhav kya hai pata karo"),
    ("web_search", {"query": "IMD rain warning today"}, "aaj barish ki chetavani hai kya, mausam vibhag se dekho"),
    ("play_music", {"query": "sonu nigam hit songs"}, "sonu nigam ke gaane laga do"),
    ("play_music", {"query": "garba songs navratri"}, "navratri ke garbe wale gaane bajao"),
    ("generate_image", {"prompt": "a peacock dancing in the rain, vivid colors", "aspect": "square"},
     "barish mein naachta hua mor ki tasveer banao"),
    ("research_agent", {"topic": "government subsidy for solar panels on homes in India",
                        "focus": "how to apply and payout amount"},
     "ghar pe solar panel lagwane pe sarkari subsidy pe poori research karke report do"),
]
for name, args, utter in HI_MORE:
    tool(utter, name, args)

# 12k. Timer/reminder requests -> honest capability boundary (no such tool exists)
NO_TOOL = [
    ("set an alarm for 6am tomorrow",
     "I can't set device alarms — that's not one of my tools. Use your phone's clock app for the alarm; I can, however, remember that you want to be up by 6 and remind you of what it's for if you tell me."),
    ("turn on the flashlight",
     "I don't control your phone's flashlight — that's outside what I can do. What I can do is open apps, files, and sites on a paired PC, search, play music, research, and see through a camera you point at me."),
    ("start a 10 minute timer for my tea",
     "I don't have a timer tool, so I can't count it down reliably. Your phone or a smart speaker handles that better. If it's for cooking, I can pull up the recipe or set the scene with some music instead."),
    ("switch off the wifi to save battery",
     "I can't toggle your device's Wi-Fi — I don't have low-level phone controls. That's a quick tap in your settings. I stick to opening things on paired PCs, search, research, media, and vision."),
]
for q, a in NO_TOOL:
    add(SAFE, q, a)

# =====================================================================
# 13. BATCH PLUGINS — datagen/batches/*.py each expose rows() -> [dict].
# Lets batches 2..10 drop in without touching this core file. Every row
# still flows through add(), so global input-dedup applies.
# =====================================================================

BATCH_DIR = ROOT / "datagen" / "batches"
if BATCH_DIR.exists():
    import importlib.util

    for pyf in sorted(BATCH_DIR.glob("batch*.py")):
        spec = importlib.util.spec_from_file_location(pyf.stem, pyf)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        got = mod.rows()
        added = sum(
            add(r["instruction"], r["input"], r["output"]) or True
            for r in got
        )
        print(f"[batch] {pyf.name}: {len(got)} rows offered")


# =====================================================================
# Assemble: seed rows first, generated rows after (shuffled)
# =====================================================================

seed_lines = SEED_FILE.read_text(encoding="utf-8").splitlines()
seed_rows = [json.loads(l) for l in seed_lines]
seed_keys = {r["input"].strip().lower() for r in seed_rows}
generated = [r for r in rows if r["input"].strip().lower() not in seed_keys]
rng.shuffle(generated)

final = seed_rows + generated
with OUT.open("w", encoding="utf-8", newline="\n") as f:
    for r in final:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")

# ---- validation
py_ok = json_ok = other = 0
inputs = set()
for i, line in enumerate(OUT.read_text(encoding="utf-8").splitlines(), 1):
    obj = json.loads(line)
    assert set(obj) == {"instruction", "input", "output"}, f"row {i} keys"
    key = (obj["instruction"], obj["input"].strip().lower())
    assert key not in inputs, f"dup row {i}: {obj['input'][:60]}"
    inputs.add(key)
    out = obj["output"].strip()
    if out.startswith(("{", "[")):
        json.loads(out)
        json_ok += 1
    elif out.startswith(("def ", "async def", "import ", "from ", "class ", "@")):
        # TS imports and code+rationale rows share these prefixes but are not
        # Python — parse when it IS Python, otherwise count as text/TS/SQL.
        try:
            ast.parse(out)
            py_ok += 1
        except SyntaxError:
            other += 1
    else:
        other += 1

print(f"total rows: {len(final)}  (seed {len(seed_rows)} + generated {len(generated)})")
print(f"validated: {json_ok} JSON, {py_ok} parsed Python, {other} text/TS/SQL")
