from __future__ import annotations

import zipfile
from pathlib import Path

import trimesh


class ConvertError(RuntimeError):
    pass


def convert_textured_model(archive: Path, dest_glb: Path) -> Path:
    """Turn NodeODM textured_model.zip (or a folder / OBJ) into a web-ready GLB."""
    dest_glb.parent.mkdir(parents=True, exist_ok=True)
    if archive.is_file() and archive.suffix.lower() == ".glb":
        dest_glb.write_bytes(archive.read_bytes())
        return dest_glb

    work = dest_glb.parent / "_mesh"
    work.mkdir(parents=True, exist_ok=True)
    source_dir = archive
    if archive.is_file() and archive.suffix.lower() == ".zip":
        with zipfile.ZipFile(archive) as zf:
            zf.extractall(work)
        source_dir = work
    elif archive.is_file():
        source_dir = archive.parent

    obj = _first(source_dir, {".obj"}) if source_dir.is_dir() else None
    gltf = _first(source_dir, {".glb", ".gltf"}) if source_dir.is_dir() else None
    if archive.suffix.lower() == ".obj":
        obj = archive
    if archive.suffix.lower() in {".gltf", ".glb"}:
        gltf = archive
    if gltf and gltf.suffix.lower() == ".glb":
        dest_glb.write_bytes(gltf.read_bytes())
        return dest_glb
    if gltf and gltf.suffix.lower() == ".gltf":
        scene = trimesh.load(str(gltf), force="scene")
        scene.export(str(dest_glb))
        return dest_glb
    if not obj:
        raise ConvertError(f"No OBJ/GLTF mesh found in {archive}")
    loaded = trimesh.load(str(obj), force="scene")
    loaded.export(str(dest_glb))
    if not dest_glb.is_file():
        raise ConvertError("GLB export failed")
    return dest_glb


def extract_all_zip(all_zip: Path, dest_dir: Path) -> Path:
    dest_dir.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(all_zip) as zf:
        zf.extractall(dest_dir)
    return dest_dir


def _first(root: Path, suffixes: set[str]) -> Path | None:
    matches = [p for p in root.rglob("*") if p.suffix.lower() in suffixes]
    return matches[0] if matches else None
