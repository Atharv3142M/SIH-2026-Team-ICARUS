from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import psutil

from orchestrator.nodeodm import NodeODMClient, nodeodm_url


def system_status() -> dict:
    vm = psutil.virtual_memory()
    disk = shutil.disk_usage(Path.cwd())
    docker_ok = False
    docker_version = ""
    try:
        proc = subprocess.run(["docker", "version", "--format", "{{.Server.Version}}"], capture_output=True, text=True, timeout=4)
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
    return {
        "cpuPercent": cpu,
        "ramUsedGb": round(vm.used / 1024**3, 2),
        "ramTotalGb": round(vm.total / 1024**3, 2),
        "ramPercent": vm.percent,
        "diskUsedGb": round(disk.used / 1024**3, 1),
        "diskTotalGb": round(disk.total / 1024**3, 1),
        "gpuPercent": None,
        "docker": {"ok": docker_ok, "version": docker_version},
        "nodeodm": {"ok": nodeodm_ok, "url": nodeodm_url(), "info": nodeodm_info},
    }
