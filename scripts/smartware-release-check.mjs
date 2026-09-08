#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const packageJson = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
const lockJson = JSON.parse(fs.readFileSync(path.join(cwd, 'package-lock.json'), 'utf8'));

const trackedPackages = ['smartware', '@technodotventures/smartware-connectors'];
const mode = (process.argv[2] ?? '').trim();

function lockVersion(name) {
  return lockJson.packages?.[`node_modules/${name}`]?.version ?? null;
}

function installedVersion(name) {
  try {
    const pkgPath = path.join(cwd, 'node_modules', name, 'package.json');
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8')).version;
  } catch {
    return null;
  }
}

function latestPublishedVersion(name) {
  const raw = execFileSync('npm', ['view', name, 'version', '--json'], { encoding: 'utf8' }).trim();
  return JSON.parse(raw);
}

function fail(lines) {
  for (const line of lines) console.error(line);
  process.exit(1);
}

if (mode !== 'verify' && mode !== 'upstream') {
  fail([
    'Usage: node scripts/smartware-release-check.mjs <verify|upstream>',
    '  verify   — confirm package-lock and installed versions match',
    '  upstream — fail when npm publishes a newer stable release',
  ]);
}

const problems = [];
for (const name of trackedPackages) {
  const declared = packageJson.dependencies?.[name];
  if (!declared) {
    problems.push(`package.json is missing dependency ${name}`);
    continue;
  }

  const locked = lockVersion(name);
  if (!locked) {
    problems.push(`package-lock.json is missing ${name}`);
    continue;
  }

  if (mode === 'verify') {
    const installed = installedVersion(name);
    if (!installed) {
      problems.push(`node_modules does not contain ${name}`);
      continue;
    }
    if (installed !== locked) {
      problems.push(`${name}: installed ${installed} does not match package-lock ${locked}`);
    }
  }

  if (mode === 'upstream') {
    const latest = latestPublishedVersion(name);
    if (latest !== locked) {
      problems.push(`${name}: latest published ${latest} is newer than pinned ${locked}`);
    }
  }
}

if (problems.length > 0) {
  fail(problems);
}

if (mode === 'verify') {
  console.log(`Smartware release lock verified: ${trackedPackages.map((name) => `${name}@${lockVersion(name)}`).join(', ')}`);
} else {
  console.log(`Smartware upstream freshness verified: ${trackedPackages.map((name) => `${name}@${lockVersion(name)}`).join(', ')}`);
}
