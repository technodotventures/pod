import { handleObserve, loadConfig } from 'smartware';
import { Layer0Index } from 'smartware/layer0';
import path from 'node:path';

const [dataDir, phase, operationId, scope, content] = process.argv.slice(2);
if (!dataDir || !phase || !operationId || !scope || !content) process.exit(64);

const layer0 = new Layer0Index(path.join(dataDir, 'smartware.db'));
const kill = () => process.kill(process.pid, 'SIGKILL');

try {
  await handleObserve(
    {
      actor: { type: 'agent', id: 'user:owner', display_name: 'user:owner' },
      type: 'message',
      scope,
      content: { format: 'text/plain', body: content },
      visibility: 'scope',
      app: 'coffee-pod',
      operation_id: operationId,
    },
    path.join(dataDir, 'evidence'),
    layer0,
    loadConfig(dataDir),
    undefined,
    path.join(dataDir, 'operations'),
    {
      ...(phase === 'afterIntent' ? { afterIntent: kill } : {}),
      ...(phase === 'afterObservation' ? { afterObservation: kill } : {}),
      ...(phase === 'afterCommit' ? { afterCommit: kill } : {}),
    },
  );
  process.exit(65);
} finally {
  layer0.close();
}
