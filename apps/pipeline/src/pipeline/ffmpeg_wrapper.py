from __future__ import annotations

from pathlib import Path

from pipeline.extract import ExtractConfig, extract_frames
from pipeline.ffmpeg import resolve_ffmpeg


def get_ffmpeg_path() -> str:
    return resolve_ffmpeg()


def extract_frames_simple(video_path: str, output_dir: str, fps: float = 2.0) -> int:
    result = extract_frames(
        ExtractConfig(
            video_path=Path(video_path),
            output_dir=Path(output_dir),
            fps=fps,
            min_retained_frames=1,
            blur_threshold=0.0,
        )
    )
    return len(result.frames)
