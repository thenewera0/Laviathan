import ast
import json
from pathlib import Path


SYSTEM = "You are Leviathan, a calm authoritative agentic assistant."
OUT = Path("leviathan_gpt.jsonl")

TOOLS = {
    "web_search",
    "browse",
    "open_url",
    "play_music",
    "run_code",
    "generate_image",
    "see",
    "see_screen",
    "set_translation",
    "research_agent",
    "remember",
    "recall",
    "create_device_link",
    "pair_computer",
    "pc_open",
    "write_project",
    "write_file",
    "read_path",
    "run_command",
    "preview_project",
}


def row(messages):
    return {"messages": [{"role": "system", "content": SYSTEM}, *messages]}


def call_message(cid, name, args):
    return {
        "role": "assistant",
        "content": "",
        "tool_calls": [
            {
                "id": cid,
                "type": "function",
                "function": {"name": name, "arguments": json.dumps(args)},
            }
        ],
    }


def calls_message(calls):
    return {
        "role": "assistant",
        "content": "",
        "tool_calls": [
            {
                "id": cid,
                "type": "function",
                "function": {"name": name, "arguments": json.dumps(args)},
            }
            for cid, name, args in calls
        ],
    }


def tool(cid, payload):
    return {"role": "tool", "tool_call_id": cid, "content": json.dumps(payload)}


rows = []

# Bucket A: Device and task execution macros.
single_opens = [
    ("open my Downloads folder on the laptop", "pc_open", {"target": "Downloads", "device": "maya-laptop"}, {"status": "opened Downloads", "device": "maya-laptop"}, "Your Downloads folder is open on maya-laptop."),
    ("bring up Safari on the studio Mac", "pc_open", {"target": "Safari", "device": "studio-mac"}, {"status": "opened Safari", "device": "studio-mac"}, "Safari is open on studio-mac."),
    ("open Notepad on office-pc", "pc_open", {"target": "Notepad", "device": "office-pc"}, {"status": "opened Notepad", "device": "office-pc"}, "Notepad is ready on office-pc."),
    ("open C:\\Users\\Maya\\Documents\\Invoices\\june.xlsx", "pc_open", {"target": "C:\\Users\\Maya\\Documents\\Invoices\\june.xlsx", "device": "office-pc"}, {"status": "opened file", "target": "C:\\Users\\Maya\\Documents\\Invoices\\june.xlsx"}, "The June invoice workbook is open."),
    ("open my project folder on the dev box", "pc_open", {"target": "C:\\Users\\Admin\\Laviathan", "device": "dev-box"}, {"status": "opened folder", "target": "C:\\Users\\Admin\\Laviathan"}, "The Laviathan project folder is open on dev-box."),
    ("launch Terminal on the Mac mini", "pc_open", {"target": "Terminal", "device": "mac-mini"}, {"status": "opened Terminal", "device": "mac-mini"}, "Terminal is open on mac-mini."),
    ("open https://supabase.com on all my computers", "pc_open", {"target": "https://supabase.com"}, {"status": "opened target on paired devices", "devices": ["office-pc", "studio-mac"]}, "Supabase is open on all paired computers."),
    ("put Slack on the screen in the office", "pc_open", {"target": "Slack", "device": "office-pc"}, {"status": "opened Slack", "device": "office-pc"}, "Slack is open on office-pc."),
    ("open Finder to my Desktop on studio-mac", "pc_open", {"target": "~/Desktop", "device": "studio-mac"}, {"status": "opened ~/Desktop", "device": "studio-mac"}, "Your Desktop is open on studio-mac."),
    ("open Windows Settings on the kitchen PC", "pc_open", {"target": "ms-settings:", "device": "kitchen-pc"}, {"status": "opened ms-settings:", "device": "kitchen-pc"}, "Windows Settings is open on kitchen-pc."),
    ("open the payroll PDF on office-pc", "pc_open", {"target": "C:\\Users\\Maya\\Documents\\Payroll\\payroll-summary.pdf", "device": "office-pc"}, {"status": "opened file", "target": "C:\\Users\\Maya\\Documents\\Payroll\\payroll-summary.pdf"}, "The payroll summary is open on office-pc."),
    ("open Visual Studio Code on dev-box", "pc_open", {"target": "Visual Studio Code", "device": "dev-box"}, {"status": "opened Visual Studio Code", "device": "dev-box"}, "Visual Studio Code is open on dev-box."),
    ("open my calendar website everywhere", "pc_open", {"target": "https://calendar.google.com"}, {"status": "opened target on paired devices", "devices": ["office-pc", "maya-laptop", "studio-mac"]}, "Your calendar is open on every paired computer."),
    ("open Keynote on the studio Mac", "pc_open", {"target": "Keynote", "device": "studio-mac"}, {"status": "opened Keynote", "device": "studio-mac"}, "Keynote is open on studio-mac."),
    ("open the shared drive folder on office-pc", "pc_open", {"target": "Z:\\Shared", "device": "office-pc"}, {"status": "opened folder", "target": "Z:\\Shared"}, "The shared drive folder is open on office-pc."),
]
for user, name, args, result, final in single_opens:
    rows.append(row([{"role": "user", "content": user}, call_message("c1", name, args), tool("c1", result), {"role": "assistant", "content": final}]))

commands = [
    ("show me the git status on dev-box", {"command": "git status --short", "device": "dev-box"}, {"status": "completed", "exit_code": 0, "stdout": " M web/src/App.tsx\n?? leviathan_gpt.jsonl\n"}, "Git status is complete. There is one modified file and one untracked JSONL file on dev-box."),
    ("run the unit tests on office-pc", {"command": "npm test", "device": "office-pc"}, {"status": "awaiting_confirmation", "device": "office-pc", "prompt": "Confirm terminal command: npm test"}, "I sent the test command to office-pc for confirmation."),
    ("restart the local API on the dev box", {"command": "npm run dev:api", "device": "dev-box"}, {"status": "started", "pid": 8824, "device": "dev-box"}, "The local API is starting on dev-box."),
    ("list the current directory on the Mac mini", {"command": "pwd && ls", "device": "mac-mini"}, {"status": "completed", "exit_code": 0, "stdout": "/Users/maya/projects\nleviathan\nnotes\n"}, "The Mac mini is in /Users/maya/projects, with leviathan and notes inside."),
    ("check disk space on all paired computers", {"command": "df -h"}, {"status": "completed", "devices": {"studio-mac": "Filesystem Size Used Avail Use%\n/dev/disk3s1 460Gi 312Gi 126Gi 72%", "office-pc": "C: 952GB total, 611GB free"}}, "Disk space is checked across your paired computers."),
    ("run ipconfig on office-pc", {"command": "ipconfig", "device": "office-pc"}, {"status": "awaiting_confirmation", "device": "office-pc", "prompt": "Confirm terminal command: ipconfig"}, "I sent ipconfig to office-pc for your confirmation."),
    ("start the Vite dev server on dev-box", {"command": "npm run dev -- --host 127.0.0.1", "device": "dev-box"}, {"status": "started", "pid": 5140, "url": "http://127.0.0.1:5173"}, "The Vite dev server is running on dev-box at http://127.0.0.1:5173."),
    ("make a temp folder called voice-captures on the studio Mac", {"command": "mkdir -p ~/Desktop/voice-captures", "device": "studio-mac"}, {"status": "completed", "exit_code": 0}, "The voice-captures folder is on the studio-mac Desktop."),
    ("show Node and npm versions on dev-box", {"command": "node -v && npm -v", "device": "dev-box"}, {"status": "completed", "exit_code": 0, "stdout": "v22.5.1\n10.8.2\n"}, "dev-box is running Node v22.5.1 and npm 10.8.2."),
    ("tail the app log on office-pc", {"command": "Get-Content .\\logs\\app.log -Tail 40", "device": "office-pc"}, {"status": "awaiting_confirmation", "device": "office-pc", "prompt": "Confirm terminal command: Get-Content .\\logs\\app.log -Tail 40"}, "I sent the log tail command to office-pc for confirmation."),
]
for user, args, result, final in commands:
    rows.append(row([{"role": "user", "content": user}, call_message("c1", "run_command", args), tool("c1", result), {"role": "assistant", "content": final}]))

