// Layer 2 — Resolution formatters: one-liner, paragraph, full page
/**
 * Format a claim object value as a human-readable string.
 */
export function formatClaimValue(claim) {
    const v = claim.object;
    if (typeof v.value === 'string')
        return v.value;
    if (typeof v.value === 'number' || typeof v.value === 'boolean')
        return String(v.value);
    return JSON.stringify(v.value);
}
/**
 * Produce a one-liner summary for an entity from its active claims.
 */
export function buildOneliner(entity, claims) {
    const nameClaim = claims.find(c => c.predicate === 'name_is');
    const descClaim = claims.find(c => c.predicate === 'description_is');
    const statusClaim = claims.find(c => c.predicate === 'status_is');
    const name = nameClaim ? formatClaimValue(nameClaim) : entity.canonical_name;
    if (descClaim) {
        const desc = formatClaimValue(descClaim);
        return `${name}: ${desc.slice(0, 80)}${desc.length > 80 ? '…' : ''}`;
    }
    if (statusClaim) {
        return `${name} — ${formatClaimValue(statusClaim)}`;
    }
    return `${name} (${entity.type})`;
}
/**
 * Produce a paragraph summary (2-4 sentences) from active claims.
 */
export function buildParagraph(entity, claims) {
    const byPredicate = new Map();
    for (const c of claims) {
        const list = byPredicate.get(c.predicate) ?? [];
        list.push(c);
        byPredicate.set(c.predicate, list);
    }
    const sentences = [];
    const name = entity.canonical_name;
    const desc = byPredicate.get('description_is')?.[0];
    if (desc)
        sentences.push(`${name} is ${formatClaimValue(desc)}.`);
    const status = byPredicate.get('status_is')?.[0];
    if (status)
        sentences.push(`Current status: ${formatClaimValue(status)}.`);
    const deadline = byPredicate.get('deadline_is')?.[0];
    if (deadline)
        sentences.push(`Deadline: ${formatClaimValue(deadline)}.`);
    const owner = byPredicate.get('created_by')?.[0];
    if (owner)
        sentences.push(`Created by ${formatClaimValue(owner)}.`);
    // Add remaining claims (up to 2 more)
    const usedPredicates = new Set(['description_is', 'status_is', 'deadline_is', 'created_by', 'name_is']);
    let extra = 0;
    for (const [pred, clms] of byPredicate) {
        if (usedPredicates.has(pred) || extra >= 2)
            continue;
        sentences.push(`${pred.replace(/_/g, ' ')}: ${formatClaimValue(clms[0])}.`);
        extra++;
    }
    return sentences.join(' ') || `${name} (${entity.type}) — no details available.`;
}
/**
 * Produce a full markdown page from entity + claims (for when LLM is unavailable).
 */
export function buildFullPage(entity, claims) {
    const sections = [`## ${entity.canonical_name}`];
    sections.push('');
    sections.push(buildParagraph(entity, claims));
    sections.push('');
    if (claims.length > 0) {
        sections.push('### Claims');
        sections.push('');
        for (const c of claims) {
            const val = formatClaimValue(c);
            const conf = `${(c.confidence * 100).toFixed(0)}%`;
            const status = c.status !== 'active' ? ` _(${c.status})_` : '';
            sections.push(`- **${c.predicate.replace(/_/g, ' ')}**: ${val} — _${c.epistemic}, ${conf}_${status}`);
        }
    }
    return sections.join('\n');
}
//# sourceMappingURL=resolutions.js.map