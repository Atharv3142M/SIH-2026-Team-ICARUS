import argparse
import sys
from pathlib import Path
import numpy as np

# Setup paths for telemetry-frame-mapper
import os
os.environ["PYTHONPATH"] += os.pathsep + os.path.join(os.getcwd(), "telemetry-frame-mapper", "src")

try:
    from drone_video_geotagger.video import extract_srt, read_video_start
    from drone_video_geotagger.telemetry import parse_srt
    from drone_video_geotagger.frames import collect_frames, infer_frame_rate, build_frame_tags
    from drone_video_geotagger.exiftool import write_exif
    from drone_video_geotagger.audit import write_audit_csv
except ImportError:
    print("Error: Could not import drone_video_geotagger. Ensure telemetry-frame-mapper/src is in PYTHONPATH.")
    sys.exit(1)

from src.utils.keyframe_selector import KeyframeSelector, KeyframeConfig

def run_phase1_pipeline(args):
    print(f"--- Phase 1: Core Pipeline ---")

    # 1. Video Decode & Telemetry Sync
    print("Step 1: Extracting telemetry and geotagging frames...")
    video_path = Path(args.video)
    frames_dir = Path(args.frames)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    srt_path = output_dir / f"{video_path.stem}.srt"
    if not srt_path.exists():
        extract_srt("ffmpeg", video_path, srt_path)

    telemetry = parse_srt(srt_path)
    frames = collect_frames(frames_dir)

    # Infer frame rate if not provided
    from drone_video_geotagger.video import read_video_duration
    video_duration = read_video_duration("ffmpeg", video_path)
    frame_rate = args.frame_rate or infer_frame_rate(frames, telemetry[-1].end_s, video_duration)
    video_start = read_video_start("ffmpeg", video_path)

    # Geotag frames
    tags = build_frame_tags(
        frames=frames,
        telemetry=telemetry,
        output_dir=output_dir,
        frame_rate=frame_rate,
        takeoff_altitude_m=args.takeoff_altitude,
        video_start=video_start,
        in_place=False
    )

    # Copy and write EXIF (if exiftool is available)
    import shutil
    for tag in tags:
        tag.target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(tag.source, tag.target)

    try:
        audit_csv = output_dir / "frame_geotags.csv"
        exif_args = output_dir / "exiftool_geotags.args"
        write_audit_csv(tags, audit_csv)
        write_exif("exiftool", tags, exif_args)
        print("Geotagging complete.")
    except Exception as e:
        print(f"Warning: EXIF writing failed (probably missing exiftool): {e}")

    # 2. Adaptive Keyframe Selection
    print("Step 2: Selecting keyframes...")
    selector = KeyframeSelector()
    # Use the geotagged frames for selection
    geotagged_frames = sorted(list((output_dir).glob("*.jpg")))
    key_frames = selector.select(geotagged_frames, telemetry)

    key_frames_dir = output_dir / "keyframes"
    key_frames_dir.mkdir(parents=True, exist_ok=True)
    for kf in key_frames:
        import shutil
        shutil.copy2(kf, key_frames_dir / kf.name)

    print(f"Selected {len(key_frames)} keyframes out of {len(geotagged_frames)}.")

    # 3. COLMAP Baseline
    print("Step 3: Running COLMAP baseline...")
    # This part requires colmap binary. If not found, we report it.
    try:
        import subprocess
        # Example COLMAP flow:
        # colmap feature_extractor --database_path ... --image_path ...
        # colmap exhaustive_matcher --database_path ...
        # colmap mapper --database_path ... --image_path ... --output_path ...

        db_path = output_dir / "database.db"
        sparse_path = output_dir / "sparse"
        sparse_path.mkdir(parents=True, exist_ok=True)

        print("Running feature extraction...")
        subprocess.run(["colmap", "feature_extractor",
                        "--database_path", str(db_path),
                        "--image_path", str(key_frames_dir)], check=True)

        print("Running matcher...")
        subprocess.run(["colmap", "exhaustive_matcher",
                        "--database_path", str(db_path)], check=True)

        print("Running mapper...")
        subprocess.run(["colmap", "mapper",
                        "--database_path", str(db_path),
                        "--image_path", str(key_frames_dir),
                        "--output_path", str(sparse_path)], check=True)

        print("COLMAP sparse reconstruction complete.")
    except Exception as e:
        print(f"Error: COLMAP failed or not installed: {e}")

def main():
    parser = argparse.ArgumentParser(description="Phase 1 Pipeline")
    parser.add_argument("--video", type=Path, required=True)
    parser.add_argument("--frames", type=Path, required=True)
    parser.add_argument("--takeoff-altitude", type=float, required=True)
    parser.add_argument("--output", type=Path, default=Path("./output_phase1"))
    parser.add_argument("--frame-rate", type=float)

    args = parser.parse_args()
    run_phase1_pipeline(args)

if __name__ == "__main__":
    main()