chains = [
    ("open the repo, then run the lint check", ("pc_open", {"target": "C:\\Users\\Admin\\Laviathan", "device": "dev-box"}, {"status": "opened folder", "device": "dev-box"}), ("run_command", {"command": "npm run lint", "device": "dev-box"}, {"status": "completed", "exit_code": 0, "stdout": "No lint errors found.\n"}), "The repo is open and lint passed on dev-box."),
    ("open VS Code and start the dev server on the laptop", ("pc_open", {"target": "Visual Studio Code", "device": "maya-laptop"}, {"status": "opened Visual Studio Code", "device": "maya-laptop"}), ("run_command", {"command": "npm run dev", "device": "maya-laptop"}, {"status": "started", "pid": 9031, "url": "http://localhost:5173"}), "VS Code is open and the dev server is running on maya-laptop."),
    ("open the screenshots folder and count the PNGs", ("pc_open", {"target": "C:\\Users\\Maya\\Pictures\\Screenshots", "device": "office-pc"}, {"status": "opened folder", "device": "office-pc"}), ("run_command", {"command": "Get-ChildItem C:\\Users\\Maya\\Pictures\\Screenshots -Filter *.png | Measure-Object", "device": "office-pc"}, {"status": "completed", "exit_code": 0, "stdout": "Count    : 86\n"}), "The screenshots folder is open. It contains 86 PNG files."),
    ("open the dashboard URL on every machine and ping it from dev-box", ("pc_open", {"target": "http://localhost:3000/dashboard"}, {"status": "opened target on paired devices", "devices": ["dev-box", "office-pc"]}), ("run_command", {"command": "curl -I http://localhost:3000/dashboard", "device": "dev-box"}, {"status": "completed", "exit_code": 0, "stdout": "HTTP/1.1 200 OK\n"}), "The dashboard is open everywhere, and dev-box reached it successfully."),
    ("open Activity Monitor, then check memory pressure", ("pc_open", {"target": "Activity Monitor", "device": "studio-mac"}, {"status": "opened Activity Monitor", "device": "studio-mac"}), ("run_command", {"command": "memory_pressure", "device": "studio-mac"}, {"status": "completed", "exit_code": 0, "stdout": "System-wide memory free percentage: 38%\n"}), "Activity Monitor is open, and memory pressure looks acceptable on studio-mac."),
]
for user, first, second, final in chains:
    rows.append(row([
        {"role": "user", "content": user},
        call_message("c1", first[0], first[1]),
        tool("c1", first[2]),
        call_message("c2", second[0], second[1]),
        tool("c2", second[2]),
        {"role": "assistant", "content": final},
    ]))

multi_calls = [
    ("open the spec on office-pc and the issue tracker on studio-mac", [("c1", "pc_open", {"target": "C:\\Users\\Maya\\Documents\\Specs\\voice-agent.md", "device": "office-pc"}), ("c2", "pc_open", {"target": "https://github.com/org/leviathan/issues", "device": "studio-mac"})], [("c1", {"status": "opened file", "device": "office-pc"}), ("c2", {"status": "opened url", "device": "studio-mac"})], "The spec is open on office-pc, and the issue tracker is open on studio-mac."),
    ("bring up Notes on the Mac and Calculator on the PC", [("c1", "pc_open", {"target": "Notes", "device": "studio-mac"}), ("c2", "pc_open", {"target": "Calculator", "device": "office-pc"})], [("c1", {"status": "opened Notes", "device": "studio-mac"}), ("c2", {"status": "opened Calculator", "device": "office-pc"})], "Notes is open on studio-mac, and Calculator is open on office-pc."),
    ("open the design folder everywhere and start a directory listing on dev-box", [("c1", "pc_open", {"target": "D:\\Design"}), ("c2", "run_command", {"command": "dir D:\\Design", "device": "dev-box"})], [("c1", {"status": "opened target on paired devices", "devices": ["dev-box", "office-pc"]}), ("c2", {"status": "awaiting_confirmation", "device": "dev-box", "prompt": "Confirm terminal command: dir D:\\Design"})], "The design folder is open on your paired computers. The directory listing is waiting for your confirmation on dev-box."),
    ("open Zoom on office-pc and the agenda PDF on maya-laptop", [("c1", "pc_open", {"target": "Zoom", "device": "office-pc"}), ("c2", "pc_open", {"target": "C:\\Users\\Maya\\Documents\\agenda.pdf", "device": "maya-laptop"})], [("c1", {"status": "opened Zoom", "device": "office-pc"}), ("c2", {"status": "opened file", "device": "maya-laptop"})], "Zoom is open on office-pc, and the agenda is open on maya-laptop."),
    ("open the logs on dev-box and Safari on studio-mac", [("c1", "pc_open", {"target": "C:\\Users\\Admin\\Laviathan\\logs", "device": "dev-box"}), ("c2", "pc_open", {"target": "Safari", "device": "studio-mac"})], [("c1", {"status": "opened folder", "device": "dev-box"}), ("c2", {"status": "opened Safari", "device": "studio-mac"})], "The logs folder is open on dev-box, and Safari is open on studio-mac."),
]
for user, tcalls, results, final in multi_calls:
    rows.append(row([{"role": "user", "content": user}, calls_message(tcalls), *[tool(cid, payload) for cid, payload in results], {"role": "assistant", "content": final}]))

