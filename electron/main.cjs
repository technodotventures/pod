const { app, BrowserWindow, dialog, shell, ipcMain } = require('electron');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { probePodRuntime, selectDataHome } = require('./runtime-guards.cjs');

const PORT = process.env.COFFEE_POD_PORT || '8732';
let serverProcess = null;
let logStream = null;
let apiToken = null;

// Keep existing installations on their current data directory after a
// user-facing app rename. New installations use Electron's normal directory.
const defaultUserDataPath = app.getPath('userData');
const legacyUserDataPath = selectDataHome(defaultUserDataPath, [
  path.join(app.getPath('appData'), 'coffee-pod'),
  path.join(app.getPath('appData'), ['Coffee', 'Pod'].join(' ')),
]);
if (legacyUserDataPath !== defaultUserDataPath) app.setPath('userData', legacyUserDataPath);

function ensurePrivateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(directory, 0o700); } catch { /* best effort */ }
}

function podDataDirectory() {
  return path.join(app.getPath('userData'), 'data');
}

/**
 * Auto-provision a per-install API token so the local HTTP server isn't
 * open to anything on the loopback interface. Token is persisted under the
 * Electron userData directory with 0600 so only the owner user can read it.
 */
function loadOrCreateApiToken() {
  if (process.env.COFFEE_POD_API_TOKEN) {
    return process.env.COFFEE_POD_API_TOKEN;
  }
  const dataDir = podDataDirectory();
  const tokenPath = path.join(dataDir, '.coffee-token');
  ensurePrivateDirectory(app.getPath('userData'));
  ensurePrivateDirectory(dataDir);
  try {
    if (fs.existsSync(tokenPath)) {
      const existing = fs.readFileSync(tokenPath, 'utf-8').trim();
      if (existing.length >= 32) {
        try { fs.chmodSync(tokenPath, 0o600); } catch { /* best effort */ }
        return existing;
      }
    }
  } catch {
    // fall through to create a new one
  }
  const token = `cpod_${crypto.randomBytes(32).toString('base64url')}`;
  fs.writeFileSync(tokenPath, token, { mode: 0o600 });
  try { fs.chmodSync(tokenPath, 0o600); } catch { /* best effort */ }
  return token;
}

function appRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app.asar');
  }
  return path.resolve(__dirname, '..');
}

function serverEntry() {
  return path.join(appRoot(), 'dist', 'server.js');
}

function nodeRuntime() {
  return { command: process.execPath, useElectronAsNode: true };
}

