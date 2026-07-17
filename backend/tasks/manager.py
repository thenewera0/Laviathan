"""Background task engine.

In-process asyncio tasks with progress reporting over the session's
WebSocket. The interface (start / update / finish) is deliberately the
shape a Celery+Redis worker pool would expose, so scaling beyond one
server later means swapping this module, not its callers. Background
tasks survive barge-in — only closing the server kills them.
"""
import asyncio
import time
import uuid


class Task:
    def __init__(self, session, kind: str, label: str):
        self.id = uuid.uuid4().hex[:10]
        self.session = session
        self.kind = kind
        self.label = label
        self.status = "running"
        self.progress: list[str] = []
        self.result: dict | None = None
        self.created = time.time()

    async def _send(self, payload: dict) -> None:
        try:
            await self.session.send(payload)
        except Exception:
            pass  # client gone; the task keeps working, results persist

    async def update(self, text: str) -> None:
        self.progress.append(text)
        await self._send(
            {"type": "task", "event": "update", "id": self.id,
             "kind": self.kind, "label": self.label, "text": text}
        )

    async def done(self, result: dict) -> None:
        self.status = "done"
        self.result = result
        await self._send(
            {"type": "task", "event": "done", "id": self.id,
             "kind": self.kind, "label": self.label}
        )

    async def failed(self, message: str) -> None:
        self.status = "failed"
        self.result = {"error": message}
        await self._send(
            {"type": "task", "event": "failed", "id": self.id,
             "kind": self.kind, "label": self.label, "text": message}
        )


TASKS: dict[str, Task] = {}


async def start(session, kind: str, label: str, work) -> Task:
    """`work` is an async callable taking the Task. Returns immediately."""
    task = Task(session, kind, label)
    TASKS[task.id] = task

    async def _run():
        try:
            await work(task)
        except asyncio.CancelledError:
            task.status = "failed"
            raise
        except Exception as exc:
            await task.failed(f"{type(exc).__name__}: {exc}")

    asyncio.create_task(_run())
    await task._send(
        {"type": "task", "event": "started", "id": task.id,
         "kind": kind, "label": label}
    )
    return task