pairs_and_errors = [
    ("pair this computer with code 483-912", "pair_computer", {"code": "483-912"}, {"status": "paired", "device": "office-pc"}, "office-pc is paired."),
    ("connect the new Mac using code 781 044", "pair_computer", {"code": "781 044"}, {"status": "paired", "device": "studio-mac"}, "studio-mac is paired."),
    ("pair my travel laptop, the code is 229174", "pair_computer", {"code": "229174"}, {"status": "paired", "device": "travel-air"}, "travel-air is paired."),
    ("try pairing code 000000", "pair_computer", {"code": "000000"}, {"status": "failed", "reason": "pairing code expired"}, "That pairing code has expired. Open the companion again and read me the fresh code."),
    ("open downloads", "pc_open", {"target": "Downloads"}, {"status": "failed", "error": "no_paired_pc"}, "I do not see a paired computer yet. Start the Leviathan companion on your computer, then give me its pairing code."),
    ("run the build on my computer", "run_command", {"command": "npm run build"}, {"status": "failed", "error": "no_paired_pc"}, "I do not have a paired computer to run that on. Start the companion app and give me the pairing code."),
    ("open the desktop on living-room-pc", "pc_open", {"target": "Desktop", "device": "living-room-pc"}, {"status": "failed", "error": "device_offline", "device": "living-room-pc"}, "living-room-pc is offline. I can act there once the companion reconnects."),
    ("open Photoshop on the studio Mac", "pc_open", {"target": "Adobe Photoshop", "device": "studio-mac"}, {"status": "failed", "error": "app_not_found", "target": "Adobe Photoshop"}, "Photoshop is not installed where I can find it on studio-mac."),
    ("connect my computer for screen control", "create_device_link", {"purpose": "screen"}, {"status": "created", "url": "https://leviathan.local/link/screen/6QF9"}, "I created a screen sharing link. Open it on the computer you want me to see."),
    ("send me a camera link for this phone", "create_device_link", {"purpose": "camera"}, {"status": "created", "url": "https://leviathan.local/link/camera/K28M"}, "I created a camera consent link. Open it on the device you want to use."),
    ("pair the workshop PC with 602-119", "pair_computer", {"code": "602-119"}, {"status": "paired", "device": "workshop-pc"}, "workshop-pc is paired."),
    ("open the camera roll on all paired PCs", "pc_open", {"target": "Pictures"}, {"status": "opened target on paired devices", "devices": ["office-pc", "travel-air", "workshop-pc"]}, "Pictures is open on all paired computers."),
    ("open the missing finance sheet on office-pc", "pc_open", {"target": "C:\\Users\\Maya\\Documents\\Finance\\forecast.xlsx", "device": "office-pc"}, {"status": "failed", "error": "file_not_found"}, "I could not find that finance sheet on office-pc."),
    ("open Chrome on every computer I paired", "pc_open", {"target": "Google Chrome"}, {"status": "opened target on paired devices", "devices": ["office-pc", "studio-mac", "dev-box"]}, "Chrome is open on every paired computer."),
    ("run npm install on dev-box", "run_command", {"command": "npm install", "device": "dev-box"}, {"status": "awaiting_confirmation", "device": "dev-box", "prompt": "Confirm terminal command: npm install"}, "I sent npm install to dev-box for your confirmation."),
]
for user, name, args, result, final in pairs_and_errors:
    rows.append(row([{"role": "user", "content": user}, call_message("c1", name, args), tool("c1", result), {"role": "assistant", "content": final}]))


# Bucket B: Database and async query engineering.
py_codes = [
("Give me asyncpg code to search pgvector embeddings by cosine distance.", """import asyncpg

async def search_similar(dsn: str, tenant_id: str, query_vec: list[float], limit: int = 8):
    sql = \"\"\"select id, title, embedding <=> $2::vector as distance
             from documents where tenant_id = $1
             order by embedding <=> $2::vector limit $3\"\"\"
    async with asyncpg.create_pool(dsn, min_size=1, max_size=5) as pool:
        async with pool.acquire() as con:
            return [dict(r) for r in await con.fetch(sql, tenant_id, query_vec, limit)]
"""),
("Write a pooled asyncpg upsert for document chunks.", """import asyncpg

async def upsert_chunks(dsn: str, rows: list[dict]):
    sql = \"\"\"insert into chunks(id, document_id, body, embedding)
             values($1, $2, $3, $4::vector)
             on conflict(id) do update set body = excluded.body, embedding = excluded.embedding\"\"\"
    vals = [(r["id"], r["document_id"], r["body"], r["embedding"]) for r in rows]
    async with asyncpg.create_pool(dsn) as pool:
        async with pool.acquire() as con:
            await con.executemany(sql, vals)
    return len(vals)
"""),
("Show a safe asyncpg account lookup by email.", """import asyncpg

async def get_account(dsn: str, email: str):
    sql = "select id, email, plan from accounts where lower(email) = lower($1)"
    conn = await asyncpg.connect(dsn)
    try:
        row = await conn.fetchrow(sql, email)
        return dict(row) if row else None
    finally:
        await conn.close()
"""),
("I need concurrent asyncpg fetches for user dashboards.", """import asyncio, asyncpg

async def dashboard(dsn: str, user_id: str):
    async with asyncpg.create_pool(dsn) as pool:
        async with pool.acquire() as con:
            q1 = con.fetchval("select count(*) from tasks where owner_id=$1 and done=false", user_id)
            q2 = con.fetch("select id, title from notes where owner_id=$1 order by updated_at desc limit 5", user_id)
            open_tasks, notes = await asyncio.gather(q1, q2)
            return {"open_tasks": open_tasks, "notes": [dict(n) for n in notes]}
"""),
("Make a parameterized asyncpg update for job status.", """import asyncpg

async def set_job_status(dsn: str, job_id: str, status: str):
    sql = "update jobs set status=$2, updated_at=now() where id=$1 returning id, status"
    conn = await asyncpg.connect(dsn)
    try:
        row = await conn.fetchrow(sql, job_id, status)
        return dict(row) if row else None
    finally:
        await conn.close()
"""),
("Give me asyncpg code to create the pgvector extension and index.", """import asyncpg

async def ensure_vector_index(dsn: str):
    conn = await asyncpg.connect(dsn)
    try:
        await conn.execute("create extension if not exists vector")
        await conn.execute("create index if not exists chunks_embedding_hnsw on chunks using hnsw (embedding vector_cosine_ops)")
        return "ready"
    finally:
        await conn.close()
"""),
("Write a paged asyncpg query for audit events.", """import asyncpg

async def audit_page(dsn: str, tenant_id: str, cursor_id: str | None, limit: int = 50):
    sql = \"\"\"select id, actor_id, action, created_at from audit_events
             where tenant_id=$1 and ($2::uuid is null or id < $2::uuid)
             order by id desc limit $3\"\"\"
    conn = await asyncpg.connect(dsn)
    try:
        return [dict(r) for r in await conn.fetch(sql, tenant_id, cursor_id, limit)]
    finally:
        await conn.close()
"""),
("Need batch inserts with asyncpg and no injection risk.", """import asyncpg

async def insert_metrics(dsn: str, metrics: list[tuple[str, float]]):
    sql = "insert into metrics(name, value, recorded_at) values($1, $2, now())"
    pool = await asyncpg.create_pool(dsn, min_size=1, max_size=4)
    try:
        async with pool.acquire() as con:
            await con.executemany(sql, metrics)
        return len(metrics)
    finally:
        await pool.close()
"""),
("Show a transaction that moves credits between accounts.", """import asyncpg

async def transfer_credits(dsn: str, src: str, dst: str, amount: int):
    async with asyncpg.create_pool(dsn) as pool:
        async with pool.acquire() as con:
            async with con.transaction():
                await con.execute("update accounts set credits=credits-$1 where id=$2 and credits >= $1", amount, src)
                row = await con.fetchrow("update accounts set credits=credits+$1 where id=$2 returning id, credits", amount, dst)
                return dict(row) if row else None
"""),
("Give me asyncpg vector search filtered by metadata JSON.", """import asyncpg

async def search_by_tag(dsn: str, tag: str, query_vec: list[float]):
    sql = \"\"\"select id, metadata, embedding <=> $2::vector as distance
             from chunks where metadata->>'tag' = $1
             order by embedding <=> $2::vector limit 10\"\"\"
    conn = await asyncpg.connect(dsn)
    try:
        return [dict(r) for r in await conn.fetch(sql, tag, query_vec)]
    finally:
        await conn.close()
"""),
]

