from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import psutil

from orchestrator.nodeodm import NodeODMClient, nodeodm_url


def _gpu() -> dict:
    try:
        proc = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu",
                "--format=csv,noheader,nounits",
            ],
            capture_output=True,
            text=True,
            timeout=4,
        )
        if proc.returncode != 0 or not proc.stdout.strip():
            return {"gpuAvailable": False}
        name, util, mem_used, mem_total, temp = [p.strip() for p in proc.stdout.strip().splitlines()[0].split(",")]
        return {
            "gpuAvailable": True,
            "gpuName": name,
            "gpuUtilization": float(util),
            "gpuMemoryUsed": float(mem_used),
            "gpuMemoryTotal": float(mem_total),
            "gpuTemperature": float(temp),
        }
    except Exception:
        return {"gpuAvailable": False}


def _ffmpeg() -> dict:
    try:
        from pipeline.ffmpeg import resolve_ffmpeg
        from pipeline.probe import ffmpeg_version

        path = resolve_ffmpeg()
        return {"detected": True, "path": path, "version": ffmpeg_version(path)}
    except Exception as exc:
        return {"detected": False, "path": None, "version": None, "error": str(exc)}


def system_status() -> dict:
    vm = psutil.virtual_memory()
    disk = shutil.disk_usage(Path.cwd())
    docker_ok = False
    docker_version = ""
    try:
        proc = subprocess.run(
            ["docker", "version", "--format", "{{.Server.Version}}"],
            capture_output=True,
            text=True,
            timeout=4,
        )
        docker_ok = proc.returncode == 0
        docker_version = (proc.stdout or "").strip()
    except Exception:
        pass

    nodeodm_ok = False
    nodeodm_info: dict = {}
    try:
        nodeodm_info = NodeODMClient().info()
        nodeodm_ok = True
    except Exception as exc:
        nodeodm_info = {"error": str(exc)}

    cpu = psutil.cpu_percent(interval=0.15)
    gpu = _gpu()
    return {
        "cpuPercent": cpu,
        "ramUsedGb": round(vm.used / 1024**3, 2),
        "ramTotalGb": round(vm.total / 1024**3, 2),
        "ramPercent": vm.percent,
        "diskUsedGb": round(disk.used / 1024**3, 1),
        "diskFreeGb": round(disk.free / 1024**3, 1),
        "diskTotalGb": round(disk.total / 1024**3, 1),
        "docker": {"ok": docker_ok, "version": docker_version},
        "nodeodm": {"ok": nodeodm_ok, "url": nodeodm_url(), "info": nodeodm_info},
        "ffmpeg": _ffmpeg(),
        **gpu,
    }
