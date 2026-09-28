from fastapi.testclient import TestClient

from orchestrator.main import app


def test_health():
    client = TestClient(app)
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["ok"] is True


def test_missing_video():
    client = TestClient(app)
    res = client.post("/jobs", json={"videoPath": "C:/nope/missing.mp4"})
    assert res.status_code == 400


def test_unknown_logs():
    client = TestClient(app)
    res = client.get("/jobs/nope/logs")
    assert res.status_code == 404


def test_probe_missing():
    client = TestClient(app)
    res = client.post("/probe/video", json={"videoPath": "C:/nope/missing.mp4"})
    assert res.status_code == 400
