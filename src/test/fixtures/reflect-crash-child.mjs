import path from 'node:path';
import { handleCompile, loadConfig } from 'smartware';
import { Layer0Index } from 'smartware/layer0';
import { ClaimStore } from 'smartware/layer1';
import { SearchIndex } from 'smartware/layer3';

const [dataDir, phase, operationId, scope] = process.argv.slice(2);
if (!dataDir || !phase || !operationId || !scope) process.exit(64);

const dbPath = path.join(dataDir, 'smartware.db');
const layer0 = new Layer0Index(dbPath);
const store = new ClaimStore(dbPath);
store.setDataDir(dataDir);
const search = new SearchIndex(dbPath);
const kill = () => process.kill(process.pid, 'SIGKILL');

try {
  await handleCompile(
    {
      actor: { type: 'agent', id: 'user:owner', display_name: 'user:owner' },
      scope,
      use_llm: false,
      operation_id: operationId,
    },
    path.join(dataDir, 'evidence'),
    path.join(dataDir, 'wiki'),
    layer0,
    store,
    search,
    loadConfig(dataDir),
    dataDir,
    { opsDir: path.join(dataDir, 'operations') },
    {
      ...(phase === 'afterIntent' ? { afterIntent: kill } : {}),
      ...(phase === 'afterClaimVersion' ? { afterClaimVersion: kill } : {}),
      ...(phase === 'afterCommit' ? { afterCommit: kill } : {}),
    },
  );
  process.exit(65);
} finally {
  search.close();
  store.close();
  layer0.close();
}
