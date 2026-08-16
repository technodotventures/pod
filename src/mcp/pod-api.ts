import type { CoffeePodEnv } from '../config/env.js';

export interface CoffeePodMcpEnv {
  baseUrl: string;
  apiToken?: string;
}

function formatBaseUrl(host: string, port: number): string {
  if (host.includes(':') && !host.startsWith('[')) {
    return `http://[${host}]:${port}`;
  }
  return `http://${host}:${port}`;
}

export function loadCoffeePodMcpEnv(): CoffeePodMcpEnv {
  const host = process.env['COFFEE_POD_HOST'] ?? '127.0.0.1';
  const port = Number(process.env['COFFEE_POD_PORT'] ?? 8732);
  const env: CoffeePodEnv = {
    host,
    port,
    dataDir: process.env['COFFEE_POD_DATA_DIR'] ?? './data',
    ownerId: process.env['COFFEE_POD_OWNER_ID'],
    podId: process.env['COFFEE_POD_ID'] ?? 'founder',
    podName: process.env['COFFEE_POD_NAME'] ?? 'Founder Pod',
    apiToken: process.env['COFFEE_POD_API_TOKEN'],
    mcpClientEnabled: process.env['COFFEE_POD_MCP_CLIENT_ENABLED'] === 'true',
    mcpDockerCommand: process.env['COFFEE_POD_MCP_DOCKER_COMMAND'] ?? 'docker',
    mcpPortBase: Number(process.env['COFFEE_POD_MCP_PORT_BASE'] ?? 5100),
  };

  return {
    baseUrl: process.env['COFFEE_POD_URL'] ?? formatBaseUrl(env.host, env.port),
    apiToken: process.env['COFFEE_POD_MCP_API_TOKEN'] ?? env.apiToken,
  };
}

function requestHeaders(apiToken: string | undefined, body?: string): Headers {
  const headers = new Headers();
  if (apiToken) {
    headers.set('authorization', `Bearer ${apiToken}`);
  }
  if (body !== undefined && body !== null) {
    headers.set('content-type', 'application/json');
  }
  return headers;
}

async function readJsonResponse<T>(response: Response, endpoint: string): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Pod API ${endpoint} failed with ${response.status}: ${text || response.statusText}`);
  }
  return text ? JSON.parse(text) as T : {} as T;
}

export async function getPodJson<T>(env: CoffeePodMcpEnv, endpoint: string): Promise<T> {
  const response = await fetch(new URL(endpoint, env.baseUrl), {
    headers: requestHeaders(env.apiToken),
  });
  return readJsonResponse<T>(response, endpoint);
}

export async function postPodJson<T>(env: CoffeePodMcpEnv, endpoint: string, body: unknown): Promise<T> {
  const payload = JSON.stringify(body);
  const response = await fetch(new URL(endpoint, env.baseUrl), {
    method: 'POST',
    headers: requestHeaders(env.apiToken, payload),
    body: payload,
  });
  return readJsonResponse<T>(response, endpoint);
}
