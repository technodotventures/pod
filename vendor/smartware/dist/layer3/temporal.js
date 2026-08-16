function instant(value, field) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) {
        throw new Error(`${field} must be a valid ISO 8601 timestamp`);
    }
    return parsed;
}
function interval(document, axis) {
    const value = document[axis];
    const from = value.from === null ? null : instant(value.from, `${axis}.from`);
    const to = value.to === null ? null : instant(value.to, `${axis}.to`);
    if (from !== null && to !== null && to <= from) {
        throw new Error(`${axis}.to must be after ${axis}.from`);
    }
    return { from, to };
}
function contains(value, at) {
    return (value.from === null || value.from <= at)
        && (value.to === null || at < value.to);
}
/**
 * Match a document against an explicit bi-temporal constraint.
 *
 * Intervals are half-open: [from, to). Valid time answers when the claim was
 * true in the represented world; transaction time answers when Smartware knew
 * it. The caller remains responsible for supplying policy-eligible documents.
 */
export function matchesTemporalConstraint(document, constraint) {
    const value = interval(document, constraint.axis);
    if (constraint.mode === 'current') {
        const at = constraint.at === undefined
            ? Date.now()
            : instant(constraint.at, 'temporal.at');
        return contains(value, at);
    }
    if (constraint.mode === 'as_of') {
        return contains(value, instant(constraint.at, 'temporal.at'));
    }
    const from = instant(constraint.from, 'temporal.from');
    const to = instant(constraint.to, 'temporal.to');
    if (to <= from) {
        throw new Error('temporal.to must be after from');
    }
    const relation = constraint.relation ?? 'overlaps';
    if (relation === 'starts_in') {
        return value.from !== null && from <= value.from && value.from < to;
    }
    if (relation !== 'overlaps') {
        throw new Error(`Unsupported temporal range relation: ${String(relation)}`);
    }
    return (value.from === null || value.from < to)
        && (value.to === null || from < value.to);
}
//# sourceMappingURL=temporal.js.map