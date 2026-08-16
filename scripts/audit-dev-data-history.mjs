#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const trackedPaths = ['coffee-pod-dev-data', 'coffee-pod-dev-data-v1'];

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: process.cwd(),
    encoding: options.encoding ?? 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

const secretPatterns = [
  ['private_key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['openai_key', /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ['github_token', /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b|\bgithub_pat_[A-Za-z0-9_]{20,}\b/],
  ['slack_token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['google_api_key', /\bAIza[A-Za-z0-9_-]{30,}\b/],
  ['aws_access_key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['jwt', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/],
  ['credential_field', /["'](?:api[_-]?key|client[_-]?secret|refresh[_-]?token|access[_-]?token|password)["']\s*:\s*["'][^"'\r\n]{8,}["']/i],
];

const privateSignals = [
  ['email_address', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
  ['user_home_path', /\/Users\/[^/\s]+\//],
];

const revisions = git(['log', '--all', '--format=%H', '--', ...trackedPaths])
  .trim()
  .split('\n')
  .filter(Boolean);
const objectLines = git(['rev-list', '--objects', '--all', '--', ...trackedPaths])
  .trim()
  .split('\n')
  .filter(Boolean);

const blobs = new Map();
for (const line of objectLines) {
  const separator = line.indexOf(' ');
  if (separator < 0) continue;
  const objectId = line.slice(0, separator);
  const path = line.slice(separator + 1);
  if (!trackedPaths.some((trackedPath) => path.startsWith(`${trackedPath}/`))) continue;
  const type = git(['cat-file', '-t', objectId]).trim();
  if (type !== 'blob') continue;
  blobs.set(`${objectId}:${path}`, { objectId, path });
}

const secretFindings = [];
const privateDataFindings = [];
let totalBytes = 0;
let databaseBlobCount = 0;

for (const { objectId, path } of blobs.values()) {
  const content = git(['cat-file', 'blob', objectId], { encoding: 'buffer' });
  totalBytes += content.length;
  const text = content.toString('utf8');
  const matches = secretPatterns.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  if (matches.length > 0) {
    secretFindings.push({ object: objectId.slice(0, 12), path, patterns: matches });
  }

  const signals = privateSignals.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  if (/\.(?:db|db-wal|db-shm)$/.test(path)) {
    signals.push('sqlite_artifact');
    databaseBlobCount += 1;
  }
  if (/\/(?:vault|wiki)\//.test(path) || /journal/i.test(path)) {
    signals.push('memory_document');
  }
  if (signals.length > 0) {
    privateDataFindings.push({ object: objectId.slice(0, 12), path, signals: [...new Set(signals)] });
  }
}

const report = {
  tracked_paths: trackedPaths,
  revisions_containing_path: revisions.length,
  unique_historical_blobs: blobs.size,
  historical_bytes_scanned: totalBytes,
  database_blobs: databaseBlobCount,
  high_confidence_secret_findings: secretFindings,
  private_data_findings: privateDataFindings,
  history_rewrite_recommended: secretFindings.length > 0 || privateDataFindings.length > 0,
  note: 'The report intentionally omits all matched values and file contents.',
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
