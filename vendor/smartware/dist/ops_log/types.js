// Operations log canonical surface types.
//
// One entry per JSONL line. Validates against schemas v0.4.2's
// operation-log-entry.schema.json. See docs/atomicity.md for the role of
// this surface in cross-artifact commit semantics.
/** Pattern check for OperationId — matches common.schema.json. */
export const OPERATION_ID_PATTERN = /^op_[0-9A-HJKMNP-TV-Z]{26}$/;
export function isValidOperationId(value) {
    return OPERATION_ID_PATTERN.test(value);
}
//# sourceMappingURL=types.js.map