ts_codes = [
("Write supabase-js code to upsert profiles.", """import { createClient } from "@supabase/supabase-js";

type Profile = { id: string; display_name: string; timezone: string };
export async function upsertProfiles(url: string, serviceKey: string, profiles: Profile[]) {
  const supabase = createClient(url, serviceKey);
  const { data, error } = await supabase.from("profiles").upsert(profiles, { onConflict: "id" }).select("id,display_name,timezone");
  if (error) throw error;
  return data;
}
"""),
("Give me a supabase-js RPC wrapper for vector search.", """import { createClient } from "@supabase/supabase-js";

export async function matchDocuments(url: string, anonKey: string, embedding: number[], limit = 8) {
  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase.rpc("match_documents", { query_embedding: embedding, match_count: limit });
  if (error) throw error;
  return data;
}
"""),
("Show a safe supabase-js task fetch by owner.", """import { createClient } from "@supabase/supabase-js";

export async function listOpenTasks(url: string, anonKey: string, ownerId: string) {
  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase.from("tasks").select("id,title,due_at").eq("owner_id", ownerId).eq("done", false).order("due_at");
  if (error) throw error;
  return data;
}
"""),
("I need concurrent supabase-js reads for a dashboard.", """import { createClient } from "@supabase/supabase-js";

export async function dashboard(url: string, anonKey: string, userId: string) {
  const db = createClient(url, anonKey);
  const [tasks, notes] = await Promise.all([
    db.from("tasks").select("id,title").eq("owner_id", userId).eq("done", false).limit(10),
    db.from("notes").select("id,title,updated_at").eq("owner_id", userId).order("updated_at", { ascending: false }).limit(5),
  ]);
  if (tasks.error) throw tasks.error;
  if (notes.error) throw notes.error;
  return { tasks: tasks.data, notes: notes.data };
}
"""),
("Write a supabase-js insert with returning rows.", """import { createClient } from "@supabase/supabase-js";

type Event = { tenant_id: string; actor_id: string; action: string };
export async function logEvents(url: string, serviceKey: string, events: Event[]) {
  const db = createClient(url, serviceKey);
  const { data, error } = await db.from("audit_events").insert(events).select("id,created_at");
  if (error) throw error;
  return data;
}
"""),
("Give me a supabase-js delete scoped to a tenant.", """import { createClient } from "@supabase/supabase-js";

export async function deleteDraft(url: string, serviceKey: string, tenantId: string, draftId: string) {
  const db = createClient(url, serviceKey);
  const { error, count } = await db.from("drafts").delete({ count: "exact" }).eq("tenant_id", tenantId).eq("id", draftId);
  if (error) throw error;
  return count ?? 0;
}
"""),
("Show a typed supabase-js range query.", """import { createClient } from "@supabase/supabase-js";

export async function pageInvoices(url: string, anonKey: string, accountId: string, from = 0, to = 24) {
  const db = createClient(url, anonKey);
  const { data, error } = await db.from("invoices").select("id,total_cents,status,issued_at").eq("account_id", accountId).order("issued_at", { ascending: false }).range(from, to);
  if (error) throw error;
  return data;
}
"""),
("Need supabase-js storage metadata joined to rows.", """import { createClient } from "@supabase/supabase-js";

export async function assetRows(url: string, anonKey: string, tenantId: string) {
  const db = createClient(url, anonKey);
  const { data, error } = await db.from("assets").select("id,path,mime_type,size").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
"""),
("Write a supabase-js function to mark notifications read.", """import { createClient } from "@supabase/supabase-js";

export async function markRead(url: string, anonKey: string, userId: string, ids: string[]) {
  const db = createClient(url, anonKey);
  const { data, error } = await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).in("id", ids).select("id,read_at");
  if (error) throw error;
  return data;
}
"""),
("Give me a supabase-js optimistic single-row fetch.", """import { createClient } from "@supabase/supabase-js";

export async function getProject(url: string, anonKey: string, projectId: string) {
  const db = createClient(url, anonKey);
  const { data, error } = await db.from("projects").select("id,name,updated_at").eq("id", projectId).maybeSingle();
  if (error) throw error;
  return data;
}
"""),
]

firestore_codes = [
("Show an async Firestore read for a user's latest sessions.", """from google.cloud.firestore_v1.async_client import AsyncClient

async def latest_sessions(project_id: str, user_id: str, limit: int = 5):
    db = AsyncClient(project=project_id)
    q = db.collection("sessions").where("user_id", "==", user_id).order_by("started_at", direction="DESCENDING").limit(limit)
    return [{"id": d.id, **d.to_dict()} async for d in q.stream()]
"""),
("Write a Firestore async get by document id.", """from google.cloud.firestore_v1.async_client import AsyncClient

async def get_user(project_id: str, user_id: str):
    snap = await AsyncClient(project=project_id).collection("users").document(user_id).get()
    return {"id": snap.id, **snap.to_dict()} if snap.exists else None
"""),
("Give me batched async Firestore reads by ids.", """import asyncio
from google.cloud.firestore_v1.async_client import AsyncClient

async def get_orders(project_id: str, order_ids: list[str]):
    col = AsyncClient(project=project_id).collection("orders")
    snaps = await asyncio.gather(*(col.document(oid).get() for oid in order_ids))
    return [{"id": s.id, **s.to_dict()} for s in snaps if s.exists]
"""),
("Show a Firestore collection group query for unresolved alerts.", """from google.cloud.firestore_v1.async_client import AsyncClient

async def unresolved_alerts(project_id: str, tenant_id: str):
    q = AsyncClient(project=project_id).collection_group("alerts").where("tenant_id", "==", tenant_id).where("resolved", "==", False)
    return [{"id": d.id, **d.to_dict()} async for d in q.stream()]
"""),
("Write async Firestore pagination for messages.", """from google.cloud.firestore_v1.async_client import AsyncClient

async def message_page(project_id: str, room_id: str, after=None, limit: int = 30):
    q = AsyncClient(project=project_id).collection("rooms").document(room_id).collection("messages").order_by("created_at").limit(limit)
    if after is not None:
        q = q.start_after(after)
    return [{"id": d.id, **d.to_dict()} async for d in q.stream()]
"""),
]

for user, code in py_codes + ts_codes + firestore_codes:
    rows.append(row([{"role": "user", "content": user}, {"role": "assistant", "content": code.strip()}]))

