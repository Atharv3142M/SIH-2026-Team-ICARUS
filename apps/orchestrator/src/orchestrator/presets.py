from __future__ import annotations

import os
from typing import Literal

import psutil

PresetName = Literal["low", "medium", "high"]

_PRESETS: dict[str, list[dict[str, str]]] = {
    "low": [
        {"name": "feature-quality", "value": "lowest"},
        {"name": "pc-quality", "value": "lowest"},
        {"name": "mesh-octree-depth", "value": "8"},
        {"name": "resize-to", "value": "1024"},
        {"name": "orthophoto-resolution", "value": "8"},
        {"name": "skip-report", "value": "true"},
    ],
    "medium": [
        {"name": "feature-quality", "value": "medium"},
        {"name": "pc-quality", "value": "medium"},
        {"name": "mesh-octree-depth", "value": "10"},
        {"name": "resize-to", "value": "2048"},
        {"name": "orthophoto-resolution", "value": "5"},
        {"name": "dsm", "value": "true"},
    ],
    "high": [
        {"name": "feature-quality", "value": "high"},
        {"name": "pc-quality", "value": "high"},
        {"name": "mesh-octree-depth", "value": "11"},
        {"name": "resize-to", "value": "4096"},
        {"name": "orthophoto-resolution", "value": "2"},
        {"name": "dsm", "value": "true"},
        {"name": "dtm", "value": "true"},
    ],
}


def preset_options(name: str) -> list[dict[str, str]]:
    if name not in _PRESETS:
        raise ValueError(f"Unknown preset {name}")
    return list(_PRESETS[name])


def detect_preset() -> PresetName:
    forced = os.environ.get("DT_PRESET")
    if forced in _PRESETS:
        return forced  # type: ignore[return-value]
    ram_gb = psutil.virtual_memory().total / (1024**3)
    cores = psutil.cpu_count(logical=True) or 4
    if ram_gb < 24 or cores < 12:
        return "low"
    if ram_gb < 64:
        return "medium"
    return "high"
