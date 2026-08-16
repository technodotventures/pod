import type { SmartwareConfig } from '../config.js';
export interface ManifestStats {
    layer0: {
        total: number;
        accepted: number;
        quarantined: number;
        tombstoned: number;
    };
    layer1: {
        claims: number;
        entities: number;
    };
    layer2: {
        pages: number;
    };
}
export declare function generateManifest(config: SmartwareConfig, stats: ManifestStats): string;
export declare function writeManifest(wikiDir: string, config: SmartwareConfig, stats: ManifestStats): void;
export declare function readManifest(wikiDir: string): string | null;
/** Count .md files in the wiki directory tree (excluding only the root manifest) */
export declare function countWikiPages(wikiDir: string): number;
//# sourceMappingURL=manifest.d.ts.map