export declare const CONTEXT_RETRIEVAL_MODES: readonly ["always", "auto", "never"];
export type ContextRetrievalMode = typeof CONTEXT_RETRIEVAL_MODES[number];
export interface ContextRetrievalDecision {
    mode: ContextRetrievalMode;
    decision: 'retrieve' | 'skip';
    reason: 'caller_required' | 'caller_disabled' | 'structured_task' | 'recent_context_requested' | 'self_contained_greeting' | 'self_contained_arithmetic' | 'memory_may_help';
}
/**
 * Decide whether a context adapter should load persistent memory.
 *
 * `auto` deliberately fails open to retrieval. It skips only exact greetings
 * and self-contained arithmetic, so terse project names and uncertain queries
 * cannot silently lose memory.
 */
export declare function decideContextRetrieval(mode: ContextRetrievalMode, query: string, hasStructuredTask?: boolean): ContextRetrievalDecision;
export type ContextLaneCosts<Lane extends string> = Record<Lane, readonly number[]>;
export interface ContextPackingPolicy<Lane extends string> {
    /** Stable first-pass order. Every lane in `costs` must appear here. */
    lane_order: readonly Lane[];
    /** Relative protected share. Missing weights default to 1. */
    lane_weights?: Partial<Record<Lane, number>>;
    /** Stable second-pass order. Omitted lanes are appended from lane_order. */
    overflow_order?: readonly Lane[];
}
export interface ContextPackingPlan<Lane extends string> {
    selected: Record<Lane, number[]>;
    used_tokens: number;
    lane_tokens: Record<Lane, number>;
}
/**
 * Pack ranked prefixes from independent evidence lanes.
 *
 * The protected-share pass prevents an early, high-volume lane from consuming
 * the entire budget. The round-robin overflow pass then redistributes unused
 * capacity without allowing lower-ranked items to jump a lane's prefix.
 */
export declare function planContextPacking<Lane extends string>(costs: ContextLaneCosts<Lane>, tokenBudget: number, policy: ContextPackingPolicy<Lane>): ContextPackingPlan<Lane>;
//# sourceMappingURL=context-planning.d.ts.map