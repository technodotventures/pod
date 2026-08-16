import type { Session } from './types.js';
export declare class SessionStore {
    private db;
    constructor(dbPath: string);
    insert(session: Session): void;
    get(sessionId: string): Session | null;
    /** Get an active, non-expired session or null */
    getActive(sessionId: string): Session | null;
    end(sessionId: string): boolean;
    /** Get all active sessions for an actor */
    getByActor(actorId: string): Session[];
    /** Count active sessions */
    activeCount(): number;
    private rowToSession;
    close(): void;
}
//# sourceMappingURL=store.d.ts.map