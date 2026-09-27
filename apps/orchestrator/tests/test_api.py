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


def test_list_jobs():
    client = TestClient(app)
    res = client.get("/jobs")
    assert res.status_code == 200
    assert isinstance(res.json(), list)
