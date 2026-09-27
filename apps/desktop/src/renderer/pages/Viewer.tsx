import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiBaseSync } from "../api";
import Button from "../components/Button";
import Header from "../components/Header";
import MeasurementTools from "../components/MeasurementTools";
import ThreeViewer, { type MeasureResult } from "../components/ThreeViewer";
import { useProject } from "../hooks/useProject";

export default function Viewer() {
  const { id } = useParams();
  const nav = useNavigate();
  const { job } = useProject(id);
  const [tool, setTool] = useState<"orbit" | "distance" | "volume" | "polygon" | "screenshot">("orbit");
  const [layers, setLayers] = useState({ mesh: true, ortho: false, cloud: false, dem: false });
  const [coords, setCoords] = useState("—");
  const [measure, setMeasure] = useState<MeasureResult>(null);

  const modelUrl = useMemo(() => {
    if (!id || !job?.hasModel) return null;
    return `${apiBaseSync()}/jobs/${id}/assets/model.glb`;
  }, [id, job?.hasModel]);

  const onCoords = useCallback((t: string) => setCoords(t), []);
  const onMeasure = useCallback((r: MeasureResult) => setMeasure(r), []);

  function screenshot() {
    const canvas = document.querySelector("canvas");
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${job?.name || "model"}-view.png`;
    a.click();
  }

  return (
    <>
      <Header />
      <main className="page" style={{ padding: 0 }}>
        <div className="row" style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-light)", justifyContent: "space-between" }}>
          <strong>{job?.name || id}</strong>
          <div className="row">
            <Button onClick={() => nav("/projects")}>Projects</Button>
            {id && job?.hasModel && (
              <>
                <a className="btn btn-secondary" href={`${apiBaseSync()}/jobs/${id}/assets/model.glb`}>Download GLB</a>
                <a className="btn btn-secondary" href={`${apiBaseSync()}/jobs/${id}/assets/model.laz`}>LAZ</a>
                <a className="btn btn-secondary" href={`${apiBaseSync()}/jobs/${id}/assets/orthophoto.tif`}>GeoTIFF</a>
              </>
            )}
            <Button onClick={screenshot}>Print / screenshot</Button>
          </div>
        </div>
        <div className="viewer-layout" style={{ display: "grid", gridTemplateColumns: "280px 1fr", height: "calc(100vh - 110px)" }}>
          <div style={{ padding: 16, borderRight: "1px solid var(--border-light)", overflow: "auto" }}>
            <MeasurementTools
              tool={tool}
              onTool={(t) => {
                if (t === "screenshot") screenshot();
                else setTool(t);
              }}
              layers={layers}
              onLayer={(k, v) => setLayers((prev) => ({ ...prev, [k]: v }))}
              coords={coords}
              info={{ georef: job && job.geotagged > 0 ? "GPS EXIF present (~2–5 m)" : "Relative / no GPS" }}
            />
          </div>
          <div style={{ position: "relative", background: "var(--bg-tertiary)" }}>
            <ThreeViewer
              modelUrl={modelUrl}
              meshVisible={layers.mesh}
              measuring={tool === "distance"}
              onCoords={onCoords}
              onMeasure={onMeasure}
            />
          </div>
        </div>
        <div style={{ padding: "8px 16px", borderTop: "1px solid var(--border-light)" }} className="muted">
          {measure
            ? `Distance: ${measure.distance.toFixed(2)} m (model units) · ΔY ${(measure.b.y - measure.a.y).toFixed(2)}`
            : "Select Distance, then click two points on the mesh."}
        </div>
      </main>
    </>
  );
}
