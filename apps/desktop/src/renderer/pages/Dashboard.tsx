import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchJson, type SystemStatus } from "../api";
import Button from "../components/Button";
import Card from "../components/Card";
import Header from "../components/Header";
import StatusBadge from "../components/StatusBadge";
import { useProjects } from "../hooks/useProject";

export default function Dashboard() {
  const nav = useNavigate();
  const { jobs } = useProjects();
  const [sys, setSys] = useState<SystemStatus | null>(null);

  useEffect(() => {
    void fetchJson<SystemStatus>("/system/status").then(setSys).catch(() => setSys(null));
  }, []);

  const done = jobs.filter((j) => j.stage === "ready");
  const failed = jobs.filter((j) => j.stage === "error");
  const recent = jobs.slice(0, 5);
  const rate = jobs.length ? Math.round((done.length / jobs.length) * 100) : 0;

  return (
    <>
      <Header />
      <main className="page">
        <div className="container">
          <h1>posEye</h1>
          <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>Single-pass drone video to 3D model · local processing</p>
          <div className="grid-3">
            <Card>
              <h2>Quick stats</h2>
              <Stat label="Total projects" value={String(jobs.length)} />
              <Stat label="Completed" value={String(done.length)} />
              <Stat label="Failed" value={String(failed.length)} />
              <Stat label="Success rate" value={`${rate}%`} />
            </Card>
            <Card>
              <h2>Recent projects</h2>
              {recent.length === 0 && <p className="muted">No jobs yet. Start a new project.</p>}
              {recent.map((j) => (
                <Link key={j.id} to={j.stage === "ready" ? `/viewer/${j.id}` : `/processing/${j.id}`} className="stack" style={{ padding: "10px 0", borderBottom: "1px solid var(--border-light)" }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <strong>{j.name || j.id}</strong>
                    <StatusBadge stage={j.stage} />
                  </div>
                  <small className="muted">{j.message}</small>
                </Link>
              ))}
            </Card>
            <Card>
              <h2>System status</h2>
              <Meter label="CPU" pct={sys?.cpuPercent ?? 0} text={`${Math.round(sys?.cpuPercent ?? 0)}%`} />
              <Meter label="RAM" pct={sys?.ramPercent ?? 0} text={`${sys?.ramUsedGb ?? "—"} / ${sys?.ramTotalGb ?? "—"} GB`} />
              <Meter label="Disk" pct={sys ? (sys.diskUsedGb / sys.diskTotalGb) * 100 : 0} text={`${sys?.diskUsedGb ?? "—"} GB used`} />
              <p className="muted">
                GPU:{" "}
                {sys?.gpuAvailable
                  ? `${sys.gpuName ?? "NVIDIA"} · ${Math.round(sys.gpuUtilization ?? 0)}% · ${sys.gpuMemoryUsed}/${sys.gpuMemoryTotal} MiB`
                  : "Unavailable"}
              </p>
              <p className="muted">FFmpeg: {sys?.ffmpeg?.detected ? sys.ffmpeg.version ?? "detected" : "Not found"}</p>
              <p className="muted">Docker: {sys?.docker.ok ? `Running ${sys.docker.version}` : "Not detected"}</p>
              <p className="muted">NodeODM: {sys?.nodeodm.ok ? "Connected" : "Offline"}</p>
            </Card>
          </div>
          <div className="actions">
            <Button variant="primary" onClick={() => nav("/projects/new")}>New project</Button>
            <Button onClick={() => nav("/projects")}>Projects</Button>
            <Button onClick={() => nav("/settings")}>Settings</Button>
          </div>
        </div>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="row" style={{ justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
      <span className="muted">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Meter({ label, pct, text }: { label: string; pct: number; text: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="muted">{label}</span>
        <span>{text}</span>
      </div>
      <div className="resource-bar"><i style={{ width: `${Math.min(100, pct)}%` }} /></div>
    </div>
  );
}
