export type ImportProcessingMode = 'store' | 'extract' | 'reflect';

export type ImportExtractor = 'text' | 'html' | 'pdf' | 'docx' | 'none';

export interface ImportFormatCapability {
  extension: string;
  label: string;
  kind: string;
  mimeType: string;
  extractor: ImportExtractor;
}

export const MAX_IMPORT_FILE_BYTES = 100 * 1024 * 1024;
export const MAX_EXTRACT_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_REQUEST_BYTES = 250 * 1024 * 1024;

export const IMPORT_FORMATS: readonly ImportFormatCapability[] = [
  { extension: '.md', label: 'Markdown', kind: 'markdown', mimeType: 'text/markdown', extractor: 'text' },
  { extension: '.markdown', label: 'Markdown', kind: 'markdown', mimeType: 'text/markdown', extractor: 'text' },
  { extension: '.txt', label: 'Plain text', kind: 'text', mimeType: 'text/plain', extractor: 'text' },
  { extension: '.log', label: 'Log', kind: 'text', mimeType: 'text/plain', extractor: 'text' },
  { extension: '.json', label: 'JSON', kind: 'json', mimeType: 'application/json', extractor: 'text' },
  { extension: '.csv', label: 'CSV', kind: 'csv', mimeType: 'text/csv', extractor: 'text' },
  { extension: '.tsv', label: 'TSV', kind: 'csv', mimeType: 'text/tab-separated-values', extractor: 'text' },
  { extension: '.html', label: 'HTML', kind: 'html', mimeType: 'text/html', extractor: 'html' },
  { extension: '.htm', label: 'HTML', kind: 'html', mimeType: 'text/html', extractor: 'html' },
  { extension: '.xml', label: 'XML', kind: 'xml', mimeType: 'application/xml', extractor: 'text' },
  { extension: '.yaml', label: 'YAML', kind: 'yaml', mimeType: 'application/yaml', extractor: 'text' },
  { extension: '.yml', label: 'YAML', kind: 'yaml', mimeType: 'application/yaml', extractor: 'text' },
  { extension: '.toml', label: 'TOML', kind: 'toml', mimeType: 'application/toml', extractor: 'text' },
  { extension: '.pdf', label: 'PDF', kind: 'pdf', mimeType: 'application/pdf', extractor: 'pdf' },
  {
    extension: '.docx',
    label: 'Word document',
    kind: 'document',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extractor: 'docx',
  },
  {
    extension: '.doc',
    label: 'Legacy Word document (store only)',
    kind: 'document',
    mimeType: 'application/msword',
    extractor: 'none',
  },
  { extension: '.png', label: 'PNG image (store only)', kind: 'image', mimeType: 'image/png', extractor: 'none' },
  { extension: '.jpg', label: 'JPEG image (store only)', kind: 'image', mimeType: 'image/jpeg', extractor: 'none' },
  { extension: '.jpeg', label: 'JPEG image (store only)', kind: 'image', mimeType: 'image/jpeg', extractor: 'none' },
  { extension: '.gif', label: 'GIF image (store only)', kind: 'image', mimeType: 'image/gif', extractor: 'none' },
  { extension: '.webp', label: 'WebP image (store only)', kind: 'image', mimeType: 'image/webp', extractor: 'none' },
  { extension: '.avif', label: 'AVIF image (store only)', kind: 'image', mimeType: 'image/avif', extractor: 'none' },
] as const;

const FORMAT_BY_EXTENSION = new Map(IMPORT_FORMATS.map((format) => [format.extension, format]));

export const SUPPORTED_IMPORT_EXTENSIONS = IMPORT_FORMATS.map((format) => format.extension);

export function importExtension(filename: string): string {
  const basename = filename.replace(/^.*[\\/]/, '');
  const dot = basename.lastIndexOf('.');
  return dot >= 0 ? basename.slice(dot).toLowerCase() : '';
}

export function importFormatForFilename(filename: string): ImportFormatCapability | undefined {
  return FORMAT_BY_EXTENSION.get(importExtension(filename));
}

export function normalizeImportProcessingMode(
  value: unknown,
  legacyReflect = false,
): ImportProcessingMode {
  if (value === 'store' || value === 'extract' || value === 'reflect') return value;
  return legacyReflect ? 'reflect' : 'extract';
}
