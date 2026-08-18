import { createHash } from 'node:crypto';
import {
  appendFile,
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
} from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { arch, platform, release } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

import {
  integrationPublicStatus,
  listIntegrations,
  readIntegrationConfig,
} from '@technodotventures/smartware-connectors';
import { readOperationIntentRecords } from 'smartware';

import type { CoffeePodEnv } from '../config/env.js';
import { getDb } from '../pod/db.js';
import { getPodProfile, getSmartwareCore } from '../smartware/core.js';
import { aggregateTelemetry } from './telemetry.js';

const DIAGNOSTIC_SCHEMA_VERSION = 'coffee-pod-diagnostics/1' as const;
const EVENT_SCHEMA_VERSION = 1 as const;
const EVENT_RETENTION_DAYS = 7;
const EVENT_LIMIT = 100;
const EVENT_FILE_MAX_BYTES = 1024 * 1024;

const OP_TYPES = [
  'observe',
  'recall',
  'reflect.explicit',
  'reflect.auto',
  'reflect.profile',
  'revise.claim',
  'endorse',
  'revive',
  'forget',
  'session.start',
  'session.end',
  'watch.subscribe',
  'watch.event',
  'access.allow',
  'access.deny',
  'guardian',
  'dream.verify',
  'dream.extract_relations',
  'dream.detect_conflicts',
  'dream.recompile_pages',
  'dream.check_capacity',
  'dream.find_orphans',
] as const;

const SAFE_ERROR_NAMES = new Set([
  'Error',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'SyntaxError',
  'URIError',
  'AggregateError',
]);
const SAFE_ERROR_CODE = /^(?:ERR|FST|SQLITE|UND_ERR)_[A-Z0-9_]{1,64}$|^E[A-Z0-9_]{1,24}$/;
const SAFE_VERSION = /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$/;
const SAFE_INTEGRATION_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const SAFE_ROUTE = /^\/[A-Za-z0-9_./:*-]{0,159}$/;
const FORBIDDEN_KEYS = new Set([
  'authorization',
  'cookie',
  'token',
  'access_token',
  'refresh_token',
  'api_key',
  'client_secret',
  'content',
  'prompt',
  'message',
  'stack',
  'data_dir',
  'owner_id',
  'actor_id',
  'instance_id',
  'operation_id',
  'source_id',
  'path',
]);
const SECRET_VALUE = /(?:\bBearer\s+[A-Za-z0-9._~+/-]+|\b(?:cpod|sk|ghp|gho|xox[baprs])[-_][A-Za-z0-9._-]{8,}|\b(?:access_token|refresh_token|client_secret|api[_-]?key)\b)/i;
const USER_PATH_VALUE = /(?:\/(?:Users|home)\/[^/\s]+|[A-Za-z]:\\Users\\[^\\\s]+)/;

export interface DiagnosticEvent {
  version: 1;
  timestamp: string;
  kind: 'request_error';
  method: string;
  route: string;
  status_code: number;
  error_name: string;
  error_code: string | null;
  fingerprint: string;
}

export interface DiagnosticReport {
  schema_version: typeof DIAGNOSTIC_SCHEMA_VERSION;
  generated_at: string;
  privacy: {
    memory_content_included: false;
    user_identifiers_included: false;
    credentials_included: false;
    raw_logs_included: false;
    report_persisted_by_pod: false;
    automatic_upload: false;
  };
  runtime: {
    pod_version: string;
    smartware_version: string;
    node_version: string;
    electron_version: string | null;
    platform: string;
    platform_release: string;
    architecture: string;
    mode: 'desktop' | 'local' | 'hosted';
    uptime_seconds: number;
    auth_configured: boolean;
  };
  pod_database: {
    quick_check: 'ok' | 'failed' | 'unavailable';
    user_version: number;
  };
  smartware: {
    available: boolean;
    layer0: { total: number; by_status: Record<string, number>; last_sequence: number };
    layer1: { claims: number; entities: number; last_replayed_sequence: number };
    layer2: { pages: number };
    layer3: { indexed: number };
    active_grants: number;
  };
  operations: {
    readable: boolean;
    total: number;
    by_type: Record<string, number>;
    access_denials: number;
    intent_records: number;
    malformed_intent_records: number;
  };
  integrations: Array<{
    id: string;
    availability: 'ready' | 'config_only' | 'coming_soon';
    status: 'active' | 'configured' | 'disconnected' | 'config_error';
    scope_mismatch: boolean;
  }>;
  recent_errors: {
    window_days: number;
    discarded_entries: number;
    events: DiagnosticEvent[];
  };
  summary: {
    status: 'ok' | 'attention_required';
    issue_codes: string[];
  };
}

