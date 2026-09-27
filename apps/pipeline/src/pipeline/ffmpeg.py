from __future__ import annotations

import os
import shutil
from pathlib import Path


def _repo_root() -> Path:
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "third_party").is_dir() or (parent / "Docs" / "MVP_Spec.md").is_file():
            return parent
    return here.parents[4]


def resolve_ffmpeg() -> str:
    """Return bundled ffmpeg.exe. PATH is last-resort only — never imageio downloads."""
    env = os.environ.get("FFMPEG_PATH")
    if env:
        path = Path(env)
        if path.is_file():
            return str(path)

    resources = os.environ.get("ELECTRON_RESOURCES", "")
    candidates = [
        _repo_root() / "third_party" / "ffmpeg.exe",
        _repo_root() / "third_party" / "ffmpeg" / "bin" / "ffmpeg.exe",
        _repo_root() / "third_party" / "ffmpeg" / "ffmpeg.exe",
        Path(resources) / "ffmpeg.exe" if resources else None,
    ]
    for candidate in candidates:
        if candidate and candidate.is_file():
            return str(candidate)

    fallback = shutil.which("ffmpeg")
    if fallback:
        return fallback

    raise FileNotFoundError(
        "ffmpeg binary not found. Place ffmpeg.exe in third_party/ or set FFMPEG_PATH."
    )
