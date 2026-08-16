export const DOC_KINDS = new Set([
  'page',
  'doc',
  'note',
  'file',
  'coffee.document',
  'bookmark',
  'markdown',
  'document',
  'pdf',
  'image',
  'csv',
]);

export function opensInDocs(kind: string | null | undefined, isCustomType = false): boolean {
  return isCustomType || (!!kind && DOC_KINDS.has(kind));
}
