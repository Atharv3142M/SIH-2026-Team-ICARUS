from pathlib import Path

from orchestrator.convert import convert_textured_model


def test_convert_obj_to_glb(tmp_path: Path):
    obj = tmp_path / "mesh.obj"
    obj.write_text("v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n", encoding="utf-8")
    dest = tmp_path / "model.glb"
    convert_textured_model(obj, dest)
    assert dest.is_file()
    assert dest.stat().st_size > 20
