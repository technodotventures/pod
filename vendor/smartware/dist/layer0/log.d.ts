import type { Observation } from './types.js';
/** Get today's date as YYYY-MM-DD (UTC) */
export declare function todayUTC(): string;
/**
 * Append a single observation to the log. NEVER modifies existing lines.
 */
export declare function appendObservation(evidenceDir: string, obs: Observation): void;
/**
 * Read all observations from a single day's file.
 */
export declare function readFile(evidenceDir: string, date: string): Observation[];
/**
 * Read all observations from all JSONL files in chronological order.
 */
export declare function readAll(evidenceDir: string): Generator<Observation>;
/**
 * List all evidence file dates.
 */
export declare function listDates(evidenceDir: string): string[];
//# sourceMappingURL=log.d.ts.map