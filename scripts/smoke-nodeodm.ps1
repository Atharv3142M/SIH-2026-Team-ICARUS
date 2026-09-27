#requires -Version 5.1
# Submit a folder of stills to a running NodeODM and download all.zip.
param(
  [Parameter(Mandatory = $true)][string]$Images,
  [string]$Out = ".jobs\nodeodm-smoke",
  [string]$Preset = "low"
)
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$py = Join-Path $root ".venv\Scripts\python.exe"
New-Item -ItemType Directory -Force -Path (Join-Path $root $Out) | Out-Null
try {
  Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:3000/info" | Out-Null
} catch {
  Write-Error "NodeODM is not reachable on http://127.0.0.1:3000. Run scripts\nodeodm-up.ps1 first."
}
& $py -m orchestrator.nodeodm --images $Images --out (Join-Path $root $Out) --preset $Preset
