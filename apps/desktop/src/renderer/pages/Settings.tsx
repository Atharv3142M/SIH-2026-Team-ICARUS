import { useEffect, useState } from "react";
import { fetchJson, type SystemStatus } from "../api";
import Button from "../components/Button";
import Card from "../components/Card";
import Header from "../components/Header";
import { useTheme, type Theme } from "../hooks/useTheme";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  const [font, setFont] = useState(localStorage.getItem("dt-font") || "normal");
  const [preset, setPreset] = useState(localStorage.getItem("dt-preset") || "balanced");
  const [fps, setFps] = useState(localStorage.getItem("dt-fps") || "3");
  const [blur, setBlur] = useState(localStorage.getItem("dt-blur") || "40");
  const [sys, setSys] = useState<SystemStatus | null>(null);

  useEffect(() => {
    document.documentElement.dataset.font = font;
    localStorage.setItem("dt-font", font);
    localStorage.setItem("dt-preset", preset);
    localStorage.setItem("dt-fps", fps);
    localStorage.setItem("dt-blur", blur);
  }, [font, preset, fps, blur]);

  useEffect(() => {
    void fetchJson<SystemStatus>("/system/status").then(setSys).catch(() => setSys(null));
  }, []);

  return (
    <>
      <Header />
      <main className="page">
        <div className="container" style={{ maxWidth: 760 }}>
          <h1>Settings</h1>
          <Card>
            <h2>Appearance</h2>
            {(["light", "dark", "auto"] as Theme[]).map((t) => (
              <label key={t} className="radio">
                <input type="radio" checked={theme === t} onChange={() => setTheme(t)} /> {t}
              </label>
            ))}
            <h2>Font size</h2>
            {["small", "normal", "large"].map((f) => (
              <label key={f} className="radio">
                <input type="radio" checked={font === f} onChange={() => setFont(f)} /> {f}
              </label>
            ))}
          </Card>
          <div style={{ height: 12 }} />
          <Card>
            <h2>Processing defaults</h2>
            {["fast", "balanced", "high", "ultra"].map((p) => (
              <label key={p} className="radio">
                <input type="radio" checked={preset === p} onChange={() => setPreset(p)} /> {p}
              </label>
            ))}
            <label className="field">Frame extraction FPS (sent with new jobs)
              <input type="number" step="0.5" min="0.5" max="5" value={fps} onChange={(e) => setFps(e.target.value)} />
            </label>
            <label className="field">Blur threshold (sent with new jobs)
              <input type="number" value={blur} onChange={(e) => setBlur(e.target.value)} />
            </label>
          </Card>
          <div style={{ height: 12 }} />
          <Card>
            <h2>System</h2>
            <p className="muted">FFmpeg: {sys?.ffmpeg?.detected ? sys.ffmpeg.version ?? sys.ffmpeg.path : "Not found"}</p>
            <p className="muted">Docker: {sys?.docker.ok ? `Running (${sys.docker.version || "ok"})` : "Not running"}</p>
            <p className="muted">NodeODM: {sys?.nodeodm.ok ? sys.nodeodm.url : "Disconnected"}</p>
            <p className="muted">GPU: {sys?.gpuAvailable ? sys.gpuName : "Unavailable"}</p>
            <p className="muted">Disk: {sys ? `${sys.diskUsedGb} / ${sys.diskTotalGb} GB` : "—"}</p>
          </Card>
          <div style={{ height: 12 }} />
          <Card>
            <h2>About</h2>
            <p className="muted">posEye 0.1.0 · SIH26158 · Team ICARUS</p>
            <p className="muted">Local processing only. Imagery never leaves this machine.</p>
            <Button onClick={() => window.open("https://github.com/OpenDroneMap/ODM")}>OpenDroneMap docs</Button>
          </Card>
        </div>
      </main>
    </>
  );
}
