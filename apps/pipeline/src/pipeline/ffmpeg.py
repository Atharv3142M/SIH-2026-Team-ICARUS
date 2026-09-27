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
    """Return a bundled ffmpeg binary. Never uses a system PATH install as the primary source."""
    env = os.environ.get("FFMPEG_PATH")
    if env:
        path = Path(env)
        if path.is_file():
            return str(path)

    candidates = [
        _repo_root() / "third_party" / "ffmpeg.exe",
        _repo_root() / "third_party" / "ffmpeg" / "bin" / "ffmpeg.exe",
        _repo_root() / "third_party" / "ffmpeg" / "ffmpeg.exe",
        Path(os.environ.get("ELECTRON_RESOURCES", "")) / "ffmpeg.exe",
    ]
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)

    try:
        import imageio_ffmpeg

        bundled = imageio_ffmpeg.get_ffmpeg_exe()
        if bundled and Path(bundled).is_file():
            return bundled
    except Exception:
        pass

    fallback = shutil.which("ffmpeg")
    if fallback:
        return fallback

    raise FileNotFoundError(
        "ffmpeg binary not found. Set FFMPEG_PATH or place ffmpeg.exe in third_party/."
    )