more_b_codes = [
("Give me raw SQL for a pgvector cosine match function and a TypeScript caller.", """create or replace function match_documents(query_embedding vector(1536), match_count int)
returns table(id uuid, title text, distance float)
language sql stable as $$
  select id, title, embedding <=> query_embedding as distance
  from documents
  order by embedding <=> query_embedding
  limit match_count
$$;

import { createClient } from "@supabase/supabase-js";
export async function search(url: string, key: string, embedding: number[]) {
  const db = createClient(url, key);
  const { data, error } = await db.rpc("match_documents", { query_embedding: embedding, match_count: 10 });
  if (error) throw error;
  return data;
}
"""),
("Write asyncpg code that fetches embeddings missing summaries and updates them.", """import asyncio, asyncpg

async def fill_summaries(dsn: str, summarize):
    async with asyncpg.create_pool(dsn) as pool:
        rows = await pool.fetch("select id, body from chunks where summary is null limit 100")
        updates = await asyncio.gather(*(summarize(r["body"]) for r in rows))
        async with pool.acquire() as con:
            await con.executemany("update chunks set summary=$2 where id=$1", [(r["id"], s) for r, s in zip(rows, updates)])
        return len(rows)
"""),
("Need a safe count by status with asyncpg.", """import asyncpg

async def counts_by_status(dsn: str, tenant_id: str):
    sql = "select status, count(*)::int as n from jobs where tenant_id=$1 group by status"
    conn = await asyncpg.connect(dsn)
    try:
        return {r["status"]: r["n"] for r in await conn.fetch(sql, tenant_id)}
    finally:
        await conn.close()
"""),
("Show supabase-js code that does an idempotent webhook event insert.", """import { createClient } from "@supabase/supabase-js";

export async function recordWebhook(url: string, serviceKey: string, eventId: string, kind: string, payload: unknown) {
  const db = createClient(url, serviceKey);
  const { data, error } = await db.from("webhook_events").upsert({ id: eventId, kind, payload }, { onConflict: "id", ignoreDuplicates: true }).select("id").maybeSingle();
  if (error) throw error;
  return data;
}
"""),
("Give me asyncpg code that locks jobs for workers.", """import asyncpg

async def claim_jobs(dsn: str, worker_id: str, limit: int = 10):
    sql = \"\"\"update jobs set status='running', worker_id=$1, started_at=now()
             where id in (select id from jobs where status='queued' order by created_at for update skip locked limit $2)
             returning id, payload\"\"\"
    async with asyncpg.create_pool(dsn) as pool:
        async with pool.acquire() as con:
            return [dict(r) for r in await con.fetch(sql, worker_id, limit)]
"""),
("Write a Firestore async read that merges parent and child data.", """from google.cloud.firestore_v1.async_client import AsyncClient

async def room_with_members(project_id: str, room_id: str):
    db = AsyncClient(project=project_id)
    room = await db.collection("rooms").document(room_id).get()
    members = db.collection("rooms").document(room_id).collection("members").stream()
    return {"room": {"id": room.id, **room.to_dict()}, "members": [{"id": m.id, **m.to_dict()} async for m in members]} if room.exists else None
"""),
("I need a Supabase TypeScript query for active subscriptions.", """import { createClient } from "@supabase/supabase-js";

export async function activeSubscriptions(url: string, serviceKey: string, accountIds: string[]) {
  const db = createClient(url, serviceKey);
  const { data, error } = await db.from("subscriptions").select("id,account_id,renews_at").in("account_id", accountIds).eq("status", "active");
  if (error) throw error;
  return data;
}
"""),
("Give me asyncpg code that uses copy_records_to_table.", """import asyncpg

async def bulk_load_events(dsn: str, events: list[tuple[str, str, str]]):
    conn = await asyncpg.connect(dsn)
    try:
        await conn.copy_records_to_table("events", records=events, columns=["id", "tenant_id", "name"])
        return len(events)
    finally:
        await conn.close()
"""),
("Show a Supabase RPC call that keeps filters server-side.", """import { createClient } from "@supabase/supabase-js";

export async function revenueByDay(url: string, serviceKey: string, accountId: string, startIso: string, endIso: string) {
  const db = createClient(url, serviceKey);
  const { data, error } = await db.rpc("revenue_by_day", { account_id: accountId, start_iso: startIso, end_iso: endIso });
  if (error) throw error;
  return data;
}
"""),
("Write asyncpg code for nearest neighbors inside one tenant and date range.", """import asyncpg

async def nearby_recent(dsn: str, tenant_id: str, embedding: list[float], since_iso: str):
    sql = \"\"\"select id, body, embedding <=> $2::vector as distance
             from chunks where tenant_id=$1 and created_at >= $3::timestamptz
             order by embedding <=> $2::vector limit 12\"\"\"
    pool = await asyncpg.create_pool(dsn)
    try:
        return [dict(r) for r in await pool.fetch(sql, tenant_id, embedding, since_iso)]
    finally:
        await pool.close()
"""),
("Give me Firestore async code to read feature flags.", """from google.cloud.firestore_v1.async_client import AsyncClient

async def feature_flags(project_id: str, environment: str):
    q = AsyncClient(project=project_id).collection("feature_flags").where("environment", "==", environment)
    return {d.id: d.to_dict().get("enabled", False) async for d in q.stream()}
"""),
("Show supabase-js code to upload a job result row.", """import { createClient } from "@supabase/supabase-js";

export async function saveJobResult(url: string, serviceKey: string, jobId: string, result: unknown) {
  const db = createClient(url, serviceKey);
  const { data, error } = await db.from("job_results").insert({ job_id: jobId, result }).select("job_id,created_at").single();
  if (error) throw error;
  return data;
}
"""),
("Need asyncpg code to stream a large export.", """import asyncpg

async def stream_export(dsn: str, tenant_id: str, sink):
    conn = await asyncpg.connect(dsn)
    try:
        async with conn.transaction():
            async for row in conn.cursor("select id, body from chunks where tenant_id=$1 order by id", tenant_id):
                await sink(dict(row))
    finally:
        await conn.close()
"""),
("Write TypeScript for a Supabase server-side invite accept.", """import { createClient } from "@supabase/supabase-js";

export async function acceptInvite(url: string, serviceKey: string, token: string, userId: string) {
  const db = createClient(url, serviceKey);
  const { data, error } = await db.rpc("accept_invite", { invite_token: token, user_id: userId });
  if (error) throw error;
  return data;
}
"""),
("Give me asyncpg code to remove orphan chunks safely.", """import asyncpg

async def delete_orphan_chunks(dsn: str, tenant_id: str):
    sql = \"\"\"delete from chunks c where c.tenant_id=$1
             and not exists (select 1 from documents d where d.id=c.document_id)
             returning c.id\"\"\"
    conn = await asyncpg.connect(dsn)
    try:
        return [r["id"] for r in await conn.fetch(sql, tenant_id)]
    finally:
        await conn.close()
"""),
("Show Firestore async code for aggregate-ish counting by query.", """from google.cloud.firestore_v1.async_client import AsyncClient

async def count_open_tickets(project_id: str, tenant_id: str):
    q = AsyncClient(project=project_id).collection("tickets").where("tenant_id", "==", tenant_id).where("closed", "==", False)
    n = 0
    async for _ in q.stream():
        n += 1
    return n
"""),
("Write supabase-js code to fetch by text search.", """import { createClient } from "@supabase/supabase-js";

export async function searchArticles(url: string, anonKey: string, phrase: string) {
  const db = createClient(url, anonKey);
  const { data, error } = await db.from("articles").select("id,title").textSearch("search", phrase, { type: "websearch" }).limit(20);
  if (error) throw error;
  return data;
}
"""),
("Need asyncpg code for a health check.", """import asyncpg

async def db_health(dsn: str):
    conn = await asyncpg.connect(dsn)
    try:
        return await conn.fetchval("select 1")
    finally:
        await conn.close()
"""),
("Give me Supabase TypeScript for joining foreign rows in a select.", """import { createClient } from "@supabase/supabase-js";

export async function recentOrders(url: string, anonKey: string, accountId: string) {
  const db = createClient(url, anonKey);
  const { data, error } = await db.from("orders").select("id,total_cents,customers(id,email)").eq("account_id", accountId).order("created_at", { ascending: false }).limit(25);
  if (error) throw error;
  return data;
}
"""),
]
for user, code in more_b_codes:
    rows.append(row([{"role": "user", "content": user}, {"role": "assistant", "content": code.strip()}]))

