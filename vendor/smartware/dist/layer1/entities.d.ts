import type { ClaimStore } from './store.js';
import type { SmartwareConfig } from '../config.js';
/** Telemetry collector for entity merge events during replay */
export interface EntityMergeEvent {
    from_name: string;
    to_name: string;
    to_entity_id: string;
    jaro_winkler_score: number;
    /** How the merge decision was made */
    resolution: 'auto' | 'borderline_accepted' | 'borderline_rejected' | 'exact';
}
export declare function resetEntityTelemetry(): void;
export declare function getEntityMergeLog(): EntityMergeEvent[];
export declare function getNewEntityLog(): string[];
export interface EntityResolution {
    id: string;
    isNew: boolean;
    matchConfidence: number;
    /** If a fuzzy merge occurred, the canonical name of the entity merged into */
    mergedIntoName?: string;
}
export declare function resolveEntity(name: string, type: string, scope: string, store: ClaimStore, config?: SmartwareConfig): EntityResolution;
//# sourceMappingURL=entities.d.ts.map