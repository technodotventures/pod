import { randomBytes } from 'node:crypto';

/**
 * In-memory session store for PIN-authenticated sessions.
 *
 * Sessions are issued when a user successfully verifies their PIN.
 * They expire after a configurable period of inactivity (sliding window).
 * This is intentionally in-memory — restarting the server invalidates
 * all sessions, which is the correct behavior for a local-only app.
 */

export interface Session {
  token: string;
  createdAt: number;
  lastActiveAt: number;
}

const sessions = new Map<string, Session>();

/** Default inactivity timeout: 30 minutes */
const SESSION_TTL_MS = 30 * 60 * 1000;

/** Maximum concurrent sessions (prevent memory leaks from brute-force) */
const MAX_SESSIONS = 50;

export function createSession(): Session {
  // Evict expired sessions first
  pruneExpired();

  // If still at limit, evict oldest
  if (sessions.size >= MAX_SESSIONS) {
    let oldest: string | null = null;
    let oldestTime = Infinity;
    for (const [token, session] of sessions) {
      if (session.lastActiveAt < oldestTime) {
        oldestTime = session.lastActiveAt;
        oldest = token;
      }
    }
    if (oldest) sessions.delete(oldest);
  }

  const token = `cpod_s_${randomBytes(32).toString('base64url')}`;
  const now = Date.now();
  const session: Session = { token, createdAt: now, lastActiveAt: now };
  sessions.set(token, session);
  return session;
}

/**
 * Validate a session token. Returns the session if valid (and refreshes
 * the sliding window), or null if expired/unknown.
 */
export function validateSession(token: string): Session | null {
  const session = sessions.get(token);
  if (!session) return null;

  const now = Date.now();
  if (now - session.lastActiveAt > SESSION_TTL_MS) {
    sessions.delete(token);
    return null;
  }

  // Slide the window
  session.lastActiveAt = now;
  return session;
}

export function destroySession(token: string): boolean {
  return sessions.delete(token);
}

export function destroyAllSessions(): void {
  sessions.clear();
}

function pruneExpired(): void {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now - session.lastActiveAt > SESSION_TTL_MS) {
      sessions.delete(token);
    }
  }
}

/** Exposed for testing */
export function activeSessionCount(): number {
  pruneExpired();
  return sessions.size;
}
