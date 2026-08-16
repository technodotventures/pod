// Protocol — STATUS handler (owner-only)
import { countWikiPages, writeManifest } from '../layer2/manifest.js';
import { requireOwner } from '../auth/middleware.js';
export async function handleStatus(params, layer0, store, searchIndex, wikiDir, config) {
    requireOwner(params.actor.id, config);
    const statusCounts = layer0.countByStatus();
    const total = layer0.totalCount();
    const claims = store.claimCount();
    const entities = store.entityCount();
    const pages = countWikiPages(wikiDir);
    // Refresh the manifest so it reflects the current state
    writeManifest(wikiDir, config, {
        layer0: {
            total,
            accepted: statusCounts['accepted'] ?? 0,
            quarantined: statusCounts['quarantined'] ?? 0,
            tombstoned: statusCounts['tombstoned'] ?? 0,
        },
        layer1: { claims, entities },
        layer2: { pages },
    });
    return {
        instance_id: config.instance_id,
        version: config.version,
        layer0: {
            total,
            by_status: statusCounts,
            last_sequence: layer0.getLastSequence(),
        },
        layer1: {
            claims,
            entities,
            last_replayed_sequence: store.getLastReplayedSequence(),
        },
        layer2: { pages },
        layer3: { indexed: searchIndex.count() },
        grants: config.grants.filter(g => g.status === 'active').length,
    };
}
//# sourceMappingURL=status.js.map