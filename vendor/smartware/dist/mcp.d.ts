import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SmartwareCore } from './core.js';
export interface SmartwareMcpServerOptions {
    handler_timeout_ms?: number;
    on_error?: (message: string) => void;
}
/**
 * Build the MCP transport Adapter over a caller-owned SmartwareCore.
 *
 * The Core remains the single protocol Implementation and lifecycle owner;
 * importing this Module has no filesystem or transport side effects.
 */
export declare function createSmartwareMcpServer(core: SmartwareCore, options?: SmartwareMcpServerOptions): McpServer;
//# sourceMappingURL=mcp.d.ts.map