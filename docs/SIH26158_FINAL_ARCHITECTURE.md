# SIH26158 — Final System Architecture
## Single-Pass Drone Video to Accurate 3D Model Generation System
**PS-17 · Organisation: National Technical Research Organisation (NTRO) · Category: Software · Theme: Drone/Robotics**

This document reconciles four independently-produced research reports (one Gemini-style, one ChatGPT deep research, two repo-comparison docs) plus the official PS text into a single, defensible plan — adjusted for the actual hardware and team this project will be built and demoed on.

---

## 1. Executive Verdict

**Build it.** The PS is ambitious but technically coherent if "entire visible scene" is read literally as *all surfaces the camera actually observed* — not omniscient reconstruction of unseen geometry.

**Core principle:** classical photogrammetry (SfM + MVS) remains the authoritative geometry engine. AI earns its place only where it produces measurable leverage — frame selection, hard-case matching, dynamic-object masking, semantic labeling, and the natural-language interface. AI does **not** replace the reconstruction engine, and Gaussian Splatting/NeRF is a secondary visual layer, never the measurement source. Two of your four source documents converge on this independently; the other two (which push Gaussian Splatting/Nerfstudio as the *primary* reconstruction method, with fabricated "likelihood of winning" percentages) are not followed here — splats don't yield the solid, measurable topology the PS's own output formats (OBJ/PLY/LAS) require.

---

## 2. Hardware Reality — This Is the Binding Constraint

You have two machines, and they play very different roles:

| Machine | Specs | Role |
|---|---|---|
| **HEPC-05** (Dell Precision 7875) | Threadripper PRO 7975WX (32c), 128GB RAM, RTX 4500 Ada 24GB VRAM | Development, training, heavy experimentation, dataset benchmarking |
| **Victus laptop** | Ryzen 7 8845HS, RTX 4060 **8GB VRAM** | **Live demo / presentation machine** |

**Critical point the earlier research missed:** the official PS says *"Dataset Link: Will be provided real time."* That almost certainly means SIH will hand you an unseen drone video during judging, and you'll need to run your actual pipeline live, on whatever hardware you bring — which for you is the 8GB laptop, not the workstation. This changes the whole design target.

**Action item: confirm with SIH organizers/mentors whether venue hardware is provided, or if teams must run on their own laptops.** If it's BYO-hardware (typical for SIH), **the 8GB RTX 4060 laptop is your real spec, not the Threadripper.** Design and test against it, and treat the Threadripper as your R&D and pre-processing machine, not your target runtime.

### VRAM budget on the 8GB demo machine

| Component | Approx. VRAM (live run) | Fits in 8GB? |
|---|---|---|
| GLOMAP / COLMAP feature extraction + sequential matching | 1–2 GB | Yes |
| PySIFT (GPU-resident SIFT) | Benchmarked by its authors on an **RTX 3050 4GB** laptop GPU | Yes, comfortably |
| ALIKED + LightGlue (hard-case pairs only) | ~2–3 GB | Yes |
| OpenMVS dense reconstruction (DensifyPointCloud, resolution capped) | 3–5 GB, tune resolution-level down | Yes, with tuning |
| SAM2 (base checkpoint, not large) | ~3–4 GB | Yes, alone — tight if concurrent with MVS |
| Depth Anything V2 (small/base variant) | ~2–3 GB | Yes |
| Gaussian Splatting / Nerfstudio Splatfacto (secondary visual branch) | ~6 GB normal, ~12 GB large variant | **Normal model only, and not concurrently with MVS/SAM2** |
| Local LLM for JARVIS (e.g., quantized Llama-3-8B Q4) | ~5–6 GB | Only if nothing else GPU-heavy is running at the same time |

**Implication:** you cannot run everything simultaneously on 8GB. The pipeline must be **staged sequentially** (matching → SfM → MVS → mesh → semantic pass → optional splat render), releasing VRAM between stages, not holding every model resident at once. For the JARVIS LLM step specifically, plan for **two modes**: a cloud API call (fast, no local VRAM cost, but needs venue internet — unverified) and a small local quantized fallback (works offline, but competes for VRAM with the splat branch — so disable the splat branch when running the LLM locally). Confirm venue internet access as an open risk item.