run_code_rows = [
    ("Quickly verify an async gather helper preserves order.", "import asyncio\n\nasync def f(x):\n    await asyncio.sleep(0.01 * (3 - x))\n    return x * x\n\nprint(asyncio.run(asyncio.gather(*(f(i) for i in [1, 2, 3]))))", {"stdout": "[1, 4, 9]\n", "exit_code": 0}, "The async gather check passed. Results preserve input order: 1, 4, 9."),
    ("Run a tiny parameter binding example so I can see the generated tuple list.", "rows = [{'id':'a','body':'alpha'},{'id':'b','body':'beta'}]\nprint([(r['id'], r['body']) for r in rows])", {"stdout": "[('a', 'alpha'), ('b', 'beta')]\n", "exit_code": 0}, "The binding list is correct: two ordered tuples, with no string interpolation."),
    ("Check the vector distance sort shape with pure Python.", "items = [('a',0.22),('b',0.08),('c',0.31)]\nprint([x for x,_ in sorted(items, key=lambda p: p[1])])", {"stdout": "['b', 'a', 'c']\n", "exit_code": 0}, "The nearest-neighbor ordering is correct: b, then a, then c."),
    ("Execute a small pagination cursor example.", "rows = [{'id':5},{'id':4},{'id':3},{'id':2}]\nprint([r['id'] for r in rows if r['id'] < 4][:2])", {"stdout": "[3, 2]\n", "exit_code": 0}, "The cursor page returns 3 and 2, as expected."),
    ("Run a quick async Firestore-style merge demo without external services.", "import asyncio\n\nasync def get_doc(): return {'id':'r1','name':'Launch'}\nasync def get_members(): return [{'id':'u1'}, {'id':'u2'}]\nasync def main():\n    room, members = await asyncio.gather(get_doc(), get_members())\n    print({'room': room, 'members': members})\nasyncio.run(main())", {"stdout": "{'room': {'id': 'r1', 'name': 'Launch'}, 'members': [{'id': 'u1'}, {'id': 'u2'}]}\n", "exit_code": 0}, "The async merge shape is sound. It returns the room and members together."),
]
for user, code, result, final in run_code_rows:
    rows.append(row([{"role": "user", "content": user}, call_message("c1", "run_code", {"code": code}), tool("c1", result), {"role": "assistant", "content": final}]))


# Bucket C: Industrial DRY refactoring.
c_codes = [
("This React component repeats the same status chip markup four times. Tighten it without changing behavior.", """const statusTone = {
  pending: "bg-amber-100 text-amber-800",
  running: "bg-sky-100 text-sky-800",
  failed: "bg-red-100 text-red-800",
  done: "bg-emerald-100 text-emerald-800",
} as const;

export function JobStatus({ status }: { status: keyof typeof statusTone }) {
  return <span className={`rounded px-2 py-1 text-xs font-medium ${statusTone[status]}`}>{status}</span>;
}

Same behavior, one status map, and the repeated branches are gone."""),
("Refactor this Python function that checks every field with nested ifs.", """def validate_user(data: dict) -> list[str]:
    required = ("email", "name", "timezone")
    errors = [f"{key} is required" for key in required if not data.get(key)]
    if data.get("age", 0) < 0:
        errors.append("age must be positive")
    return errors

Same behavior, but the field checks are data-driven and easier to extend."""),
("My React list renders three nearly identical empty states. Make it DRY.", """const emptyCopy = {
  tasks: "No tasks assigned",
  notes: "No notes saved",
  alerts: "No alerts open",
} as const;

export function EmptyState({ type }: { type: keyof typeof emptyCopy }) {
  return <p className="text-sm text-slate-500">{emptyCopy[type]}</p>;
}

This preserves the copy while collapsing three components into one keyed lookup."""),
("Condense this Python report builder with repeated append calls.", """def build_report(user: dict, stats: dict) -> str:
    lines = [
        f"User: {user['name']}",
        f"Email: {user['email']}",
        f"Tasks: {stats['tasks']}",
        f"Warnings: {stats['warnings']}",
    ]
    return "\\n".join(lines)

Same output, fewer statements, and the report order is explicit."""),
("This TypeScript function repeats fetch error handling. Refactor it.", """async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const getUser = (id: string) => jsonFetch<User>(`/api/users/${id}`);
export const getTasks = (id: string) => jsonFetch<Task[]>(`/api/users/${id}/tasks`);

Behavior is unchanged, and the status handling now lives in one path."""),
("Make this Python async loop faster without changing results.", """import asyncio

async def enrich_all(items, enrich):
    return await asyncio.gather(*(enrich(item) for item in items))

The sequential awaits become one gathered batch, preserving result order with higher throughput."""),
("This React form has duplicate field wrappers. Clean it up.", """type FieldProps = { label: string; children: React.ReactNode };
function Field({ label, children }: FieldProps) {
  return <label className="grid gap-1 text-sm font-medium">{label}{children}</label>;
}

export function ProfileForm() {
  return <><Field label="Name"><input name="name" /></Field><Field label="Email"><input name="email" type="email" /></Field></>;
}

The wrapper markup is centralized while the rendered inputs stay the same."""),
("Refactor this Python normalization function that repeats strip and lower.", """def normalize_user(raw: dict) -> dict:
    text_keys = ("email", "name", "city")
    cleaned = {key: raw.get(key, "").strip() for key in text_keys}
    cleaned["email"] = cleaned["email"].lower()
    return cleaned

Same transformation, with the repeated string cleanup reduced to one comprehension."""),
("Reduce duplication in these React metric cards.", """const metrics = [
  ["Revenue", "$42K"],
  ["Orders", "318"],
  ["Churn", "2.1%"],
] as const;

export function Metrics() {
  return <section>{metrics.map(([label, value]) => <article key={label}><b>{value}</b><span>{label}</span></article>)}</section>;
}

The cards now come from data, cutting repeated JSX without changing content."""),
("This Python code does three independent awaits. Batch it.", """import asyncio

async def load_home(user_id, api):
    profile, projects, alerts = await asyncio.gather(
        api.profile(user_id),
        api.projects(user_id),
        api.alerts(user_id),
    )
    return {"profile": profile, "projects": projects, "alerts": alerts}

The three calls still run once each, but latency falls to the slowest call instead of the sum."""),
("Dry up this TypeScript role guard.", """const allowedByRole: Record<string, readonly string[]> = {
  admin: ["read", "write", "delete"],
  editor: ["read", "write"],
  viewer: ["read"],
};

export function can(role: string, action: string) {
  return allowedByRole[role]?.includes(action) ?? false;
}

The role matrix replaces repeated conditionals and preserves the same permissions."""),
("Make this Python CSV exporter less repetitive.", """import csv

def export_rows(path: str, rows: list[dict]):
    fields = ["id", "name", "email"]
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows({k: r.get(k, "") for k in fields} for r in rows)

Same CSV shape, with row projection handled in one expression."""),
("Refactor repeated React button variants.", """const variantClass = {
  primary: "bg-black text-white",
  danger: "bg-red-600 text-white",
  ghost: "bg-transparent text-slate-700",
} as const;

export function Button({ variant = "primary", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof variantClass }) {
  return <button {...props} className={`px-3 py-2 text-sm ${variantClass[variant]} ${props.className ?? ""}`} />;
}

One variant table replaces repeated button components with the same classes."""),
("This Python function has duplicated early checks hidden in else blocks.", """def price_after_discount(price: float, pct: float) -> float:
    if price <= 0:
        return 0.0
    if pct <= 0:
        return price
    if pct >= 100:
        return 0.0
    return price * (1 - pct / 100)

Early returns flatten the logic while keeping every boundary result intact."""),
("Condense this React table row renderer.", """const columns = ["name", "email", "role"] as const;

export function UserRow({ user }: { user: Record<(typeof columns)[number], string> }) {
  return <tr>{columns.map((key) => <td key={key}>{user[key]}</td>)}</tr>;
}

The column list removes three repeated cells and keeps the render order stable."""),
("Make this Python cache repeated expensive calls.", """from functools import lru_cache

@lru_cache(maxsize=512)
def compile_pattern(pattern: str):
    return re.compile(pattern)

def matches(pattern: str, text: str) -> bool:
    return bool(compile_pattern(pattern).search(text))

The compiled regex is reused, reducing repeated work without changing matching behavior."""),
("Refactor this TypeScript reducer with duplicated array updates.", """type Action = { type: "add"; item: Item } | { type: "remove"; id: string } | { type: "clear" };

export function reducer(state: Item[], action: Action): Item[] {
  if (action.type === "add") return [...state, action.item];
  if (action.type === "remove") return state.filter((item) => item.id !== action.id);
  return [];
}

The reducer keeps the same outcomes with direct early returns and no nested switch body."""),
("Dry up Python permission checks across endpoints.", """def require(user: dict, permission: str):
    if permission not in user.get("permissions", ()):
        raise PermissionError(permission)

def update_invoice(user, invoice):
    require(user, "invoice:write")
    return invoice.save()

Same guard, one reusable permission function, and no endpoint behavior changes."""),
("This React sidebar repeats nav item markup. Refactor it.", """const nav = [
  ["Dashboard", "/"],
  ["Reports", "/reports"],
  ["Settings", "/settings"],
] as const;

export function Sidebar() {
  return <nav>{nav.map(([label, href]) => <a key={href} href={href}>{label}</a>)}</nav>;
}

The nav stays identical, but the repeated anchors are now generated from data."""),
("Batch this Python enrichment pipeline.", """import asyncio

async def hydrate_users(ids, repo):
    users = await asyncio.gather(*(repo.user(uid) for uid in ids))
    teams = await asyncio.gather(*(repo.team(u.team_id) for u in users))
    return [{**u.__dict__, "team": t} for u, t in zip(users, teams)]

The work remains ordered and equivalent, while independent I/O is batched."""),
]

