import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchJson, type Job } from "../api";
import Button from "../components/Button";
import Card from "../components/Card";
import Header from "../components/Header";

const PRESETS = [
  { id: "fast", label: "Fast", hint: "5–8 min — lower quality" },
  { id: "balanced", label: "Balanced", hint: "8–12 min — good default" },
  { id: "high", label: "High", hint: "15–30 min — best quality" },
  { id: "ultra", label: "Ultra", hint: "30+ min — maximum detail" },
];

export default function NewProject() {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [videoPath, setVideoPath] = useState("");
  const [srtPath, setSrtPath] = useState("");
  const [preset, setPreset] = useState(localStorage.getItem("dt-preset") || "balanced");
  const [masks, setMasks] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [probe, setProbe] = useState<{ durationS?: number; width?: number; height?: number; fps?: number; sizeBytes?: number; name?: string } | null>(null);

  async function applyVideo(p: string) {
    setVideoPath(p);
    try {
      setProbe(await fetchJson("/probe/video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoPath: p }),
      }));
    } catch {
      setProbe(null);
    }
  }

  async function pickVideo() {
    if (window.dt) {
      const p = await window.dt.pickVideo();
      if (p) await applyVideo(p);
    }
  }

  async function pickSrt() {
    if (window.dt) {
      const p = await window.dt.pickSrt();
      if (p) setSrtPath(p);
    }
  }

  async function start() {
    setError(null);
    setBusy(true);
    try {
      const job = await fetchJson<Job>("/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          description: description || undefined,
          videoPath,
          srtPath: srtPath || null,
          preset,
          generateMasks: masks,
          fps: Number(localStorage.getItem("dt-fps") || "3"),
          blurThreshold: Number(localStorage.getItem("dt-blur") || "40"),
        }),
      });
      nav(`/processing/${job.id}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header />
      <main className="page">
        <div className="container" style={{ maxWidth: 760 }}>
          <h1>New project</h1>
          <Card>
            <h2>Project details</h2>
            <label className="field">Project name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Flight_Inspection_Site_A" />
            </label>
            <label className="field">Description
              <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
          </Card>
          <div style={{ height: 12 }} />
          <Card>
            <h2>Input files</h2>
            <label className="field">Video file (required)
              <div className="row">
                <input style={{ flex: 1 }} value={videoPath} onChange={(e) => setVideoPath(e.target.value)} onBlur={() => videoPath && void applyVideo(videoPath)} placeholder="C:\\path\\flight.mp4" />
                <Button onClick={() => void pickVideo()}>Browse</Button>
              </div>
              {probe && (
                <p className="muted">
                  {probe.name} · {probe.width}×{probe.height} · {probe.fps?.toFixed(1)} fps ·{" "}
                  {probe.durationS != null ? `${probe.durationS.toFixed(1)}s` : ""} ·{" "}
                  {probe.sizeBytes != null ? `${(probe.sizeBytes / 1e6).toFixed(1)} MB` : ""}
                </p>
              )}
            </label>
            <label className="field">Telemetry SRT (optional)
              <div className="row">
                <input style={{ flex: 1 }} value={srtPath} onChange={(e) => setSrtPath(e.target.value)} placeholder="Optional .SRT" />
                <Button onClick={() => void pickSrt()}>Browse</Button>
              </div>
            </label>
          </Card>
          <div style={{ height: 12 }} />
          <Card>
            <h2>Quality preset</h2>
            {PRESETS.map((p) => (
              <label key={p.id} className="radio">
                <input type="radio" name="preset" checked={preset === p.id} onChange={() => setPreset(p.id)} />
                <span><strong>{p.label}</strong> <span className="muted">{p.hint}</span></span>
              </label>
            ))}
            <label className="check" style={{ marginTop: 12 }}>
              <input type="checkbox" checked={masks} onChange={(e) => setMasks(e.target.checked)} />
              Mask moving objects
            </label>
          </Card>
          {error && <p style={{ color: "var(--error)" }}>{error}</p>}
          <div className="actions">
            <Button onClick={() => nav("/dashboard")}>Cancel</Button>
            <Button variant="primary" disabled={!videoPath || busy} onClick={() => void start()}>
              {busy ? "Starting…" : "Start processing"}
            </Button>
          </div>
        </div>
      </main>
    </>
  );
}
