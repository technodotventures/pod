// Throwaway harness to verify exportPodAsOkf end-to-end against the live pod.db.
import path from 'node:path';
import { loadEnv } from '../src/config/env.js';
import { getDb } from '../src/pod/db.js';
import { exportPodAsOkf } from '../src/services/okf-export.js';

const env = loadEnv();
const db = getDb(env);
const out = '/tmp/verify-okf.tar.gz';
const tmp = '/tmp/okf-verify-tmp';
const res = await exportPodAsOkf(db, out, tmp, {
  exportedAt: new Date().toISOString(),
  // exercise the claims-injection seam with a trivial stub so the code path runs
  claimsFor: async (id) => (id.startsWith('gmail:') ? [`exported from object ${id}`] : []),
});
console.log('RESULT', JSON.stringify(res));
