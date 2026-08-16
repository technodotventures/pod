export interface ActivityNavigationEvent {
  type?: string;
  actor_id?: string;
  source_app?: string;
  source_id?: string;
  pod_object_id?: string;
  content?: unknown;
}

export interface ActivityNavigationObject {
  id: string;
  collection_id?: string | null;
}

export interface ActivitySourceItem {
  title: string;
  object_id?: string;
  source_url?: string;
  sender?: string;
  occurred_at?: string;
}

export type ActivityDestination =
  | { kind: 'object'; id: string }
  | { kind: 'collection'; id: string };

const SOURCE_COLLECTION_IDS = new Set([
  'gmail',
  'icloud-mail',
  'google-calendar',
  'google-drive',
  'github',
  'gitlab',
  'linear',
  'notion',
  'obsidian',
  'slack',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function safeHttpUrl(value: unknown): string | undefined {
  const candidate = optionalString(value);
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    if (url.hostname === 'mail.google.com' && url.pathname === '/mail/u/google-account/') {
      url.pathname = '/mail/u/0/';
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

/**
 * Returns the concrete items represented by an aggregate activity event.
 * Older events only retained titles in `messages`; newer events also retain
 * exact Pod object and provider URLs.
 */
export function activitySourceItems(event: ActivityNavigationEvent): ActivitySourceItem[] {
  const content = asRecord(event.content);
  const structured = Array.isArray(content?.items)
    ? content.items.flatMap((value) => {
      const item = asRecord(value);
      const title = optionalString(item?.title);
      if (!title) return [];
      const objectId = optionalString(item?.object_id);
      const sourceUrl = safeHttpUrl(item?.source_url);
      const sender = optionalString(item?.sender);
      const occurredAt = optionalString(item?.occurred_at);
      return [{
        title,
        ...(objectId ? { object_id: objectId } : {}),
        ...(sourceUrl ? { source_url: sourceUrl } : {}),
        ...(sender ? { sender } : {}),
        ...(occurredAt ? { occurred_at: occurredAt } : {}),
      }];
    })
    : [];
  if (structured.length > 0) return structured.slice(0, 20);

  return Array.isArray(content?.messages)
    ? content.messages
      .flatMap((value) => {
        const title = optionalString(value);
        return title ? [{ title }] : [];
      })
      .slice(0, 20)
    : [];
}

function sourceCollectionId(event: ActivityNavigationEvent, content: Record<string, unknown> | null): string | null {
  const explicit = typeof event.source_app === 'string'
    ? event.source_app
    : typeof content?.source_app === 'string'
      ? content.source_app
      : null;
  const haystack = [explicit, event.type, event.actor_id]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase()
    .replaceAll('_', '-');

  for (const source of SOURCE_COLLECTION_IDS) {
    if (haystack.includes(source)) return source;
  }
  return null;
}

export function resolveActivityDestination(
  event: ActivityNavigationEvent,
  objects: ActivityNavigationObject[],
): ActivityDestination | null {
  if (event.pod_object_id) return { kind: 'object', id: event.pod_object_id };

  const content = asRecord(event.content);
  const contentObjectId = typeof content?.object_id === 'string' ? content.object_id : null;
  if (contentObjectId) return { kind: 'object', id: contentObjectId };

  const files = Array.isArray(content?.files)
    ? content.files.flatMap((file) => {
      const record = asRecord(file);
      return typeof record?.id === 'string' ? [record.id] : [];
    })
    : [];
  if (files.length === 1) return { kind: 'object', id: files[0] };

  const objectById = new Map(objects.map(object => [object.id, object]));
  const sourceIds = [event.source_id, content?.source_id]
    .filter((id): id is string => typeof id === 'string');
  const matchingSourceId = sourceIds.find(id => objectById.has(id));
  if (matchingSourceId) return { kind: 'object', id: matchingSourceId };

  if (files.length > 1) {
    const collectionIds = new Set(files.flatMap(id => {
      const collectionId = objectById.get(id)?.collection_id;
      return collectionId ? [collectionId] : [];
    }));
    if (collectionIds.size === 1) {
      return { kind: 'collection', id: [...collectionIds][0] };
    }
  }

  const collectionId = sourceCollectionId(event, content);
  if (collectionId) return { kind: 'collection', id: collectionId };
  return null;
}
