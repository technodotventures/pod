export type ConnectionManagementTab = 'sources' | 'agents' | 'models';

interface ConnectionRequestDetails {
  label: string;
  subject: string;
  prompt: string;
}

const REQUEST_EMAIL = 'tech@techno.ventures';

const CONNECTION_REQUESTS: Record<ConnectionManagementTab, ConnectionRequestDetails> = {
  sources: {
    label: 'Request connector',
    subject: 'Pod connector / MCP request',
    prompt: [
      'Hi Coffee team,',
      '',
      "I'd like to request a new connector or MCP integration for Pod.",
      '',
      'Name:',
      'Link:',
      "How I'd use it:",
    ].join('\n'),
  },
  agents: {
    label: 'Request agent',
    subject: 'Pod agent request',
    prompt: [
      'Hi Coffee team,',
      '',
      "I'd like to request support for an agent in Pod.",
      '',
      'Agent:',
      'Link:',
      "How I'd use it:",
    ].join('\n'),
  },
  models: {
    label: 'Request model',
    subject: 'Pod model request',
    prompt: [
      'Hi Coffee team,',
      '',
      "I'd like to request support for a model or model provider in Pod.",
      '',
      'Model or provider:',
      'Link:',
      "How I'd use it:",
    ].join('\n'),
  },
};

export function connectionRequestDetails(tab: ConnectionManagementTab): {
  label: string;
  mailto: string;
} {
  const request = CONNECTION_REQUESTS[tab];
  const query = new URLSearchParams({
    subject: request.subject,
    body: request.prompt,
  });

  return {
    label: request.label,
    mailto: `mailto:${REQUEST_EMAIL}?${query.toString()}`,
  };
}
