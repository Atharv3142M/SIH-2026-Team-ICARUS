from __future__ import annotations

from pathlib import Path

import pytest

from pipeline.exif import read_gps_exif
from pipeline.extract import ExtractConfig, extract_frames
from pipeline.ffmpeg_wrapper import get_ffmpeg_path
from pipeline.srt import parse_srt
from tests.fixtures.make_fixtures import write_fixture_srt, write_fixture_video

FIXTURE_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session")
def flight_files(tmp_path_factory) -> tuple[Path, Path]:
    video = FIXTURE_DIR / "test_flight.mp4"
    srt = FIXTURE_DIR / "test_flight.SRT"
    if not video.is_file():
        write_fixture_video(video)
    if not srt.is_file():
        write_fixture_srt(srt)
    return video, srt


def test_ffmpeg_resolves() -> None:
    path = get_ffmpeg_path()
    assert Path(path).is_file()


def test_extract_frames(flight_files, tmp_path: Path) -> None:
    video, srt = flight_files
    result = extract_frames(
        ExtractConfig(
            video_path=video,
            output_dir=tmp_path / "out",
            srt_path=srt,
            fps=2.0,
            blur_threshold=5.0,
            min_retained_frames=3,
        )
    )
    assert result.raw_count > 0
    assert len(result.frames) >= 3
    assert all(p.suffix.lower() == ".jpg" for p in result.frames)


def test_srt_parsing(flight_files) -> None:
    _, srt = flight_files
    samples = parse_srt(srt)
    assert len(samples) > 0
    assert samples[0].latitude is not None
    assert samples[0].longitude is not None


def test_exif_gps_write(flight_files, tmp_path: Path) -> None:
    video, srt = flight_files
    result = extract_frames(
        ExtractConfig(
            video_path=video,
            output_dir=tmp_path / "exif",
            srt_path=srt,
            fps=2.0,
            blur_threshold=5.0,
            min_retained_frames=3,
        )
    )
    lat, lon, alt = read_gps_exif(result.frames[0])
    assert lat is not None
    assert lon is not None
    assert 28.0 < lat < 29.0
    assert 77.0 < lon < 78.0
