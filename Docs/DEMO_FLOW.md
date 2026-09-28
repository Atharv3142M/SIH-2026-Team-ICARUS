# posEye — Demo flow

One operator, one machine. Docker and NodeODM must already be running (Electron starts the container when possible).

## Setup (once)

1. Enable CPU virtualization in BIOS if Docker Desktop will not start.
2. Place `ffmpeg.exe` in `third_party\` (`scripts\fetch-ffmpeg.ps1` copies from PATH; it does not download via imageio).
3. Load NodeODM (`scripts\nodeodm-up.ps1` or Electron first launch).
4. Start the desktop app (`npm run dev:electron` from `apps/desktop`) or the orchestrator plus Vite.

Dashboard should show **Docker: Running**, **NodeODM: Connected**, **FFmpeg: detected**. GPU reads **Unavailable** if nvidia-smi is missing.

## Happy path

1. **New** → name the project → browse a drone `.mp4`. Probe line should show resolution, fps, duration, size.
2. Optionally attach a matching `.SRT`. Without it, the mesh is relative-scale only — say that out loud.
3. Preset **Balanced**, leave **Mask moving objects** on if people/vehicles are in frame (needs ultralytics).
4. **Start processing**. Timeline should walk extract → filter → geotag → mask → upload → NodeODM → GLB.
5. On **ready**, the viewer loads `model.glb`.
6. **Distance**: two clicks on the mesh. Units are meters only if GPS EXIF was present.
7. **Export GLB**. Mention LAZ/GeoTIFF only if those buttons appear (NodeODM actually wrote them).
8. **Screenshot** saves the current canvas.

## Failure paths to show (honest)

| What you do | What should happen |
| --- | --- |
| Missing video path | HTTP 400, form error, no fake job |
| Too few sharp frames | `NOT_ENOUGH_FRAMES` on Processing, Retry from New project |
| Stop Docker mid-job | NodeODM error with `NODEODM_*` code, not a hang with no message |
| Cancel | Stage `cancelled`, job remains in Projects |
| Open a job with no LAZ | No LAZ button |

## Do not claim

- Area or volume numbers
- Live orthophoto overlay
- Cloud upload
- Pause
- Meter-accurate distances on untagged flights

## Backup if reconstruction is too slow

Show a previously completed job from **Projects** → viewer + distance + GLB export. Be explicit that reconstruction already ran.
