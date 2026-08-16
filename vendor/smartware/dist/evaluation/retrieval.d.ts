export type RetrievalQueryCategory = 'exact' | 'paraphrase' | 'entity' | 'current' | 'historical' | 'range' | 'multi_hop' | 'procedural' | 'negative' | 'safety';
export interface RetrievalEvaluationCase {
    id: string;
    category: RetrievalQueryCategory;
    query: string;
    expected_ids: string[];
    forbidden_ids?: string[];
    obsolete_ids?: string[];
    should_abstain?: boolean;
    max_rank?: number;
}
export interface RetrievalChannelObservation {
    query_id: string;
    channel: string;
    result_ids: string[];
    abstained?: boolean;
    latency_ms?: number;
    input_tokens?: number;
    output_tokens?: number;
    cost_usd?: number;
}
export interface RetrievalQueryEvaluation {
    query_id: string;
    category: RetrievalQueryCategory;
    channel: string;
    passed: boolean;
    result_ids: string[];
    expected_ids: string[];
    expected_rank: number | null;
    hit_at_1: number;
    recall_at_1: number;
    recall_at_5: number;
    recall_at_10: number;
    recall_at_20: number;
    reciprocal_rank: number;
    ndcg_at_10: number;
    forbidden_hits: string[];
    obsolete_hits: string[];
    should_abstain: boolean;
    abstained: boolean;
    abstention_correct: boolean;
    missing_observation: boolean;
    latency_ms: number | null;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
}
export interface RetrievalMetricSummary {
    queries: number;
    scored_queries: number;
    passed: number;
    failed: number;
    pass_rate: number;
    hit_at_1: number;
    recall_at_1: number;
    recall_at_5: number;
    recall_at_10: number;
    recall_at_20: number;
    mean_reciprocal_rank: number;
    ndcg_at_10: number;
    abstention_accuracy: number;
    forbidden_hits: number;
    obsolete_hits: number;
    missing_observations: number;
    latency_p50_ms: number | null;
    latency_p95_ms: number | null;
    input_tokens: number;
    output_tokens: number;
    cost_usd: number;
}
export interface RetrievalChannelSummary extends RetrievalMetricSummary {
    channel: string;
    categories: Partial<Record<RetrievalQueryCategory, RetrievalMetricSummary>>;
    queries_detail: RetrievalQueryEvaluation[];
}
export interface RetrievalQualityGate {
    channel: string;
    min_pass_rate?: number;
    min_recall_at_5?: number;
    min_mean_reciprocal_rank?: number;
    min_ndcg_at_10?: number;
    min_abstention_accuracy?: number;
    max_forbidden_hits?: number;
    max_obsolete_hits?: number;
    max_missing_observations?: number;
    max_latency_p95_ms?: number;
    max_cost_usd?: number;
}
export interface RetrievalGateResult {
    channel: string;
    passed: boolean;
    failures: string[];
}
export interface RetrievalArenaEvaluation {
    passed: boolean;
    channels: RetrievalChannelSummary[];
    gates: RetrievalGateResult[];
}
export type RetrievalActivationDatasetStatus = 'development' | 'held_out';
export type RetrievalActivationDataClassification = 'synthetic_non_user_data' | 'consented_user_data';
export interface RetrievalActivationEvidence {
    dataset_status: RetrievalActivationDatasetStatus;
    data_classification: RetrievalActivationDataClassification;
    arena_sha256: string;
    run_sha256: string;
}
export interface RetrievalActivationPolicy {
    baseline_channel: string;
    candidate_channel: string;
    min_queries?: number;
    min_scored_queries?: number;
    min_query_wins?: number;
    max_query_losses?: number;
    min_pass_rate_delta?: number;
    min_recall_at_5_delta?: number;
    min_mean_reciprocal_rank_delta?: number;
    min_ndcg_at_10_delta?: number;
    min_abstention_accuracy_delta?: number;
    max_candidate_latency_p95_ms?: number;
    max_candidate_cost_usd?: number;
}
export interface RetrievalActivationComparison {
    baseline_channel: string;
    candidate_channel: string;
    query_wins: number;
    query_losses: number;
    query_ties: number;
    winning_query_ids: string[];
    losing_query_ids: string[];
    deltas: {
        pass_rate: number;
        recall_at_5: number;
        mean_reciprocal_rank: number;
        ndcg_at_10: number;
        abstention_accuracy: number;
    };
}
export interface RetrievalActivationEvaluation {
    passed: boolean;
    decision: 'promote' | 'hold';
    failures: string[];
    evidence: RetrievalActivationEvidence;
    baseline: RetrievalChannelSummary;
    candidate: RetrievalChannelSummary;
    comparison: RetrievalActivationComparison;
}
export declare function evaluateRetrievalArena(cases: RetrievalEvaluationCase[], observations: RetrievalChannelObservation[], gates?: RetrievalQualityGate[]): RetrievalArenaEvaluation;
export declare function evaluateRetrievalActivation(cases: RetrievalEvaluationCase[], observations: RetrievalChannelObservation[], evidence: RetrievalActivationEvidence, policy: RetrievalActivationPolicy): RetrievalActivationEvaluation;
//# sourceMappingURL=retrieval.d.ts.map