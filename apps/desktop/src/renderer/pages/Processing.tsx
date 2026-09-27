import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchJson } from "../api";
import Button from "../components/Button";
import Card from "../components/Card";
import Header from "../components/Header";
import ProgressBar from "../components/ProgressBar";
import { useProject } from "../hooks/useProject";
import { useJobEvents } from "../hooks/useWebSocket";

const STAGES = [
  { id: "queued", label: "Input validation" },
  { id: "extracting", label: "Extracting frames" },
  { id: "reconstructing", label: "Building geometry" },
  { id: "converting", label: "Finalizing output" },
  { id: "ready", label: "Ready" },
];

export default function Processing() {
  const { id } = useParams();
  const nav = useNavigate();
  const { job, refresh } = useProject(id);
  const { events, latest } = useJobEvents(id);
  const stage = latest?.stage ?? job?.stage ?? "queued";
  const percent = latest?.percent ?? job?.percent ?? 0;
  const message = latest?.message ?? job?.message ?? "Waiting";

  useEffect(() => {
    if (stage === "ready" && id) nav(`/viewer/${id}`, { replace: true });
  }, [stage, id, nav]);

  async function cancel() {
    if (!id) return;
    await fetchJson(`/jobs/${id}/cancel`, { method: "POST" });
    await refresh();
  }

  const order = STAGES.map((s) => s.id);
  const idx = Math.max(0, order.indexOf(stage === "error" ? "queued" : stage));

  return (
    <>
      <Header />
      <main className="page">
        <div className="container">
          <h1>Processing {job?.name || id}</h1>
          <Card>
            <ProgressBar percent={percent} label={message} />
            {stage === "error" && <p style={{ color: "var(--error)" }}>{latest?.message || job?.error}</p>}
            <ul className="timeline">
              {STAGES.map((s, i) => {
                const cls = stage === "error" && i === idx ? "current" : i < idx ? "done" : i === idx ? "current" : "";
                return (
                  <li key={s.id} className={cls}>
                    <span>{i < idx ? "done" : i === idx ? "current" : "pending"}</span>
                    <span>{s.label}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
          <div style={{ height: 12 }} />
          <div className="grid-3">
            <Card>
              <h2>Stage details</h2>
              <p className="muted">Frames kept: {job?.frameCount ?? "—"}</p>
              <p className="muted">Geotagged: {job?.geotagged ?? "—"}</p>
              <p className="muted">Preset: {job?.preset ?? "—"}</p>
            </Card>
            <Card>
              <h2>Live log</h2>
              <div className="logbox">
                {events.map((e, i) => (
                  <div key={i}>{e.ts.slice(11, 19)} {e.stage} — {e.message}</div>
                ))}
              </div>
            </Card>
          </div>
          <div className="actions">
            <Button variant="danger" onClick={() => void cancel()}>Cancel</Button>
            <Button onClick={() => nav("/dashboard")}>Dashboard</Button>
          </div>
        </div>
      </main>
    </>
  );
}
