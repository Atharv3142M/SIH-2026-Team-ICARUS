from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from pipeline.masks import generate_moving_object_masks


class _Box:
    def __init__(self, xyxy, cls_id: int):
        self.xyxy = [xyxy]
        self.cls = [cls_id]


class _Result:
    def __init__(self, boxes):
        self.boxes = boxes


class _FakeModel:
    names = {0: "car", 1: "building"}

    def predict(self, source, conf, verbose):
        return [_Result([_Box([10, 10, 40, 40], 0), _Box([50, 50, 80, 80], 1)])]


def test_masks_black_out_moving_classes(tmp_path: Path, monkeypatch) -> None:
    frame = tmp_path / "image_000001.jpg"
    cv2.imwrite(str(frame), np.full((100, 100, 3), 200, dtype=np.uint8))

    import pipeline.masks as masks

    monkeypatch.setattr(masks, "YOLO", lambda name: _FakeModel(), raising=False)

    # Patch import inside function
    import sys
    import types

    ultra = types.ModuleType("ultralytics")
    ultra.YOLO = lambda name: _FakeModel()
    sys.modules["ultralytics"] = ultra

    paths = generate_moving_object_masks([frame])
    assert len(paths) == 1
    mask = cv2.imread(str(paths[0]), cv2.IMREAD_GRAYSCALE)
    assert mask[20, 20] == 0
    assert mask[60, 60] == 255
    assert mask[0, 0] == 255