**Recommendation:** during the actual judged demo run, **disable the Gaussian Splatting visual branch** and keep it for your pitch video / poster / backup slides only. Show it as "here's what this looks like as a photorealistic render" on a pre-baked scene, but let the *live* run on unseen data focus entirely on the measurable mesh + accuracy/completeness reporting — that's where 70% of your score lives anyway.

---

## 3. Official Requirement Recap

| Parameter | Target |
|---|---|
| Reconstruction type | 3D Mesh / Point Cloud |
| Processing time | **< 15 min for a 10-min video** |
| Spatial accuracy | **≤ 1 m** |
| Coverage | Entire visible scene |
| Output formats | OBJ, PLY, LAS, GeoTIFF, .glb/.gltf, .fbx |
| Visualization | Web-based or desktop viewer |

**Evaluation weighting:** Accuracy 30% · Completeness 20% · Speed 20% · Innovation 15% · Scalability 10% · **UI 5%**.

**Mandatory inputs:** drone video (1080p/4K), GPS coordinates, flight metadata.
**Optional inputs:** IMU, barometric altitude, camera intrinsics, RTK/PPK.

---

## 4. Final Reconciled Architecture

```
SINGLE CONTINUOUS UAV FLIGHT
        │
        ▼
┌─────────────────────┐     ┌──────────────────────┐
│   Video (1080p/4K)   │     │  Telemetry (SRT/GPS)  │
│   FFmpeg decode      │     │  IMU / barometer opt. │
└──────────┬───────────┘     └───────────┬──────────┘
           └──────────────┬──────────────┘
                          ▼
              Timestamp / GPS synchronizer
           (adapted from telemetry-frame-mapper)
                          │
                          ▼
              Adaptive keyframe selection
    (blur, exposure, feature count, GPS spacing, angle change)
              18,000 frames → ~500–1,500 keyframes
                          │
                          ▼
        ┌─────────────────────────────────┐
        │   Feature extraction + matching  │
        │   Default: SIFT/PySIFT +         │
        │   sequential matching (GLOMAP or │
        │   COLMAP)                        │
        │   Hard pairs only: ALIKED +      │
        │   LightGlue                      │
        └────────────────┬─────────────────┘
                          ▼
              SfM (GLOMAP, GPS/RTK pose priors)
                          │
                          ▼
                 Sparse 3D model + poses
                          │
              ┌───────────┴────────────┐
              ▼                        ▼
     OpenMVS dense MVS         Nerfstudio Splatfacto
     (authoritative geometry)  (secondary visual branch,
              │                 optional, disabled during
              ▼                 live 8GB demo run)
      Dense point cloud
              │
              ▼
      Mesh + texture (Open3D / OpenMVS refine+texture)
              │
              ▼
      Georeferencing (WGS84 → UTM → local ENU)
              │
        ┌─────┴─────┐
        ▼           ▼
  Accuracy/       Semantic AI
  completeness    (SAM2 masks, object
  engine          detection, dynamic-
  (RMSE,          object removal)
  coverage %,           │
  confidence map) ◄─────┘
        │
        ▼
  Digital twin data model
  (LAS/LAZ + GLB + GeoTIFF + 3D Tiles + object metadata)
        │
        ▼
  CesiumJS viewer (rotate/pan/zoom/measure/layers)
        │
        ▼
  JARVIS layer (Whisper → LLM → fixed tool schema →
  spatial engine → response). LLM never computes geometry.
```

---

## 5. Component Decisions

