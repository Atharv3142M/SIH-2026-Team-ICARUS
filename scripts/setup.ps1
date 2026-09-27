#requires -Version 5.1
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

if (-not (Test-Path ".venv")) {
  py -3.11 -m venv .venv
}

$py = Join-Path $root ".venv\Scripts\python.exe"
& $py -m pip install -U pip
& $py -m pip install -e "apps\pipeline[dev]"
& $py -m pip install -e "apps\orchestrator[dev]"

Write-Host "Python env ready. Next:"
Write-Host "  .\.venv\Scripts\python.exe -m pytest apps\pipeline apps\orchestrator"
Write-Host "  docker compose up -d"
Write-Host "  cd apps\desktop; npm install; npm run dev:electron"
