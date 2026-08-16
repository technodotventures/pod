# Pod Staging Integration

Pod is the user-owned memory companion for Coffee. Coffee should treat it
as an external memory/runtime service that can be local, VPS-hosted, or
Coffee-hosted.

The Pod itself is a generic object library, memory store, and agent event log.
Coffee connects through the same app-space boundary available to any other app.
Its adapter endpoints map Coffee meetings, documents, captures, and follow-ups
into generic Pod objects plus Smartware observations inside that Coffee-owned
space. Coffee should continue surfacing meetings in Coffee; the Pod stores the
underlying data and memory.

## Base Flow

1. Coffee user enters or discovers a Pod URL.
2. Coffee calls `GET /health`.
3. Coffee calls `GET /pod/capabilities`.
4. If `auth.api_token_required` is true, Coffee pairs with the Pod using the
   owner-provided token:

   ```http
   POST /coffee/connect
   Authorization: Bearer <owner-token>
   ```

5. Pod returns `client_token`. Coffee stores that token securely and uses it for
   future Pod requests:

   ```http
   Authorization: Bearer <client-token>
   ```

   Client tokens are bound to the returned `actor_id`. Requests that include a
   different `actor_id` are rejected.

6. Coffee syncs meetings and documents into the Pod.
7. Coffee requests Pod-backed briefs before meetings.
8. Coffee captures notes, decisions, tasks, and follow-up drafts after meetings.
9. Coffee shows pending external actions to the user before executing anything.

## Pairing

### `POST /coffee/connect`

Request:

```json
{
  "client_id": "coffee-staging-desktop",
  "client_name": "Coffee Staging Desktop",
  "pod_url": "https://pod.example.com",
  "actor_id": "coffee:coffee-staging-desktop"
}
```

Response:

```json
{
  "client_id": "coffee-staging-desktop",
  "client_name": "Coffee Staging Desktop",
  "pod_url": "https://pod.example.com",
  "actor_id": "coffee:coffee-staging-desktop",
  "grant_id": "grant_...",
  "client_token": "cpod_...",
  "token_prefix": "cpod_abc12",
  "status": "connected",
  "created_at": "2026-05-07T00:00:00.000Z"
}
```

The Pod stores only a hash of `client_token`.

Owner-only endpoints:

- `POST /coffee/connect`
- `GET /coffee/clients`
- `POST /coffee/clients/:client_id/revoke`

Client-token endpoints:

- `POST /coffee/sync/meetings`
- `POST /coffee/meetings/:meeting_id/brief`
- `POST /coffee/meetings/:meeting_id/capture`
- Pod memory/session/action endpoints when `actor_id` matches the paired
  client actor.

## Meeting Sync

### `POST /coffee/sync/meetings`

Request:

```json
{
  "actor_id": "coffee:coffee-staging-desktop",
  "meetings": [
    {
      "id": "meeting_123",
      "title": "Founder Pod staging kickoff",
      "start_at": "2026-05-08T10:00:00.000Z",
      "end_at": "2026-05-08T10:30:00.000Z",
      "location": "Coffee Room A",
      "url": "https://coffee.example/meetings/meeting_123",
      "attendees": [
        {
          "id": "user_1",
          "name": "Stevie",
          "email": "stevie@example.com",
          "role": "host"
        }
      ],
      "notes": "Planning Pod staging integration.",
      "documents": [
        {
          "id": "doc_1",
          "title": "Integration Plan",
          "url": "https://coffee.example/docs/doc_1",
          "text": "Optional extracted/plain text for Pod memory."
        }
      ]
    }
  ]
}
```

Response:

```json
{
  "synced": [
    {
      "meeting_id": "meeting_123",
      "observation_id": "obs_...",
      "status": "accepted"
    }
  ],
  "count": 1
}
```

This also writes generic Pod objects:

- `kind: "coffee.meeting"`
- `kind: "coffee.document"`
- `collection_id: "coffee"`

## Meeting Brief

### `POST /coffee/meetings/:meeting_id/brief`

Request:

```json
{
  "actor_id": "coffee:coffee-staging-desktop",
  "query": "Founder Pod staging kickoff Integration Plan",
  "limit": 5
}
```

Response:

```json
{
  "meeting_id": "meeting_123",
  "brief": "Meeting brief...",
  "sources": [
    {
      "id": "obs_...",
      "type": "meeting",
      "scope": "pod/founder/apps/coffee",
      "snippet": "..."
    }
  ],
  "observation_id": "obs_..."
}
```

## Meeting Capture

### `POST /coffee/meetings/:meeting_id/capture`

Request:

```json
{
  "actor_id": "coffee:coffee-staging-desktop",
  "notes": "Meeting notes or summary.",
  "decisions": ["Coffee will plug staging into the Pod API."],
  "tasks": ["Create the staging adapter."],
  "followups": [
    {
      "title": "Send Pod integration package",
      "description": "Share API contract and local run instructions.",
      "to": "cto@example.com"
    }
  ]
}
```

Response:

```json
{
  "meeting_id": "meeting_123",
  "writes": [
    {
      "id": "obs_...",
      "status": "accepted"
    }
  ]
}
```

Follow-ups are stored as Pod drafts requiring human review. Coffee should not
send email, calendar updates, messages, or external writes without approval.

## Admin

### `GET /coffee/clients`

Lists connected clients without exposing token hashes.

### `POST /coffee/clients/:client_id/revoke`

Revokes a client token and records a private Smartware consent event.

## Staging Requirements

- A staging Coffee workspace with synthetic users, meetings, documents, and
  notes.
- Coffee can call a local Pod URL such as `http://127.0.0.1:8732` for desktop
  testing and a hosted/VPS Pod URL for cloud testing.
- Coffee stores `client_token` in the existing secure credential store.
- Coffee sends only synthetic/non-production customer data during integration.
- Coffee treats Pod follow-ups as drafts until the user approves execution.
