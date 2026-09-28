const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");
const fs = require("node:fs");

const API_PORT = process.env.DT_PORT || "8765";
const API_BASE = process.env.DT_API || `http://127.0.0.1:${API_PORT}`;
const NODEODM_URL = process.env.NODEODM_URL || "http://127.0.0.1:3000";

let mainWindow = null;
let apiProc = null;

function repoRoot() {
  if (app.isPackaged) return path.dirname(app.getPath("exe"));
  return path.resolve(__dirname, "..", "..", "..");
}

function ffmpegPath() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  if (app.isPackaged) return path.join(process.resourcesPath, "ffmpeg.exe");
  const bundled = path.join(repoRoot(), "third_party", "ffmpeg.exe");
  return fs.existsSync(bundled) ? bundled : "";
}

function pythonCmd() {
  if (process.env.DT_PYTHON) return process.env.DT_PYTHON;
  const venv = path.join(repoRoot(), ".venv", "Scripts", "python.exe");
  if (fs.existsSync(venv)) return venv;
  return "python";
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true, ...opts });
    let out = "";
    let err = "";
    child.stdout?.on("data", (d) => {
      out += d.toString();
    });
    child.stderr?.on("data", (d) => {
      err += d.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(err || out || `${cmd} exited ${code}`));
    });
  });
}

async function virtualizationEnabled() {
  try {
    const out = await run("powershell.exe", [
      "-NoProfile",
      "-Command",
      "(Get-CimInstance Win32_Processor).VirtualizationFirmwareEnabled",
    ]);
    return /true/i.test(out);
  } catch {
    return true;
  }
}

async function dockerAvailable() {
  try {
    await run("docker", ["info"]);
    return true;
  } catch {
    return false;
  }
}

async function waitForUrl(url, ms = 60000, label = "service") {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`${label} did not become ready (${url}).`);
}

async function ensureNodeOdm() {
  if (!(await dockerAvailable())) {
    throw new Error(
      "Docker is not running. Start Docker Desktop, then relaunch posEye. If Docker is not installed, run the posEye installer.",
    );
  }
  const names = ["poseye-nodeodm", "digitaltwin-nodeodm"];
  for (const name of names) {
    try {
      await run("docker", ["start", name]);
      await waitForUrl(`${NODEODM_URL}/info`, 90000, "NodeODM");
      return;
    } catch {
      /* try next */
    }
  }
  const tar = path.join(repoRoot(), "third_party", "nodeodm.tar");
  if (fs.existsSync(tar)) {
    await run("docker", ["load", "-i", tar]);
  }
  try {
    await run("docker", [
      "run",
      "-d",
      "--name",
      "poseye-nodeodm",
      "-p",
      "3000:3000",
      "opendronemap/nodeodm",
    ]);
  } catch (err) {
    const msg = String(err.message || err);
    if (/port is already allocated|bind/i.test(msg)) {
      throw new Error("Port 3000 is already in use. Stop the other process or set NODEODM_URL to that instance.");
    }
    throw new Error("Could not start NodeODM. Confirm Docker is running and the NodeODM image is available.");
  }
  await waitForUrl(`${NODEODM_URL}/info`, 120000, "NodeODM");
}

function startApi() {
  const env = {
    ...process.env,
    DT_PORT: API_PORT,
    NODEODM_URL,
    FFMPEG_PATH: ffmpegPath() || process.env.FFMPEG_PATH || "",
    DT_JOBS_DIR: path.join(app.getPath("userData"), "jobs"),
    PYTHONPATH: [
      path.join(repoRoot(), "apps", "orchestrator", "src"),
      path.join(repoRoot(), "apps", "pipeline", "src"),
      process.env.PYTHONPATH || "",
    ]
      .filter(Boolean)
      .join(path.delimiter),
  };
  apiProc = spawn(pythonCmd(), ["-m", "orchestrator.main"], {
    cwd: path.join(repoRoot(), "apps", "orchestrator"),
    env,
    windowsHide: true,
  });
  apiProc.stdout?.on("data", (d) => console.log("[api]", d.toString()));
  apiProc.stderr?.on("data", (d) => console.error("[api]", d.toString()));
}

async function waitForApi(ms = 20000) {
  await waitForUrl(`${API_BASE}/health`, ms, "posEye orchestrator");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: "#ffffff",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  if (!app.isPackaged) {
    mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(async () => {
  ipcMain.handle("dialog:video", async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: "Select drone video",
      filters: [{ name: "Video", extensions: ["mp4", "mov", "mkv", "avi"] }],
      properties: ["openFile"],
    });
    return res.canceled ? null : res.filePaths[0];
  });
  ipcMain.handle("dialog:srt", async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: "Select telemetry SRT",
      filters: [{ name: "SRT", extensions: ["srt"] }],
      properties: ["openFile"],
    });
    return res.canceled ? null : res.filePaths[0];
  });
  ipcMain.handle("dialog:glb", async () => {
    const res = await dialog.showOpenDialog(mainWindow, {
      title: "Open GLB model",
      filters: [{ name: "glTF Binary", extensions: ["glb"] }],
      properties: ["openFile"],
    });
    return res.canceled ? null : res.filePaths[0];
  });
  ipcMain.handle("env", () => ({
    apiBase: API_BASE,
    packaged: app.isPackaged,
  }));
  ipcMain.handle("read:file", (_e, filePath) => {
    if (!filePath || typeof filePath !== "string") return null;
    return fs.readFileSync(filePath);
  });

  try {
    if (!(await virtualizationEnabled())) {
      await dialog.showMessageBox({
        type: "warning",
        title: "Virtualization disabled",
        message:
          "posEye uses Docker/WSL2, which needs Intel VT-x or AMD-V enabled in BIOS/UEFI. Enable it, reboot, then relaunch. The installer cannot change this firmware setting.",
      });
    }
    await ensureNodeOdm();
    startApi();
    await waitForApi();
  } catch (err) {
    await dialog.showErrorBox("posEye startup", String(err.message || err));
  }
  createWindow();
});

app.on("before-quit", () => {
  if (apiProc && !apiProc.killed) apiProc.kill();
  spawn("docker", ["stop", "poseye-nodeodm", "digitaltwin-nodeodm"], { windowsHide: true });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
