import type { RelationKind } from './types.js';
import type Database from 'better-sqlite3';
export declare function isEffectiveCurrent(claimId: string, db: Database.Database): boolean;
export declare function getEffectiveCurrentIds(db: Database.Database, scope?: string): string[];
export declare function checkAcyclicity(sourceId: string, targetId: string, kind: RelationKind, db: Database.Database): boolean;
export declare function computeReleasedClaims(forgottenClaimId: string, db: Database.Database): string[];
export interface ReviveValidation {
    valid: string[];
    invalidated: string[];
}
export declare function revalidateOnRevive(claimId: string, db: Database.Database): ReviveValidation;
//# sourceMappingURL=effective_current.d.ts.map