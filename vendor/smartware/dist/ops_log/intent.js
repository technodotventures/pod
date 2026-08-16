// Operation intent write-ahead log.
//
// Intent files contain hashes and artifact identities, never memory content.
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync, } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { OPERATION_ID_PATTERN } from './types.js';
function hasCommonIntentFields(intent) {
    return intent.version === 1
        && typeof intent.operation_id === 'string'
        && OPERATION_ID_PATTERN.test(intent.operation_id)
        && typeof intent.actor_id === 'string'
        && typeof intent.payload_hash === 'string'
        && /^[a-f0-9]{64}$/.test(intent.payload_hash)
        && typeof intent.prepared_at === 'string';
}
function intentsDir(opsDir) {
    return join(opsDir, 'intents');
}
function intentPath(opsDir, operationId) {
    if (!OPERATION_ID_PATTERN.test(operationId)) {
        throw new Error(`Invalid operation intent id '${operationId}'`);
    }
    return join(intentsDir(opsDir), `${operationId}.json`);
}
function syncDirectory(directory) {
    let fd;
    try {
        fd = openSync(directory, 'r');
        fsyncSync(fd);
    }
    catch {
        // Some filesystems do not support directory fsync. The file itself was
        // fsynced before rename, so process-kill durability is still preserved.
    }
    finally {
        if (fd !== undefined)
            closeSync(fd);
    }
}
function isObservationIntent(value) {
    if (!value || typeof value !== 'object')
        return false;
    const intent = value;
    const expected = intent.expected;
    const result = intent.result;
    const details = intent.details;
    return hasCommonIntentFields(intent)
        && intent.op === 'observe'
        && expected?.surface === 'l0'
        && typeof expected.observation_id === 'string'
        && typeof expected.observation_hash === 'string'
        && Number.isInteger(expected.sequence)
        && result?.id === expected.observation_id
        && (result.status === 'accepted' || result.status === 'quarantined')
        && result.sequence === expected.sequence
        && typeof details?.scope === 'string'
        && typeof details.source === 'string';
}
function isReviseIntent(value) {
    if (!value || typeof value !== 'object')
        return false;
    const intent = value;
    const expected = intent.expected;
    const result = intent.result;
    const details = intent.details;
    return hasCommonIntentFields(intent)
        && intent.op === 'revise.claim'
        && expected?.surface === 'l1'
        && typeof expected.claim_id === 'string'
        && Number.isInteger(expected.version)
        && typeof expected.record_hash === 'string'
        && /^[a-f0-9]{64}$/.test(expected.record_hash)
        && Array.isArray(expected.relation_ids)
        && expected.relation_ids.every(relationId => typeof relationId === 'string')
        && result?.claim_id === expected.claim_id
        && result.new_version === expected.version
        && (result.epistemic_owner === 'agent' || result.epistemic_owner === 'user')
        && result.operation_id === intent.operation_id
        && result.status === 'revised'
        && details?.claim_id === expected.claim_id
        && details.new_version === expected.version;
}
function isForgetIntent(value) {
    if (!value || typeof value !== 'object')
        return false;
    const intent = value;
    const expected = intent.expected;
    const result = intent.result;
    const details = intent.details;
    const claimVersion = expected?.claim_version;
    const validMode = result?.mode === 'tombstone' || result?.mode === 'redact_if_supported';
    const validTargetKind = result?.target_kind === 'observation' || result?.target_kind === 'claim';
    return hasCommonIntentFields(intent)
        && intent.op === 'forget'
        && expected?.surface === 'forget'
        && typeof expected.audit?.observation_id === 'string'
        && typeof expected.audit.observation_hash === 'string'
        && Number.isInteger(expected.audit.sequence)
        && (claimVersion === undefined || (typeof claimVersion.claim_id === 'string'
            && Number.isInteger(claimVersion.version)
            && typeof claimVersion.record_hash === 'string'
            && /^[a-f0-9]{64}$/.test(claimVersion.record_hash)))
        && typeof result?.target_id === 'string'
        && validTargetKind
        && validMode
        && Number.isInteger(result.claims_retracted)
        && Number.isInteger(result.claims_reduced)
        && result.audit_observation_id === expected.audit.observation_id
        && result.status === 'forgotten'
        && details?.target_id === result.target_id
        && details.target_kind === result.target_kind
        && details.mode === result.mode
        && (result.target_kind === 'claim') === (claimVersion !== undefined);
}
function isReviveIntent(value) {
    if (!value || typeof value !== 'object')
        return false;
    const intent = value;
    const expected = intent.expected;
    const result = intent.result;
    const details = intent.details;
    return hasCommonIntentFields(intent)
        && intent.op === 'revive'
        && expected?.surface === 'l1'
        && typeof expected.claim_id === 'string'
        && Number.isInteger(expected.version)
        && typeof expected.record_hash === 'string'
        && /^[a-f0-9]{64}$/.test(expected.record_hash)
        && result?.claim_id === expected.claim_id
        && result.new_version === expected.version
        && result.operation_id === intent.operation_id
        && Array.isArray(result.invalidated_edges)
        && result.invalidated_edges.every(relationId => typeof relationId === 'string')
        && result.status === 'revived'
        && details?.claim_id === expected.claim_id
        && typeof details.tombstone_id === 'string';
}
function isEndorseIntent(value) {
    if (!value || typeof value !== 'object')
        return false;
    const intent = value;
    const expected = intent.expected;
    const result = intent.result;
    const details = intent.details;
    return hasCommonIntentFields(intent)
        && intent.op === 'endorse'
        && expected?.surface === 'endorse'
        && typeof expected.page?.page_id === 'string'
        && typeof expected.page.content_hash === 'string'
        && /^[a-f0-9]{64}$/.test(expected.page.content_hash)
        && Array.isArray(expected.claims)
        && expected.claims.every(claim => typeof claim.claim_id === 'string'
            && Number.isInteger(claim.version)
            && typeof claim.record_hash === 'string'
            && /^[a-f0-9]{64}$/.test(claim.record_hash))
        && result?.page_id === expected.page.page_id
        && result.claims_endorsed === expected.claims.length
        && result.operation_id === intent.operation_id
        && result.commit_ts === intent.prepared_at
        && result.status === 'endorsed'
        && details?.page_id === expected.page.page_id;
}
function isReflectClaimIntent(value) {
    if (!value || typeof value !== 'object')
        return false;
    const intent = value;
    const expected = intent.expected;
    const result = intent.result;
    const details = intent.details;
    return hasCommonIntentFields(intent)
        && intent.op === 'reflect.auto'
        && expected?.surface === 'l1'
        && typeof expected.claim_id === 'string'
        && Number.isInteger(expected.version)
        && typeof expected.record_hash === 'string'
        && /^[a-f0-9]{64}$/.test(expected.record_hash)
        && result?.claim_id === expected.claim_id
        && result.version === expected.version
        && result.status === 'reflected'
        && details?.claim_id === expected.claim_id
        && typeof details.fingerprint === 'string';
}
function parseIntent(raw, expectedOperationId) {
    const parsed = JSON.parse(raw);
    if ((!isObservationIntent(parsed)
        && !isReviseIntent(parsed)
        && !isForgetIntent(parsed)
        && !isReviveIntent(parsed)
        && !isEndorseIntent(parsed)
        && !isReflectClaimIntent(parsed))
        || parsed.operation_id !== expectedOperationId) {
        throw new Error(`Malformed operation intent '${expectedOperationId}'`);
    }
    return parsed;
}
export function readOperationIntent(opsDir, operationId) {
    const filePath = intentPath(opsDir, operationId);
    if (!existsSync(filePath))
        return null;
    return parseIntent(readFileSync(filePath, 'utf8'), operationId);
}
export function readOperationIntentRecords(opsDir) {
    const directory = intentsDir(opsDir);
    if (!existsSync(directory))
        return [];
    return readdirSync(directory)
        .filter(file => file.endsWith('.json'))
        .sort()
        .map(file => {
        const operationId = file.slice(0, -5);
        try {
            if (!OPERATION_ID_PATTERN.test(operationId))
                throw new Error('invalid filename');
            return {
                operation_id: operationId,
                intent: parseIntent(readFileSync(join(directory, file), 'utf8'), operationId),
            };
        }
        catch (error) {
            return { operation_id: operationId, error: error.message };
        }
    });
}
export function persistOperationIntent(opsDir, intent, allowMatchingReplacement = false) {
    if (!isObservationIntent(intent)
        && !isReviseIntent(intent)
        && !isForgetIntent(intent)
        && !isReviveIntent(intent)
        && !isEndorseIntent(intent)
        && !isReflectClaimIntent(intent)) {
        throw new Error('Invalid operation intent');
    }
    const directory = intentsDir(opsDir);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const existing = readOperationIntent(opsDir, intent.operation_id);
    if (existing) {
        const matchingIdentity = existing.op === intent.op
            && existing.actor_id === intent.actor_id
            && existing.payload_hash === intent.payload_hash;
        if (!matchingIdentity || !allowMatchingReplacement) {
            if (JSON.stringify(existing) === JSON.stringify(intent))
                return;
            throw new Error(`Operation intent '${intent.operation_id}' already exists with different state`);
        }
    }
    const destination = intentPath(opsDir, intent.operation_id);
    const temporary = join(directory, `.${intent.operation_id}.${process.pid}.${randomUUID()}.tmp`);
    const fd = openSync(temporary, 'wx', 0o600);
    try {
        writeFileSync(fd, `${JSON.stringify(intent, null, 2)}\n`, 'utf8');
        fsyncSync(fd);
    }
    finally {
        closeSync(fd);
    }
    renameSync(temporary, destination);
    syncDirectory(directory);
}
export function removeOperationIntent(opsDir, operationId) {
    const filePath = intentPath(opsDir, operationId);
    if (!existsSync(filePath))
        return;
    unlinkSync(filePath);
    syncDirectory(intentsDir(opsDir));
}
//# sourceMappingURL=intent.js.map