| Layer | Chosen | Why | Alternative | Trade-off |
|---|---|---|---|---|
| Geotagging | telemetry-frame-mapper | Only repo in your list that's a complete, released, working video→GPS-EXIF pipeline | Write from scratch | No reason to; adapt, don't rebuild |
| Feature extraction | PySIFT (GPU-resident SIFT) | Verified real, MIT-licensed, recent (2026) tool; authors benchmark it on a 4GB laptop GPU, so it fits your 8GB demo machine comfortably | OpenCV SIFT (CPU) | CPU SIFT is a PCIe/CPU bottleneck for video-scale frame counts |
| Global SfM | GLOMAP | Verified real (ETH Zürich/COLMAP team); global (not incremental) SfM avoids COLMAP's quadratic blow-up on long video sequences; drop-in with COLMAP database format | Standard COLMAP incremental mapper | COLMAP incremental is more mature/documented; keep as fallback if GLOMAP integration stalls |
| Hard-case matching | ALIKED + LightGlue, selectively | Used only where sequential/SIFT matching fails (trajectory gaps, turns, weak texture) | LightGlue on every pair | All-pairs LightGlue adds GPU cost with no proven end-to-end benefit for easy pairs |
| Dense reconstruction | OpenMVS | Produces actual measurable mesh + texture, the PS's real requirement | Nerfstudio/Gaussian Splatting as primary | Splats have no solid topology — can't reliably export OBJ/PLY/LAS from them |
| Point/mesh cleanup | Open3D | MIT, mature, fast for cleanup/downsampling/Poisson | Custom code | No reason to reinvent |
| Point-cloud I/O | PDAL / Laspy | Standard, streaming-capable, handles LAS/LAZ natively | Manual parsing | Manual is slower and error-prone |
| Georeferencing | WGS84 → UTM → local ENU | COLMAP/GLOMAP support GPS-EXIF pose priors with configurable uncertainty; matches PS's mandatory-GPS/optional-RTK structure | Raw lat/lon math | Raw lat/lon breaks metric distance calculations |
| Semantic AI | SAM2 (base checkpoint) | Fits 8GB budget; masks feed both dynamic-object removal and semantic 3D layer | Full segmentation transformer | Larger models don't fit demo VRAM budget alongside the rest of the pipeline |
| Secondary visual branch | Nerfstudio Splatfacto | Apache-2.0, initializes from your existing SfM poses, best licensing/engineering fit if you want the photorealistic wow-factor | Original Graphdeco 3DGS | Original is non-commercial-licensed — avoid for a project you'll present/distribute |
| Viewer | CesiumJS + 3D Tiles | Native geospatial coordinates, WGS84/UTM, streaming for large scenes, proven by gods-eye-view in production | Three.js / Unity / Unreal | Three.js lacks built-in geospatial tiling; Unity/Unreal are steep learning curves for your team's timeline |
| MVP point-cloud viewer | Potree | Fast to stand up, good for early milestones before Cesium integration is done | Skip straight to Cesium | Cesium integration takes longer; Potree de-risks early demos |
| Voice/agent | Whisper (speech-to-text) + LLM with fixed tool schema | LLM never invents numbers; all measurements come from the geometry engine | LLM computes answers directly | Direct LLM computation is exactly the kind of unverifiable claim judges will probe |

---

## 6. The Differentiator: Observed / Inferred / Unknown

This is the strongest, most judge-resistant idea across every source document, and it directly answers the PS's own "Key Challenges" list (limited viewing angles, occlusion, reconstruction of occluded surfaces).

Every reconstructed surface gets tagged:
- **OBSERVED** — seen by the camera, has real supporting views and triangulation
- **INFERRED** — filled in by AI (if you choose to do this at all) — clearly and separately marked, never presented as measured fact
- **UNKNOWN** — never seen; explicitly shown as a gap, not hidden

Paired with a **completeness/confidence map** (green = well-reconstructed, yellow = low-confidence, red = unobserved), this turns "the model looks incomplete in places" from a weakness into "the system knows and reports exactly what it does and doesn't know" — a real, defensible engineering claim rather than a hidden flaw.

Accuracy reporting should always cite actual metres (e.g., `RMSE_3D = 0.43 m`), never a bare percentage like "99% accurate" without a defined metric.

---

## 7. Team Plan (Adjusted for Your Actual Team)

Your team is 1-2 strong coders plus idea-contributors — not the 6-person specialist breakdown some of the source documents assumed. Realistic allocation:

- **Strong coder(s)**: own the geometry pipeline end-to-end (telemetry sync → keyframe selection → GLOMAP/COLMAP → OpenMVS → georeferencing → accuracy/completeness engine). This is the 70%-of-score core and should get the majority of coding time.
- **Idea-contributors**: own things that don't require deep CV/graphics expertise — CesiumJS viewer styling and HUD/theming (mostly CSS/JS glue on top of a working viewer), demo scenario planning and flight-path design, the JARVIS tool-schema definitions (a fixed, small set of functions — not the underlying geometry math), pitch deck, evaluation methodology write-up, and testing/QA against the accuracy benchmarks.
- **Gaussian Splatting / Nerfstudio branch**: treat as a stretch goal assigned only once the core pipeline is proven — don't let it compete for your strongest coder's time early on.

