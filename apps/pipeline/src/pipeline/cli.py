from __future__ import annotations

import argparse
import json
from pathlib import Path

from pipeline.extract import ExtractConfig, extract_frames


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Extract geotagged frames from drone video")
    parser.add_argument("command", nargs="?", default="extract", help="extract")
    parser.add_argument("--video", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--srt", type=Path, default=None)
    parser.add_argument("--fps", type=float, default=3.0)
    parser.add_argument("--blur-threshold", type=float, default=40.0)
    parser.add_argument("--min-frames", type=int, default=8)
    parser.add_argument("--masks", action="store_true")
    args = parser.parse_args(argv)

    result = extract_frames(
        ExtractConfig(
            video_path=args.video,
            output_dir=args.out,
            srt_path=args.srt,
            fps=args.fps,
            blur_threshold=args.blur_threshold,
            min_retained_frames=args.min_frames,
            generate_masks=args.masks,
        ),
        progress=lambda stage, pct, msg: print(f"[{stage}] {pct:.0f}% {msg}", flush=True),
    )
    print(
        json.dumps(
            {
                "frames": len(result.frames),
                "geotagged": result.geotagged,
                "dropped_blur": result.dropped_blur,
                "dropped_dup": result.dropped_dup,
                "raw_count": result.raw_count,
                "masks": len(result.mask_paths),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
