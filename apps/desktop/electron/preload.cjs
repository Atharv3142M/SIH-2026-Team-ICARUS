const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("dt", {
  pickVideo: () => ipcRenderer.invoke("dialog:video"),
  pickSrt: () => ipcRenderer.invoke("dialog:srt"),
  pickGlb: () => ipcRenderer.invoke("dialog:glb"),
  env: () => ipcRenderer.invoke("env"),
  readFile: (filePath) => ipcRenderer.invoke("read:file", filePath),
  pathForFile: (file) => webUtils.getPathForFile(file),
});
