import { type OpLogEntry } from './types.js';
/** YYYY-MM-DD in UTC for the entry's timestamp. */
export declare function dayOfTimestamp(iso8601: string): string;
/**
 * Append a single operations-log entry. The entry's `timestamp` decides
 * which day's file it lands in. The entry must satisfy the OperationId
 * pattern; malformed entries throw.
 */
export declare function appendOpLogEntry(opsDir: string, entry: OpLogEntry): void;
/** Read every entry for a given UTC date. Returns [] if the file is missing. */
export declare function readOpLogDay(opsDir: string, date: string): OpLogEntry[];
/** Iterate every entry across every day's file in chronological order. */
export declare function readAllOpLogEntries(opsDir: string): Generator<OpLogEntry>;
/** Set of every operation_id present in the canonical ops log. */
export declare function loadCommittedOperationIds(opsDir: string): Set<string>;
//# sourceMappingURL=log.d.ts.map