from pathlib import Path

import httpx

from orchestrator.nodeodm import NodeODMClient
from orchestrator.presets import detect_preset, preset_options


class _Transport(httpx.BaseTransport):
    def __init__(self):
        self.created = False

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if url.endswith("task/new"):
            self.created = True
            return httpx.Response(200, json={"uuid": "abc-123"})
        if "/task/abc-123/info" in url:
            return httpx.Response(
                200,
                json={"status": {"code": 40}, "progress": 100},
            )
        if "/task/abc-123/download/all.zip" in url:
            return httpx.Response(200, content=b"PK\x03\x04fake")
        if url.endswith("/info"):
            return httpx.Response(200, json={"version": "test"})
        return httpx.Response(404)


def test_preset_options():
    opts = preset_options("low")
    names = {o["name"] for o in opts}
    assert "resize-to" in names
    assert detect_preset() in {"low", "medium", "high"}


def test_create_task_zips_images(tmp_path: Path, monkeypatch):
    images = tmp_path / "frames"
    images.mkdir()
    (images / "image_000001.jpg").write_bytes(b"\xff\xd8\xff")
    (images / "image_000001_mask.jpg").write_bytes(b"\xff\xd8\xff")
    client = NodeODMClient("http://nodeodm.test")
    transport = _Transport()

    real_client = httpx.Client

    def fake_client(*args, **kwargs):
        kwargs["transport"] = transport
        kwargs["base_url"] = "http://nodeodm.test"
        return real_client(*args, **kwargs)

    monkeypatch.setattr(httpx, "Client", fake_client)
    uuid = client.create_task(images, preset_options("medium"), tmp_path / "upload.zip")
    assert uuid == "abc-123"
    assert (tmp_path / "upload.zip").is_file()
    info = client.task_info(uuid)
    assert info.completed
    dest = client.download_asset(uuid, "all.zip", tmp_path / "all.zip")
    assert dest.read_bytes().startswith(b"PK")
