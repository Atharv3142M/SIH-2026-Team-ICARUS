from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

from orchestrator.jobs import JobStore
from orchestrator.presets import detect_preset
from orchestrator.system import system_status

JOBS_ROOT = Path(os.environ.get("DT_JOBS_DIR", Path.cwd() / ".jobs"))
store = JobStore(JOBS_ROOT)

app = FastAPI(title="posEye Orchestrator", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3001", "*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class CreateJob(BaseModel):
    videoPath: str
    srtPath: str | None = None
    preset: str | None = None
    generateMasks: bool = False
    name: str | None = None
    description: str | None = None
    fps: float | None = None
    blurThreshold: float | None = None


class JobOut(BaseModel):
    id: str
    name: str = ""
    description: str = ""
    stage: str
    percent: float
    message: str
    error: str | None = None
    geotagged: int = 0
    frameCount: int = 0
    preset: str
    hasModel: bool = False
    createdAt: str = ""
    updatedAt: str = ""
    videoPath: str = ""
    errorCode: str | None = None
    extract: dict = {}
    assets: dict = {}


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception) -> JSONResponse:
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    return JSONResponse(status_code=500, content={"error": str(exc), "stage": "unknown"})


@app.get("/health")
def health() -> dict:
    status = system_status()
    return {
        "ok": True,
        "defaultPreset": detect_preset(),
        "ffmpeg": status.get("ffmpeg"),
        "nodeodm": {"ok": status["nodeodm"]["ok"], "url": status["nodeodm"]["url"]},
        "docker": status.get("docker"),
    }


@app.get("/system/status")
def get_system() -> dict:
    return system_status()


class ProbeBody(BaseModel):
    videoPath: str


@app.post("/probe/video")
def probe_video_endpoint(body: ProbeBody) -> dict:
    from pipeline.probe import probe_video

    try:
        info = probe_video(body.videoPath)
    except Exception as exc:
        raise HTTPException(400, str(exc)) from exc
    return {
        "path": str(info.path),
        "durationS": info.duration_s,
        "width": info.width,
        "height": info.height,
        "fps": info.fps,
        "sizeBytes": info.size_bytes,
        "name": info.path.name,
    }


@app.get("/presets/default")
def default_preset() -> dict:
    return {"preset": detect_preset()}


@app.post("/jobs", response_model=JobOut)
async def create_job(body: CreateJob) -> JobOut:
    video = Path(body.videoPath)
    if not video.is_file():
        raise HTTPException(400, f"Video not found: {video}")
    srt = Path(body.srtPath) if body.srtPath else None
    if srt and not srt.is_file():
        raise HTTPException(400, f"SRT not found: {srt}")
    import asyncio

    job = store.create(
        video,
        srt,
        body.preset,
        body.generateMasks,
        asyncio.get_running_loop(),
        name=body.name or "",
        description=body.description or "",
        fps=body.fps if body.fps and body.fps > 0 else 3.0,
        blur_threshold=body.blurThreshold if body.blurThreshold and body.blurThreshold > 0 else 40.0,
    )
    asyncio.get_running_loop().run_in_executor(None, store.run_job, job)
    return _out(job)


@app.get("/jobs", response_model=list[JobOut])
def list_jobs() -> list[JobOut]:
    return [_out(j) for j in store.list()]


@app.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: str) -> JobOut:
    job = store.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job")
    return _out(job)


@app.post("/jobs/{job_id}/cancel", response_model=JobOut)
def cancel_job(job_id: str) -> JobOut:
    job = store.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job")
    store.cancel(job)
    return _out(job)


@app.delete("/jobs/{job_id}")
def delete_job(job_id: str) -> dict:
    job = store.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job")
    store.delete(job)
    return {"ok": True}


@app.get("/jobs/{job_id}/assets/{asset}")
def job_asset(job_id: str, asset: str) -> FileResponse:
    job = store.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job")
    mapping = {
        "model.glb": job.work_dir / "model.glb",
        "all.zip": job.work_dir / "all.zip",
    }
    odm = job.work_dir / "odm"
    if asset == "orthophoto.tif":
        hits = list(odm.rglob("*orthophoto*.tif"))
        path = hits[0] if hits else None
    elif asset == "model.laz":
        hits = list(odm.rglob("*.laz"))
        path = hits[0] if hits else None
    else:
        path = mapping.get(asset)
    if path is None or not path.is_file():
        raise HTTPException(404, f"Asset not available: {asset}")
    return FileResponse(path, filename=path.name)


@app.get("/jobs/{job_id}/logs")
def job_logs(job_id: str) -> dict:
    job = store.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job")
    return {"id": job.id, "events": [e.as_dict() for e in job.events]}


@app.get("/jobs/{job_id}/metadata")
def job_metadata(job_id: str) -> dict:
    job = store.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job")
    store.persist(job)
    meta_path = job.work_dir / "job.json"
    return json_load(meta_path) if meta_path.is_file() else _out(job).model_dump()


@app.get("/jobs/{job_id}/diagnostics")
def job_diagnostics(job_id: str) -> dict:
    job = store.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job")
    err_file = job.work_dir / "error.txt"
    return {
        "id": job.id,
        "stage": job.stage,
        "error": job.error,
        "errorCode": job.error_code,
        "traceback": err_file.read_text(encoding="utf-8") if err_file.is_file() else None,
        "system": system_status(),
    }


def json_load(path: Path) -> dict:
    import json

    return json.loads(path.read_text(encoding="utf-8"))


@app.websocket("/jobs/{job_id}/events")
async def job_events(websocket: WebSocket, job_id: str) -> None:
    job = store.get(job_id)
    if not job:
        await websocket.close(code=4404)
        return
    await websocket.accept()
    queue = store.subscribe(job)
    try:
        while True:
            event = await queue.get()
            await websocket.send_json(event.as_dict())
            if event.stage in {"ready", "error", "cancelled"}:
                break
    except WebSocketDisconnect:
        return


def _out(job) -> JobOut:
    return JobOut(
        id=job.id,
        name=job.name,
        description=job.description,
        stage=job.stage,
        percent=job.percent,
        message=job.message,
        error=job.error,
        geotagged=job.geotagged,
        frameCount=job.frame_count,
        preset=job.preset,
        hasModel=bool(job.glb_path and job.glb_path.is_file()),
        createdAt=job.created_at,
        updatedAt=job.updated_at,
        videoPath=str(job.video_path),
        errorCode=job.error_code,
        extract=job.extract_stats,
        assets={
            "glb": bool(job.glb_path and job.glb_path.is_file()),
            "laz": (job.work_dir / "odm").exists() and any(job.work_dir.joinpath("odm").rglob("*.laz")),
            "orthophoto": (job.work_dir / "odm").exists()
            and any(job.work_dir.joinpath("odm").rglob("*orthophoto*.tif")),
        },
    )


def run() -> None:
    import uvicorn

    host = os.environ.get("DT_HOST", "127.0.0.1")
    port = int(os.environ.get("DT_PORT", "8765"))
    uvicorn.run("orchestrator.main:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    run()
