import assert from 'node:assert/strict';
import test from 'node:test';

import {
  deleteEmailPassword,
  EMAIL_KEYCHAIN_SERVICE,
  readEmailPassword,
  storeEmailPassword,
  type SecurityCommandRunner,
} from '../services/macos-keychain.js';

test('email credentials travel through stdin and never through process arguments', async () => {
  const calls: Array<{ args: string[]; stdin?: string }> = [];
  const runner: SecurityCommandRunner = async (args, stdin) => {
    calls.push({ args, ...(stdin === undefined ? {} : { stdin }) });
    return { stdout: '', stderr: '', code: 0 };
  };

  await storeEmailPassword(' Owner@iCloud.com ', 'private-app-password', runner, true);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.stdin, 'private-app-password');
  assert.equal(calls[0]!.args.includes('private-app-password'), false);
  assert.deepEqual(calls[0]!.args, [
    'add-generic-password', '-U', '-a', 'owner@icloud.com', '-s', EMAIL_KEYCHAIN_SERVICE, '-w',
  ]);
});

test('email credentials can be read and an already absent entry disconnects cleanly', async () => {
  const reader: SecurityCommandRunner = async () => ({ stdout: 'private-app-password\n', stderr: '', code: 0 });
  assert.equal(await readEmailPassword('owner@icloud.com', reader, true), 'private-app-password');

  const missing: SecurityCommandRunner = async () => ({ stdout: '', stderr: 'not found', code: 44 });
  await assert.doesNotReject(deleteEmailPassword('owner@icloud.com', missing, true));
});
