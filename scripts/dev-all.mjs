import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { resolveDevRuntime, waitForExpectedPod } = require('./dev-runtime-guards.cjs');
const runtime = resolveDevRuntime(projectRoot, process.env);
const serviceEnv = {
  ...process.env,
  COFFEE_POD_DATA_DIR: runtime.dataDir,
  COFFEE_POD_PORT: String(runtime.port),
};
const serviceDefinitions = [
  {
    name: 'API',
    args: ['./node_modules/.bin/tsx', 'watch', '--env-file=.env', 'src/server.ts'],
  },
  {
    name: 'UI',
    args: ['./node_modules/.bin/vite'],
  },
];

const children = [];
let stopping = false;
let exitCode = 0;

function startService(service) {
  const child = spawn(process.execPath, service.args, {
    cwd: projectRoot,
    env: serviceEnv,
    stdio: 'inherit',
  });
  const runningService = { ...service, child };
  children.push(runningService);
  child.on('error', error => {
    console.error(`[dev:all] ${service.name} failed to start: ${error.message}`);
    stopAll(1);
  });
  child.on('exit', (code, signal) => {
    if (!stopping) {
      console.error(`[dev:all] ${service.name} stopped (${signal ?? code ?? 'unknown'}).`);
      stopAll(code ?? 1);
    }
    if (children.every(({ child: current }) => current.exitCode !== null || current.signalCode !== null)) {
      process.exit(exitCode);
    }
  });
  return child;
}

function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  exitCode = code;
  for (const { child } of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM');
  }
  setTimeout(() => {
    for (const { child } of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
  }, 2_000).unref();
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));

startService(serviceDefinitions[0]);
try {
  await waitForExpectedPod({ runtime });
  if (!stopping) startService(serviceDefinitions[1]);
} catch (error) {
  console.error(`[dev:all] ${error instanceof Error ? error.message : String(error)}`);
  stopAll(1);
}
