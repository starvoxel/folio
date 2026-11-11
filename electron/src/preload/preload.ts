// Sandboxed preload: only `electron` may be required here. Keep it tiny.
import { contextBridge, ipcRenderer } from 'electron';

const bridge = {
  getConfig: () => ipcRenderer.invoke('folio:get-config'),
  loadData: () => ipcRenderer.invoke('folio:load-data'),
};
contextBridge.exposeInMainWorld('folio', Object.freeze(bridge));
