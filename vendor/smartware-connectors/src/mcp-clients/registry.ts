export interface McpProviderDef {
  /** Matches the integration id (e.g. 'google-drive', 'slack'). */
  id: string;
  /** Klavis Docker image (without tag/digest — combined with `digest` at run time). */
  image: string;
  /**
   * Content-addressed digest (`sha256:...`). When set, the runtime pulls
   * `image@digest` — frozen at a known-good version. When omitted, the runtime
   * falls back to `:latest`, which may shift under us at any docker pull.
   * Only pin a digest after the provider has been verified end-to-end.
   */
  digest?: string;
  /** Port the MCP server listens on inside the container. */
  containerPort: number;
  /** Path the MCP StreamableHTTP endpoint is mounted at. */
  mcpPath: string;
}

const PROVIDERS: McpProviderDef[] = [
  // Pinned: verified end-to-end against the linked digest.
  { id: 'google-drive',     image: 'ghcr.io/klavis-ai/google-drive-mcp-server',
    digest: 'sha256:cb74cecbe98204ceebf8627fa700c9fd83cb0694301445b5d7e8588786f2fd1c',
    containerPort: 5000, mcpPath: '/mcp/' },
  { id: 'google-calendar',  image: 'ghcr.io/klavis-ai/google-calendar-mcp-server',
    digest: 'sha256:c5a79de2fc726b48d214d9c8f5447f3f7e3f9b0bb90e37a8896e3f43c0b2630d',
    containerPort: 5000, mcpPath: '/mcp/' },
  // Unpinned: registered but not yet verified. Pin a digest after first successful round-trip.
  { id: 'gmail',            image: 'ghcr.io/klavis-ai/gmail-mcp-server',            containerPort: 5000, mcpPath: '/mcp/' },
  { id: 'github',           image: 'ghcr.io/klavis-ai/github-mcp-server',           containerPort: 5000, mcpPath: '/mcp/' },
  { id: 'slack',            image: 'ghcr.io/klavis-ai/slack-mcp-server',            containerPort: 5000, mcpPath: '/mcp/' },
  { id: 'notion',           image: 'ghcr.io/klavis-ai/notion-mcp-server',           containerPort: 5000, mcpPath: '/mcp/' },
  { id: 'linear',           image: 'ghcr.io/klavis-ai/linear-mcp-server',           containerPort: 5000, mcpPath: '/mcp/' },
  { id: 'gitlab',           image: 'ghcr.io/klavis-ai/gitlab-mcp-server',           containerPort: 5000, mcpPath: '/mcp/' },
];

/** Resolves the image reference to use in `docker run`. Digest if pinned, else `:latest`. */
export function imageRef(provider: McpProviderDef): string {
  return provider.digest ? `${provider.image}@${provider.digest}` : `${provider.image}:latest`;
}

export function listMcpProviders(): McpProviderDef[] {
  return [...PROVIDERS];
}

export function getMcpProvider(id: string): McpProviderDef | undefined {
  return PROVIDERS.find(p => p.id === id);
}

/**
 * Register a custom MCP provider at runtime (useful for apps that extend the
 * default Klavis set with their own Docker-based providers).
 */
export function registerMcpProvider(def: McpProviderDef): void {
  const idx = PROVIDERS.findIndex(p => p.id === def.id);
  if (idx >= 0) PROVIDERS[idx] = def;
  else PROVIDERS.push(def);
}
