import assert from 'node:assert/strict';
import test from 'node:test';

import {
  connectionRequestDetails,
  type ConnectionManagementTab,
} from '../src/connection-request.ts';

test('builds a tailored request email for every Connections tab', () => {
  const expectations: Record<ConnectionManagementTab, {
    label: string;
    subject: string;
    bodyIncludes: string;
  }> = {
    sources: {
      label: 'Request connector',
      subject: 'Pod connector / MCP request',
      bodyIncludes: 'connector or MCP integration',
    },
    agents: {
      label: 'Request agent',
      subject: 'Pod agent request',
      bodyIncludes: 'support for an agent',
    },
    models: {
      label: 'Request model',
      subject: 'Pod model request',
      bodyIncludes: 'model or model provider',
    },
  };

  for (const tab of Object.keys(expectations) as ConnectionManagementTab[]) {
    const details = connectionRequestDetails(tab);
    const mailto = new URL(details.mailto);

    assert.equal(details.label, expectations[tab].label);
    assert.equal(mailto.pathname, 'tech@techno.ventures');
    assert.equal(mailto.searchParams.get('subject'), expectations[tab].subject);
    assert.match(mailto.searchParams.get('body') ?? '', new RegExp(expectations[tab].bodyIncludes));
  }
});