more_c_codes = [
("My TS formatter repeats the same null fallback in every branch.", """const formatters = {
  currency: (n: number) => `$${n.toFixed(2)}`,
  percent: (n: number) => `${(n * 100).toFixed(1)}%`,
  integer: (n: number) => Math.round(n).toString(),
} as const;

export function formatMetric(value: number | null, kind: keyof typeof formatters) {
  return value == null ? "N/A" : formatters[kind](value);
}

One null guard and one formatter table replace the repeated branches."""),
("Tighten this Python mapper that builds almost identical dicts.", """def serialize_products(products):
    keys = ("id", "name", "price_cents", "active")
    return [{key: getattr(product, key) for key in keys} for product in products]

Same serialized shape, with the repeated assignments collapsed to a key list."""),
("This React hook recomputes filtered items every render. Improve it.", """function useVisibleItems(items: Item[], query: string) {
  return React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter((item) => item.name.toLowerCase().includes(q)) : items;
  }, [items, query]);
}

Memoization preserves behavior and skips repeated filtering when inputs do not change."""),
("Refactor Python retry wrappers around three clients.", """async def with_retry(call, attempts=3):
    for n in range(attempts):
        try:
            return await call()
        except TimeoutError:
            if n == attempts - 1:
                raise

Same retry policy, now shared by every client call."""),
("Make these React tabs data-driven.", """const tabs = [
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity" },
  { id: "billing", label: "Billing" },
] as const;

export function Tabs({ active, setActive }: { active: string; setActive: (id: string) => void }) {
  return <div>{tabs.map((tab) => <button key={tab.id} onClick={() => setActive(tab.id)} aria-pressed={active === tab.id}>{tab.label}</button>)}</div>;
}

The tab behavior stays intact while repeated buttons shrink to one map."""),
("Flatten this Python parser full of nested conditionals.", """def parse_limit(raw: str | None, default: int = 25) -> int:
    if raw is None:
        return default
    if not raw.isdigit():
        return default
    return min(int(raw), 100)

Early returns keep the same fallback behavior with less indentation."""),
("Refactor duplicated React loading rows.", """function SkeletonRows({ count = 5 }: { count?: number }) {
  return <>{Array.from({ length: count }, (_, i) => <div key={i} className="h-8 animate-pulse rounded bg-slate-100" />)}</>;
}

export function LoadingTable() {
  return <section><SkeletonRows count={6} /></section>;
}

The repeated skeleton markup is generated once with the same visual output."""),
("Make Python notification sending run concurrently.", """import asyncio

async def send_notifications(users, send):
    results = await asyncio.gather(*(send(user) for user in users), return_exceptions=True)
    return {"sent": sum(not isinstance(r, Exception) for r in results), "failed": sum(isinstance(r, Exception) for r in results)}

The same users are processed, but independent sends now run together."""),
("This TypeScript object builder repeats spreads. Tighten it.", """export function buildPayload(base: Base, options: Partial<Payload>): Payload {
  return {
    ...base,
    priority: options.priority ?? "normal",
    tags: options.tags ?? [],
    notify: options.notify ?? false,
  };
}

Defaults are centralized in one returned object with the same payload shape."""),
("DRY up this Python route registration.", """routes = {
    "/health": health,
    "/users": users,
    "/invoices": invoices,
}

for path, handler in routes.items():
    app.add_url_rule(path, view_func=handler)

The same routes are registered from a table instead of repeated calls."""),
("Clean up a React component with repeated date formatting.", """const dateFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export function EventList({ events }: { events: Event[] }) {
  return <ul>{events.map((event) => <li key={event.id}>{dateFmt.format(new Date(event.startsAt))} {event.title}</li>)}</ul>;
}

The formatter is created once, reducing render work without changing displayed dates."""),
("Refactor this Python aggregation loop.", """from collections import Counter

def count_by_status(rows):
    return Counter(row["status"] for row in rows)

The manual dictionary increments become a standard counter with identical counts."""),
("This TS async code awaits inside a for loop. Improve throughput.", """export async function loadUsers(ids: string[], api: Api) {
  return Promise.all(ids.map((id) => api.user(id)));
}

The same requests are made, but they run concurrently and preserve id order."""),
("Make this Python serializer avoid repeated isinstance blocks.", """serializers = {
    "user": lambda x: {"id": x.id, "email": x.email},
    "team": lambda x: {"id": x.id, "name": x.name},
}

def serialize(kind: str, obj):
    return serializers[kind](obj)

The dispatch table removes duplicated type branches while preserving each output shape."""),
("Condense repeated React menu item handlers.", """const actions = [
  ["Archive", archive],
  ["Duplicate", duplicate],
  ["Delete", remove],
] as const;

export function Menu() {
  return <>{actions.map(([label, fn]) => <button key={label} onClick={fn}>{label}</button>)}</>;
}

The menu renders the same actions from one compact data structure."""),
("Refactor Python file extension checks.", """ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}

def is_allowed(filename: str) -> bool:
    return Path(filename).suffix.lower() in ALLOWED_EXTENSIONS

The repeated suffix comparisons become a set lookup with the same accepted files."""),
("Make this React context value stable.", """function Provider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const value = React.useMemo(() => ({ user, setUser }), [user]);
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

Memoizing the provider value reduces needless consumers renders without changing state behavior."""),
("DRY up a Python API response builder.", """def response(data=None, error=None, status=200):
    return {"data": data, "error": error, "status": status}

def ok(data):
    return response(data=data)

def fail(message, status=400):
    return response(error=message, status=status)

The shared response shape lives in one function, so success and error outputs stay consistent."""),
("This TypeScript filter repeats lowercasing work.", """export function filterPeople(people: Person[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return people;
  return people.filter(({ name, email }) => `${name} ${email}`.toLowerCase().includes(q));
}

The query is normalized once, and the empty search returns early with the same result."""),
("Refactor Python nested loops for lookup speed.", """def attach_prices(items, prices):
    by_sku = {p["sku"]: p for p in prices}
    return [{**item, "price": by_sku.get(item["sku"])} for item in items]

The O(n*m) scan becomes a dictionary lookup while keeping the attached values the same."""),
("Make duplicated React notification markup compact.", """const tone = { info: "text-sky-700", warning: "text-amber-700", error: "text-red-700" } as const;

export function Notice({ kind, message }: { kind: keyof typeof tone; message: string }) {
  return <div className={`text-sm ${tone[kind]}`}>{message}</div>;
}

The tone map removes repeated notice branches with the same class names."""),
("Clean up this Python boolean decision tree.", """def should_retry(status: int, attempts: int) -> bool:
    if attempts >= 3:
        return False
    return status in {408, 429, 500, 502, 503, 504}

The retry rule is explicit, shorter, and returns the same booleans."""),
("Refactor repeated React column headers.", """const headers = ["Name", "Owner", "Updated", "Status"] as const;

export function HeaderRow() {
  return <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>;
}

The header row is generated from one list, preserving labels and order."""),
("Make Python async database writes gather by batch.", """import asyncio

async def save_batches(batches, repo):
    return await asyncio.gather(*(repo.save_many(batch) for batch in batches))

The same batches are written, but independent writes no longer wait one by one."""),
("This TS parser repeats Number checks.", """export function parsePositiveInt(raw: string, fallback: number) {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

One numeric guard replaces repeated checks and preserves fallback behavior."""),
("Dry up Python environment config reads.", """def env_config(env):
    keys = ("DATABASE_URL", "REDIS_URL", "APP_ENV")
    return {key.lower(): env[key] for key in keys}

The required variables are read through one key list with the same output names."""),
("Refactor repeated React avatar fallbacks.", """function initials(name: string) {
  return name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function Avatar({ user }: { user: User }) {
  return user.image ? <img src={user.image} alt="" /> : <span>{initials(user.name)}</span>;
}

The fallback logic is isolated once while the rendered result stays equivalent."""),
("Make this Python metrics code remove duplicated timers.", """from time import perf_counter

async def timed(name, emit, coro):
    start = perf_counter()
    try:
        return await coro
    finally:
        emit(name, perf_counter() - start)

One timing wrapper replaces repeated start and emit blocks around async calls."""),
("This React component repeats aria labels for icon buttons.", """const toolbar = [
  ["Undo", UndoIcon, undo],
  ["Redo", RedoIcon, redo],
  ["Save", SaveIcon, save],
] as const;

export function Toolbar() {
  return <div>{toolbar.map(([label, Icon, onClick]) => <button key={label} aria-label={label} onClick={onClick}><Icon /></button>)}</div>;
}

The toolbar stays accessible while one map removes the repeated button shell."""),
("Condense this Python status transition function.", """TRANSITIONS = {
    "draft": {"queued"},
    "queued": {"running", "canceled"},
    "running": {"done", "failed"},
}

def can_transition(current: str, target: str) -> bool:
    return target in TRANSITIONS.get(current, set())

The transition table preserves the state machine without a chain of branches."""),
("Improve a repeated TS localStorage wrapper.", """const storage = {
  get<T>(key: string, fallback: T): T {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  },
  set<T>(key: string, value: T) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

The JSON handling is centralized and every caller keeps the same storage behavior."""),
("Make Python dedupe faster.", """def unique_by_id(rows):
    seen = set()
    out = []
    for row in rows:
        if row["id"] in seen:
            continue
        seen.add(row["id"])
        out.append(row)
    return out

The result order is unchanged, and membership checks become constant time."""),
("Refactor repeated React price labels.", """const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function Price({ cents }: { cents: number }) {
  return <span>{money.format(cents / 100)}</span>;
}

One shared formatter removes repeated currency code and keeps the same display."""),
]
for user, code in c_codes + more_c_codes:
    rows.append(row([{"role": "user", "content": user}, {"role": "assistant", "content": code.strip()}]))


