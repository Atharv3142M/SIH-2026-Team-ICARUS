import Button from "./Button";

type Tool = "orbit" | "distance" | "volume" | "polygon" | "screenshot";

export default function MeasurementTools({
  tool,
  onTool,
  layers,
  onLayer,
  coords,
  info,
}: {
  tool: Tool;
  onTool: (t: Tool) => void;
  layers: { mesh: boolean; ortho: boolean; cloud: boolean; dem: boolean };
  onLayer: (key: keyof typeof layers, value: boolean) => void;
  coords: string;
  info: { verts?: string; faces?: string; georef?: string };
}) {
  return (
    <aside className="stack" style={{ width: 260, flexShrink: 0 }}>
      <h2>Tools</h2>
      {(["distance", "volume", "polygon", "screenshot"] as Tool[]).map((t) => (
        <Button key={t} variant={tool === t ? "primary" : "secondary"} onClick={() => onTool(tool === t ? "orbit" : t)}>
          {t === "distance" ? "Distance" : t === "volume" ? "Volume" : t === "polygon" ? "Polygon" : "Screenshot"}
        </Button>
      ))}
      <h2>Layers</h2>
      <label className="check"><input type="checkbox" checked={layers.mesh} onChange={(e) => onLayer("mesh", e.target.checked)} /> Mesh</label>
      <label className="check"><input type="checkbox" checked={layers.ortho} disabled onChange={(e) => onLayer("ortho", e.target.checked)} /> Orthophoto</label>
      <label className="check"><input type="checkbox" checked={layers.cloud} disabled onChange={(e) => onLayer("cloud", e.target.checked)} /> Point cloud</label>
      <label className="check"><input type="checkbox" checked={layers.dem} disabled onChange={(e) => onLayer("dem", e.target.checked)} /> DEM</label>
      <h2>Model info</h2>
      <p className="muted">Vertices: {info.verts ?? "—"}</p>
      <p className="muted">Faces: {info.faces ?? "—"}</p>
      <p className="muted">Georef: {info.georef ?? "Relative unless EXIF GPS was present"}</p>
      <h2>Coordinates</h2>
      <p className="muted" style={{ fontFamily: "Consolas, monospace" }}>{coords}</p>
    </aside>
  );
}
