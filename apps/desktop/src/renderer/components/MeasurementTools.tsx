import Button from "./Button";

type Tool = "orbit" | "distance" | "screenshot";

export default function MeasurementTools({
  tool,
  onTool,
  layers,
  onLayer,
  coords,
  info,
  assets,
}: {
  tool: Tool;
  onTool: (t: Tool) => void;
  layers: { mesh: boolean; ortho: boolean; cloud: boolean; dem: boolean };
  onLayer: (key: keyof typeof layers, value: boolean) => void;
  coords: string;
  info: { verts?: string; faces?: string; georef?: string };
  assets?: { glb?: boolean; laz?: boolean; orthophoto?: boolean };
}) {
  return (
    <aside className="stack" style={{ width: 260, flexShrink: 0 }}>
      <h2>Tools</h2>
      <Button variant={tool === "distance" ? "primary" : "secondary"} onClick={() => onTool(tool === "distance" ? "orbit" : "distance")}>
        Distance
      </Button>
      <Button variant="secondary" onClick={() => onTool("screenshot")}>Screenshot</Button>
      <p className="muted">Area / volume: not implemented (needs DEM).</p>
      <h2>Layers</h2>
      <label className="check">
        <input type="checkbox" checked={layers.mesh} onChange={(e) => onLayer("mesh", e.target.checked)} /> Mesh
      </label>
      <p className="muted">Orthophoto: {assets?.orthophoto ? "available (2D export)" : "Not generated for this project"}</p>
      <p className="muted">Point cloud: {assets?.laz ? "available as LAZ export" : "Not generated for this project"}</p>
      <p className="muted">DEM / hillshade: Not generated for this project</p>
      <h2>Model info</h2>
      <p className="muted">Vertices: {info.verts ?? "—"}</p>
      <p className="muted">Faces: {info.faces ?? "—"}</p>
      <p className="muted">Georef: {info.georef ?? "Relative / unreferenced model"}</p>
      <h2>Coordinates</h2>
      <p className="muted">Model XYZ (not lat/lon unless GPS EXIF was present)</p>
      <p className="muted" style={{ fontFamily: "Consolas, monospace" }}>{coords}</p>
    </aside>
  );
}