interface DiagnosticEventInput {
  method?: string;
  route?: string;
  statusCode?: number;
  error: Error & { code?: unknown; statusCode?: unknown };
}

const eventWriteQueues = new Map<string, Promise<void>>();

function diagnosticsDir(dataDir: string): string {
  return path.join(dataDir, 'diagnostics');
}

function eventsPath(dataDir: string): string {
  return path.join(diagnosticsDir(dataDir), 'events.jsonl');
}

function previousEventsPath(dataDir: string): string {
  return path.join(diagnosticsDir(dataDir), 'events.previous.jsonl');
}

function safeVersion(value: unknown): string {
  return typeof value === 'string' && SAFE_VERSION.test(value) ? value : 'unknown';
}

function readPodVersion(): string {
  try {
    const packageJson = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version?: unknown };
    return safeVersion(packageJson.version);
  } catch {
    return 'unknown';
  }
}

function deploymentMode(env: CoffeePodEnv): 'desktop' | 'local' | 'hosted' {
  if (process.versions['electron']) return 'desktop';
  if (env.host === '127.0.0.1' || env.host === 'localhost' || env.host === '::1') return 'local';
  return 'hosted';
}

function sanitizeRoute(route: unknown): string {
  if (typeof route !== 'string') return 'unknown';
  const withoutQuery = route.split('?')[0] ?? '';
  if (!SAFE_ROUTE.test(withoutQuery)) return 'unknown';
  const segments = withoutQuery.split('/').map(segment => {
    if (segment.startsWith(':') || segment === '*') return segment;
    return segment.length > 48 ? ':value' : segment;
  });
  return segments.join('/');
}

function sanitizeMethod(method: unknown): string {
  if (typeof method !== 'string') return 'UNKNOWN';
  const upper = method.toUpperCase();
  return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].includes(upper) ? upper : 'UNKNOWN';
}

function sanitizeErrorName(name: unknown): string {
  return typeof name === 'string' && SAFE_ERROR_NAMES.has(name) ? name : 'Error';
}

function sanitizeErrorCode(code: unknown): string | null {
  return typeof code === 'string' && SAFE_ERROR_CODE.test(code) ? code : null;
}

function buildDiagnosticEvent(input: DiagnosticEventInput): DiagnosticEvent {
  const method = sanitizeMethod(input.method);
  const route = sanitizeRoute(input.route);
  const errorName = sanitizeErrorName(input.error.name);
  const errorCode = sanitizeErrorCode(input.error.code);
  const fromError = typeof input.error.statusCode === 'number' ? input.error.statusCode : undefined;
  const candidateStatus = fromError ?? input.statusCode ?? 500;
  const statusCode = Number.isInteger(candidateStatus) && candidateStatus >= 100 && candidateStatus <= 599
    ? candidateStatus
    : 500;
  const fingerprint = createHash('sha256')
    .update(`${method}|${route}|${statusCode}|${errorName}|${errorCode ?? ''}`)
    .digest('hex')
    .slice(0, 16);

  return {
    version: EVENT_SCHEMA_VERSION,
    timestamp: new Date().toISOString(),
    kind: 'request_error',
    method,
    route,
    status_code: statusCode,
    error_name: errorName,
    error_code: errorCode,
    fingerprint,
  };
}

async function appendDiagnosticEvent(dataDir: string, event: DiagnosticEvent): Promise<void> {
  const directory = diagnosticsDir(dataDir);
  const file = eventsPath(dataDir);
  const previous = previousEventsPath(dataDir);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);

  try {
    const current = await stat(file);
    if (current.size >= EVENT_FILE_MAX_BYTES) {
      await rm(previous, { force: true });
      await rename(file, previous);
      await chmod(previous, 0o600);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  await appendFile(file, `${JSON.stringify(event)}\n`, { encoding: 'utf8', mode: 0o600 });
  await chmod(file, 0o600);
}

export async function recordDiagnosticRequestError(dataDir: string, input: DiagnosticEventInput): Promise<void> {
  const event = buildDiagnosticEvent(input);
  const previous = eventWriteQueues.get(dataDir) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(() => appendDiagnosticEvent(dataDir, event));
  eventWriteQueues.set(dataDir, next);
  try {
    await next;
  } finally {
    if (eventWriteQueues.get(dataDir) === next) eventWriteQueues.delete(dataDir);
  }
}

function isDiagnosticEvent(value: unknown): value is DiagnosticEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<DiagnosticEvent>;
  return event.version === EVENT_SCHEMA_VERSION
    && typeof event.timestamp === 'string'
    && Number.isFinite(Date.parse(event.timestamp))
    && event.kind === 'request_error'
    && sanitizeMethod(event.method) === event.method
    && sanitizeRoute(event.route) === event.route
    && Number.isInteger(event.status_code)
    && typeof event.status_code === 'number'
    && event.status_code >= 100
    && event.status_code <= 599
    && sanitizeErrorName(event.error_name) === event.error_name
    && (event.error_code === null || sanitizeErrorCode(event.error_code) === event.error_code)
    && typeof event.fingerprint === 'string'
    && /^[a-f0-9]{16}$/.test(event.fingerprint);
}

