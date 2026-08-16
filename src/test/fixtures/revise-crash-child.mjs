import path from 'node:path';
import { handleRevise, loadConfig } from 'smartware';
import { ClaimStore } from '../../../vendor/smartware/dist/layer1/store.js';

const [dataDir, phase, operationId, claimId] = process.argv.slice(2);
if (!dataDir || !phase || !operationId || !claimId) process.exit(64);

const store = new ClaimStore(path.join(dataDir, 'smartware.db'));
store.setDataDir(dataDir);
const kill = () => process.kill(process.pid, 'SIGKILL');

try {
  await handleRevise(
    {
      actor: { type: 'person', id: 'user:owner', display_name: 'Owner' },
      target: claimId,
      expected_base_version: 1,
      set_confidence: 'high',
      reason: 'Owner verified the claim.',
      operation_id: operationId,
    },
    dataDir,
    store,
    loadConfig(dataDir),
    { opsDir: path.join(dataDir, 'operations') },
    undefined,
    {
      ...(phase === 'afterIntent' ? { afterIntent: kill } : {}),
      ...(phase === 'afterClaimVersion' ? { afterClaimVersion: kill } : {}),
      ...(phase === 'afterCommit' ? { afterCommit: kill } : {}),
    },
  );
  process.exit(65);
} finally {
  store.close();
}
