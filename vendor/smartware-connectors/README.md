# @smartware/connectors

Connector infrastructure for
[Smartware](https://github.com/technodotventures/Smartware)-powered apps.

Provides everything an app needs to connect to external services: OAuth token management, MCP client pool with Docker runtime, connection grants and audit logging, and a registry of integration definitions.

## Install

```bash
npm install @smartware/connectors
```

Peer dependencies (your app must provide):
- `@modelcontextprotocol/sdk` ^1.29.0
- `better-sqlite3` ^12.0.0

## Quick start

```typescript
import {
  type ConnectorEnv,
  ensureConnectorSchema,
  listIntegrations,
  getIntegration,
  listMcpTools,
  callMcpTool,
  getFreshAccessToken,
  shutdownMcpClients,
} from '@smartware/connectors';

// 1. Define your env (your app's config layer provides these values)
const env: ConnectorEnv = {
  dataDir: './data',
  mcpClientEnabled: true,
  mcpDockerCommand: 'docker',
  mcpPortBase: 5100,
};

// 2. Initialize the database schema
import Database from 'better-sqlite3';
const db = new Database('./data/app.db');
ensureConnectorSchema(db);

// 3. Use the integration registry
const integrations = listIntegrations();
const drive = getIntegration('google-drive');

// 4. Call MCP tools via Docker-managed servers
const tools = await listMcpTools(env, 'google-drive');
const result = await callMcpTool(env, 'google-drive', 'search_files', { query: 'meeting notes' });

// 5. Clean up on shutdown
await shutdownMcpClients(env);
```

## Architecture

```
@smartware/connectors
├── ConnectorEnv              Config interface (dataDir, mcpClientEnabled, etc.)
├── Integration Registry      Service definitions (OAuth endpoints, fields, scopes)
├── Integration Config        File-based credential storage (JSON, 0o600)
├── MCP Clients
│   ├── Registry              Docker image definitions
│   ├── Docker Runtime        Container lifecycle (start, stop, readiness)
│   ├── Client Pool           MCP SDK client management + tool calls
│   └── Health                Docker + container health checks, prewarm
├── Connections
│   ├── OAuth Refresh         Token refresh for Google, GitHub, Slack, Notion, Linear
│   ├── Grants                Per-actor tool access grants (glob patterns, expiry)
│   ├── Grant Requests        Approval workflow for grant requests
│   └── Audit                 MCP tool call audit logging
├── External MCP              User-configured stdio/HTTP MCP servers
└── Schema                    SQLite table definitions (connection_grants, mcp_tool_calls, etc.)
```

## Extending the registry

Apps can register their own integrations at runtime:

```typescript
import { registerIntegration, registerMcpProvider, registerTokenEndpoint } from '@smartware/connectors';

// Add a custom OAuth provider
registerIntegration({
  id: 'my-service',
  name: 'My Service',
  authType: 'oauth',
  availability: 'ready',
  oauth: {
    authorizeUrl: 'https://my-service.com/oauth/authorize',
    tokenUrl: 'https://my-service.com/oauth/token',
    scopes: ['read', 'write'],
  },
  fields: [
    { key: 'client_id', label: 'Client ID' },
    { key: 'client_secret', label: 'Client Secret', secret: true },
  ],
});

// Register its token refresh endpoint
registerTokenEndpoint('my-service', 'https://my-service.com/oauth/token');

// Register a custom MCP Docker provider
registerMcpProvider({
  id: 'my-service',
  image: 'ghcr.io/my-org/my-mcp-server',
  digest: 'sha256:abc123...',
  containerPort: 5000,
  mcpPath: '/mcp/',
});
```

## Subpath exports

```typescript
// Everything
import { ... } from '@smartware/connectors';

// Just MCP client pool + Docker + registry
import { ... } from '@smartware/connectors/mcp-clients';

// Just grants, audit, OAuth
import { ... } from '@smartware/connectors/connections';

// Just external MCP server management
import { ... } from '@smartware/connectors/mcp';
```

## Design principles

- **No process.env reads** — apps pass `ConnectorEnv`, the package never reads env vars directly
- **No framework dependency** — pure TypeScript, works with Fastify, Express, Hono, or bare Node
- **Peer dependencies** — apps bring their own `@modelcontextprotocol/sdk` and `better-sqlite3` versions
- **Runtime-extensible** — `registerIntegration()`, `registerMcpProvider()`, `registerTokenEndpoint()` let apps add providers without forking

## Smartware ecosystem

- [Smartware](https://github.com/technodotventures/Smartware) — the memory
  protocol and reference implementation.
- [Smartware MCP Servers](https://github.com/technodotventures/smartware-mcp-servers) —
  Docker-packaged MCP service adapters managed by this runtime.

## License

MIT
