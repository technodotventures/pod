import crypto from 'node:crypto';
import { matchesTemporalConstraint, } from './temporal.js';
export const SEMANTIC_INDEX_VERSION = 1;
function stableValue(value) {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map(stableValue).join(',')}]`;
    }
    const record = value;
    return `{${Object.keys(record)
        .sort()
        .map(key => `${JSON.stringify(key)}:${stableValue(record[key])}`)
        .join(',')}}`;
}
function displayValue(value) {
    return typeof value === 'string' ? value : stableValue(value);
}
export function semanticModelKey(adapter) {
    return `${adapter.provider}/${adapter.model}`;
}
export function semanticContentHash(text) {
    return crypto.createHash('sha256').update(text).digest('hex');
}
/** Exact, order-independent identity of the documents eligible for indexing. */
export function semanticDocumentSetHash(documents) {
    validateDocuments(documents);
    return semanticSetHash(documents
        .map(document => ({
        id: document.id,
        scope: document.scope,
        content_hash: semanticContentHash(document.text),
    })));
}
export function semanticRecordSetHash(records) {
    return semanticSetHash(records);
}
function semanticSetHash(identity) {
    const sorted = [...identity].sort((left, right) => left.id.localeCompare(right.id)
        || left.scope.localeCompare(right.scope)
        || left.content_hash.localeCompare(right.content_hash));
    return crypto.createHash('sha256').update(stableValue(sorted)).digest('hex');
}
function validateDocuments(documents) {
    const ids = new Set();
    for (const document of documents) {
        if (!document.id)
            throw new Error('Semantic document id is required');
        if (ids.has(document.id)) {
            throw new Error(`Duplicate semantic document id: ${document.id}`);
        }
        ids.add(document.id);
    }
}
function validateVectors(vectors, expectedCount, expectedDimensions) {
    if (vectors.length !== expectedCount) {
        throw new Error('Embedding adapter must return one vector per input');
    }
    let dimensions = expectedDimensions;
    for (const vector of vectors) {
        if (!Array.isArray(vector) || vector.length === 0) {
            throw new Error('Embedding vectors must not be empty');
        }
        if (vector.some(value => !Number.isFinite(value))) {
            throw new Error('Embedding vectors must contain only finite numbers');
        }
        if (vector.every(value => value === 0)) {
            throw new Error('Embedding vectors must have a non-zero magnitude');
        }
        dimensions ??= vector.length;
        if (vector.length !== dimensions) {
            throw new Error(`Embedding vector dimensions must equal ${dimensions}`);
        }
    }
    if (dimensions === undefined) {
        throw new Error('Embedding dimensions could not be established');
    }
    return dimensions;
}
function validateTimeout(timeoutMs) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new Error('Semantic embedding timeout must be a positive number');
    }
}
async function embedWithTimeout(adapter, texts, timeoutMs) {
    validateTimeout(timeoutMs);
    let timeout;
    try {
        return await Promise.race([
            adapter.embed(texts),
            new Promise((_resolve, reject) => {
                timeout = setTimeout(() => reject(new Error(`Semantic embedding timed out after ${timeoutMs}ms`)), timeoutMs);
            }),
        ]);
    }
    finally {
        if (timeout !== undefined)
            clearTimeout(timeout);
    }
}
function isUsableRecord(record, adapter) {
    return record.model_key === semanticModelKey(adapter)
        && record.index_version === SEMANTIC_INDEX_VERSION
        && record.dimensions > 0
        && record.vector.length === record.dimensions
        && (adapter.dimensions === undefined || record.dimensions === adapter.dimensions)
        && record.vector.every(Number.isFinite)
        && record.vector.some(value => value !== 0);
}
function cosine(left, right) {
    if (left.length === 0 || left.length !== right.length)
        return null;
    let dot = 0;
    let leftMagnitude = 0;
    let rightMagnitude = 0;
    for (let index = 0; index < left.length; index += 1) {
        dot += left[index] * right[index];
        leftMagnitude += left[index] ** 2;
        rightMagnitude += right[index] ** 2;
    }
    if (leftMagnitude === 0 || rightMagnitude === 0)
        return null;
    return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}
export function claimToSemanticDocument(claim) {
    const predicate = claim.predicate.replace(/[_-]+/g, ' ').trim();
    return {
        id: claim.id,
        scope: claim.scope,
        version: claim.version_at ?? claim.created_at ?? claim.extraction.extracted_at,
        text: `${claim.subject_name.trim()}\n${predicate}: ${displayValue(claim.object.value)}`,
        valid_time: {
            from: claim.t_valid_from.value ?? claim.validity.from ?? null,
            to: claim.t_valid_to.value ?? claim.validity.to ?? null,
        },
        transaction_time: {
            from: claim.t_ingested.value ?? claim.created_at ?? claim.extraction.extracted_at,
            to: claim.t_invalidated.value,
        },
    };
}
/**
 * Update a rebuildable embedding record set.
 *
 * Only changed content or a changed model key triggers embedding work.
 * Deleted documents disappear from the returned records. Persistence belongs
 * to the host, allowing local files, SQLite, or a vector backend without
 * changing Smartware's retrieval semantics.
 */
export async function syncSemanticRecords(documents, existingRecords, adapter, batchSize = 64, timeoutMs = 30_000) {
    validateDocuments(documents);
    if (!Number.isInteger(batchSize) || batchSize < 1) {
        throw new Error('Semantic embedding batch size must be a positive integer');
    }
    validateTimeout(timeoutMs);
    const key = semanticModelKey(adapter);
    const existingById = new Map(existingRecords.map(record => [record.id, record]));
    const reusable = new Map();
    const missing = [];
    for (const document of documents) {
        const record = existingById.get(document.id);
        const hash = semanticContentHash(document.text);
        if (record
            && record.content_hash === hash
            && isUsableRecord(record, adapter)) {
            reusable.set(document.id, {
                ...record,
                scope: document.scope,
            });
        }
        else {
            missing.push(document);
        }
    }
    const embedded = new Map();
    let dimensions = adapter.dimensions;
    for (let offset = 0; offset < missing.length; offset += batchSize) {
        const batch = missing.slice(offset, offset + batchSize);
        const vectors = await embedWithTimeout(adapter, batch.map(document => document.text), timeoutMs);
        dimensions = validateVectors(vectors, batch.length, dimensions);
        batch.forEach((document, index) => {
            embedded.set(document.id, {
                id: document.id,
                scope: document.scope,
                content_hash: semanticContentHash(document.text),
                model_key: key,
                index_version: SEMANTIC_INDEX_VERSION,
                dimensions: dimensions,
                vector: [...vectors[index]],
            });
        });
    }
    const documentIds = new Set(documents.map(document => document.id));
    return {
        records: documents.map(document => reusable.get(document.id) ?? embedded.get(document.id)),
        embedded: missing.length,
        reused: reusable.size,
        removed: existingRecords.filter(record => !documentIds.has(record.id)).length,
    };
}
/**
 * Rank a policy-eligible document set by cosine similarity.
 *
 * The function never expands beyond `documents`: authorization, sensitivity,
 * lifecycle, and scope filtering must happen before this boundary. An explicit
 * temporal constraint is also applied before the query embedding is requested.
 */
export async function rankSemanticDocuments(query, documents, records, adapter, options) {
    validateDocuments(documents);
    if (!query.trim())
        return [];
    if (!Number.isFinite(options.min_similarity)
        || options.min_similarity < -1
        || options.min_similarity > 1) {
        throw new Error('Semantic minimum similarity must be between -1 and 1');
    }
    if (!Number.isInteger(options.limit) || options.limit < 1) {
        throw new Error('Semantic result limit must be a positive integer');
    }
    const timeoutMs = options.timeout_ms ?? 5_000;
    validateTimeout(timeoutMs);
    const eligible = options.temporal
        ? documents.filter(document => matchesTemporalConstraint(document, options.temporal))
        : documents;
    if (eligible.length === 0)
        return [];
    const key = semanticModelKey(adapter);
    const recordsById = new Map(records
        .filter(record => record.model_key === key && isUsableRecord(record, adapter))
        .map(record => [record.id, record]));
    const searchable = eligible.filter(document => {
        const record = recordsById.get(document.id);
        return record
            && record.content_hash === semanticContentHash(document.text)
            && record.vector.length === record.dimensions
            && (adapter.dimensions === undefined || record.dimensions === adapter.dimensions);
    });
    if (searchable.length === 0)
        return [];
    const queryVectors = await embedWithTimeout(adapter, [query], timeoutMs);
    const queryDimensions = validateVectors(queryVectors, 1, adapter.dimensions);
    const queryVector = queryVectors[0];
    return searchable
        .flatMap(document => {
        const record = recordsById.get(document.id);
        if (record.dimensions !== queryDimensions)
            return [];
        const similarity = cosine(queryVector, record.vector);
        if (similarity === null || similarity < options.min_similarity)
            return [];
        return [{ ...document, semantic_relevance: similarity }];
    })
        .sort((left, right) => right.semantic_relevance - left.semantic_relevance
        || left.id.localeCompare(right.id))
        .slice(0, options.limit);
}
//# sourceMappingURL=semantic.js.map