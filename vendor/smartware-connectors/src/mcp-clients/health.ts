import { spawn } from 'node:child_process';

import type { ConnectorEnv } from '../config.js';
import { ensureContainerRunning, DockerRuntimeError } from './docker-runtime.js';
import { getMcpProvider, listMcpProviders, type McpProviderDef } from './registry.js';

function imageRef(provider: McpProviderDef): string {
  return `${provider.image}:latest`;
}

export interface McpBackendHealth {
  mcp_enabled: boolean;
  docker_reachable: boolean;
  docker_error: string | null;
  providers: Array<{
    id: string;
    image_ref: string;
    image_present: boolean;
    container_running: boolean;
  }>;
}

interface ExecResult { stdout: string; stderr: string; code: number; }

function exec(cmd: string, args: string[], timeoutMs = 5_000): Promise<ExecResult> {
  return new Promise(resolve => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => { try { child.kill(); } catch {/* */} }, timeoutMs);
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', err => { clearTimeout(timer); resolve({ stdout, stderr: err.message, code: -1 }); });
    child.on('close', code => { clearTimeout(timer); resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code ?? -1 }); });
  });
}

/** Pre-start container(s) so the first tool call doesn't pay cold-start (~5-10s). */
export interface PrewarmResult {
  warmed: Array<{ id: string; url: string }>;
  errors: Array<{ id: string; message: string }>;
  skipped: Array<{ id: string; reason: string }>;
}

export async function prewarmProviders(env: ConnectorEnv, providerIds?: string[]): Promise<PrewarmResult> {
  const result: PrewarmResult = { warmed: [], errors: [], skipped: [] };
  if (!env.mcpClientEnabled) {
    return { ...result, skipped: [{ id: '*', reason: 'mcp_disabled' }] };
  }
  const allProviders = listMcpProviders();
  const targets = providerIds
    ? providerIds.map(id => getMcpProvider(id)).filter((p): p is McpProviderDef => Boolean(p))
    : allProviders;

  // Sequential, not parallel — parallel docker pulls + binds can race on port allocation.
  for (const provider of targets) {
    try {
      const url = await ensureContainerRunning(env, provider, allProviders.findIndex(p => p.id === provider.id));
      result.warmed.push({ id: provider.id, url });
    } catch (err) {
      if (err instanceof DockerRuntimeError) {
        result.errors.push({ id: provider.id, message: err.message });
      } else {
        result.errors.push({ id: provider.id, message: (err as Error).message });
      }
    }
  }
  return result;
}

export async function getMcpHealth(env: ConnectorEnv): Promise<McpBackendHealth> {
  const providers = listMcpProviders();

  if (!env.mcpClientEnabled) {
    return {
      mcp_enabled: false,
      docker_reachable: false,
      docker_error: null,
      providers: providers.map(p => ({ id: p.id, image_ref: imageRef(p), image_present: false, container_running: false })),
    };
  }

  // Probe docker reachability via `docker version`. Short timeout — UI calls this often.
  const versionCheck = await exec(env.mcpDockerCommand, ['version', '--format', '{{.Server.Version}}'], 3_000);
  if (versionCheck.code !== 0) {
    const hint = /Cannot connect to the Docker daemon/i.test(versionCheck.stderr)
      ? 'Docker daemon is not reachable. If you use Colima, run `colima start`.'
      : versionCheck.stderr || `docker version exited ${versionCheck.code}`;
    return {
      mcp_enabled: true,
      docker_reachable: false,
      docker_error: hint,
      providers: providers.map(p => ({ id: p.id, image_ref: imageRef(p), image_present: false, container_running: false })),
    };
  }

  // Now query for present images + running containers in two cheap calls.
  const [imagesRes, psRes] = await Promise.all([
    exec(env.mcpDockerCommand, ['images', '--format', '{{.Repository}}@{{.Digest}}']),
    exec(env.mcpDockerCommand, ['ps', '--filter', 'name=^smartware-mcp-', '--filter', 'status=running', '--format', '{{.Names}}']),
  ]);
  const imageLines = imagesRes.code === 0 ? new Set(imagesRes.stdout.split('\n').filter(Boolean)) : new Set<string>();
  const runningNames = psRes.code === 0 ? new Set(psRes.stdout.split('\n').filter(Boolean)) : new Set<string>();

  return {
    mcp_enabled: true,
    docker_reachable: true,
    docker_error: null,
    providers: providers.map(p => {
      const ref = imageRef(p);
      const repoPresent = [...imageLines].some(line => line.startsWith(`${p.image}@`));
      const exactPresent = imageLines.has(ref);
      return {
        id: p.id,
        image_ref: ref,
        image_present: exactPresent || repoPresent,
        container_running: runningNames.has(`smartware-mcp-${p.id}`),
      };
    }),
  };
}
