import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { SmartwareCore, readLatestClaimVersion } from 'smartware';
import { ulid } from 'ulid';

function readFixture(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveScope(profile, alias) {
  switch (alias) {
    case 'personal':
      return profile.scopes.personal;
    case 'workspace':
    default:
      return profile.scopes.workspace;
  }
}

function objectText(entry) {
  if (!entry.claim) return '';
  return typeof entry.claim.object === 'string'
    ? entry.claim.object
    : JSON.stringify(entry.claim.object);
}

function matchesResult(entry, matcher = {}) {
  if (matcher.entity_name_includes && !entry.entity_name.includes(matcher.entity_name_includes)) return false;
  if (matcher.claim_predicate && entry.claim?.predicate !== matcher.claim_predicate) return false;
  if (matcher.claim_object_includes && !objectText(entry).includes(matcher.claim_object_includes)) return false;
  return true;
}

function resultRank(results, matcher) {
  const index = results.findIndex(entry => matchesResult(entry, matcher));
  return index === -1 ? null : index + 1;
}

function legacyExpectedMatcher(assertions) {
  const matcher = {
    entity_name_includes: assertions.entity_name_includes,
    claim_predicate: assertions.claim_predicate,
    claim_object_includes: assertions.claim_object_includes,
  };
  return Object.values(matcher).some(Boolean) ? matcher : null;
}

function findScenarioClaim(core, owner, scopes, matcher) {
  const graph = core.readKnowledgeGraph({ actor: owner, scopes, include_sensitive: true });
  const matches = graph.claims.filter(claim => matchesResult({
    entity_name: claim.subject_name,
    claim: {
      predicate: claim.predicate,
      object: claim.object,
    },
  }, matcher));
  if (matches.length !== 1) {
    throw new Error(`action matcher must identify exactly one claim; matched ${matches.length}`);
  }
  return matches[0];
}

async function applyAction(core, owner, scopes, action) {
  const claim = findScenarioClaim(core, owner, scopes, action.match ?? {});
  if (action.type === 'revise_claim') {
    const version = readLatestClaimVersion(core.dataDir, claim.claim_id)?.version;
    if (!version) throw new Error(`missing canonical version for ${claim.claim_id}`);
    await core.revise({
      actor: owner,
      target: claim.claim_id,
      expected_base_version: version,
      set_confidence: action.set_confidence,
      set_epistemic_tag: action.set_epistemic_tag,
      adopt_body: action.adopt_body,
      reason: action.reason ?? 'Benchmark fixture setup',
      operation_id: `op_${ulid()}`,
    });
    return;
  }
  if (action.type === 'forget_claim') {
    await core.forget({
      actor: owner,
      target: { type: 'claim', id: claim.claim_id },
      mode: 'tombstone',
      reason: action.reason ?? 'Benchmark fixture setup',
    });
    return;
  }
  throw new Error(`unsupported benchmark action: ${action.type}`);
}

async function runScenario(fixtureName, scenario) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `coffee-bench-${scenario.id}-`));
  const ownerId = 'person_benchmark_owner';
  const owner = { type: 'person', id: ownerId, display_name: 'Benchmark Owner' };
  let core;

  try {
    core = await SmartwareCore.open({ dataDir: tempDir, ownerId });
    const profile = core.createPodProfile(`bench-${scenario.id}`, `${fixtureName} Benchmark`);
    const scope = resolveScope(profile, scenario.scope_alias ?? 'workspace');
    const observedScopes = new Set();

    for (const [index, observation] of (scenario.observations ?? []).entries()) {
      const observationScope = resolveScope(profile, observation.scope_alias ?? scenario.scope_alias ?? 'workspace');
      observedScopes.add(observationScope);
      await core.observe({
        actor: owner,
        type: observation.type ?? 'message',
        content: {
          format: observation.format ?? 'text/plain',
          body: observation.body,
        },
        scope: observationScope,
        observed_at: observation.observed_at,
        source_id: `${scenario.id}-obs-${index + 1}`,
        app: 'benchmark-harness',
        idempotency_key: `${scenario.id}-obs-${index + 1}`,
        sensitive: observation.sensitive ?? false,
      });
    }

    if (scenario.compile !== false) {
      for (const compileScope of observedScopes) {
        await core.compile({ actor: owner, scope: compileScope, use_llm: false });
      }
    }

    const actionScopes = [...new Set([...observedScopes, scope])];
    for (const action of scenario.actions ?? []) {
      await applyAction(core, owner, actionScopes, action);
    }

    const result = await core.query({
      actor: owner,
      query: scenario.query,
      scope,
      limit: scenario.limit ?? 5,
      include_sensitive: scenario.include_sensitive ?? false,
      include_stale: scenario.include_stale ?? false,
      include_superseded: scenario.include_superseded ?? false,
      include_forgotten: scenario.include_forgotten ?? false,
    });

    const assertions = scenario.assertions ?? {};
    const expected = [
      ...(assertions.contains ?? []),
      ...(legacyExpectedMatcher(assertions) ? [{ match: legacyExpectedMatcher(assertions) }] : []),
    ];
    const excluded = assertions.excludes ?? [];
    const expectedRanks = expected.map(expectation => ({
      matcher: expectation.match,
      max_rank: expectation.max_rank ?? scenario.limit ?? 5,
      rank: resultRank(result.results, expectation.match),
    }));
    const excludedRanks = excluded.map(expectation => ({
      matcher: expectation.match,
      rank: resultRank(result.results, expectation.match),
    }));
    const checks = [
      {
        ok: result.results.length >= (assertions.min_results ?? 1),
        message: `expected at least ${assertions.min_results ?? 1} result(s), got ${result.results.length}`,
      },
      ...(assertions.max_results === undefined ? [] : [{
        ok: result.results.length <= assertions.max_results,
        message: `expected at most ${assertions.max_results} result(s), got ${result.results.length}`,
      }]),
      ...(assertions.top_result ? [{
        ok: Boolean(result.results[0] && matchesResult(result.results[0], assertions.top_result)),
        message: 'top result did not match the expected claim',
      }] : []),
      ...expectedRanks.map(expectedRank => ({
        ok: expectedRank.rank !== null && expectedRank.rank <= expectedRank.max_rank,
        message: `expected one result matching ${JSON.stringify(expectedRank.matcher)} by rank ${expectedRank.max_rank}; got ${expectedRank.rank ?? 'no hit'}`,
      })),
      ...excludedRanks.map(excludedRank => ({
        ok: excludedRank.rank === null,
        message: `expected no result matching ${JSON.stringify(excludedRank.matcher)}; got rank ${excludedRank.rank}`,
      })),
    ];

    const failures = checks.filter(check => !check.ok).map(check => check.message);
    return {
      id: scenario.id,
      query: scenario.query,
      scope,
      passed: failures.length === 0,
      total_results: result.results.length,
      failures,
      expected_ranks: expectedRanks.map(({ matcher, max_rank, rank }) => ({ matcher, max_rank, rank })),
      forbidden_hits: excludedRanks.filter(entry => entry.rank !== null).length,
      primary_expected_rank: expectedRanks[0]?.rank ?? null,
      top_result: result.results[0] ?? null,
    };
  } finally {
    await core?.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  const fixturePath = process.argv[2];
  if (!fixturePath) {
    console.error('Usage: node scripts/run-benchmark-fixture.mjs <fixture.json>');
    process.exit(1);
  }

  const absolutePath = path.resolve(process.cwd(), fixturePath);
  const fixture = readFixture(absolutePath);
  const results = [];
  for (const scenario of fixture.scenarios ?? []) {
    results.push(await runScenario(fixture.name ?? path.basename(fixturePath), scenario));
  }

  const summary = {
    fixture: fixture.name ?? path.basename(fixturePath),
    scenarios: results.length,
    passed: results.filter(result => result.passed).length,
    failed: results.filter(result => !result.passed).length,
    pass_rate: results.length === 0 ? 0 : results.filter(result => result.passed).length / results.length,
    scored_scenarios: results.filter(result => result.expected_ranks.length > 0).length,
    hit_at_1: (() => {
      const scored = results.filter(result => result.expected_ranks.length > 0);
      return scored.length === 0 ? 0 : scored.filter(result => result.primary_expected_rank === 1).length / scored.length;
    })(),
    mean_reciprocal_rank: (() => {
      const scored = results.filter(result => result.expected_ranks.length > 0);
      return scored.length === 0
        ? 0
        : scored.reduce((sum, result) => sum + (result.primary_expected_rank ? 1 / result.primary_expected_rank : 0), 0) / scored.length;
    })(),
    forbidden_hits: results.reduce((sum, result) => sum + result.forbidden_hits, 0),
    results,
  };

  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed > 0) {
    process.exit(1);
  }
}

await main();
