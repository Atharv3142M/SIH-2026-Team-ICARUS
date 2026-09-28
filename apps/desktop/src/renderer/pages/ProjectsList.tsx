import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiBaseSync, fetchJson } from "../api";
import Button from "../components/Button";
import Card from "../components/Card";
import Header from "../components/Header";
import StatusBadge from "../components/StatusBadge";
import { useProjects } from "../hooks/useProject";

export default function ProjectsList() {
  const nav = useNavigate();
  const { jobs, refresh } = useProjects();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [shown, setShown] = useState(8);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (filter === "ready" && j.stage !== "ready") return false;
      if (filter === "error" && j.stage !== "error") return false;
      if (q && !(`${j.name} ${j.id}`).toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [jobs, q, filter]);

  async function remove(id: string) {
    await fetchJson(`/jobs/${id}`, { method: "DELETE" });
    await refresh();
  }

  async function download(id: string, asset: string) {
    const url = `${apiBaseSync()}/jobs/${id}/assets/${asset}`;
    window.open(url, "_blank");
  }

  return (
    <>
      <Header />
      <main className="page">
        <div className="container">
          <h1>Projects</h1>
          <div className="row" style={{ marginBottom: 16 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" style={{ minWidth: 240 }} />
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">All</option>
              <option value="ready">Completed</option>
              <option value="error">Failed</option>
            </select>
            <Button variant="primary" onClick={() => nav("/projects/new")}>New project</Button>
          </div>
          {filtered.slice(0, shown).map((j) => (
            <Card key={j.id} className="" >
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{j.name || j.id}</strong>
                <StatusBadge stage={j.stage} />
              </div>
              <p className="muted">{j.preset} · frames {j.frameCount} · {j.message}</p>
              <div className="row">
                <Button variant="primary" onClick={() => nav(j.stage === "ready" ? `/viewer/${j.id}` : `/processing/${j.id}`)}>View</Button>
                {j.hasModel && (
                  <Button onClick={() => void download(j.id, "model.glb")}>Export GLB</Button>
                )}
                {j.assets?.laz && (
                  <Button onClick={() => void download(j.id, "model.laz")}>Export LAZ</Button>
                )}
                {j.assets?.orthophoto && (
                  <Button onClick={() => void download(j.id, "orthophoto.tif")}>Export GeoTIFF</Button>
                )}
                {j.stage === "error" && <Button onClick={() => nav("/projects/new")}>Retry</Button>}
                <Button variant="danger" onClick={() => void remove(j.id)}>Delete</Button>
              </div>
            </Card>
          ))}
          {shown < filtered.length && (
            <div className="actions"><Button onClick={() => setShown((n) => n + 8)}>Load more</Button></div>
          )}
        </div>
      </main>
    </>
  );
}
