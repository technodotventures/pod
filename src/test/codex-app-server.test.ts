import assert from 'node:assert/strict';
import test from 'node:test';

import {
  codexAccountStatusFromResult,
  codexLoginStartFromResult,
  codexTextFromCompletedTurn,
} from '../services/codex-app-server.js';

test('Codex account responses distinguish ChatGPT plans from disconnected state', () => {
  assert.deepEqual(codexAccountStatusFromResult({
    account: { type: 'chatgpt', email: 'owner@example.com', planType: 'pro' },
  }), {
    available: true,
    connected: true,
    auth_mode: 'chatgpt',
    email: 'owner@example.com',
    plan_type: 'pro',
  });
  assert.equal(codexAccountStatusFromResult({ account: null }).connected, false);
});

test('Codex login responses retain only frontend-safe authorization fields', () => {
  assert.deepEqual(codexLoginStartFromResult({
    type: 'chatgptDeviceCode',
    loginId: 'login-1',
    verificationUrl: 'https://auth.openai.com/codex/device',
    userCode: 'ABCD-1234',
    accessToken: 'must-not-leak',
  }, 'device'), {
    login_id: 'login-1',
    mode: 'device',
    verification_url: 'https://auth.openai.com/codex/device',
    user_code: 'ABCD-1234',
    auth_url: undefined,
  });
});

test('Codex completed turns expose assistant text and reject empty or failed output', () => {
  assert.equal(codexTextFromCompletedTurn({
    status: 'completed',
    items: [
      { type: 'reasoning', content: ['private'] },
      { type: 'agentMessage', text: 'Useful answer' },
    ],
  }), 'Useful answer');
  assert.throws(() => codexTextFromCompletedTurn({ status: 'failed', items: [] }), /failed/);
  assert.throws(() => codexTextFromCompletedTurn({ status: 'completed', items: [] }), /no text/);
});
