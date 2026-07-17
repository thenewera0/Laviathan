"""run_code — executes ONLY inside an isolated Docker container.

Hard rule from the blueprint: never run generated code on the host.
No Docker -> the tool reports itself unavailable; there is no fallback.

Sandbox posture: no network, capped memory/CPU, read-only rootfs,
all capabilities dropped, hard wall-clock timeout.
"""
import asyncio
import shutil

from config import settings

_docker_checked: bool | None = None


async def _docker_available() -> bool:
    global _docker_checked
    if _docker_checked is not None:
        return _docker_checked
    if not shutil.which("docker"):
        _docker_checked = False
        return False
    try:
        proc = await asyncio.create_subprocess_exec(
            "docker", "info",
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await asyncio.wait_for(proc.wait(), timeout=10)
        _docker_checked = proc.returncode == 0
    except (asyncio.TimeoutError, OSError):
        _docker_checked = False
    return _docker_checked


async def run(session, code: str, language: str = "python") -> dict:
    if language != "python":
        return {"error": "only python is supported in this phase"}
    if not await _docker_available():
        return {
            "error": "code sandbox unavailable — Docker is not installed or "
            "not running on the host. Tell the user plainly: installing "
            "Docker Desktop enables safe code execution."
        }

    cmd = [
        "docker", "run", "--rm", "-i",
        "--network", "none",
        "--memory", "256m",
        "--cpus", "1",
        "--pids-limit", "128",
        "--read-only",
        "--cap-drop", "ALL",
        "--security-opt", "no-new-privileges",
        settings.docker_image,
        "python", "-c", code,
    ]
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        out, err = await asyncio.wait_for(
            proc.communicate(), timeout=settings.code_timeout
        )
    except asyncio.TimeoutError:
        proc.kill()
        return {"error": f"execution exceeded {settings.code_timeout}s and was killed"}
    except asyncio.CancelledError:
        proc.kill()
        raise

    return {
        "exit_code": proc.returncode,
        "stdout": out.decode(errors="replace")[-4000:],
        "stderr": err.decode(errors="replace")[-2000:],
    }
