import fs from 'node:fs/promises';
import path from 'node:path';

import type { ConnectorEnv } from './config.js';

export function integrationConfigPath(env: ConnectorEnv, serviceId: string): string {
  return path.join(env.dataDir, 'integrations', `${serviceId}.json`);
}

export async function readIntegrationConfig(env: ConnectorEnv, serviceId: string): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await fs.readFile(integrationConfigPath(env, serviceId), 'utf8')) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
}

export async function writeIntegrationConfig(env: ConnectorEnv, serviceId: string, config: Record<string, unknown>): Promise<void> {
  const file = integrationConfigPath(env, serviceId);
  const directory = path.dirname(file);
  await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  await fs.chmod(directory, 0o700);
  await fs.writeFile(file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await fs.chmod(file, 0o600);
}

export async function deleteIntegrationConfig(env: ConnectorEnv, serviceId: string): Promise<void> {
  try {
    await fs.unlink(integrationConfigPath(env, serviceId));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
