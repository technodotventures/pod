const fs = require('node:fs');
const path = require('node:path');

function selectDataHome(defaultPath, legacyPaths, existsSync = fs.existsSync) {
  if (existsSync(path.join(defaultPath, 'data'))) return defaultPath;
  return legacyPaths.find(candidate => (
    candidate !== defaultPath && existsSync(path.join(candidate, 'data'))
  )) ?? defaultPath;
}

async function probePodRuntime({
  baseUrl,
  token,
  expectedDataDir,
  fetchImpl = fetch,
}) {
  try {
    const response = await fetchImpl(`${baseUrl}/pod/runtime`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) return { ready: false, reachable: true };
    const runtime = await response.json();
    const actualDataDir = runtime && typeof runtime === 'object'
      ? runtime.data_dir
      : undefined;
    return {
      ready: typeof actualDataDir === 'string'
        && path.resolve(actualDataDir) === path.resolve(expectedDataDir),
      reachable: true,
    };
  } catch {
    return { ready: false, reachable: false };
  }
}

module.exports = {
  probePodRuntime,
  selectDataHome,
};
