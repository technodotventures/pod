/**
 * Stable identity hooks shared across Calendar and Drive ingestion.
 *
 * REFLECT relies on these being identical across sources — a Calendar
 * attendee email and a Drive sharing-list email must hash to the same
 * canonical form so the People graph can link them. Likewise, a Drive
 * file_id referenced from a Calendar event attachment must match the
 * id stored on the Drive-side observation.
 */

/** Canonical email form: trimmed, lowercased. We deliberately do not
 *  strip `+alias` because plus-aliases are addresses the user can route
 *  separately, and treating them as identical risks merging distinct
 *  identities in the People graph. */
export function normalizeEmail(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/** Canonical Drive file id. Google's ids are already URL-safe and stable;
 *  we just trim and reject empty/whitespace ids. */
export function normalizeFileId(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Extract Drive file_ids from a Calendar event's `attachments` array.
 *  Google returns `fileId` (camelCase); we emit `file_id` everywhere
 *  downstream. */
export function extractAttachedDriveFileIds(event: { attachments?: Array<{ fileId?: string; fileUrl?: string }> } | undefined | null): string[] {
  if (!event?.attachments) return [];
  const ids: string[] = [];
  for (const att of event.attachments) {
    const id = normalizeFileId(att.fileId);
    if (id) ids.push(id);
  }
  return ids;
}

/** Map a list of email-bearing records (attendees, sharing entries) to
 *  their normalized addresses. Order preserved; nulls dropped. */
export function normalizeEmailList(
  raw: Array<{ email?: string | null }> | undefined | null,
): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const entry of raw) {
    const email = normalizeEmail(entry.email);
    if (email) out.push(email);
  }
  return out;
}
