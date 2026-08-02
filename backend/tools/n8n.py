"""n8n_automation — Manage automated workflows on the n8n server."""
import httpx
from config import settings


async def run(session, action: str, **kwargs) -> dict:
    """Manage workflows in the deployed n8n automation server."""
    n8n_url = settings.n8n_url or "https://leviathan-n8n.onrender.com"
    n8n_api_key = settings.n8n_api_key

    if not n8n_api_key:
        return {
            "success": False,
            "error": (
                "N8N_API_KEY is not configured in backend/.env. "
                f"Please login to your n8n console at {n8n_url} (User: leviathan, "
                "Password: your LEVIATHAN_MASTER_KEY), go to Settings -> API, "
                "generate an API key, add it to your backend/.env as N8N_API_KEY, "
                "and restart the backend to enable automated workflow creation."
            )
        }

    # Normalize url (remove trailing slash)
    n8n_url = n8n_url.rstrip("/")
    api_base = f"{n8n_url}/api/v1"

    headers = {
        "X-N8N-API-KEY": n8n_api_key,
        "Content-Type": "application/json"
    }

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            if action == "list":
                resp = await client.get(f"{api_base}/workflows", headers=headers)
                if resp.status_code != 200:
                    return {"success": False, "error": f"n8n API returned {resp.status_code}: {resp.text}"}
                return {"success": True, "workflows": resp.json().get("data", [])}

            elif action == "create":
                name = kwargs.get("name", "Generated Automation")
                nodes = kwargs.get("nodes", [])
                connections = kwargs.get("connections", {})
                # NB: don't name this `settings` — it would shadow the module-level
                # config import used above.
                wf_settings = kwargs.get("settings") or {"executionOrder": "v1"}
                activate = kwargs.get("activate", True)

                if not nodes:
                    return {"success": False, "error": "Cannot create a workflow without any nodes."}

                # n8n API v1 treats `active` as read-only on create and requires
                # `settings`; sending `active` returns 400. Create first, then
                # activate through the dedicated endpoint.
                payload = {
                    "name": name,
                    "nodes": nodes,
                    "connections": connections,
                    "settings": wf_settings,
                }

                resp = await client.post(f"{api_base}/workflows", headers=headers, json=payload)
                if resp.status_code not in (200, 201):
                    return {"success": False, "error": f"n8n API returned {resp.status_code}: {resp.text}"}

                data = resp.json()
                wf_id = data.get("id")
                wf_url = f"{n8n_url}/workflow/{wf_id}" if wf_id else n8n_url

                if not activate or not wf_id:
                    return {
                        "success": True,
                        "active": bool(data.get("active")),
                        "message": f"Created workflow '{name}' (inactive).",
                        "workflow": data,
                        "url": wf_url,
                    }

                # Activation legitimately fails when the workflow needs credentials
                # the user hasn't connected yet, or has no activatable trigger.
                # The import still succeeded — report that honestly.
                act = await client.post(f"{api_base}/workflows/{wf_id}/activate", headers=headers)
                if act.status_code in (200, 201):
                    return {
                        "success": True,
                        "active": True,
                        "message": f"Created and activated workflow '{name}'.",
                        "workflow": act.json() if act.content else data,
                        "url": wf_url,
                    }

                return {
                    "success": True,
                    "active": False,
                    "message": (
                        f"Imported workflow '{name}', but it could not be activated "
                        f"automatically (n8n said {act.status_code}). This usually means "
                        "it needs credentials connected or has no active trigger. "
                        f"Open it and finish setup: {wf_url}"
                    ),
                    "activation_error": act.text[:300],
                    "workflow": data,
                    "url": wf_url,
                }

            elif action == "delete":
                wf_id = kwargs.get("id")
                if not wf_id:
                    return {"success": False, "error": "Missing 'id' parameter for delete action"}
                resp = await client.delete(f"{api_base}/workflows/{wf_id}", headers=headers)
                if resp.status_code != 200:
                    return {"success": False, "error": f"n8n API returned {resp.status_code}: {resp.text}"}
                return {"success": True, "message": f"Workflow {wf_id} deleted."}

            elif action == "toggle":
                wf_id = kwargs.get("id")
                active = kwargs.get("active", True)
                if not wf_id:
                    return {"success": False, "error": "Missing 'id' parameter for toggle action"}

                act_str = "activate" if active else "deactivate"
                resp = await client.post(f"{api_base}/workflows/{wf_id}/{act_str}", headers=headers)
                if resp.status_code != 200:
                    return {"success": False, "error": f"n8n API returned {resp.status_code}: {resp.text}"}
                return {"success": True, "message": f"Workflow {wf_id} is now {'active' if active else 'inactive'}."}

            else:
                return {"success": False, "error": f"Unknown action: {action}"}
    except Exception as e:
        return {"success": False, "error": f"Exception connecting to n8n: {e}"}
