// FORGET hardening per PR-14/B5/FG-02.
//
// Wraps the substrate's existing forget path to ALSO write a
// spec-conformant forgotten L1 version to the JSONL canonical surface.
// The substrate's protocol/forget.ts continues to handle the SQLite
// + tombstone-observation side; this helper layers the v0.1.2 carry-
// forward on top so FG-02 / LC-04 can be tested end-to-end.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
  appendClaimVersion,
  appendOpLogEntry,
  readLatestClaimVersion,
  readClaimHistory,
  type ClaimVersionRecord,
  type SmartwareCore,
} from 'smartware';

export interface ForgetHardenedArgs {
  claim_id: string;
  operation_id: string;
  actor_id: string;
  reason: string;
}

export interface ForgetHardenedResult {
  tombstone_id: string;
  forgotten_at: string;
  prior_version: number;
  new_version: number;
}

/**
 * Append a forgotten L1 version per Spec v1.5.4.2 §FORGET. Carries forward
 * every non-content field from the prior active version; omits content
 * (canonical snapshot lives in the L2 tombstone). Writes the L2 tombstone
 * with the full snapshot. Appends ops-log 'forget' entry last.
 */
export function forgetHardened(
  core: SmartwareCore,
  args: ForgetHardenedArgs,
): ForgetHardenedResult | { error: string } {
  const prior = readLatestClaimVersion(core.dataDir, args.claim_id);
  if (!prior) {
    return { error: `claim ${args.claim_id} has no L1 history; nothing to forget` };
  }
  if (prior.state === 'forgotten') {
    return { error: `claim ${args.claim_id} is already forgotten` };
  }

  // Spec v0.1.2 RV-03 / FG-10: user-authored claims can only be forgotten
  // by the user. Reject if actor is not user-typed.
  if (prior.author === 'user' && !args.actor_id.startsWith('user:')) {
    return { error: `forbidden: claim ${args.claim_id} is user-authored; only the user can forget it` };
  }

  const commit_ts = new Date().toISOString();
  const tombstoneId = `tomb_${args.claim_id.replace(/^claim_/, '')}`;

  // Full carry-forward of non-content metadata per FG-02 / Reference
  // Impl v0.1.2 §FORGET.
  const forgottenVersion: ClaimVersionRecord = {
    claim_id: prior.claim_id,
    version: prior.version + 1,
    state: 'forgotten',
    // content omitted (lives in the tombstone snapshot)
    claim_type: prior.claim_type,
    claim_role: prior.claim_role,
    author: prior.author,
    epistemic_owner: prior.epistemic_owner,
    fingerprint: prior.fingerprint,
    confidence: prior.confidence,
    epistemic_tag: prior.epistemic_tag,
    scope: prior.scope,
    derived_from: prior.derived_from,
    relations: prior.relations,
    created_at: prior.created_at,
    version_at: commit_ts,
    operation_id: args.operation_id,
    actor_id: args.actor_id,
    tags: prior.tags,
    supersedes: prior.version,
    tombstone_id: tombstoneId,
    forgotten_at: commit_ts,
    forgotten_by: args.actor_id,
  };
  appendClaimVersion(core.dataDir, forgottenVersion);

  // L2 tombstone with the full snapshot of the prior active version
  // per Schemas v0.1.2 (so LC-04 catastrophic recovery is reconstructable).
  const tombstoneDir = join(core.wikiDir, 'tombstones');
  if (!existsSync(tombstoneDir)) mkdirSync(tombstoneDir, { recursive: true });
  const slug = args.claim_id.replace(/^claim_/, '');
  const fm = {
    tombstone_id: tombstoneId,
    claim_id: args.claim_id,
    forgotten_at: commit_ts,
    forgotten_by: args.actor_id,
    operation_id: args.operation_id,
    reason: args.reason,
    snapshot: {
      version: prior.version,
      content: prior.content,
      derived_from: prior.derived_from,
      author: prior.author,
      confidence: prior.confidence,
      epistemic_tag: prior.epistemic_tag,
      claim_type: prior.claim_type,
      claim_role: prior.claim_role,
      scope: prior.scope,
      created_at: prior.created_at,
      version_at: prior.version_at,
      operation_id: prior.operation_id,
      actor_id: prior.actor_id,
      tags: prior.tags,
      relations: prior.relations,
    },
    blast_radius_summary: {
      pages_affected: 0,
      agent_blocks_marked: 0,
      user_pages_notified: 0,
    },
    affected_pages: [],
  };
  const fmText = Object.entries(fm)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join('\n');
  const body = `# Tombstone: ${args.claim_id}\n\nReason: ${args.reason}\n`;
  writeFileSync(join(tombstoneDir, `${slug}.md`), `---\n${fmText}\n---\n\n${body}`, 'utf-8');

  // Ops-log entry LAST per A0.
  appendOpLogEntry(core.opsDir, {
    operation_id: args.operation_id,
    actor_id: args.actor_id,
    timestamp: commit_ts,
    op: 'forget',
    details: {
      claim_id: args.claim_id,
      tombstone_id: tombstoneId,
      prior_version: prior.version,
      new_version: forgottenVersion.version,
      reason: args.reason,
    },
  });

  return {
    tombstone_id: tombstoneId,
    forgotten_at: commit_ts,
    prior_version: prior.version,
    new_version: forgottenVersion.version,
  };
}

/**
 * Tombstone revival per spec RV-10/RV-11. Appends a new active L1 version
 * with state=active, supersedes pointing at the forgotten version,
 * revived_via pointing at the tombstone. Page citations NOT auto-restored.
 */
export function reviveTombstone(
  core: SmartwareCore,
  args: { tombstone_id: string; operation_id: string; actor_id: string; reason: string },
): { claim_id: string; new_version: number; revived_at: string } | { error: string } {
  const claim_id = `claim_${args.tombstone_id.replace(/^tomb_/, '')}`;
  const latest = readLatestClaimVersion(core.dataDir, claim_id);
  if (!latest) return { error: `no L1 history for ${claim_id}` };
  if (latest.state !== 'forgotten') {
    return { error: `${claim_id} is not in state=forgotten; cannot revive` };
  }
  if (latest.author === 'user' && !args.actor_id.startsWith('user:')) {
    return { error: `forbidden: only the user can revive user-authored tombstones` };
  }

  const commit_ts = new Date().toISOString();
  const claimHistory = readClaimHistory(core.dataDir, claim_id);
  const lastActive = claimHistory.slice().reverse().find((v: ClaimVersionRecord) => v.state === 'active');
  const content = lastActive && 'content' in lastActive ? (lastActive as { content: string }).content : '(content lost; review and revise)';
  const { tombstone_id: _t, forgotten_at: _fa, forgotten_by: _fb, ...base } = latest as unknown as Record<string, unknown>;
  const revivedVersion: ClaimVersionRecord = {
    ...base,
    version: latest.version + 1,
    state: 'active',
    content,
    supersedes: latest.version,
    version_at: commit_ts,
    operation_id: args.operation_id,
    actor_id: args.actor_id,
    revived_via: args.tombstone_id,
  } as ClaimVersionRecord;
  appendClaimVersion(core.dataDir, revivedVersion);

  appendOpLogEntry(core.opsDir, {
    operation_id: args.operation_id,
    actor_id: args.actor_id,
    timestamp: commit_ts,
    op: 'revive',
    details: {
      claim_id,
      tombstone_id: args.tombstone_id,
      new_version: revivedVersion.version,
      reason: args.reason,
    },
  });

  return { claim_id, new_version: revivedVersion.version, revived_at: commit_ts };
}
