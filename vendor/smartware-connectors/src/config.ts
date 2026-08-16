/**
 * @smartware/connectors — environment config interface.
 *
 * Apps provide their own env loader and pass a ConnectorEnv to connector
 * functions. This keeps the connectors package agnostic of how the host
 * app loads configuration (env vars, config file, CLI flags, etc.).
 */

export interface ConnectorEnv {
  /** Root directory for data files (integrations/, mcp-servers.json, etc.) */
  dataDir: string;
  /** Whether the MCP client backend is enabled. */
  mcpClientEnabled: boolean;
  /** Docker-compatible CLI command ('docker', 'podman', etc.) */
  mcpDockerCommand: string;
  /** Base port number for MCP container host-port bindings. */
  mcpPortBase: number;
}
