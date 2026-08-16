/**
 * Pod preload — runs in the renderer with sandbox=true.
 *
 * Receives the per-install API token from the main process via
 * webPreferences.additionalArguments and exposes it to the renderer through
 * contextBridge. The cockpit's main.tsx installs a fetch wrapper that reads
 * window.coffeePod.token and adds an Authorization header to every same-origin
 * request — so the local API can require auth without breaking the cockpit.
 */
const { contextBridge, ipcRenderer } = require('electron');

function extractTokenArg() {
  const prefix = '--coffee-pod-token=';
  for (const arg of process.argv) {
    if (typeof arg === 'string' && arg.startsWith(prefix)) {
      return arg.slice(prefix.length);
    }
  }
  return null;
}

const token = extractTokenArg();

contextBridge.exposeInMainWorld('coffeePod', {
  token,
  // Marker the UI can use to detect Electron without reading user agent.
  packagedShell: true,
  openInDefaultApp: (filename, content) =>
    ipcRenderer.invoke('open-in-default-app', filename, content),
  chooseBackupDestination: (suggestedName) =>
    ipcRenderer.invoke('choose-backup-destination', suggestedName),
  chooseBackupSource: () => ipcRenderer.invoke('choose-backup-source'),
  restart: () => ipcRenderer.invoke('restart-coffee-pod'),
});
