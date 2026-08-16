import path from 'node:path';
import { handleForget, handleRevive, loadConfig } from 'smartware';
import { Layer0Index } from '../../../vendor/smartware/dist/layer0/index.js';
import { ClaimStore } from '../../../vendor/smartware/dist/layer1/store.js';

const [verb, dataDir, phase, operationId, targetId] = process.argv.slice(2);
if (!verb || !dataDir || !phase || !operationId || !targetId) process.exit(64);

const dbPath = path.join(dataDir, 'smartware.db');
const store = new ClaimStore(dbPath);
store.setDataDir(dataDir);
const layer0 = new Layer0Index(dbPath);
const kill = () => process.kill(process.pid, 'SIGKILL');

try {
  if (verb === 'forget') {
    await handleForget(
      {
        actor: { type: 'person', id: 'user:owner', display_name: 'user:owner' },
        target: { type: 'claim', id: targetId },
        mode: 'tombstone',
        reason: 'Owner removed the claim.',
        operation_id: operationId,
      },
      path.join(dataDir, 'evidence'),
      layer0,
      store,
      loadConfig(dataDir),
      { opsDir: path.join(dataDir, 'operations') },
      {
        ...(phase === 'afterIntent' ? { afterIntent: kill } : {}),
        ...(phase === 'afterAuditObservation' ? { afterAuditObservation: kill } : {}),
        ...(phase === 'afterClaimVersion' ? { afterClaimVersion: kill } : {}),
        ...(phase === 'afterCommit' ? { afterCommit: kill } : {}),
      },
    );
  } else if (verb === 'revive') {
    await handleRevive(
      {
        actor: { type: 'person', id: 'user:owner', display_name: 'Owner' },
        tombstone_id: targetId,
        reason: 'Owner restored the claim.',
        operation_id: operationId,
      },
      dataDir,
      store,
      loadConfig(dataDir),
      { opsDir: path.join(dataDir, 'operations') },
      store.getDB(),
      {
        ...(phase === 'afterIntent' ? { afterIntent: kill } : {}),
        ...(phase === 'afterClaimVersion' ? { afterClaimVersion: kill } : {}),
        ...(phase === 'afterCommit' ? { afterCommit: kill } : {}),
      },
    );
  } else {
    process.exit(64);
  }
  process.exit(65);
} finally {
  layer0.close();
  store.close();
}
