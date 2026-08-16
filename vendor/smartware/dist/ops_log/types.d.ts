export type OpType = 'observe' | 'recall' | 'reflect.explicit' | 'reflect.auto' | 'reflect.profile' | 'revise.claim' | 'endorse' | 'revive' | 'forget' | 'session.start' | 'session.end' | 'watch.subscribe' | 'watch.event' | 'access.allow' | 'access.deny' | 'guardian' | 'dream.verify' | 'dream.extract_relations' | 'dream.detect_conflicts' | 'dream.recompile_pages' | 'dream.check_capacity' | 'dream.find_orphans';
/** One canonical entry in `pod_data/operations/YYYY-MM-DD.jsonl`. */
export interface OpLogEntry {
    /** ULID-shaped, `^op_[0-9A-HJKMNP-TV-Z]{26}$` */
    operation_id: string;
    /** Registered ActorId per agent registry */
    actor_id: string;
    /** ISO 8601 — equals the operation's commit_ts; equals version_at of any L1 produced */
    timestamp: string;
    op: OpType;
    /** Operation-specific structured details. No PII; use IDs not content. */
    details?: Record<string, unknown>;
}
/** Pattern check for OperationId — matches common.schema.json. */
export declare const OPERATION_ID_PATTERN: RegExp;
export declare function isValidOperationId(value: string): boolean;
//# sourceMappingURL=types.d.ts.map