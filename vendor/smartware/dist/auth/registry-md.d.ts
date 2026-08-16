import type { SmartwareConfig } from '../config.js';
export declare function renderRegistryMarkdown(config: SmartwareConfig): string;
/**
 * Write the markdown projection to `pod_data/agents/registry.md`.
 * Atomic via tmp+rename so a partial write never appears.
 */
export declare function writeRegistryMarkdown(dataDir: string, config: SmartwareConfig): string;
//# sourceMappingURL=registry-md.d.ts.map