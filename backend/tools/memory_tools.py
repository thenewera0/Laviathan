"""remember / recall — the model's handles on long-term memory.

Relevant memories are ALSO injected automatically each turn (loop.py);
recall exists for deliberate searches ("what did I tell you about X?").
"""
from brain import memory


async def remember(session, fact: str) -> dict:
    status = await memory.remember(fact)
    return {"status": status, "total_memories": await memory.count()}


async def recall(session, query: str) -> dict:
    found = await memory.recall(query, k=6, min_score=0.25)
    if not found:
        return {"result": "nothing surfaces for that query"}
    return {"memories": found}
