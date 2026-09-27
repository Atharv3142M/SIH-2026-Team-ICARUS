#requires -Version 5.1
$ErrorActionPreference = "Stop"
docker compose -f (Join-Path $PSScriptRoot "..\docker-compose.yml") up -d
Write-Host "NodeODM at http://127.0.0.1:3000"
