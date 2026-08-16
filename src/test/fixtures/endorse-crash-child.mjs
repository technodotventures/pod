import path from 'node:path';
import { CascadePreviewStore, handleEndorse, loadConfig } from 'smartware';
import { ClaimStore } from '../../../vendor/smartware/dist/layer1/store.js';

const [dataDir, phase, operationId, pageId, pagePath] = process.argv.slice(2);
if (!dataDir || !phase || !operationId || !pageId || !pagePath) process.exit(64);

const store = new ClaimStore(path.join(dataDir, 'smartware.db'));
store.setDataDir(dataDir);
const previews = new CascadePreviewStore(path.join(dataDir, 'indices', 'crash-previews.db'));
const kill = () => process.kill(process.pid, 'SIGKILL');

try {
  await handleEndorse(
    {
      actor: { type: 'person', id: 'user:owner', display_name: 'user:owner' },
      page_id: pageId,
      page_path: pagePath,
      dry_run: false,
      reason: 'Owner endorsed the page.',
      operation_id: operationId,
    },
    dataDir,
    store,
    previews,
    loadConfig(dataDir),
    { opsDir: path.join(dataDir, 'operations') },
    {
      ...(phase === 'afterIntent' ? { afterIntent: kill } : {}),
      ...(phase === 'afterClaimVersions' ? { afterClaimVersions: kill } : {}),
      ...(phase === 'afterPage' ? { afterPage: kill } : {}),
      ...(phase === 'afterCommit' ? { afterCommit: kill } : {}),
    },
  );
  process.exit(65);
} finally {
  previews.close();
  store.close();
}
