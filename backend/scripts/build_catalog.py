"""
Script to build workflow_catalog.json from Zie619/n8n-workflows repository tree using GitHub API.
Fetches directory listing of workflows/ and constructs lightweight search index.
"""
import json
import urllib.request
import re
import os
from pathlib import Path

REPO_API_TREE_URL = "https://api.github.com/repos/Zie619/n8n-workflows/git/trees/main?recursive=1"
OUTPUT_FILE = Path(__file__).parent.parent / "data" / "workflow_catalog.json"

def fetch_tree():
    headers = {"User-Agent": "Leviathan-Catalog-Builder/1.0", "Accept": "application/vnd.github.v3+json"}
    req = urllib.request.Request(REPO_API_TREE_URL, headers=headers)
    print("Fetching repository tree from GitHub API...")
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        return data.get("tree", [])

# Filename tokens that are verbs/nouns describing the action, NOT integrations.
# Without this filter the index lists "Create"/"Triggered" as integrations,
# which pollutes search results.
NOISE_TOKENS = {
    "create", "created", "update", "updated", "delete", "send", "sending", "sent",
    "get", "fetch", "automate", "automated", "automation", "triggered", "trigger",
    "webhook", "scheduled", "schedule", "manual", "cron", "import", "export",
    "sync", "process", "monitor", "notify", "alert", "message", "data", "info",
    "list", "add", "set", "new", "auto", "bot", "workflow", "task", "job", "run",
    "handler", "save", "store", "read", "write", "check", "search", "find",
    "generate", "convert", "transform", "parse", "extract", "upload", "download",
    "backup", "report", "daily", "weekly", "hourly", "form", "file", "files",
    "item", "items", "record", "records", "row", "rows", "page", "pages", "user",
    "users", "post", "posts", "custom", "simple", "advanced", "basic", "template",
    "example", "test", "demo", "with", "from", "when", "then", "and", "for", "the",
    "all", "each", "every", "using", "via", "into", "onto", "over", "under",
    "based", "multiple", "response", "request", "error", "success", "status",
}

TRIGGER_TOKENS = {
    "webhook": "Webhook",
    "triggered": "Webhook",
    "trigger": "Webhook",
    "scheduled": "Schedule",
    "schedule": "Schedule",
    "cron": "Schedule",
    "manual": "Manual",
    "event": "Event",
}


def parse_workflows(tree):
    workflows = []
    category_counts = {}

    for item in tree:
        path = item.get("path", "")
        # Look for JSON files inside workflows/
        if path.startswith("workflows/") and path.endswith(".json"):
            parts = path.split("/")
            if len(parts) >= 3:
                category = parts[1]
                filename = parts[-1]
            elif len(parts) == 2:
                category = "General"
                filename = parts[1]
            else:
                continue
                
            # Clean filename to derive name and metadata
            name_raw = filename[:-5]  # strip .json
            
            # Extract leading ID if present (e.g. 0756_)
            id_match = re.match(r"^(\d+)_(.+)$", name_raw)
            if id_match:
                wf_id = id_match.group(1)
                clean_name = id_match.group(2).replace("_", " ")
            else:
                wf_id = str(len(workflows) + 1).zfill(4)
                clean_name = name_raw.replace("_", " ")
                
            tokens = [t for t in re.split(r"[\s_]+", clean_name) if t]

            # Trigger type: the trailing token carries it in this repo's naming
            # convention ({id}_{Integrations}_{Trigger}.json).
            trigger_type = "Manual"
            for tok in reversed(tokens):
                hit = TRIGGER_TOKENS.get(tok.lower())
                if hit:
                    trigger_type = hit
                    break

            # Integrations = capitalised tokens that aren't action verbs/nouns.
            # Category always counts as an integration and leads the list.
            extras = [
                t for t in tokens
                if len(t) > 2 and t[0].isupper() and t.lower() not in NOISE_TOKENS
                and t.lower() != category.lower()
            ]
            seen = set()
            integrations = []
            for t in [category] + extras:
                if t.lower() not in seen:
                    seen.add(t.lower())
                    integrations.append(t)

            # Searchable haystack so the backend can match on one lowercase field
            search_blob = " ".join([clean_name, category, trigger_type] + integrations).lower()

            # Construct raw github URL
            raw_url = f"https://raw.githubusercontent.com/Zie619/n8n-workflows/main/{path}"
            
            category_counts[category] = category_counts.get(category, 0) + 1
            
            workflows.append({
                "id": wf_id,
                "name": clean_name,
                "category": category,
                "filename": filename,
                "path": path,
                "trigger_type": trigger_type,
                "integrations": integrations[:5],
                "github_raw_url": raw_url,
                "search_blob": search_blob,
            })
            
    return workflows, category_counts

def main():
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    tree = fetch_tree()
    workflows, categories = parse_workflows(tree)
    
    catalog_data = {
        "total_workflows": len(workflows),
        "total_categories": len(categories),
        "categories": categories,
        "workflows": workflows
    }
    
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(catalog_data, f, indent=2, ensure_ascii=False)
        
    print(f"SUCCESS: Built catalog with {len(workflows)} workflows across {len(categories)} categories.")
    print(f"Saved to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
