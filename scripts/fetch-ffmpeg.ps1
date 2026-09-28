#requires -Version 5.1
# Copy a local ffmpeg.exe into third_party/. Does not download via imageio-ffmpeg.
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dest = Join-Path $root "third_party\ffmpeg.exe"
New-Item -ItemType Directory -Force -Path (Join-Path $root "third_party") | Out-Null

if (Test-Path $dest) {
  Write-Host "Already present: $dest"
  exit 0
}

$cmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
if ($cmd) {
  Copy-Item -Force $cmd.Source $dest
  Write-Host "Copied $($cmd.Source) -> $dest"
  exit 0
}

Write-Error @"
ffmpeg.exe not found.
Place a static Windows ffmpeg.exe at:
  $dest
Or add ffmpeg to PATH and re-run this script.
Do not use imageio-ffmpeg (it downloads at runtime and breaks offline installs).
"@
