export type Job = {
  id: string;
  name: string;
  description: string;
  stage: string;
  percent: number;
  message: string;
  error: string | null;
  errorCode?: string | null;
  geotagged: number;
  frameCount: number;
  preset: string;
  hasModel: boolean;
  createdAt: string;
  updatedAt?: string;
  videoPath: string;
  extract?: {
    rawFrames?: number;
    retainedFrames?: number;
    droppedBlur?: number;
    droppedDuplicates?: number;
    geotaggedFrames?: number;
    masksGenerated?: number;
    duration?: number | null;
    fps?: number | null;
    resolution?: string | null;
  };
  assets?: { glb?: boolean; laz?: boolean; orthophoto?: boolean };
};

export type SystemStatus = {
  cpuPercent: number;
  ramUsedGb: number;
  ramTotalGb: number;
  ramPercent: number;
  diskUsedGb: number;
  diskFreeGb?: number;
  diskTotalGb: number;
  docker: { ok: boolean; version: string };
  nodeodm: { ok: boolean; url: string };
  ffmpeg?: { detected: boolean; path: string | null; version: string | null };
  gpuAvailable?: boolean;
  gpuName?: string;
  gpuUtilization?: number;
  gpuMemoryUsed?: number;
  gpuMemoryTotal?: number;
};

declare global {
  interface Window {
    dt?: {
      pickVideo: () => Promise<string | null>;
      pickSrt: () => Promise<string | null>;
      pickGlb: () => Promise<string | null>;
      env: () => Promise<{ apiBase: string; packaged: boolean }>;
      pathForFile: (file: File) => string;
    };
  }
}

let cachedBase = "http://127.0.0.1:8765";

export async function apiBase(): Promise<string> {
  if (window.dt?.env) {
    const env = await window.dt.env();
    cachedBase = env.apiBase;
  }
  return cachedBase;
}

export function apiBaseSync(): string {
  return cachedBase;
}

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const base = await apiBase();
  const res = await fetch(`${base}${path}`, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}