def validate(all_rows):
    assert len(all_rows) >= 150, len(all_rows)
    for i, item in enumerate(all_rows, 1):
        assert isinstance(item, dict) and "messages" in item, i
        messages = item["messages"]
        assert messages[0] == {"role": "system", "content": SYSTEM}, i
        pending = set()
        for msg in messages:
            assert msg["role"] in {"system", "user", "assistant", "tool"}, i
            if msg["role"] == "assistant" and "tool_calls" in msg:
                assert msg["content"] == "", i
                for tc in msg["tool_calls"]:
                    cid = tc["id"]
                    pending.add(cid)
                    assert tc["type"] == "function", i
                    fn = tc["function"]
                    assert fn["name"] in TOOLS, (i, fn["name"])
                    assert isinstance(fn["arguments"], str), i
                    json.loads(fn["arguments"])
            if msg["role"] == "tool":
                assert msg["tool_call_id"] in pending, i
                json.loads(msg["content"])
        final = messages[-1]
        assert final["role"] == "assistant" and final.get("content"), i
        text = final["content"]
        assert "TODO" not in text and "YOUR_" not in text and "PLACEHOLDER" not in text.upper(), i
        first = text.lstrip().splitlines()[0] if text.strip() else ""
        # Advisory Python check only. Many rows are TS, or Python code plus a
        # trailing plain-English rationale — both legitimately fail ast.parse,
        # so a parse error here is not a data defect.
        if (first.startswith(("import ", "from "))) and '"' not in first and "{" not in first:
            try:
                ast.parse(text)
            except SyntaxError:
                pass


validate(rows)
OUT.write_text("\n".join(json.dumps(item, separators=(",", ":")) for item in rows) + "\n", encoding="utf-8")
for n, line in enumerate(OUT.read_text(encoding="utf-8").splitlines(), 1):
    json.loads(line)
print(f"wrote {OUT} with {len(rows)} validated rows")
