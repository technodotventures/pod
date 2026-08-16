import fs from 'node:fs';
import path from 'node:path';
import { exec, execSync } from 'node:child_process';

import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import { getDb, getObject } from '../pod/db.js';
import { folderForKind, safeFilename } from '../services/vault-writer.js';
import { requestWorkspaceId } from './workspaces.js';

/* ── Known markdown-capable apps by platform ── */
interface AppOption {
  id: string;
  name: string;
  /** macOS bundle id or executable hint used for detection */
  mac?: string;
  /** Linux desktop-file id or binary name */
  linux?: string;
  /** Windows exe name */
  win?: string;
}

const KNOWN_APPS: AppOption[] = [
  { id: 'vscode',   name: 'VS Code',    mac: 'Visual Studio Code', linux: 'code',     win: 'code.cmd' },
  { id: 'cursor',   name: 'Cursor',     mac: 'Cursor',             linux: 'cursor',   win: 'cursor.cmd' },
  { id: 'obsidian', name: 'Obsidian',   mac: 'Obsidian',           linux: 'obsidian', win: 'obsidian.exe' },
  { id: 'typora',   name: 'Typora',     mac: 'Typora',             linux: 'typora',   win: 'typora.exe' },
  { id: 'ia',       name: 'iA Writer',  mac: 'iA Writer' },
  { id: 'sublime',  name: 'Sublime Text', mac: 'Sublime Text', linux: 'subl',     win: 'subl.exe' },
  { id: 'textedit', name: 'TextEdit',   mac: 'TextEdit' },
  { id: 'notepad',  name: 'Notepad',    win: 'notepad.exe' },
];

/** Detect which known apps are installed (cached after first call). */
let cachedApps: { id: string; name: string }[] | null = null;

function detectInstalledApps(): { id: string; name: string }[] {
  if (cachedApps) return cachedApps;

  const platform = process.platform;
  const found: { id: string; name: string }[] = [];

  for (const app of KNOWN_APPS) {
    try {
      if (platform === 'darwin' && app.mac) {
        // `open -Ra "Name"` exits 0 if the app exists
        execSync(`open -Ra "${app.mac}" 2>/dev/null`, { stdio: 'ignore' });
        found.push({ id: app.id, name: app.name });
      } else if (platform === 'linux' && app.linux) {
        execSync(`which ${app.linux} 2>/dev/null`, { stdio: 'ignore' });
        found.push({ id: app.id, name: app.name });
      } else if (platform === 'win32' && app.win) {
        execSync(`where ${app.win} 2>nul`, { stdio: 'ignore' });
        found.push({ id: app.id, name: app.name });
      }
    } catch {
      // app not installed — skip
    }
  }

  cachedApps = found;
  return found;
}

/** Resolve the vault .md path for an object, creating the file if needed. */
function resolveVaultPath(env: CoffeePodEnv, object: { id: string; title: string; kind: string; content: unknown }): string {
  const subfolder = folderForKind(object.kind);
  const filename = safeFilename(object.title, object.id) + '.md';
  const vaultDir = path.join(env.dataDir, 'vault', subfolder);
  const filePath = path.join(vaultDir, filename);

  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(vaultDir, { recursive: true });
    const content = (object.content as Record<string, unknown> | undefined);
    const text = typeof content?.text === 'string' ? content.text : '';
    const md = `# ${object.title}\n\n${text}`;
    fs.writeFileSync(filePath, md, 'utf-8');
  }

  return filePath;
}

export async function registerVaultReadRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  const db = getDb(env);

  app.get('/pod/objects/:object_id/vault', {
    schema: { summary: 'Read the vault Markdown file for a Pod object' },
  }, async (request, reply) => {
    const params = request.params as { object_id: string };
    const object = getObject(db, params.object_id);
    if (!object || object.workspace_id !== requestWorkspaceId(request)) {
      return reply.code(404).send({ error: 'not_found', message: 'Pod object not found' });
    }

    const subfolder = folderForKind(object.kind);
    const filename = safeFilename(object.title, object.id) + '.md';
    const filePath = path.join(env.dataDir, 'vault', subfolder, filename);

    if (!fs.existsSync(filePath)) {
      return reply.code(404).send({ error: 'not_found', message: 'Vault file not found' });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return { content, path: filePath };
  });

  /**
   * List available apps that can open .md files on this machine.
   * Also returns a "reveal" option and "default" option.
   */
  app.get('/system/open-in-options', {
    schema: { summary: 'List available apps for opening markdown files' },
  }, async () => {
    const installed = detectInstalledApps();
    const platform = process.platform;
    return {
      platform,
      options: [
        { id: 'default', name: 'Default App' },
        ...installed,
        { id: 'reveal', name: platform === 'darwin' ? 'Reveal in Finder' : platform === 'win32' ? 'Show in Explorer' : 'Show in Files' },
      ],
    };
  });

  /**
   * Open the vault markdown file in a specific app, system default, or reveal in Finder.
   * Body: { app?: string } — app id from /system/open-in-options, or omit for default.
   */
  app.post('/pod/objects/:object_id/open-in-app', {
    schema: { summary: 'Open the vault Markdown file in a chosen application' },
  }, async (request, reply) => {
    const params = request.params as { object_id: string };
    const body = (request.body ?? {}) as { app?: string };
    const appId = body.app ?? 'default';

    const object = getObject(db, params.object_id);
    if (!object || object.workspace_id !== requestWorkspaceId(request)) {
      return reply.code(404).send({ error: 'not_found', message: 'Pod object not found' });
    }

    const filePath = resolveVaultPath(env, object);
    const platform = process.platform;

    // Build the open command
    let cmd: string;
    if (appId === 'reveal') {
      // Reveal in file manager
      if (platform === 'darwin') cmd = `open -R "${filePath}"`;
      else if (platform === 'win32') cmd = `explorer /select,"${filePath}"`;
      else cmd = `xdg-open "${path.dirname(filePath)}"`;
    } else if (appId === 'default') {
      // System default
      if (platform === 'darwin') cmd = `open "${filePath}"`;
      else if (platform === 'win32') cmd = `start "" "${filePath}"`;
      else cmd = `xdg-open "${filePath}"`;
    } else {
      // Specific app
      const appDef = KNOWN_APPS.find(a => a.id === appId);
      if (!appDef) {
        return reply.code(400).send({ error: 'unknown_app', message: `Unknown app: ${appId}` });
      }
      if (platform === 'darwin' && appDef.mac) {
        cmd = `open -a "${appDef.mac}" "${filePath}"`;
      } else if (platform === 'linux' && appDef.linux) {
        cmd = `${appDef.linux} "${filePath}"`;
      } else if (platform === 'win32' && appDef.win) {
        cmd = `${appDef.win} "${filePath}"`;
      } else {
        // Fallback to system default
        cmd = platform === 'darwin' ? `open "${filePath}"` : `xdg-open "${filePath}"`;
      }
    }

    return new Promise((resolve) => {
      exec(cmd, (err) => {
        if (err) {
          resolve(reply.code(500).send({
            error: 'open_failed',
            message: `Failed to open file: ${err.message}`,
            path: filePath,
          }));
        } else {
          resolve({ ok: true, app: appId, path: filePath });
        }
      });
    });
  });
}
