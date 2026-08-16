// Rollout telemetry (PR-20). Plan §7 — cross-cutting P2.
//
// Aggregates over the canonical operations log to surface the metrics
// the plan wants tracked during rollout:
//   - operation_id conflict rate
//   - cascade_required_ack frequency at commit
//   - ACCESS deny rate per actor_id
//   - fencing exclusion counts (post-A3 emitter migration)
//   - preview expired + not_found rates
//   - guardian quarantine entries
//   - conformance suite failures (test runner aggregates this separately)

import {
  readAllOpLogEntries,
  type OpLogEntry,
  type SmartwareCore,
} from 'smartware';

export interface TelemetryReport {
  total_operations: number;
  by_op: Record<string, number>;
  by_actor: Record<string, number>;
  /** Operations producing each ops-log entry with `op: access.deny`. */
  access_deny_rate_per_actor: Record<string, number>;
  /** Endorsements where cascade_required_ack was returned (commit-without-preview). */
  cascade_required_ack_count: number;
  /** Inferred from details — preview_expired and preview_not_found are surfaced via API but the count of dry-run/commits is in the log. */
  endorsement_count: number;
  /** Guardian runs and any errors flagged. */
  guardian_runs: number;
  guardian_errors_total: number;
  /** Window timestamps. */
  since: string;
  until: string;
}

export function aggregateTelemetry(core: SmartwareCore, sinceIso?: string): TelemetryReport {
  const report: TelemetryReport = {
    total_operations: 0,
    by_op: {},
    by_actor: {},
    access_deny_rate_per_actor: {},
    cascade_required_ack_count: 0,
    endorsement_count: 0,
    guardian_runs: 0,
    guardian_errors_total: 0,
    since: sinceIso ?? '',
    until: new Date().toISOString(),
  };

  let earliest = '';
  for (const entry of readAllOpLogEntries(core.opsDir)) {
    if (sinceIso && entry.timestamp < sinceIso) continue;
    if (!earliest || entry.timestamp < earliest) earliest = entry.timestamp;

    report.total_operations += 1;
    report.by_op[entry.op] = (report.by_op[entry.op] ?? 0) + 1;
    report.by_actor[entry.actor_id] = (report.by_actor[entry.actor_id] ?? 0) + 1;

    if (entry.op === 'access.deny') {
      report.access_deny_rate_per_actor[entry.actor_id] = (report.access_deny_rate_per_actor[entry.actor_id] ?? 0) + 1;
    }
    if (entry.op === 'endorse') {
      report.endorsement_count += 1;
      const details = (entry.details ?? {}) as { cascade_required_ack?: boolean };
      if (details.cascade_required_ack) report.cascade_required_ack_count += 1;
    }
    if (entry.op === 'guardian') {
      report.guardian_runs += 1;
      const details = (entry.details ?? {}) as { errors_count?: number };
      report.guardian_errors_total += details.errors_count ?? 0;
    }
  }

  if (!report.since) report.since = earliest;
  return report;
}
