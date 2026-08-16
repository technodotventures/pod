export interface ReflectionPageResult {
  id: string;
  title: string;
  entity_id: string;
  path: string;
}

export interface ReflectionScopeResult {
  scope: string;
  claims_created: number;
  pages_compiled: number;
  pages: ReflectionPageResult[];
}

export interface ActivityReflectionResult {
  claims_created: number;
  pages_compiled: number;
  scopes: ReflectionScopeResult[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonNegativeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function requiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function activityReflectionResult(event: { type?: string; content?: unknown }): ActivityReflectionResult | null {
  if (event.type !== 'reflect') return null;
  const content = asRecord(event.content);
  if (!content) return null;
  const claimsCreated = nonNegativeNumber(content.claims_created);
  const pagesCompiled = nonNegativeNumber(content.pages_compiled);
  if (claimsCreated == null || pagesCompiled == null) return null;

  const scopes = Array.isArray(content.results)
    ? content.results.flatMap(value => {
      const result = asRecord(value);
      const scope = requiredString(result?.scope);
      const claims = nonNegativeNumber(result?.claims_created);
      const pages = nonNegativeNumber(result?.pages_compiled);
      if (!scope || claims == null || pages == null) return [];
      const pageItems = Array.isArray(result?.pages)
        ? result.pages.flatMap(value => {
          const page = asRecord(value);
          const id = requiredString(page?.id);
          const title = requiredString(page?.title);
          const entityId = requiredString(page?.entity_id);
          const path = requiredString(page?.path);
          return id && title && entityId && path
            ? [{ id, title, entity_id: entityId, path }]
            : [];
        })
        : [];
      return [{ scope, claims_created: claims, pages_compiled: pages, pages: pageItems }];
    })
    : [];

  return { claims_created: claimsCreated, pages_compiled: pagesCompiled, scopes };
}
