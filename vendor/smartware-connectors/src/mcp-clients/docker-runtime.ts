import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

import type { ConnectorEnv } from '../config.js';
import { imageRef, type McpProviderDef } from './registry.js';

export class DockerRuntimeError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'DockerRuntimeError';
  }
}

interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

function exec(cmd: string, args: string[]): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', err => reject(new DockerRuntimeError(`Failed to spawn ${cmd}: ${err.message}`, err)));
    child.on('close', code => resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code ?? -1 }));
  });
}

function containerName(provider: McpProviderDef): string {
  return `smartware-mcp-${provider.id}`;
}

function hostPort(env: ConnectorEnv, index: number): number {
  return env.mcpPortBase + index;
}

async function isRunning(env: ConnectorEnv, name: string): Promise<boolean> {
  const result = await exec(env.mcpDockerCommand, ['ps', '--filter', `name=^${name}$`, '--filter', 'status=running', '--format', '{{.Names}}']);
  if (result.code !== 0) {
    throw new DockerRuntimeError(`docker ps failed: ${result.stderr || `exit ${result.code}`}`);
  }
  return result.stdout.split('\n').some(line => line.trim() === name);
}

async function removeIfExists(env: ConnectorEnv, name: string): Promise<void> {
  await exec(env.mcpDockerCommand, ['rm', '-f', name]);
}

async function waitReady(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' });
      // Any non-5xx means the MCP HTTP transport is up (401/405/etc. are OK).
      if (res.status < 500) return;
    } catch {
      // not yet listening
    }
    await sleep(500);
  }
  throw new DockerRuntimeError(`MCP server at ${url} did not become ready within ${timeoutMs}ms`);
}

/** Returns the host URL where the MCP server can be reached. Idempotent. */
export async function ensureContainerRunning(
  env: ConnectorEnv,
  provider: McpProviderDef,
  providerIndex: number,
): Promise<string> {
  const name = containerName(provider);
  const port = hostPort(env, providerIndex);
  const url = `http://127.0.0.1:${port}${provider.mcpPath}`;

  if (await isRunning(env, name)) return url;

  // Stale stopped container with the same name would block creation — clear it.
  await removeIfExists(env, name);

  const args = [
    'run', '-d',
    '--name', name,
    '--restart', 'unless-stopped',
    '-p', `${port}:${provider.containerPort}`,
    '-e', 'SKIP_OAUTH=true',
    imageRef(provider),
  ];
  const result = await exec(env.mcpDockerCommand, args);
  if (result.code !== 0) {
    const hint = /Cannot connect to the Docker daemon/i.test(result.stderr)
      ? ' (Is Docker/Colima running? Try: colima start)'
      : '';
    throw new DockerRuntimeError(`Failed to start ${name}: ${result.stderr || `exit ${result.code}`}${hint}`);
  }

  await waitReady(url, 30_000);
  return url;
}

export async function stopContainer(env: ConnectorEnv, provider: McpProviderDef): Promise<void> {
  await removeIfExists(env, containerName(provider));
}
