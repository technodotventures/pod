import { SmartwareCore } from 'smartware';
import type { CoffeePodEnv } from '../config/env.js';
import { getPodProfile } from '../pod/data-spaces.js';
import { syncSmartwareLLMConfig } from '../services/ai-provider.js';
import { publishWatchEvent } from '../services/watch-events.js';

let core: SmartwareCore | null = null;

export { getPodProfile };

interface SmartwareCoreInternals {
  store: {
    getClaim(id: string): { scope: string } | undefined;
  };
  layer0: {
    getDB(): {
      prepare(sql: string): {
        get(id: string): { scope: string } | undefined;
      };
    };
  };
}

function resolveClaimScope(target: SmartwareCore, claimId: string): string {
  const internals = target as unknown as SmartwareCoreInternals;
  return internals.store.getClaim(claimId)?.scope ?? 'unknown';
}

function resolveObservationScope(target: SmartwareCore, observationId: string): string {
  const internals = target as unknown as SmartwareCoreInternals;
  const row = internals.layer0.getDB().prepare('SELECT scope FROM observations WHERE id = ?').get(observationId);
  return row?.scope ?? 'unknown';
}

function installWatchPublishing(target: SmartwareCore): void {
  const wrapped = target as SmartwareCore & { __coffeeWatchPublishing?: boolean };
  if (wrapped.__coffeeWatchPublishing) return;
  wrapped.__coffeeWatchPublishing = true;

  const compile = target.compile.bind(target);
  target.compile = async (params) => {
    const result = await compile(params);
    for (const entry of result.audit) {
      publishWatchEvent({
        type: 'compile',
        scope: params.scope ?? entry.path.split('/wiki/')[1]?.split('/')[0] ?? 'personal',
        target: entry.entity_id,
        payload: {
          entity_id: entry.entity_id,
          entity_name: entry.entity_name,
          claims_used: entry.claims_used,
          claims_contested: entry.claims_contested,
          observations_used: entry.observations_used,
          git_sha: result.git_sha,
        },
      });
    }
    return result;
  };

  const correct = target.correct.bind(target);
  target.correct = async (params) => {
    const scope = resolveClaimScope(target, params.target_claim_id);
    const result = await correct(params);
    publishWatchEvent({
      type: 'revise',
      scope,
      target: params.target_claim_id,
      payload: result as unknown as Record<string, unknown>,
    });
    return result;
  };

  const forget = target.forget.bind(target);
  target.forget = async (params) => {
    const forgetTarget = params.target
      ?? (params.target_claim_id ? { type: 'claim' as const, id: params.target_claim_id } : undefined)
      ?? (params.target_obs_id ? { type: 'observation' as const, id: params.target_obs_id } : undefined);
    const scope = forgetTarget?.type === 'claim'
      ? resolveClaimScope(target, forgetTarget.id)
      : forgetTarget?.type === 'observation'
        ? resolveObservationScope(target, forgetTarget.id)
        : 'unknown';
    const result = await forget(params);
    publishWatchEvent({
      type: 'forget',
      scope,
      target: result.target_id,
      payload: result as unknown as Record<string, unknown>,
    });
    return result;
  };
}

export async function getSmartwareCore(env: CoffeePodEnv): Promise<SmartwareCore> {
  if (!core) {
    core = await SmartwareCore.open({ dataDir: env.dataDir, ownerId: env.ownerId });
    installWatchPublishing(core);
    const profile = getPodProfile(core, env);
    core.ensureTrustedClientGrant('person-local', 'person', ['*']);
  }
  await syncSmartwareLLMConfig(env, core);
  return core;
}

export async function closeSmartwareCore(): Promise<void> {
  core?.close();
  core = null;
}
