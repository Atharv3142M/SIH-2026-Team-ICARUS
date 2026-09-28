import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchJson } from "../api";
import Button from "../components/Button";
import Card from "../components/Card";
import Header from "../components/Header";
import ProgressBar from "../components/ProgressBar";
import { useProject } from "../hooks/useProject";
import { useJobEvents } from "../hooks/useWebSocket";

const PIPELINE = [
  { id: "queued", label: "Input" },
  { id: "validating", label: "Validate video" },
  { id: "extracting", label: "Frame extraction" },
  { id: "filtering", label: "Filtering" },
  { id: "geotagging", label: "Geotagging" },
  { id: "masking", label: "Masking" },
  { id: "uploading", label: "Upload" },
  { id: "reconstructing", label: "NodeODM reconstruction" },
  { id: "postprocessing", label: "Post-processing" },
  { id: "converting", label: "Convert GLB" },
  { id: "ready", label: "Model ready" },
];

const ORDER = PIPELINE.map((s) => s.id);

function stageIndex(stage: string): number {
  if (stage === "error" || stage === "cancelled") return -1;
  const i = ORDER.indexOf(stage);
  return i >= 0 ? i : 0;
}

export default function Processing() {
  const { id } = useParams();
  const nav = useNavigate();
  const { job, refresh } = useProject(id);
  const { events, latest } = useJobEvents(id);
  const stage = latest?.stage ?? job?.stage ?? "queued";
  const percent = latest?.percent ?? job?.percent ?? 0;
  const message = latest?.message ?? job?.message ?? "Waiting";
  const extract = job?.extract;
  const idx = stageIndex(stage);

  useEffect(() => {
    if (stage === "ready" && id && job?.hasModel) nav(`/viewer/${id}`, { replace: true });
  }, [stage, id, nav, job?.hasModel]);

  async function cancel() {
    if (!id) return;
    await fetchJson(`/jobs/${id}/cancel`, { method: "POST" });
    await refresh();
  }

  return (
    <>
      <Header />
      <main className="page">
        <div className="container">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h1>Processing {job?.name || id}</h1>
            <span className="muted">{id}</span>
          </div>
          <Card>
            <ProgressBar percent={percent} label={message} />
            {(stage === "error" || stage === "cancelled") && (
              <p style={{ color: "var(--error)" }}>
                {job?.errorCode ? `${job.errorCode}: ` : ""}
                {latest?.message || job?.error}
              </p>
            )}
            <ul className="timeline">
              {PIPELINE.map((s, i) => {
                const cls = idx < 0 ? "" : i < idx ? "done" : i === idx ? "current" : "";
                const mark = idx < 0 ? "—" : i < idx ? "done" : i === idx ? "active" : "queued";
                return (
                  <li key={s.id} className={cls}>
                    <span>{mark}</span>
                    <span>{s.label}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
          <div style={{ height: 12 }} />
          <div className="grid-3">
            <Card>
              <h2>Preprocess</h2>
              <p className="muted">Video {extract?.duration != null ? `${extract.duration.toFixed(1)}s` : "—"} · {extract?.resolution ?? "—"}</p>
              <p className="muted">Extracted {extract?.rawFrames ?? "—"} · retained {extract?.retainedFrames ?? job?.frameCount ?? "—"}</p>
              <p className="muted">Blur dropped {extract?.droppedBlur ?? "—"} · dupes {extract?.droppedDuplicates ?? "—"}</p>
              <p className="muted">GPS matched {extract?.geotaggedFrames ?? job?.geotagged ?? 0} / {extract?.retainedFrames ?? job?.frameCount ?? "—"}</p>
              <p className="muted">Masks {extract?.masksGenerated ? `${extract.masksGenerated} generated` : "off"}</p>
            </Card>
            <Card>
              <h2>Live log</h2>
              <div className="logbox">
                {events.map((e, i) => (
                  <div key={i}>
                    {e.ts.slice(11, 19)} {e.stage} — {e.message}
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <div className="actions">
            <Button variant="danger" onClick={() => void cancel()}>Cancel</Button>
            <Button onClick={() => nav("/projects")}>Open project list</Button>
            {stage === "error" && <Button onClick={() => nav("/projects/new")}>Retry from new project</Button>}
          </div>
        </div>
      </main>
    </>
  );
}
