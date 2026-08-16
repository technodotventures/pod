import path from 'node:path';

export interface CoffeePodEnv {
  host: string;
  port: number;
  dataDir: string;
  ownerId: string | undefined;
  podId: string;
  /** True when an operator explicitly selected COFFEE_POD_ID. */
  podIdExplicit?: boolean;
  podName: string;
  apiToken?: string;
  /** Owner's email — used for signal classification (directly-addressed detection). */
  userEmail?: string;
  mcpClientEnabled: boolean;
  mcpDockerCommand: string;
  mcpPortBase: number;
}

export function loadEnv(): CoffeePodEnv {
  return {
    host: process.env['COFFEE_POD_HOST'] ?? '127.0.0.1',
    port: Number(process.env['COFFEE_POD_PORT'] ?? 8732),
    dataDir: process.env['COFFEE_POD_DATA_DIR'] ?? path.join(process.cwd(), 'data'),
    ownerId: process.env['COFFEE_POD_OWNER_ID'],
    podId: process.env['COFFEE_POD_ID'] ?? 'founder',
    podIdExplicit: Boolean(process.env['COFFEE_POD_ID']?.trim()),
    podName: process.env['COFFEE_POD_NAME'] ?? 'Founder Pod',
    apiToken: process.env['COFFEE_POD_API_TOKEN'],
    userEmail: process.env['COFFEE_POD_USER_EMAIL'] || undefined,
    mcpClientEnabled: process.env['COFFEE_POD_MCP_CLIENT_ENABLED'] === 'true',
    mcpDockerCommand: process.env['COFFEE_POD_MCP_DOCKER_COMMAND'] ?? 'docker',
    mcpPortBase: Number(process.env['COFFEE_POD_MCP_PORT_BASE'] ?? 5100),
  };
}
