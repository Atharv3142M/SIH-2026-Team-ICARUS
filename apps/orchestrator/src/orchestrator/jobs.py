from __future__ import annotations

import asyncio
import json
import threading
import traceback
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from pipeline.extract import ExtractConfig, ExtractError, extract_frames

from orchestrator.convert import ConvertError, convert_textured_model, extract_all_zip
from orchestrator.nodeodm import NodeODMClient, NodeODMError
from orchestrator.presets import detect_preset, preset_options

Stage = Literal["queued", "extracting", "reconstructing", "converting", "ready", "error"]


@dataclass
class JobEvent:
    stage: Stage
    percent: float
    message: str
    ts: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def as_dict(self) -> dict[str, Any]:
        return {"stage": self.stage, "percent": self.percent, "message": self.message, "ts": self.ts}


@dataclass
class Job:
    id: str
    video_path: Path
    srt_path: Path | None
    preset: str
    generate_masks: bool
    work_dir: Path
    stage: Stage = "queued"
    percent: float = 0
    message: str = "Queued"
    error: str | None = None
    glb_path: Path | None = None
    frames_dir: Path | None = None
    geotagged: int = 0
    events: list[JobEvent] = field(default_factory=list)
    subscribers: list[asyncio.Queue] = field(default_factory=list)
    loop: asyncio.AbstractEventLoop | None = None


class JobStore:
    def __init__(self, root: Path):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self.jobs: dict[str, Job] = {}
        self.lock = threading.Lock()

    def create(
        self,
        video_path: Path,
        srt_path: Path | None,
        preset: str | None,
        generate_masks: bool,
        loop: asyncio.AbstractEventLoop,
    ) -> Job:
        job_id = uuid.uuid4().hex[:12]
        job = Job(
            id=job_id,
            video_path=video_path,
            srt_path=srt_path,
            preset=preset or detect_preset(),
            generate_masks=generate_masks,
            work_dir=self.root / job_id,
            loop=loop,
        )
        job.work_dir.mkdir(parents=True, exist_ok=True)
        with self.lock:
            self.jobs[job_id] = job
        self._emit(job, "queued", 0, "Queued")
        return job

    def get(self, job_id: str) -> Job | None:
        return self.jobs.get(job_id)

    def subscribe(self, job: Job) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        job.subscribers.append(q)
        for event in job.events[-20:]:
            q.put_nowait(event)
        return q

    def _emit(self, job: Job, stage: Stage, percent: float, message: str) -> None:
        event = JobEvent(stage, percent, message)
        job.stage = stage
        job.percent = percent
        job.message = message
        job.events.append(event)
        if job.loop:
            for q in list(job.subscribers):
                job.loop.call_soon_threadsafe(q.put_nowait, event)

    def run_job(self, job: Job) -> None:
        try:
            extract_dir = job.work_dir / "extract"
            self._emit(job, "extracting", 2, "Extracting frames")

            def on_progress(stage: str, pct: float, message: str) -> None:
                mapped = 5 + pct * 0.3
                self._emit(job, "extracting", mapped, message)

            result = extract_frames(
                ExtractConfig(
                    video_path=job.video_path,
                    output_dir=extract_dir,
                    srt_path=job.srt_path,
                    generate_masks=job.generate_masks,
                ),
                progress=on_progress,
            )
            job.frames_dir = extract_dir / "frames"
            job.geotagged = result.geotagged
            self._emit(
                job,
                "reconstructing",
                36,
                f"Submitting {len(result.frames)} frames to NodeODM ({job.preset})",
            )

            client = NodeODMClient()
            uuid_task = client.create_task(
                job.frames_dir,
                preset_options(job.preset),
                job.work_dir / "upload.zip",
            )
            client.wait(
                uuid_task,
                progress=lambda s, p, m: self._emit(job, "reconstructing", p, m),
            )
            all_zip = client.download_asset(uuid_task, "all.zip", job.work_dir / "all.zip")
            unpacked = extract_all_zip(all_zip, job.work_dir / "odm")
            self._emit(job, "converting", 88, "Converting mesh to GLB")

            textured = unpacked / "odm_texturing" / "odm_textured_model_geo.obj"
            if not textured.is_file():
                textured = next(unpacked.rglob("*.obj"), None) or next(unpacked.rglob("*.glb"), None)
            if textured is None:
                raise ConvertError("NodeODM output did not include a mesh")
            glb = convert_textured_model(textured, job.work_dir / "model.glb")
            job.glb_path = glb
            meta = {
                "id": job.id,
                "preset": job.preset,
                "frames": len(result.frames),
                "geotagged": result.geotagged,
                "nodeodm": uuid_task,
            }
            (job.work_dir / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
            self._emit(job, "ready", 100, "Model ready")
        except (ExtractError, NodeODMError, ConvertError) as exc:
            job.error = str(exc)
            self._emit(job, "error", job.percent, str(exc))
        except Exception as exc:
            job.error = str(exc)
            (job.work_dir / "error.txt").write_text(traceback.format_exc(), encoding="utf-8")
            self._emit(job, "error", job.percent, str(exc))
