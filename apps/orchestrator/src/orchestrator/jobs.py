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
from orchestrator.presets import canonical_preset, detect_preset, preset_options

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
    name: str = ""
    description: str = ""
    stage: Stage = "queued"
    percent: float = 0
    message: str = "Queued"
    error: str | None = None
    glb_path: Path | None = None
    frames_dir: Path | None = None
    geotagged: int = 0
    frame_count: int = 0
    nodeodm_uuid: str | None = None
    canceled: bool = False
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    events: list[JobEvent] = field(default_factory=list)
    subscribers: list[asyncio.Queue] = field(default_factory=list)
    loop: asyncio.AbstractEventLoop | None = None


class JobStore:
    def __init__(self, root: Path):
        self.root = root
        self.root.mkdir(parents=True, exist_ok=True)
        self.jobs: dict[str, Job] = {}
        self.lock = threading.Lock()
        self._load_existing()

    def _load_existing(self) -> None:
        for meta in self.root.glob("*/job.json"):
            try:
                data = json.loads(meta.read_text(encoding="utf-8"))
            except Exception:
                continue
            job_id = data.get("id") or meta.parent.name
            job = Job(
                id=job_id,
                video_path=Path(data.get("videoPath") or ""),
                srt_path=Path(data["srtPath"]) if data.get("srtPath") else None,
                preset=data.get("preset") or "medium",
                generate_masks=bool(data.get("generateMasks")),
                work_dir=meta.parent,
                name=data.get("name") or job_id,
                description=data.get("description") or "",
                stage=data.get("stage") or "queued",
                percent=float(data.get("percent") or 0),
                message=data.get("message") or "",
                error=data.get("error"),
                geotagged=int(data.get("geotagged") or 0),
                frame_count=int(data.get("frameCount") or 0),
                created_at=data.get("createdAt") or "",
            )
            glb = meta.parent / "model.glb"
            if glb.is_file():
                job.glb_path = glb
            self.jobs[job_id] = job

    def create(
        self,
        video_path: Path,
        srt_path: Path | None,
        preset: str | None,
        generate_masks: bool,
        loop: asyncio.AbstractEventLoop,
        *,
        name: str = "",
        description: str = "",
    ) -> Job:
        job_id = uuid.uuid4().hex[:12]
        job = Job(
            id=job_id,
            video_path=video_path,
            srt_path=srt_path,
            preset=canonical_preset(preset or detect_preset()),
            generate_masks=generate_masks,
            work_dir=self.root / job_id,
            name=name or video_path.stem,
            description=description,
            loop=loop,
        )
        job.work_dir.mkdir(parents=True, exist_ok=True)
        with self.lock:
            self.jobs[job_id] = job
        self._emit(job, "queued", 0, "Queued")
        return job

    def get(self, job_id: str) -> Job | None:
        return self.jobs.get(job_id)

    def list(self) -> list[Job]:
        return sorted(self.jobs.values(), key=lambda j: j.created_at, reverse=True)

    def cancel(self, job: Job) -> None:
        job.canceled = True
        if job.nodeodm_uuid:
            try:
                NodeODMClient().cancel_task(job.nodeodm_uuid)
            except Exception:
                pass
        self._emit(job, "error", job.percent, "Canceled")

    def delete(self, job: Job) -> None:
        import shutil

        with self.lock:
            self.jobs.pop(job.id, None)
        shutil.rmtree(job.work_dir, ignore_errors=True)

    def subscribe(self, job: Job) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue()
        job.subscribers.append(q)
        for event in job.events[-40:]:
            q.put_nowait(event)
        return q

    def persist(self, job: Job) -> None:
        payload = {
            "id": job.id,
            "name": job.name,
            "description": job.description,
            "videoPath": str(job.video_path),
            "srtPath": str(job.srt_path) if job.srt_path else None,
            "preset": job.preset,
            "generateMasks": job.generate_masks,
            "stage": job.stage,
            "percent": job.percent,
            "message": job.message,
            "error": job.error,
            "geotagged": job.geotagged,
            "frameCount": job.frame_count,
            "createdAt": job.created_at,
            "hasModel": bool(job.glb_path and job.glb_path.is_file()),
        }
        (job.work_dir / "job.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def _emit(self, job: Job, stage: Stage, percent: float, message: str) -> None:
        event = JobEvent(stage, percent, message)
        job.stage = stage
        job.percent = percent
        job.message = message
        job.events.append(event)
        self.persist(job)
        if job.loop:
            for q in list(job.subscribers):
                job.loop.call_soon_threadsafe(q.put_nowait, event)

    def run_job(self, job: Job) -> None:
        try:
            if job.canceled:
                raise NodeODMError("Job canceled")
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
            if job.canceled:
                raise NodeODMError("Job canceled")
            job.frames_dir = extract_dir / "frames"
            job.geotagged = result.geotagged
            job.frame_count = len(result.frames)
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
            job.nodeodm_uuid = uuid_task
            client.wait(
                uuid_task,
                progress=lambda s, p, m: self._emit(job, "reconstructing", p, m),
                should_stop=lambda: job.canceled,
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
            (job.work_dir / "meta.json").write_text(
                json.dumps(
                    {
                        "id": job.id,
                        "preset": job.preset,
                        "frames": len(result.frames),
                        "geotagged": result.geotagged,
                        "nodeodm": uuid_task,
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
            self._emit(job, "ready", 100, "Model ready")
        except (ExtractError, NodeODMError, ConvertError) as exc:
            job.error = str(exc)
            self._emit(job, "error", job.percent, str(exc))
        except Exception as exc:
            job.error = str(exc)
            (job.work_dir / "error.txt").write_text(traceback.format_exc(), encoding="utf-8")
            self._emit(job, "error", job.percent, str(exc))
