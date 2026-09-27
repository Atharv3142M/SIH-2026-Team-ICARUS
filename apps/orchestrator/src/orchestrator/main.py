from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from orchestrator.jobs import JobStore
from orchestrator.presets import detect_preset

JOBS_ROOT = Path(os.environ.get("DT_JOBS_DIR", Path.cwd() / ".jobs"))
store = JobStore(JOBS_ROOT)

app = FastAPI(title="Digital Twin Orchestrator", version="0.1.0")
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


class JobOut(BaseModel):
    id: str
    stage: str
    percent: float
    message: str
    error: str | None = None
    geotagged: int = 0
    preset: str
    hasModel: bool = False


@app.get("/health")
def health() -> dict:
    return {"ok": True, "defaultPreset": detect_preset()}


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

    job = store.create(video, srt, body.preset, body.generateMasks, asyncio.get_running_loop())
    asyncio.get_running_loop().run_in_executor(None, store.run_job, job)
    return _out(job)


@app.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: str) -> JobOut:
    job = store.get(job_id)
    if not job:
        raise HTTPException(404, "Unknown job")
    return _out(job)


@app.get("/jobs/{job_id}/assets/model.glb")
def model_glb(job_id: str) -> FileResponse:
    job = store.get(job_id)
    if not job or not job.glb_path or not job.glb_path.is_file():
        raise HTTPException(404, "Model not ready")
    return FileResponse(job.glb_path, media_type="model/gltf-binary", filename="model.glb")


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
            if event.stage in {"ready", "error"}:
                break
    except WebSocketDisconnect:
        return


def _out(job) -> JobOut:
    return JobOut(
        id=job.id,
        stage=job.stage,
        percent=job.percent,
        message=job.message,
        error=job.error,
        geotagged=job.geotagged,
        preset=job.preset,
        hasModel=bool(job.glb_path and job.glb_path.is_file()),
    )


def run() -> None:
    import uvicorn

    host = os.environ.get("DT_HOST", "127.0.0.1")
    port = int(os.environ.get("DT_PORT", "8765"))
    uvicorn.run("orchestrator.main:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    run()
