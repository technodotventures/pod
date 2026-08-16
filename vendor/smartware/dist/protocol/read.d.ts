import type { Actor } from '../layer0/types.js';
import type { ClaimStore } from '../layer1/store.js';
import type { SmartwareConfig } from '../config.js';
import type { SessionStore } from '../session/store.js';
export interface ReadParams {
    actor: Actor;
    /** When supplied, server-resolved session identity overrides actor.id. */
    session_id?: string;
    entity_id?: string;
    entity_name?: string;
    scope?: string;
    resolution?: 'oneliner' | 'paragraph' | 'full';
    /** Required to read sensitive pages, even for the owner. Defaults to false. */
    include_sensitive?: boolean;
}
export interface ReadResult {
    entity_id: string;
    entity_name: string;
    scope: string;
    content: string;
    sensitive: boolean;
    compiled_at: string;
    confidence: number;
}
export interface ScopeBrowseResult {
    scope: string;
    entities: Array<{
        entity_id: string;
        entity_name: string;
        type: string;
        claim_count: number;
        confidence: number;
        oneliner: string;
    }>;
    total: number;
}
export declare function handleRead(params: ReadParams, wikiDir: string, config: SmartwareConfig, store?: ClaimStore, sessionStore?: SessionStore): Promise<ReadResult | ScopeBrowseResult>;
//# sourceMappingURL=read.d.ts.map