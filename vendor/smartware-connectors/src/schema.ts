import type Database from 'better-sqlite3';

/**
 * Create the database tables required by @smartware/connectors.
 *
 * Safe to call multiple times (uses IF NOT EXISTS). Host apps should
 * call this during their database initialization, after creating the
 * SQLite database instance.
 */
export function ensureConnectorSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS connection_grants (
      id              TEXT PRIMARY KEY,
      actor_id        TEXT NOT NULL,
      service_id      TEXT NOT NULL,
      tool_pattern    TEXT NOT NULL DEFAULT '*',
      expires_at      INTEGER,
      revoked_at      TEXT,
      created_at      TEXT NOT NULL,
      created_by      TEXT NOT NULL,
      note            TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_connection_grants_actor
      ON connection_grants (actor_id, service_id);

    CREATE TABLE IF NOT EXISTS connection_grant_requests (
      id                    TEXT PRIMARY KEY,
      actor_id              TEXT NOT NULL,
      service_id            TEXT NOT NULL,
      tool_pattern          TEXT NOT NULL DEFAULT '*',
      reason                TEXT,
      requested_expires_at  INTEGER,
      status                TEXT NOT NULL DEFAULT 'pending',
      resolved_at           TEXT,
      resolved_by           TEXT,
      approved_grant_id     TEXT,
      created_at            TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mcp_tool_calls (
      id            TEXT PRIMARY KEY,
      actor_id      TEXT NOT NULL,
      service_id    TEXT NOT NULL,
      tool_name     TEXT NOT NULL,
      args_summary  TEXT,
      status        TEXT NOT NULL,
      error_kind    TEXT,
      duration_ms   INTEGER NOT NULL,
      grant_id      TEXT,
      caller_kind   TEXT NOT NULL,
      observed_at   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_actor
      ON mcp_tool_calls (actor_id, service_id);
    CREATE INDEX IF NOT EXISTS idx_mcp_tool_calls_observed
      ON mcp_tool_calls (observed_at DESC);
  `);
}
