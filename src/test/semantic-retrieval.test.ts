import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import type { SmartwareCore } from 'smartware';

import type { CoffeePodEnv } from '../config/env.js';
import { closeDb, getDb, setSettings } from '../pod/db.js';
import {
  applyRetrievalSettingsDefaults,
  evaluateSmartwareHybridRecall,
  RETRIEVAL_SETTINGS_NAMESPACE,
  shouldUseSemanticFallback,
  validateRetrievalSettings,
} from '../services/semantic-retrieval.js';

function environment(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 8732,
    dataDir,
    ownerId: 'person_owner',
    podId: 'test',
    podName: 'Test Pod',
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

const provider = {
  id: 'openrouter' as const,
  apiKey: 'test-key',
  model: 'gpt-test',
  mode: 'fast' as const,
  selectedForAI: true,
};

test('hybrid retrieval is off by default and shadow is not fallback activation', () => {
  const off = applyRetrievalSettingsDefaults({});
  assert.equal(shouldUseSemanticFallback([], off), false);

  const shadow = applyRetrievalSettingsDefaults({ semantic_mode: 'shadow' });
  assert.equal(shouldUseSemanticFallback([], shadow), false);

  const fallback = applyRetrievalSettingsDefaults({ semantic_mode: 'fallback' });
  assert.equal(shouldUseSemanticFallback([], fallback), true);
  assert.equal(
    shouldUseSemanticFallback([{ score: 0.2 }, { score: 0.1 }], fallback),
    true,
  );
  assert.equal(
    shouldUseSemanticFallback([{ score: 0.8 }, { score: 0.7 }], fallback),
    false,
  );
  assert.match(
    validateRetrievalSettings({ semantic_min_similarity: 2 }) ?? '',
    /between -1 and 1/,
  );
  assert.match(
    validateRetrievalSettings({ embedding_timeout_ms: 100 }) ?? '',
    /between 1000 and 30000/,
  );
});

test('Pod delegates indexing and hybrid ranking to Smartware in shadow mode', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coffee-hybrid-shadow-'));
  const env = environment(dataDir);
  const db = getDb(env);
  setSettings(db, RETRIEVAL_SETTINGS_NAMESPACE, {
    semantic_mode: 'shadow',
    embedding_provider: 'openrouter',
    embedding_model: 'baai/bge-m3',
    semantic_min_similarity: 0.4,
  });
  const embeddingBatches: string[][] = [];
  let storeClosed = false;
  let syncedMaxDocuments: number | undefined;
  const fakeCore = {
    async syncSemanticIndex(
      _params: unknown,
      options: {
        adapter: { embed(texts: string[]): Promise<number[][]> };
        max_documents?: number;
      },
    ) {
      syncedMaxDocuments = options.max_documents;
      await options.adapter.embed(['Release deadline: 2026-08-01']);
    },
    async recallHybrid(
      _params: unknown,
      options: { adapter: { embed(texts: string[]): Promise<number[][]> } },
    ) {
      await options.adapter.embed(['When do we ship?']);
      return {
        canonical: {
          results: [{ claim: { id: 'claim_canonical' } }],
        },
        hybrid_results: [{
          claim_id: 'claim_release',
          entity_id: 'entity_release',
          entity_name: 'Release',
          predicate: 'deadline_is',
          text: 'Release deadline: 2026-08-01',
          scope: 'pod/test/workspace',
          confidence: 0.9,
          observation_ids: ['obs_release'],
          rrf_score: 0.032,
          lexical_rank: null,
          semantic_rank: 1,
          semantic_relevance: 0.91,
        }],
        selected_channel: 'hybrid',
        semantic_status: 'ok',
        semantic_index_status: 'ready',
      };
    },
  };

  try {
    const result = await evaluateSmartwareHybridRecall(
      env,
      db,
      fakeCore as unknown as SmartwareCore,
      {
        actor: {
          type: 'person',
          id: 'person_owner',
          display_name: 'Owner',
        },
        query: 'When do we ship?',
        scope: 'pod/test/workspace',
      },
      {
        resolveProvider: async () => ({ provider, model: 'baai/bge-m3' }),
        embedTexts: async texts => {
          embeddingBatches.push([...texts]);
          return texts.map(() => [1, 0]);
        },
        runtime: {
          openSemanticRecordStore() {
            return {
              status: 'ready',
              store: {
                close() {
                  storeClosed = true;
                },
              },
            };
          },
        },
      },
    );

    assert.equal(result.status, 'ok');
    assert.equal(result.mode, 'shadow');
    assert.equal(result.selected_channel, 'hybrid');
    assert.equal(result.semantic_index_status, 'ready');
    assert.equal(result.matches[0]?.claim_id, 'claim_release');
    assert.deepEqual(result.comparison, {
      canonical_count: 1,
      hybrid_count: 1,
      overlap_count: 0,
      top1_agreement: false,
    });
    assert.equal(syncedMaxDocuments, 5_000);
    assert.deepEqual(embeddingBatches, [
      ['Release deadline: 2026-08-01'],
      ['When do we ship?'],
    ]);
    assert.equal(storeClosed, true);
  } finally {
    closeDb();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('an older Smartware runtime makes shadow retrieval unavailable without failing context', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coffee-hybrid-version-'));
  const env = environment(dataDir);
  const db = getDb(env);
  setSettings(db, RETRIEVAL_SETTINGS_NAMESPACE, {
    semantic_mode: 'shadow',
  });

  try {
    const result = await evaluateSmartwareHybridRecall(
      env,
      db,
      {} as SmartwareCore,
      {
        actor: {
          type: 'person',
          id: 'person_owner',
          display_name: 'Owner',
        },
        query: 'release',
        scope: 'pod/test/workspace',
      },
    );
    assert.equal(result.status, 'unavailable');
    assert.equal(result.selected_channel, 'canonical');
    assert.deepEqual(result.matches, []);
  } finally {
    closeDb();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});

test('provider failures are isolated from canonical recall', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coffee-hybrid-provider-'));
  const env = environment(dataDir);
  const db = getDb(env);
  setSettings(db, RETRIEVAL_SETTINGS_NAMESPACE, {
    semantic_mode: 'shadow',
  });

  try {
    const result = await evaluateSmartwareHybridRecall(
      env,
      db,
      {
        syncSemanticIndex: async () => undefined,
        recallHybrid: async () => {
          throw new Error('must not reach hybrid recall');
        },
      } as unknown as SmartwareCore,
      {
        actor: {
          type: 'person',
          id: 'person_owner',
          display_name: 'Owner',
        },
        query: 'release',
        scope: 'pod/test/workspace',
      },
      {
        resolveProvider: async () => {
          throw new Error('provider offline');
        },
      },
    );

    assert.equal(result.status, 'error');
    assert.equal(result.selected_channel, 'canonical');
    assert.deepEqual(result.matches, []);
    assert.equal(result.error, 'provider offline');
  } finally {
    closeDb();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
