import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lock = JSON.parse(
  readFileSync(resolve(repositoryRoot, 'smartware-vendor.lock.json'), 'utf8'),
);

const output = execFileSync(
  'git',
  [
    'ls-remote',
    lock.repository,
    'refs/heads/main',
    'refs/tags/v*',
    'refs/tags/v*^{}',
  ],
  { encoding: 'utf8' },
);

const refs = new Map();
for (const line of output.trim().split('\n').filter(Boolean)) {
  const [commit, ref] = line.split(/\s+/u);
  refs.set(ref, commit);
}

const stableTags = [...refs.keys()]
  .filter(ref => /^refs\/tags\/v\d+\.\d+\.\d+$/u.test(ref))
  .map(ref => ref.replace('refs/tags/', ''));

function compareVersions(left, right) {
  const leftParts = left.slice(1).split('.').map(Number);
  const rightParts = right.slice(1).split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) {
      return leftParts[index] - rightParts[index];
    }
  }
  return 0;
}

stableTags.sort(compareVersions);
const latestTag = stableTags.at(-1);
if (!latestTag) {
  throw new Error('No stable Smartware release tags were found upstream');
}

const pinnedRef = `refs/tags/${lock.release.tag}`;
const remotePinnedCommit = refs.get(`${pinnedRef}^{}`) ?? refs.get(pinnedRef);
if (!remotePinnedCommit) {
  throw new Error(`Pinned Smartware tag ${lock.release.tag} does not exist upstream`);
}
if (remotePinnedCommit !== lock.release.commit) {
  throw new Error(
    `Pinned Smartware tag ${lock.release.tag} resolves to ${remotePinnedCommit}, `
    + `not recorded commit ${lock.release.commit}`,
  );
}
if (latestTag !== lock.release.tag) {
  throw new Error(
    `A newer stable Smartware release is available: ${latestTag} `
    + `(Pod pins ${lock.release.tag})`,
  );
}

console.log(
  `Smartware is current: ${lock.release.tag} @ ${lock.release.commit.slice(0, 12)}`,
);

const mainCommit = refs.get('refs/heads/main');
if (mainCommit && mainCommit !== lock.release.commit) {
  console.log(
    `Upstream main is ${mainCommit.slice(0, 12)}; treat it as unreleased until it receives a stable tag.`,
  );
}
