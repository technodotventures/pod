export interface ObservationOperationIntent {
    version: 1;
    operation_id: string;
    actor_id: string;
    op: 'observe';
    payload_hash: string;
    prepared_at: string;
    expected: {
        surface: 'l0';
        observation_id: string;
        observation_hash: string;
        sequence: number;
    };
    result: {
        id: string;
        status: 'accepted' | 'quarantined';
        sequence: number;
    };
    details: {
        scope: string;
        source: string;
    };
}
export interface ReviseOperationIntent {
    version: 1;
    operation_id: string;
    actor_id: string;
    op: 'revise.claim';
    payload_hash: string;
    prepared_at: string;
    expected: {
        surface: 'l1';
        claim_id: string;
        version: number;
        record_hash: string;
        relation_ids: string[];
    };
    result: {
        claim_id: string;
        new_version: number;
        epistemic_owner: 'agent' | 'user';
        operation_id: string;
        status: 'revised';
    };
    details: {
        claim_id: string;
        new_version: number;
    };
}
export interface ForgetOperationIntent {
    version: 1;
    operation_id: string;
    actor_id: string;
    op: 'forget';
    payload_hash: string;
    prepared_at: string;
    expected: {
        surface: 'forget';
        audit: {
            observation_id: string;
            observation_hash: string;
            sequence: number;
        };
        claim_version?: {
            claim_id: string;
            version: number;
            record_hash: string;
        };
    };
    result: {
        target_id: string;
        target_kind: 'observation' | 'claim';
        mode: 'tombstone' | 'redact_if_supported';
        claims_retracted: number;
        claims_reduced: number;
        audit_observation_id: string;
        status: 'forgotten';
    };
    details: {
        target_id: string;
        target_kind: 'observation' | 'claim';
        mode: 'tombstone' | 'redact_if_supported';
    };
}
export interface ReviveOperationIntent {
    version: 1;
    operation_id: string;
    actor_id: string;
    op: 'revive';
    payload_hash: string;
    prepared_at: string;
    expected: {
        surface: 'l1';
        claim_id: string;
        version: number;
        record_hash: string;
    };
    result: {
        claim_id: string;
        new_version: number;
        operation_id: string;
        invalidated_edges: string[];
        status: 'revived';
    };
    details: {
        claim_id: string;
        tombstone_id: string;
    };
}
export interface EndorseOperationIntent {
    version: 1;
    operation_id: string;
    actor_id: string;
    op: 'endorse';
    payload_hash: string;
    prepared_at: string;
    expected: {
        surface: 'endorse';
        page: {
            page_id: string;
            content_hash: string;
        };
        claims: Array<{
            claim_id: string;
            version: number;
            record_hash: string;
        }>;
    };
    result: {
        page_id: string;
        claims_endorsed: number;
        operation_id: string;
        commit_ts: string;
        status: 'endorsed';
    };
    details: {
        page_id: string;
    };
}
export interface ReflectClaimOperationIntent {
    version: 1;
    operation_id: string;
    actor_id: string;
    op: 'reflect.auto';
    payload_hash: string;
    prepared_at: string;
    expected: {
        surface: 'l1';
        claim_id: string;
        version: number;
        record_hash: string;
    };
    result: {
        claim_id: string;
        version: number;
        status: 'reflected';
    };
    details: {
        claim_id: string;
        fingerprint: string;
    };
}
export type OperationIntent = ObservationOperationIntent | ReviseOperationIntent | ForgetOperationIntent | ReviveOperationIntent | EndorseOperationIntent | ReflectClaimOperationIntent;
export interface OperationIntentReadRecord {
    operation_id: string;
    intent?: OperationIntent;
    error?: string;
}
export declare function readOperationIntent(opsDir: string, operationId: string): OperationIntent | null;
export declare function readOperationIntentRecords(opsDir: string): OperationIntentReadRecord[];
export declare function persistOperationIntent(opsDir: string, intent: OperationIntent, allowMatchingReplacement?: boolean): void;
export declare function removeOperationIntent(opsDir: string, operationId: string): void;
//# sourceMappingURL=intent.d.ts.map