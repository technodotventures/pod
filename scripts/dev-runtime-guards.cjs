const path = require('node:path');

const { probePodRuntime } = require('../electron/runtime-guards.cjs');

const DEFAULT_DEV_PORT = 8733;

function resolveDevRuntime(projectRoot, env = process.env) {
  const port = Number(env.COFFEE_POD_PORT || DEFAULT_DEV_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`COFFEE_POD_PORT must be an integer between 1 and 65535; received "${env.COFFEE_POD_PORT}".`);
  }

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    dataDir: path.resolve(projectRoot, env.COFFEE_POD_DATA_DIR || 'data'),
    port,
    token: env.COFFEE_POD_API_TOKEN || '',
  };
}

async function waitForExpectedPod({
  runtime,
  timeoutMs = 20_000,
  probe = () => probePodRuntime({
    baseUrl: runtime.baseUrl,
    token: runtime.token,
    expectedDataDir: runtime.dataDir,
  }),
  delay = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds)),
}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const result = await probe();
    if (result.ready) return;
    if (result.reachable) {
      throw new Error(
        `Port ${runtime.port} is already serving a different or unauthorized Pod. `
        + 'Stop it or choose another COFFEE_POD_PORT.',
      );
    }
    await delay(150);
  }

  throw new Error(`Expected Pod API did not start on port ${runtime.port} within ${timeoutMs / 1_000} seconds.`);
}

module.exports = {
  DEFAULT_DEV_PORT,
  resolveDevRuntime,
  waitForExpectedPod,
};
