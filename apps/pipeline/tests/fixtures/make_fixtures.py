from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np


def write_fixture_video(dest: Path, *, seconds: float = 3.0, fps: int = 15, width: int = 640, height: int = 360) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(dest), fourcc, fps, (width, height))
    n = int(seconds * fps)
    for i in range(n):
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        x = int(40 + (i / max(n - 1, 1)) * (width - 160))
        cv2.rectangle(frame, (x, 80), (x + 120, 240), (40, 180, 90), -1)
        cv2.circle(frame, (x + 60, 160), 36, (30, 90, 200), -1)
        cv2.putText(frame, f"F{i:03d}", (16, 36), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (240, 240, 240), 2)
        writer.write(frame)
    writer.release()
    return dest


def write_fixture_srt(dest: Path, *, seconds: float = 3.0, step: float = 0.2) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    blocks: list[str] = []
    t = 0.0
    i = 0
    while t < seconds:
        t1 = min(seconds, t + step)
        lat = 28.6139 + i * 0.00005
        lon = 77.2090 + i * 0.00005
        alt = 80.0 + i * 0.4

        def fmt(v: float) -> str:
            ms = int(round(v * 1000))
            s, ms = divmod(ms, 1000)
            m, s = divmod(s, 60)
            h, m = divmod(m, 60)
            return f"00:{m:02d}:{s:02d},{ms:03d}" if h == 0 else f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

        blocks.append(f"{i}\n{fmt(t)} --> {fmt(t1)}\n{lat:.6f},{lon:.6f},{alt:.1f},45,30,0,5.0,0.0,0.0,0,0,0,1,0\n")
        t = t1
        i += 1
    dest.write_text("\n".join(blocks), encoding="utf-8")
    return dest


if __name__ == "__main__":
    root = Path(__file__).parent
    write_fixture_video(root / "test_flight.mp4")
    write_fixture_srt(root / "test_flight.SRT")
    print("wrote", root / "test_flight.mp4")
