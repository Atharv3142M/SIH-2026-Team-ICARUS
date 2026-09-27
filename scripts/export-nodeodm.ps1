#requires -Version 5.1
$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$tar = Join-Path $root "third_party\nodeodm.tar"
Write-Host "Pulling opendronemap/nodeodm (large image)..."
docker pull opendronemap/nodeodm
docker save -o $tar opendronemap/nodeodm
Write-Host "Wrote $tar"
