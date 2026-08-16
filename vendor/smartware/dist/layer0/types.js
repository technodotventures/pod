// Layer 0 — Evidence Log Types
// normative definitions
// State transition matrix
export const TERMINAL_STATES = new Set(['tombstoned', 'redacted', 'rejected']);
export const TRANSITIONS = {
    accepted: {
        tombstone: 'tombstoned',
        redaction: 'redacted',
    },
    quarantined: {
        'quarantine_review:approve': 'accepted',
        'quarantine_review:reject': 'rejected',
        tombstone: 'tombstoned',
    },
};
//# sourceMappingURL=types.js.map