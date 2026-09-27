import { createViewer } from "./viewer";

declare global {
  interface Window {
    dt?: {
      pickVideo: () => Promise<string | null>;
      pickSrt: () => Promise<string | null>;
      pickGlb: () => Promise<string | null>;
      env: () => Promise<{ apiBase: string; packaged: boolean }>;
      readFile: (filePath: string) => Promise<ArrayBuffer | Uint8Array | null>;
      pathForFile: (file: File) => string;
    };
  }
}

async function boot() {
  const env = await window.dt?.env();
  const apiBase = env?.apiBase ?? "http://127.0.0.1:8765";

  const videoName = document.querySelector("#videoName") as HTMLElement;
  const srtName = document.querySelector("#srtName") as HTMLElement;
  const processBtn = document.querySelector("#process") as HTMLButtonElement;
  const progressWrap = document.querySelector("#progressWrap") as HTMLElement;
  const barFill = document.querySelector("#barFill") as HTMLElement;
  const progressLabel = document.querySelector("#progressLabel") as HTMLElement;
  const statusLine = document.querySelector("#statusLine") as HTMLElement;
  const coords = document.querySelector("#coords") as HTMLElement;
  const measureOut = document.querySelector("#measureOut") as HTMLElement;

  let videoPath = "";
  let srtPath = "";
  let measuring = false;

  const viewer = createViewer(
    document.querySelector("#viewport") as HTMLCanvasElement,
    (t) => {
      coords.textContent = t;
    },
    (t) => {
      measureOut.textContent = t;
    },
  );

  function setVideo(p: string) {
    videoPath = p;
    videoName.textContent = p || "No video";
    processBtn.disabled = !p;
  }

  document.querySelector("#pickVideo")!.addEventListener("click", async () => {
    if (window.dt) {
      const p = await window.dt.pickVideo();
      if (p) setVideo(p);
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*";
    input.onchange = () => {
      const f = input.files?.[0];
      if (f) {
        videoName.textContent = `${f.name} (open in Electron to process)`;
        processBtn.disabled = true;
      }
    };
    input.click();
  });

  document.querySelector("#pickSrt")!.addEventListener("click", async () => {
    if (window.dt) {
      const p = await window.dt.pickSrt();
      if (p) {
        srtPath = p;
        srtName.textContent = p;
      }
      return;
    }
    srtName.textContent = "Open in Electron to attach SRT";
  });

  async function loadGlbFromPath(filePath: string) {
    if (!window.dt?.readFile) return;
    const data = await window.dt.readFile(filePath);
    if (!data) return;
    const blob = new Blob([data as BlobPart], { type: "model/gltf-binary" });
    await viewer.loadGlb(URL.createObjectURL(blob));
    statusLine.textContent = "Loaded local GLB";
  }

  document.querySelector("#openGlb")!.addEventListener("click", async () => {
    if (window.dt) {
      const p = await window.dt.pickGlb();
      if (p) await loadGlbFromPath(p);
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".glb";
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const url = URL.createObjectURL(f);
      await viewer.loadGlb(url);
      statusLine.textContent = "Loaded local GLB";
    };
    input.click();
  });

  document.querySelector("#layerMesh")!.addEventListener("change", (ev) => {
    viewer.setMeshVisible((ev.target as HTMLInputElement).checked);
  });

  document.querySelector("#measure")!.addEventListener("click", () => {
    measuring = !measuring;
    viewer.setMeasure(measuring);
    (document.querySelector("#measure") as HTMLButtonElement).textContent = measuring
      ? "Measuring…"
      : "Measure distance";
    if (!measuring) viewer.resetMeasure();
  });

  const panel = document.querySelector("#panel") as HTMLElement;
  panel.addEventListener("dragover", (ev) => {
    ev.preventDefault();
  });
  panel.addEventListener("drop", (ev) => {
    ev.preventDefault();
    const file = ev.dataTransfer?.files[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (window.dt?.pathForFile) {
      const p = window.dt.pathForFile(file);
      if (lower.endsWith(".srt")) {
        srtPath = p;
        srtName.textContent = p;
        return;
      }
      if (lower.endsWith(".glb")) {
        void loadGlbFromPath(p);
        return;
      }
      setVideo(p);
      return;
    }
    videoName.textContent = `${file.name} (open in Electron to process)`;
  });

  async function watchJob(id: string) {
    statusLine.textContent = "Processing";
    const ws = new WebSocket(`${apiBase.replace(/^http/, "ws")}/jobs/${id}/events`);
    ws.onmessage = async (ev) => {
      const data = JSON.parse(ev.data) as {
        stage: string;
        percent: number;
        message: string;
      };
      barFill.style.width = `${data.percent}%`;
      progressLabel.textContent = `${data.stage}: ${data.message}`;
      statusLine.textContent = data.stage;
      if (data.stage === "ready") {
        await viewer.loadGlb(`${apiBase}/jobs/${id}/assets/model.glb`);
        processBtn.disabled = !videoPath;
        ws.close();
      }
      if (data.stage === "error") {
        processBtn.disabled = !videoPath;
        ws.close();
      }
    };
    ws.onerror = () => {
      progressLabel.textContent = "Lost connection to orchestrator";
      processBtn.disabled = !videoPath;
    };
  }

  processBtn.addEventListener("click", async () => {
    progressWrap.hidden = false;
    processBtn.disabled = true;
    const preset = (document.querySelector("#preset") as HTMLSelectElement).value || null;
    const generateMasks = (document.querySelector("#masks") as HTMLInputElement).checked;
    try {
      const res = await fetch(`${apiBase}/jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoPath, srtPath: srtPath || null, preset, generateMasks }),
      });
      if (!res.ok) throw new Error(await res.text());
      const job = await res.json();
      await watchJob(job.id);
    } catch (err) {
      progressLabel.textContent = String(err);
      statusLine.textContent = "Error";
      processBtn.disabled = false;
    }
  });
}

void boot();
