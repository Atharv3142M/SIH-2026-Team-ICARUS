import { useEffect, useRef } from "react";
import {
  AmbientLight,
  Box3,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  GridHelper,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type MeasureResult = { distance: number; a: Vector3; b: Vector3 } | null;

export default function ThreeViewer({
  modelUrl,
  meshVisible,
  measuring,
  onCoords,
  onMeasure,
}: {
  modelUrl: string | null;
  meshVisible: boolean;
  measuring: boolean;
  onCoords: (text: string) => void;
  onMeasure: (result: MeasureResult) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<Group | null>(null);
  const measureRef = useRef<Group | null>(null);
  const measuringRef = useRef(measuring);
  measuringRef.current = measuring;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene = new Scene();
    scene.background = new Color(getComputedStyle(document.documentElement).getPropertyValue("--bg-primary").trim() || "#ffffff");
    const camera = new PerspectiveCamera(50, 1, 0.1, 100000);
    camera.position.set(40, 30, 40);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    const light = new DirectionalLight(0xffffff, 1.05);
    light.position.set(40, 80, 20);
    scene.add(light);
    scene.add(new AmbientLight(0xffffff, 0.5));
    scene.add(new GridHelper(200, 40, 0x9ca3af, 0xe5e7eb));
    const root = new Group();
    const measures = new Group();
    rootRef.current = root;
    measureRef.current = measures;
    scene.add(root, measures);
    const raycaster = new Raycaster();
    const pointer = new Vector2();
    const picks: Vector3[] = [];

    function resize() {
      const w = canvas.clientWidth || canvas.parentElement?.clientWidth || 800;
      const h = canvas.clientHeight || canvas.parentElement?.clientHeight || 600;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const meshes = () => {
      const out: Mesh[] = [];
      root.traverse((o) => {
        if (o instanceof Mesh) out.push(o);
      });
      return out;
    };

    canvas.onpointermove = (ev) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(meshes(), true)[0];
      if (!hit) {
        onCoords("—");
        return;
      }
      const p = hit.point;
      onCoords(`X ${p.x.toFixed(2)}  Y ${p.y.toFixed(2)}  Z ${p.z.toFixed(2)}`);
    };

    canvas.onpointerdown = (ev) => {
      if (!measuringRef.current || ev.button !== 0) return;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(meshes(), true)[0];
      if (!hit) return;
      picks.push(hit.point.clone());
      const m = new Mesh(new SphereGeometry(0.25, 12, 12), new MeshStandardMaterial({ color: 0x2563eb }));
      m.position.copy(hit.point);
      measures.add(m);
      if (picks.length === 2) {
        const geom = new BufferGeometry().setFromPoints([picks[0], picks[1]]);
        measures.add(new Line(geom, new LineBasicMaterial({ color: 0x2563eb })));
        onMeasure({ distance: picks[0].distanceTo(picks[1]), a: picks[0].clone(), b: picks[1].clone() });
        picks.length = 0;
      }
    };

    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });

    (canvas as HTMLCanvasElement & { __frame?: (obj: Group) => void }).__frame = () => {
      const box = new Box3().setFromObject(root);
      if (box.isEmpty()) return;
      const size = box.getSize(new Vector3()).length();
      const center = box.getCenter(new Vector3());
      controls.target.copy(center);
      camera.position.copy(center).add(new Vector3(size * 0.6, size * 0.45, size * 0.6));
      camera.near = size / 1000;
      camera.far = size * 20;
      camera.updateProjectionMatrix();
    };

    return () => {
      ro.disconnect();
      renderer.dispose();
    };
  }, [onCoords, onMeasure]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.visible = meshVisible;
  }, [meshVisible]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !modelUrl) return;
    root.clear();
    measureRef.current?.clear();
    void new GLTFLoader().loadAsync(modelUrl).then((gltf) => {
      gltf.scene.traverse((obj) => {
        if (obj instanceof Mesh && obj.material && "side" in obj.material) obj.material.side = DoubleSide;
      });
      root.add(gltf.scene);
      const canvas = canvasRef.current as HTMLCanvasElement & { __frame?: () => void };
      canvas.__frame?.();
    });
  }, [modelUrl]);

  return <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />;
}
