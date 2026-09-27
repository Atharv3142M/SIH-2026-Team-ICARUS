import {
  AxesHelper,
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

export type ViewerApi = {
  loadGlb: (url: string) => Promise<void>;
  setMeshVisible: (v: boolean) => void;
  setMeasure: (on: boolean) => void;
  resetMeasure: () => void;
};

export function createViewer(
  canvas: HTMLCanvasElement,
  onCoords: (text: string) => void,
  onMeasure: (text: string) => void,
): ViewerApi {
  const renderer = new WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new Scene();
  scene.background = new Color(0x0b0d0c);
  const camera = new PerspectiveCamera(50, 1, 0.1, 100000);
  camera.position.set(40, 30, 40);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  const light = new DirectionalLight(0xfff4dd, 1.1);
  light.position.set(40, 80, 20);
  scene.add(light, new AmbientLight(0xb7c4b0, 0.45));
  const grid = new GridHelper(200, 40, 0x3a3d34, 0x22241f);
  scene.add(grid);
  scene.add(new AxesHelper(12));

  const root = new Group();
  scene.add(root);
  const measureGroup = new Group();
  scene.add(measureGroup);

  const raycaster = new Raycaster();
  const pointer = new Vector2();
  let measuring = false;
  const picks: Vector3[] = [];

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  function meshes(): Mesh[] {
    const out: Mesh[] = [];
    root.traverse((obj) => {
      if (obj instanceof Mesh) out.push(obj);
    });
    return out;
  }

  canvas.addEventListener("pointermove", (ev) => {
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
  });

  canvas.addEventListener("pointerdown", (ev) => {
    if (!measuring || ev.button !== 0) return;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(meshes(), true)[0];
    if (!hit) return;
    picks.push(hit.point.clone());
    addMarker(hit.point);
    if (picks.length === 2) {
      const d = picks[0].distanceTo(picks[1]);
      addSegment(picks[0], picks[1]);
      onMeasure(`${d.toFixed(2)} m (model units)`);
      picks.length = 0;
    } else {
      onMeasure("Second point…");
    }
  });

  function addMarker(p: Vector3) {
    const m = new Mesh(
      new SphereGeometry(0.25, 12, 12),
      new MeshStandardMaterial({ color: 0xc4a35a, roughness: 0.4 }),
    );
    m.position.copy(p);
    measureGroup.add(m);
  }

  function addSegment(a: Vector3, b: Vector3) {
    const geom = new BufferGeometry().setFromPoints([a, b]);
    measureGroup.add(new Line(geom, new LineBasicMaterial({ color: 0xc4a35a })));
  }

  function frameObject() {
    const box = new Box3().setFromObject(root);
    if (box.isEmpty()) return;
    const size = box.getSize(new Vector3()).length();
    const center = box.getCenter(new Vector3());
    controls.target.copy(center);
    camera.position.copy(center).add(new Vector3(size * 0.6, size * 0.45, size * 0.6));
    camera.near = size / 1000;
    camera.far = size * 20;
    camera.updateProjectionMatrix();
  }

  async function loadGlb(url: string) {
    root.clear();
    measureGroup.clear();
    picks.length = 0;
    const gltf = await new GLTFLoader().loadAsync(url);
    gltf.scene.traverse((obj) => {
      if (obj instanceof Mesh) {
        const mat = obj.material;
        if (mat && "side" in mat) mat.side = DoubleSide;
      }
    });
    root.add(gltf.scene);
    frameObject();
  }

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });

  return {
    loadGlb,
    setMeshVisible: (v) => {
      root.visible = v;
    },
    setMeasure: (on) => {
      measuring = on;
      canvas.style.cursor = on ? "crosshair" : "default";
    },
    resetMeasure: () => {
      measureGroup.clear();
      picks.length = 0;
      onMeasure("Click two points on the mesh.");
    },
  };
}