function startServer() {
  const entry = serverEntry();
  const dataDir = podDataDirectory();
  const runtime = nodeRuntime();
  ensurePrivateDirectory(app.getPath('userData'));
  ensurePrivateDirectory(dataDir);
  const logPath = path.join(app.getPath('userData'), 'coffee-pod-server.log');
  logStream = fs.createWriteStream(logPath, { flags: 'a', mode: 0o600 });
  try { fs.chmodSync(logPath, 0o600); } catch { /* created asynchronously */ }
  logStream.write(`\n[${new Date().toISOString()}] starting server ${entry} on ${PORT} with ${runtime.command}\n`);

  serverProcess = spawn(runtime.command, [entry], {
    env: {
      ...process.env,
      ...(runtime.useElectronAsNode ? { ELECTRON_RUN_AS_NODE: '1' } : {}),
      COFFEE_POD_HOST: '127.0.0.1',
      COFFEE_POD_PORT: PORT,
      COFFEE_POD_DATA_DIR: dataDir,
      COFFEE_POD_NAME: process.env.COFFEE_POD_NAME || 'Local Pod',
      COFFEE_POD_API_TOKEN: apiToken,
    },
    stdio: app.isPackaged ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

  if (app.isPackaged) {
    serverProcess.stdout?.pipe(logStream);
    serverProcess.stderr?.pipe(logStream);
  }

  serverProcess.on('exit', (code) => {
    logStream?.write(`[${new Date().toISOString()}] server exited with code ${code}\n`);
    if (code && !app.isQuitting) {
      console.error(`Pod server exited with code ${code}`);
    }
  });
}

async function waitForServer() {
  const deadline = Date.now() + 15_000;
  const baseUrl = `http://127.0.0.1:${PORT}`;
  while (Date.now() < deadline) {
    const probe = await probePodRuntime({
      baseUrl,
      token: apiToken,
      expectedDataDir: podDataDirectory(),
    });
    if (probe.ready) return;
    if (probe.reachable) {
      throw new Error(`Port ${PORT} is already serving a different Pod. Close it, then reopen Pod.`);
    }
    if (serverProcess && serverProcess.exitCode !== null) {
      throw new Error(`Pod server exited before it became ready. Check ${path.join(app.getPath('userData'), 'coffee-pod-server.log')}.`);
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('Pod server did not start in time');
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1080,
    minHeight: 720,
    title: 'Pod',
    backgroundColor: '#0b0b0e',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
      // Smuggle the API token to the preload script via process.argv —
      // sandbox-safe and avoids exposing it through env or IPC roundtrips.
      additionalArguments: apiToken ? [`--coffee-pod-token=${apiToken}`] : [],
    },
  });

  // Block in-page navigation to anything other than the local Pod. Combined
  // with the setWindowOpenHandler below, a malicious link in imported content
  // cannot replace the cockpit with an attacker-controlled page.
  win.webContents.on('will-navigate', (event, url) => {
    try {
      const target = new URL(url);
      const expectedOrigin = `http://127.0.0.1:${PORT}`;
      if (target.origin !== expectedOrigin) {
        event.preventDefault();
        shell.openExternal(url);
      }
    } catch {
      event.preventDefault();
    }
  });

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await waitForServer();
  await win.loadURL(`http://127.0.0.1:${PORT}/`);
  if (!win.isVisible()) {
    win.show();
    win.focus();
  }
}

ipcMain.handle('open-in-default-app', async (_event, filename, content) => {
  const safe = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const tmpDir = path.join(os.tmpdir(), 'coffee-pod-exports');
  fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, safe);
  fs.writeFileSync(filePath, content, 'utf-8');
  return shell.openPath(filePath);
});

ipcMain.handle('choose-backup-destination', async (_event, suggestedName) => {
  const safeName = String(suggestedName || 'coffee-pod-backup.tar.gz').replace(/[^a-zA-Z0-9_.-]/g, '_');
  const result = await dialog.showSaveDialog({
    title: 'Save Pod backup',
    defaultPath: path.join(app.getPath('documents'), safeName),
    filters: [{ name: 'Pod backup', extensions: ['gz'] }],
  });
  if (result.canceled || !result.filePath) return null;
  const filePath = result.filePath.endsWith('.tar.gz') ? result.filePath : `${result.filePath}.tar.gz`;
  return { outputDir: path.dirname(filePath), filename: path.basename(filePath) };
});

ipcMain.handle('choose-backup-source', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Choose Pod backup',
    properties: ['openFile'],
    filters: [{ name: 'Pod backup', extensions: ['gz'] }],
  });
  return result.canceled ? null : (result.filePaths[0] ?? null);
});

ipcMain.handle('restart-coffee-pod', () => {
  app.relaunch();
  app.quit();
  return true;
});

app.whenReady().then(async () => {
  apiToken = loadOrCreateApiToken();
  startServer();
  try {
    await createWindow();
  } catch (error) {
    const win = new BrowserWindow({
      width: 720,
      height: 420,
      title: 'Pod',
      backgroundColor: '#0b0b0e',
    });
    const rawMessage = error instanceof Error ? error.message : String(error);
    const message = rawMessage
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
    await win.loadURL(`data:text/html,${encodeURIComponent(`
      <!doctype html>
      <html>
        <body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#0b0b0e;color:#fff;font:600 16px -apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;">
          <main style="width:min(520px,calc(100vw - 40px));padding:28px;border:1px solid rgba(255,255,255,.1);border-radius:12px;background:#131318;">
            <h1 style="margin:0 0 10px;font-size:24px;">Pod could not start</h1>
            <p style="margin:0 0 12px;color:rgba(255,255,255,.72);line-height:1.45;">${message}</p>
            <p style="margin:0;color:rgba(255,255,255,.52);line-height:1.45;">Log: ${path.join(app.getPath('userData'), 'coffee-pod-server.log')}</p>
          </main>
        </body>
      </html>
    `)}`);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
  logStream?.end();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
