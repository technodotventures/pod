/* Capability view utilities — pure, testable.
   Run 007 (capabilities UI audit improvements I3/I5/I8): revision diffs,
   instruction-file classification, freshness bucketing. */

export type ComponentKind = 'skill' | 'mcp_server' | 'extension';
export type ComponentStatus = 'valid' | 'invalid' | 'unsupported';

export interface DiffableComponent {
  component_type: ComponentKind;
  component_key: string;
  status: ComponentStatus;
}

export interface ComponentChange {
  key: string; // `${component_type}:${component_key}`
  type: ComponentKind;
  componentKey: string;
  kind: 'added' | 'removed' | 'status_changed';
  from?: ComponentStatus;
  to?: ComponentStatus;
}

export interface FileChange {
  path: string;
  kind: 'added' | 'changed' | 'removed';
  instruction: boolean;
}

/** SKILL.md is the instruction file; everything else is a resource. */
export function isInstructionFile(path: string): boolean {
  const base = path.split('/').pop() ?? path;
  return /^skill\.md$/i.test(base);
}

/** Changed-file list between a retained revision and an incoming revision. */
export function skillFileDiff(
  prev: Record<string, string> | null | undefined,
  next: Record<string, string> | null | undefined,
): FileChange[] {
  const before = prev ?? {};
  const after = next ?? {};
  const paths = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const changes: FileChange[] = [];
  for (const path of paths) {
    const inBefore = Object.prototype.hasOwnProperty.call(before, path);
    const inAfter = Object.prototype.hasOwnProperty.call(after, path);
    if (inAfter && !inBefore) {
      changes.push({ path, kind: 'added', instruction: isInstructionFile(path) });
    } else if (!inAfter && inBefore) {
      changes.push({ path, kind: 'removed', instruction: isInstructionFile(path) });
    } else if (before[path] !== after[path]) {
      changes.push({ path, kind: 'changed', instruction: isInstructionFile(path) });
    }
  }
  return changes;
}

/** Component-level diff between a retained plugin revision and an incoming one. */
export function pluginComponentDiff(
  prev: readonly DiffableComponent[] | null | undefined,
  next: readonly DiffableComponent[] | null | undefined,
): ComponentChange[] {
  const before = new Map((prev ?? []).map(c => [`${c.component_type}:${c.component_key}`, c]));
  const after = new Map((next ?? []).map(c => [`${c.component_type}:${c.component_key}`, c]));
  const keys = [...new Set([...before.keys(), ...after.keys()])].sort();
  const changes: ComponentChange[] = [];
  for (const key of keys) {
    const b = before.get(key);
    const a = after.get(key);
    if (a && !b) {
      changes.push({ key, type: a.component_type, componentKey: a.component_key, kind: 'added' });
    } else if (!a && b) {
      changes.push({ key, type: b.component_type, componentKey: b.component_key, kind: 'removed' });
    } else if (a && b && a.status !== b.status) {
      changes.push({
        key, type: a.component_type, componentKey: a.component_key,
        kind: 'status_changed', from: b.status, to: a.status,
      });
    }
  }
  return changes;
}

export type FreshnessBucket = 'fresh' | 'recent' | 'stale' | 'unknown';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Age bucket for freshness filters and chips. */
export function freshnessBucket(iso: string | null | undefined, nowMs: number = Date.now()): FreshnessBucket {
  if (!iso) return 'unknown';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return 'unknown';
  const age = nowMs - t;
  if (age < DAY_MS) return 'fresh';
  if (age < 7 * DAY_MS) return 'recent';
  return 'stale';
}