---

## 8. Phased Roadmap

**Phase 1 — Core pipeline (foundation).** Video decode, telemetry sync (adapted from telemetry-frame-mapper), basic keyframe selection, COLMAP baseline (video → sparse 3D). No JARVIS, no semantic AI yet. Validate on the Threadripper first, then confirm it still runs within budget on the 8GB laptop.

**Phase 2 — Dense reconstruction.** Add OpenMVS, Open3D cleanup, mesh + texture, LAS/PLY/GLB export. Deliverable: video → textured 3D model.

**Phase 3 — Geospatial correctness.** WGS84/UTM georeferencing, GPS pose priors, RTK/PPK support if available, checkpoint-based accuracy validation. Deliverable: measured metric accuracy (report real RMSE, not a guessed percentage).

**Phase 4 — Speed + intelligence.** Swap in GLOMAP and PySIFT for speed, add selective LightGlue for hard pairs, SAM2 dynamic-object masking, completeness/confidence engine. Deliverable: pipeline that hits the 15-minute budget on the 8GB laptop with real, unfamiliar test footage.

**Phase 5 — Digital twin + viewer.** 3D Tiles export, CesiumJS viewer, measurement tools, layer toggles, confidence-map overlay. Deliverable: an actual explorable geospatial digital twin, not just a static model.

**Phase 6 — JARVIS + polish.** Whisper + LLM + fixed tool schema, voice/text query interface, optional Gaussian Splatting visual branch (demo-video only), final speed optimization and rehearsal on the exact demo laptop.

Test on the 8GB laptop starting in Phase 1, not just at the end — that's the machine your score depends on.

---

## 9. Explicitly Out of Scope for MVP

Custom SLAM, custom NeRF from scratch, custom MVS algorithm, real-time (sub-minute) reconstruction, a mobile app, Unreal/Unity, full autonomous drone flight control, training a custom neural keyframe selector. These are scope traps relative to a <15-minute, ≤1m-accuracy, 4–6 month, small-team target.

---

## 10. Risks and Open Questions to Resolve Early

1. **Venue hardware for the live/judging round** — confirm whether SIH provides processing hardware or teams run on their own laptops. This determines whether the 8GB RTX 4060 is really your hard ceiling.
2. **Venue internet access** — determines whether your JARVIS LLM step can call a cloud API or must run a local quantized model.
3. **RTK/PPK access** — ordinary consumer drone GPS won't reliably hit ≤1m *absolute* accuracy on its own; confirm whether you have access to an RTK-capable drone or will rely on GCPs/checkpoints for validation instead.
4. **AGPL licensing** — OpenMVS, ODM, NodeODM, WebODM are all AGPL-3.0. Fine for a competition build, but don't blindly redistribute/commercialize without checking compliance later.
5. **15-minute budget** — must be proven empirically on your actual demo hardware with real footage, not assumed from any document's estimate (all of them, correctly, decline to promise a number without benchmarking).

---

## 11. Final Decisions, Explicitly

- **Should you build it?** Yes.
- **Is single-pass realistic?** Yes, with a deliberately designed oblique corridor/perimeter flight path, not an arbitrary trajectory.
- **Can ≤1m accuracy be achieved?** Plausibly, especially with RTK/PPK or checkpoint validation. Don't advertise it as guaranteed with ordinary GPS alone — report measured RMSE instead.
- **Can <15-minute processing be achieved?** Ambitious but plausible on a controlled keyframe count and tuned MVS resolution — must be benchmarked on the actual 8GB demo laptop, not assumed.
- **Should you use COLMAP/GLOMAP?** Yes — this is the core of the system.
- **Should you use LightGlue?** Yes, selectively, for hard pairs only.
- **Should you use Gaussian Splatting?** Yes, as an optional secondary visual branch — never as your authoritative measurement geometry, and disabled during the live 8GB judged run.
- **What should be removed?** Everything in Section 9.
- **Strongest novelty?** Confidence-aware, honesty-first reconstruction — a system that explicitly reports what it observed, what it inferred, and what it simply never saw.
