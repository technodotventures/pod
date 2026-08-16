// Layer 4 — Deterministic context admission and token-budget planning.
//
// These helpers are wire-neutral. Protocol adapters choose their own lane
// names and response envelope while sharing one conservative admission rule
// and one starvation-resistant packing algorithm.
export const CONTEXT_RETRIEVAL_MODES = ['always', 'auto', 'never'];
const GREETING_PATTERN = /^(?:hi|hello|hey|hiya|thanks|thank you|cheers|good (?:morning|afternoon|evening))[!.?\s]*$/i;
const ARITHMETIC_PREFIX = /^(?:what(?:'s| is)|calculate|compute|solve|evaluate)\s+/i;
const ARITHMETIC_BODY = /^[\d\s.,()+\-*/×÷%^=]+$/;
const ARITHMETIC_OPERATOR = /[+\-*/×÷%^]/;
function isSelfContainedArithmetic(query) {
    const expression = query.trim().replace(/[?]+$/, '').replace(ARITHMETIC_PREFIX, '').trim();
    return /\d/.test(expression)
        && ARITHMETIC_OPERATOR.test(expression)
        && ARITHMETIC_BODY.test(expression);
}
/**
 * Decide whether a context adapter should load persistent memory.
 *
 * `auto` deliberately fails open to retrieval. It skips only exact greetings
 * and self-contained arithmetic, so terse project names and uncertain queries
 * cannot silently lose memory.
 */
export function decideContextRetrieval(mode, query, hasStructuredTask = false) {
    if (mode === 'always')
        return { mode, decision: 'retrieve', reason: 'caller_required' };
    if (mode === 'never')
        return { mode, decision: 'skip', reason: 'caller_disabled' };
    if (hasStructuredTask)
        return { mode, decision: 'retrieve', reason: 'structured_task' };
    if (!query.trim())
        return { mode, decision: 'retrieve', reason: 'recent_context_requested' };
    if (GREETING_PATTERN.test(query))
        return { mode, decision: 'skip', reason: 'self_contained_greeting' };
    if (isSelfContainedArithmetic(query))
        return { mode, decision: 'skip', reason: 'self_contained_arithmetic' };
    return { mode, decision: 'retrieve', reason: 'memory_may_help' };
}
function normalizedCost(value) {
    return Number.isFinite(value) && value > 0 ? Math.ceil(value) : 0;
}
function uniqueLanes(lanes) {
    return [...new Set(lanes)];
}
/**
 * Pack ranked prefixes from independent evidence lanes.
 *
 * The protected-share pass prevents an early, high-volume lane from consuming
 * the entire budget. The round-robin overflow pass then redistributes unused
 * capacity without allowing lower-ranked items to jump a lane's prefix.
 */
export function planContextPacking(costs, tokenBudget, policy) {
    const lanes = uniqueLanes(policy.lane_order);
    const unknownCostLane = Object.keys(costs).find(lane => !lanes.includes(lane));
    const missingCostLane = lanes.find(lane => !Object.prototype.hasOwnProperty.call(costs, lane));
    if (unknownCostLane || missingCostLane) {
        throw new Error(`Context packing policy and costs disagree on lane "${unknownCostLane ?? missingCostLane}"`);
    }
    const budget = Number.isFinite(tokenBudget) ? Math.max(0, Math.floor(tokenBudget)) : 0;
    const selected = {};
    const laneTokens = {};
    const cursor = {};
    for (const lane of lanes) {
        selected[lane] = [];
        laneTokens[lane] = 0;
        cursor[lane] = 0;
    }
    const rawWeights = lanes.map(lane => {
        const configured = policy.lane_weights?.[lane];
        return configured === undefined || !Number.isFinite(configured)
            ? 1
            : Math.max(0, configured);
    });
    const configuredWeightTotal = rawWeights.reduce((sum, weight) => sum + weight, 0);
    const weights = configuredWeightTotal > 0 ? rawWeights : lanes.map(() => 1);
    const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
    let used = 0;
    for (let laneIndex = 0; laneIndex < lanes.length; laneIndex++) {
        const lane = lanes[laneIndex];
        const target = weightTotal > 0 ? Math.floor(budget * weights[laneIndex] / weightTotal) : 0;
        while (cursor[lane] < costs[lane].length) {
            const index = cursor[lane];
            const cost = normalizedCost(costs[lane][index]);
            if (laneTokens[lane] + cost > target || used + cost > budget)
                break;
            selected[lane].push(index);
            laneTokens[lane] += cost;
            used += cost;
            cursor[lane] += 1;
        }
    }
    const configuredOverflow = uniqueLanes(policy.overflow_order ?? []);
    const overflowOrder = [
        ...configuredOverflow.filter(lane => lanes.includes(lane)),
        ...lanes.filter(lane => !configuredOverflow.includes(lane)),
    ];
    let progressed = true;
    while (progressed && used < budget) {
        progressed = false;
        for (const lane of overflowOrder) {
            if (cursor[lane] >= costs[lane].length)
                continue;
            const index = cursor[lane];
            const cost = normalizedCost(costs[lane][index]);
            if (used + cost > budget)
                continue;
            selected[lane].push(index);
            laneTokens[lane] += cost;
            used += cost;
            cursor[lane] += 1;
            progressed = true;
        }
    }
    return { selected, used_tokens: used, lane_tokens: laneTokens };
}
//# sourceMappingURL=context-planning.js.map