# Digital Twin (SIH26158)

Windows desktop app: drone video in, georeferenced 3D model out. Processing is local (NodeODM in Docker). Spec: [Docs/MVP_Spec.md](Docs/MVP_Spec.md).

## Layout

- `apps/pipeline` — Stage 1: ffmpeg extract, blur/dedup, SRT → EXIF
- `apps/orchestrator` — FastAPI jobs, NodeODM client, mesh → GLB
- `apps/desktop` — Electron + Three.js viewer
- `installer` — Inno Setup outer installer (Docker + image load)
- `third_party` — `ffmpeg.exe` and `nodeodm.tar` (gitignored)

## Dev setup

```powershell
scripts\setup.ps1
scripts\fetch-ffmpeg.ps1
scripts\nodeodm-up.ps1
.\.venv\Scripts\python.exe -m pytest apps\pipeline apps\orchestrator
cd apps\desktop
npm install
npm run dev
# or: npm run dev:electron
```

Orchestrator: `http://127.0.0.1:8765`  
NodeODM: `NODEODM_URL` (default `http://127.0.0.1:3000`)

```powershell
.\.venv\Scripts\python.exe -m orchestrator.main
```

CLI extraction without Docker:

```powershell
.\.venv\Scripts\python.exe -m pipeline --video C:\path\flight.mp4 --srt C:\path\flight.SRT --out .jobs\extract
```

Submit an existing still folder to NodeODM:

```powershell
.\.venv\Scripts\python.exe -m orchestrator.nodeodm --images .jobs\extract\frames --out .jobs\odm --preset medium
```

## Job API

- `POST /jobs` `{ "videoPath", "srtPath?", "preset?", "generateMasks?" }`
- `GET /jobs` list
- `GET /jobs/{id}`
- `POST /jobs/{id}/cancel`
- `DELETE /jobs/{id}`
- `WS /jobs/{id}/events`
- `GET /jobs/{id}/assets/{model.glb|model.laz|orthophoto.tif|all.zip}`
- `GET /system/status`

## Known limits

- Without SRT/EXIF GPS, the model is relative-scale only; distance is still shown in model units.
- Until a masked run is used, moving people/vehicles may ghost in the mesh. Enable **Mask moving objects** (YOLOv8n) or treat that as a documented limitation (spec §9).
- Docker WSL2 needs firmware virtualization; the installer can detect this but cannot flip BIOS.

## Clean-machine install

See [installer/README.md](installer/README.md). Hardware virtualization must be enabled in BIOS; the installer detects that case and cannot fix it silently.
