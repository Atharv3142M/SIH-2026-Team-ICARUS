# posEye Project Audit

## Project Purpose
posEye is a Windows desktop application that converts drone flight videos into georeferenced, interactive 3D models. The system automates the entire pipeline from video input to 3D model output with zero manual intermediate steps and no cloud dependencies.

## Official MVP Requirements
Based on [Docs/MVP_Spec.md], the MVP requires:
- Fully automated pipeline: video in → 3D model out, zero manual steps
- Zero manual dependency installation (ffmpeg, Docker, ODM)
- Georeferenced, metrically accurate output when GPS telemetry is present
- Interactive 3D viewer with orbit/pan/zoom and distance measurement tools
- Packaged Windows application that installs and runs on a clean machine
- Fully offline/local processing without cloud uploads

## Discovered Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Drone Video   │───▶│   Frame Extract │───▶│   NodeODM       │
│   + SRT Telem   │    │   (Stage 1)     │    │   Processing    │
└─────────────────┘    └─────────────────┘    │   Engine        │
                                        │   (Stage 2)     │
                                        └─────────────────┘
                                                ▲
                                                │
                                        ┌─────────────────┐
                                        │   Post-process  │
                                        │   & Format Conv │
                                        │   (Stage 3)     │
                                        └─────────────────┘
                                                ▲
                                                │
                                        ┌─────────────────┐
                                        │   Desktop UI    │
                                        │   Viewer        │
                                        │   (Stage 4)     │
                                        └─────────────────┘
```

### Core Components:
1. **Frame Extraction Service** (`apps/pipeline`) - video → clean, geotagged image set
2. **Processing Engine** (NodeODM) - image set → orthophoto, DSM/DTM, mesh, point cloud
3. **Orchestrator / Post-processor** (`apps/orchestrator`) - job lifecycle, progress, format conversion
4. **Desktop UI** (`apps/desktop`) - file picker, progress display, 3D viewer, measurement tools

## Important Directories
- `apps/pipeline` - Frame extraction and preprocessing logic
- `apps/orchestrator` - API service and NodeODM integration
- `apps/desktop` - Electron desktop application with React/Three.js viewer
- `installer` - Inno Setup installer scripts
- `scripts` - Setup and provisioning scripts
- `third_party` - Bundled dependencies (ffmpeg, nodeodm.tar)
- `Docs` - Documentation including MVP spec and status

## Development Commands
```powershell
# Setup environment
scripts\setup.ps1
scripts\fetch-ffmpeg.ps1
scripts\nodeodm-up.ps1

# Run tests
.\.venv\Scripts\python.exe -m pytest apps\pipeline apps\orchestrator

# Run orchestrator service
.\.venv\Scripts\python.exe -m orchestrator.main

# Run desktop app
cd apps\desktop
npm ci
npm run build
npm run dev
```

## Test Commands
```powershell
.\.venv\Scripts\python.exe -m pytest apps\pipeline apps\orchestrator
```

## Build Commands
```powershell
cd apps\desktop
npm run build
```

## Environment Requirements
- Windows 10/11 64-bit (WSL2 support required for Docker)
- Python 3.9+ with virtual environment
- Node.js 18+ for desktop app
- Docker Desktop with WSL2 backend
- 16GB RAM minimum, 6GB VRAM for viewer

## Coding Conventions
- Python modules in `apps/*/src` structure
- FastAPI for orchestrator service
- Electron + React + Three.js for desktop UI
- pytest for unit testing
- Modular component design with clear separation of concerns

## Rules for Third-party/Reference Repositories
- Reference repositories (ODM, NodeODM, WebODM) are used for research only
- No direct code copying from third-party repositories into posEye
- Third-party components should be bundled or provisioned rather than installed separately
- Licenses and attribution must be preserved for any reused components

## Definition of Done
- All core pipeline stages work end-to-end
- Desktop application builds and runs on a clean machine
- Installer properly provisions Docker, ffmpeg, and NodeODM image
- All MVP requirements from [Docs/MVP_Spec.md] are met
- No critical bugs or missing functionality

## MVP Acceptance Criteria
1. User can load video → click "Process" → get viewable 3D model in <5 minutes (dev machine)
2. Application installs and runs on clean Windows machine with no manual dependency installation
3. 3D model is georeferenced when GPS telemetry is present
4. Interactive viewer supports orbit/pan/zoom and distance measurement
5. All processing stays local - no cloud uploads
6. Installer properly handles Docker WSL2 virtualization detection