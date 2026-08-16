#!/usr/bin/env node

const podUrl = process.env.COFFEE_POD_URL ?? 'http://127.0.0.1:8732';
const ownerToken = process.env.COFFEE_POD_API_TOKEN;

async function request(path, options = {}) {
  const headers = {
    accept: 'application/json',
    ...(options.body ? { 'content-type': 'application/json' } : {}),
    ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
  };
  const response = await fetch(`${podUrl}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

const health = await request('/health');
console.log('health', health);

const capabilitiesToken = ownerToken;
const capabilities = await request('/pod/capabilities', { token: capabilitiesToken });
console.log('capabilities', capabilities.protocol, capabilities.capabilities);

const connect = await request('/coffee/connect', {
  method: 'POST',
  token: ownerToken,
  body: {
    client_id: 'coffee-staging-smoke',
    client_name: 'Coffee Staging Smoke',
    pod_url: podUrl,
  },
});
console.log('connected', {
  client_id: connect.client_id,
  actor_id: connect.actor_id,
  token_prefix: connect.token_prefix,
});

const clientToken = connect.client_token;

const sync = await request('/coffee/sync/meetings', {
  method: 'POST',
  token: clientToken,
  body: {
    actor_id: connect.actor_id,
    meetings: [
      {
        id: 'staging-smoke-meeting',
        title: 'Pod staging smoke test',
        start_at: '2026-05-08T10:00:00.000Z',
        attendees: [{ name: 'Coffee CTO', email: 'cto@example.com' }],
        notes: 'Validate Coffee can sync meetings into a user-owned Pod.',
        documents: [
          {
            id: 'staging-smoke-doc',
            title: 'Pod staging contract',
            text: 'Coffee calls Pod sync, brief, capture, approvals, and query endpoints.',
          },
        ],
      },
    ],
  },
});
console.log('synced', sync);

const brief = await request('/coffee/meetings/staging-smoke-meeting/brief', {
  method: 'POST',
  token: clientToken,
  body: {
    actor_id: connect.actor_id,
    query: 'Pod staging smoke test staging contract',
  },
});
console.log('brief', {
  meeting_id: brief.meeting_id,
  source_count: brief.sources.length,
  preview: brief.brief.slice(0, 160),
});

const capture = await request('/coffee/meetings/staging-smoke-meeting/capture', {
  method: 'POST',
  token: clientToken,
  body: {
    actor_id: connect.actor_id,
    notes: 'Smoke test completed. Coffee staging can plug into the Pod contract.',
    decisions: ['Coffee staging will use Pod as the memory companion contract.'],
    tasks: ['Replace smoke payloads with real Coffee staging meetings.'],
    followups: [{ title: 'Share smoke result with Coffee team', to: 'cto@example.com' }],
  },
});
console.log('captured', capture);

const followups = await request('/pod/activity?scope_alias=app%3Acoffee&type=followup_drafted&limit=5', { token: clientToken });
console.log('followups', {
  count: followups.events.length,
  latest: followups.events[0],
});
