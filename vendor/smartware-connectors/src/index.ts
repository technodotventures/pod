/**
 * @smartware/connectors
 *
 * Connector infrastructure for Smartware-powered apps.
 * Provides MCP client pool (Klavis Docker), OAuth token management,
 * connection grants, audit logging, and external MCP server support.
 *
 * Usage:
 *   import { type ConnectorEnv, ensureConnectorSchema } from '@smartware/connectors';
 *   import { listMcpTools, callMcpTool } from '@smartware/connectors/mcp-clients';
 *   import { getFreshAccessToken } from '@smartware/connectors/connections';
 */

// ── Config ──
export { type ConnectorEnv } from './config.js';

// ── Database schema ──
export { ensureConnectorSchema } from './schema.js';

// ── Integration config (file-based credential storage) ──
export {
  integrationConfigPath,
  readIntegrationConfig,
  writeIntegrationConfig,
  deleteIntegrationConfig,
} from './integration-config.js';

// ── MCP Clients (Klavis Docker providers) ──
export {
  // Registry
  type McpProviderDef,
  imageRef,
  listMcpProviders,
  getMcpProvider,
  registerMcpProvider,
  // Docker runtime
  DockerRuntimeError,
  ensureContainerRunning,
  stopContainer,
  // Health & prewarm
  type McpBackendHealth,
  type PrewarmResult,
  prewarmProviders,
  getMcpHealth,
  // Client pool
  type McpToolSummary,
  type McpCallResult,
  McpClientError,
  McpToolNotFoundError,
  McpToolExecutionError,
  listMcpTools,
  callMcpTool,
  shutdownMcpClients,
} from './mcp-clients/index.js';

// ── Connections (grants, requests, audit, OAuth) ──
export {
  // OAuth
  TokenRefreshError,
  registerTokenEndpoint,
  getFreshAccessToken,
  // Grants
  type ConnectionGrantRow,
  type ConnectionGrantInput,
  listConnectionGrants,
  createConnectionGrant,
  revokeConnectionGrant,
  checkConnectionGrant,
  // Grant requests
  type GrantRequestStatus,
  type ConnectionGrantRequestRow,
  type ConnectionGrantRequestInput,
  type ApproveResult,
  createGrantRequest,
  listGrantRequests,
  getGrantRequest,
  approveGrantRequest,
  denyGrantRequest,
  // Audit
  type CallerKind,
  type CallStatus,
  type ErrorKind,
  type McpCallAuditEntry,
  type RecordMcpCallInput,
  type AuditQueryFilter,
  recordMcpCall,
  listMcpCalls,
} from './connections/index.js';

// ── External MCP servers (user-configured stdio/http) ──
export {
  type ExternalMcpTransport,
  type ExternalMcpContextTool,
  type ExternalMcpServerConfig,
  type PublicExternalMcpServerConfig,
  type ExternalMcpContextResult,
  listExternalMcpServers,
  getExternalMcpServer,
  upsertExternalMcpServer,
  deleteExternalMcpServer,
  listExternalMcpTools,
  callExternalMcpReadOnlyTool,
  searchExternalMcpContext,
} from './mcp/external-client.js';

// ── Integration registry (service definitions, OAuth metadata) ──
export {
  type AuthType,
  type IntegrationAvailability,
  type IntegrationField,
  type IntegrationOAuth,
  type IntegrationDef,
  listIntegrations,
  getIntegration,
  registerIntegration,
  integrationPublicStatus,
} from './integration-registry.js';
