"""workflow_library — Search, browse, and deploy 2,000+ n8n workflows into n8n."""
import json
import httpx
from pathlib import Path
from tools import n8n

# Load catalog index into memory on module import
CATALOG_PATH = Path(__file__).parent.parent / "data" / "workflow_catalog.json"
_catalog = {"total_workflows": 0, "total_categories": 0, "categories": {}, "workflows": []}

if CATALOG_PATH.exists():
    try:
        with open(CATALOG_PATH, "r", encoding="utf-8") as f:
            _catalog = json.load(f)
    except Exception as e:
        print(f"Warning: Could not load workflow_catalog.json: {e}")

def _score(wf: dict, terms: list) -> int:
    """Rank a catalog entry against query terms (higher = better match)."""
    name = wf.get("name", "").lower()
    cat = wf.get("category", "").lower()
    integs = [i.lower() for i in wf.get("integrations", [])]
    blob = wf.get("search_blob") or " ".join([name, cat] + integs)

    score = 0
    for term in terms:
        if cat == term:
            score += 10
        elif any(i == term for i in integs):
            score += 8
        elif term in cat:
            score += 5
        elif any(term in i for i in integs):
            score += 4
        if term in name:
            score += 3
        elif term in blob:
            score += 1
    return score


def search_catalog(query: str = "", category: str = "", limit: int = 20) -> list:
    """Relevance-ranked search over the in-memory catalog."""
    workflows = _catalog.get("workflows", [])
    query = (query or "").lower().strip()
    category = (category or "").strip()

    pool = workflows
    if category and category.lower() != "all":
        pool = [w for w in pool if w.get("category", "").lower() == category.lower()]

    if not query:
        return pool[:limit]

    terms = [t for t in query.split() if t]
    scored = []
    for wf in pool:
        s = _score(wf, terms)
        if s > 0:
            scored.append((s, wf))

    scored.sort(key=lambda x: (-x[0], x[1].get("name", "")))
    return [wf for _, wf in scored[:limit]]


async def run(session, action: str, **kwargs) -> dict:
    """Access the 2,000+ n8n workflow library."""
    workflows = _catalog.get("workflows", [])
    categories = _catalog.get("categories", {})

    if action == "browse_categories":
        # Return sorted list of top categories
        sorted_cats = sorted(categories.items(), key=lambda x: x[1], reverse=True)
        return {
            "success": True,
            "total_workflows": _catalog.get("total_workflows", 0),
            "total_categories": len(sorted_cats),
            "categories": [{"name": k, "count": v} for k, v in sorted_cats]
        }

    elif action == "search":
        results = search_catalog(
            query=kwargs.get("query", ""),
            category=kwargs.get("category", ""),
            limit=int(kwargs.get("limit", 20)),
        )
        return {
            "success": True,
            "count": len(results),
            "library_size": _catalog.get("total_workflows", 0),
            "workflows": results,
        }

    elif action == "get_details":
        wf_id = str(kwargs.get("id", ""))
        raw_url = kwargs.get("github_raw_url", "")

        target_wf = None
        if wf_id:
            target_wf = next((w for w in workflows if str(w.get("id")) == wf_id), None)
            if target_wf:
                raw_url = target_wf.get("github_raw_url")

        if not raw_url:
            return {"success": False, "error": "Missing workflow 'id' or 'github_raw_url'"}

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(raw_url)
                if resp.status_code != 200:
                    return {"success": False, "error": f"Failed to fetch workflow from GitHub: HTTP {resp.status_code}"}
                
                wf_data = resp.json()
                return {
                    "success": True,
                    "metadata": target_wf,
                    "workflow": wf_data
                }
        except Exception as e:
            return {"success": False, "error": f"Exception fetching workflow JSON: {e}"}

    elif action == "deploy":
        wf_id = str(kwargs.get("id", ""))
        raw_url = kwargs.get("github_raw_url", "")
        custom_name = kwargs.get("name", "")

        target_wf = None
        if wf_id:
            target_wf = next((w for w in workflows if str(w.get("id")) == wf_id), None)
            if target_wf:
                raw_url = target_wf.get("github_raw_url")
                if not custom_name:
                    custom_name = target_wf.get("name")

        if not raw_url:
            return {"success": False, "error": "Missing workflow 'id' or 'github_raw_url'"}

        # 1. Fetch workflow JSON from GitHub
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(raw_url)
                if resp.status_code != 200:
                    return {"success": False, "error": f"Failed to fetch workflow from GitHub: HTTP {resp.status_code}"}
                wf_json = resp.json()
        except Exception as e:
            return {"success": False, "error": f"Exception fetching workflow JSON from GitHub: {e}"}

        # 2. Extract nodes, connections and the workflow's own settings
        nodes = wf_json.get("nodes", [])
        connections = wf_json.get("connections", {})
        settings = wf_json.get("settings") or {"executionOrder": "v1"}
        wf_name = custom_name or wf_json.get("name", "Library Workflow")

        if not nodes:
            return {"success": False, "error": "Workflow JSON contains no nodes."}

        # 3. Call n8n tool to create and activate workflow on the n8n server
        deploy_res = await n8n.run(
            session,
            action="create",
            name=f"⚡ {wf_name}",
            nodes=nodes,
            connections=connections,
            settings=settings,
        )

        return deploy_res

    elif action == "recommend":
        query = kwargs.get("query", "").strip()
        if not query:
            return {"success": False, "error": "Query required for recommendation"}

        # Drop filler words so "I want Slack alerts from a Google Form" ranks on
        # the integration names rather than the connective tissue.
        stop = {"i", "a", "an", "the", "to", "for", "with", "from", "when",
                "want", "need", "get", "my", "me", "and", "or", "of", "on",
                "in", "that", "this", "workflow", "automation", "someone"}
        terms = [t for t in query.lower().split() if len(t) > 2 and t not in stop]
        if not terms:
            terms = [t for t in query.lower().split() if t]

        scored = []
        for wf in workflows:
            s = _score(wf, terms)
            if s > 0:
                scored.append((s, wf))
        scored.sort(key=lambda x: (-x[0], x[1].get("name", "")))

        return {
            "success": True,
            "query": query,
            "recommendations": [wf for _, wf in scored[:10]],
        }

    else:
        return {"success": False, "error": f"Unknown action: {action}"}