async function readRecentDiagnosticEvents(dataDir: string): Promise<{ events: DiagnosticEvent[]; discarded: number }> {
  const records: DiagnosticEvent[] = [];
  let discarded = 0;
  for (const file of [previousEventsPath(dataDir), eventsPath(dataDir)]) {
    let raw = '';
    try {
      raw = await readFile(file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') discarded += 1;
      continue;
    }
    for (const line of raw.split('\n').filter(Boolean)) {
      try {
        const parsed = JSON.parse(line) as unknown;
        if (isDiagnosticEvent(parsed)) records.push(parsed);
        else discarded += 1;
      } catch {
        discarded += 1;
      }
    }
  }

  const cutoff = Date.now() - EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const events = records
    .filter(event => Date.parse(event.timestamp) >= cutoff)
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
    .slice(-EVENT_LIMIT);
  return { events, discarded };
}

export function registerDiagnosticErrorCapture(app: FastifyInstance, env: CoffeePodEnv): void {
  app.addHook('onError', async (request, reply, error) => {
    try {
      await recordDiagnosticRequestError(env.dataDir, {
        method: request.method,
        route: request.routeOptions.url,
        statusCode: reply.statusCode,
        error,
      });
    } catch {
      // Diagnostics must never alter the response or create an error loop.
    }
  });
}

function inspectValue(value: unknown, location: string): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => inspectValue(entry, `${location}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
        throw new Error(`Diagnostics privacy check rejected key at ${location}.${key}`);
      }
      inspectValue(entry, `${location}.${key}`);
    }
    return;
  }
  if (typeof value === 'string' && (SECRET_VALUE.test(value) || USER_PATH_VALUE.test(value))) {
    throw new Error(`Diagnostics privacy check rejected value at ${location}`);
  }
}

export function assertDiagnosticsSafe(report: unknown): void {
  inspectValue(report, '$');
}

export async function generateDiagnosticReport(env: CoffeePodEnv): Promise<DiagnosticReport> {
  const issues = new Set<string>();
  const generatedAt = new Date().toISOString();
  const core = await getSmartwareCore(env);

  let dbQuickCheck: DiagnosticReport['pod_database']['quick_check'] = 'unavailable';
  let dbUserVersion = 0;
  try {
    const db = getDb(env);
    const quickCheck = db.pragma('quick_check', { simple: true }) as unknown;
    dbQuickCheck = quickCheck === 'ok' ? 'ok' : 'failed';
    const userVersion = db.pragma('user_version', { simple: true }) as unknown;
    dbUserVersion = typeof userVersion === 'number' && Number.isInteger(userVersion) ? userVersion : 0;
  } catch {
    dbQuickCheck = 'unavailable';
  }
  if (dbQuickCheck !== 'ok') issues.add('pod_database_check_failed');

  let smartwareVersion = 'unknown';
  try {
    smartwareVersion = safeVersion(core.getConfig().version);
  } catch {
    issues.add('smartware_config_unavailable');
  }

  const smartware: DiagnosticReport['smartware'] = {
    available: false,
    layer0: { total: 0, by_status: {}, last_sequence: 0 },
    layer1: { claims: 0, entities: 0, last_replayed_sequence: 0 },
    layer2: { pages: 0 },
    layer3: { indexed: 0 },
    active_grants: 0,
  };
  try {
    const status = await core.status();
    const byStatus: Record<string, number> = {};
    for (const key of ['accepted', 'quarantined', 'tombstoned', 'redacted', 'rejected']) {
      const count = status.layer0.by_status[key];
      if (typeof count === 'number' && count > 0) byStatus[key] = count;
    }
    smartware.available = true;
    smartware.layer0 = { total: status.layer0.total, by_status: byStatus, last_sequence: status.layer0.last_sequence };
    smartware.layer1 = status.layer1;
    smartware.layer2 = status.layer2;
    smartware.layer3 = status.layer3;
    smartware.active_grants = status.grants;
    smartwareVersion = safeVersion(status.version);
    if (status.layer1.last_replayed_sequence < status.layer0.last_sequence) issues.add('smartware_replay_lag');
  } catch {
    issues.add('smartware_status_unavailable');
  }

  const operations: DiagnosticReport['operations'] = {
    readable: false,
    total: 0,
    by_type: {},
    access_denials: 0,
    intent_records: 0,
    malformed_intent_records: 0,
  };
  try {
    const telemetry = aggregateTelemetry(core);
    operations.readable = true;
    operations.total = telemetry.total_operations;
    for (const op of OP_TYPES) {
      const count = telemetry.by_op[op];
      if (typeof count === 'number' && count > 0) operations.by_type[op] = count;
    }
    operations.access_denials = Object.values(telemetry.access_deny_rate_per_actor)
      .reduce((sum, count) => sum + count, 0);
  } catch {
    issues.add('operations_log_unreadable');
  }

  try {
    const intentRecords = readOperationIntentRecords(core.opsDir);
    operations.intent_records = intentRecords.length;
    operations.malformed_intent_records = intentRecords.filter(record => !record.intent).length;
    if (operations.intent_records > 0) issues.add('operation_intents_unresolved');
    if (operations.malformed_intent_records > 0) issues.add('operation_intents_malformed');
  } catch {
    issues.add('operation_intents_unreadable');
  }

  const integrations: DiagnosticReport['integrations'] = [];
  for (const definition of listIntegrations()) {
    if (!SAFE_INTEGRATION_ID.test(definition.id)) continue;
    try {
      const config = await readIntegrationConfig(env, definition.id);
      const publicStatus = integrationPublicStatus(definition, config);
      const candidate = publicStatus['status'];
      const status = candidate === 'active' || candidate === 'configured' || candidate === 'disconnected'
        ? candidate
        : 'config_error';
      const scopeMismatch = publicStatus['scope_mismatch'] === true;
      integrations.push({
        id: definition.id,
        availability: definition.availability,
        status,
        scope_mismatch: scopeMismatch,
      });
      if (status === 'config_error') issues.add('integration_config_error');
      if (scopeMismatch) issues.add('integration_scope_mismatch');
    } catch {
      integrations.push({
        id: definition.id,
        availability: definition.availability,
        status: 'config_error',
        scope_mismatch: false,
      });
      issues.add('integration_config_error');
    }
  }

  const recent = await readRecentDiagnosticEvents(env.dataDir);
  if (recent.events.some(event => event.status_code >= 500)) issues.add('recent_request_errors');
  if (recent.discarded > 0) issues.add('diagnostic_events_discarded');

  const issueCodes = [...issues].sort();
  const report: DiagnosticReport = {
    schema_version: DIAGNOSTIC_SCHEMA_VERSION,
    generated_at: generatedAt,
    privacy: {
      memory_content_included: false,
      user_identifiers_included: false,
      credentials_included: false,
      raw_logs_included: false,
      report_persisted_by_pod: false,
      automatic_upload: false,
    },
    runtime: {
      pod_version: readPodVersion(),
      smartware_version: smartwareVersion,
      node_version: safeVersion(process.versions.node),
      electron_version: process.versions['electron'] ? safeVersion(process.versions['electron']) : null,
      platform: safeVersion(platform()),
      platform_release: safeVersion(release()),
      architecture: safeVersion(arch()),
      mode: deploymentMode(env),
      uptime_seconds: Math.floor(process.uptime()),
      auth_configured: Boolean(env.apiToken),
    },
    pod_database: {
      quick_check: dbQuickCheck,
      user_version: dbUserVersion,
    },
    smartware,
    operations,
    integrations,
    recent_errors: {
      window_days: EVENT_RETENTION_DAYS,
      discarded_entries: recent.discarded,
      events: recent.events,
    },
    summary: {
      status: issueCodes.length > 0 ? 'attention_required' : 'ok',
      issue_codes: issueCodes,
    },
  };

  assertDiagnosticsSafe(report);
  return report;
}
