/** File processing pipeline for Pod imports. */
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  IMPORT_FORMATS,
  MAX_EXTRACT_FILE_BYTES,
  MAX_IMPORT_FILE_BYTES,
  importFormatForFilename,
  type ImportProcessingMode,
} from '../shared/import-formats.js';

export type FileExtractionStatus = 'stored' | 'searchable' | 'needs_ocr' | 'metadata_only' | 'failed';

export interface ExtractedChunk {
  index: number;
  text: string;
  locator: {
    kind: 'document' | 'page' | 'section';
    label: string;
    page?: number;
    section?: string;
  };
}

export interface ProcessedFile {
  /** Original filename */
  filename: string;
  /** Detected kind for the Pod object */
  kind: string;
  /** MIME type */
  mimeType: string;
  /** Extracted plain-text content (if any) */
  text: string | undefined;
  /** File size in bytes */
  size: number;
  /** Whether text extraction succeeded */
  hasText: boolean;
  /** Honest extraction outcome for the selected processing mode */
  extractionStatus: FileExtractionStatus;
  /** Source-located text units suitable for memory observation */
  chunks: ExtractedChunk[];
  /** Non-fatal parser and capability warnings */
  warnings: string[];
  /** Additional metadata from parsing */
  meta: Record<string, unknown>;
}

export interface StructuredFrontmatter {
  [key: string]: string | string[] | boolean | number | null | undefined;
}

export interface ObjectAnnotations {
  summary: string | null;
  tags: string[];
  references: {
    belongs_to: string[];
    related_to: string[];
    derived_from: string[];
    mentions: string[];
    other_links: string[];
  };
}

/** All extensions we accept for import */
export const SUPPORTED_EXTENSIONS = new Set(IMPORT_FORMATS.map((format) => format.extension));

export function classifyFile(filename: string): {
  kind: string;
  mimeType: string;
  canExtractText: boolean;
  isPdf: boolean;
} {
  const format = importFormatForFilename(filename);
  return {
    kind: format?.kind ?? 'file',
    mimeType: format?.mimeType ?? 'application/octet-stream',
    canExtractText: Boolean(format && format.extractor !== 'none'),
    isPdf: format?.extractor === 'pdf',
  };
}

export function isSupported(filename: string): boolean {
  return importFormatForFilename(filename) !== undefined;
}

/**
 * Process a file from a Buffer.
 * Used by the upload endpoint after reading multipart data.
 */
export async function processBuffer(
  filename: string,
  buffer: Buffer,
  processingMode: ImportProcessingMode = 'extract',
): Promise<ProcessedFile> {
  const format = importFormatForFilename(filename);
  const kind = format?.kind ?? 'file';
  const mimeType = format?.mimeType ?? 'application/octet-stream';
  let text: string | undefined;
  let chunks: ExtractedChunk[] = [];
  let extractionStatus: FileExtractionStatus = processingMode === 'store' ? 'stored' : 'metadata_only';
  const warnings: string[] = [];
  const meta: Record<string, unknown> = {};

  if (processingMode !== 'store') {
    if (!format || format.extractor === 'none') {
      warnings.push(
        format?.extension === '.doc'
          ? 'Legacy .doc text extraction is not available; the original file was retained.'
          : 'No text extractor is available for this format; the original file was retained.',
      );
    } else if (buffer.length > MAX_EXTRACT_FILE_BYTES) {
      warnings.push(
        `File retained without extraction because it exceeds the ${MAX_EXTRACT_FILE_BYTES / (1024 * 1024)} MB extraction limit.`,
      );
    } else if (format.extractor === 'text' || format.extractor === 'html') {
      const raw = buffer.toString('utf-8');
      text = format.extractor === 'html' ? htmlToStructuredText(raw) : raw;
      chunks = chunksFromStructuredText(text);

      if (kind === 'markdown') {
        const fm = extractFrontmatter(text);
        if (fm) {
          meta.frontmatter = fm;
          meta.annotations = deriveObjectAnnotations(text, fm);
        }
      }
      if (format.extractor === 'html') {
        meta.raw_html = raw;
      }
      extractionStatus = text.trim() ? 'searchable' : 'metadata_only';
    } else if (format.extractor === 'pdf') {
      const result = await extractPdfText(buffer);
      text = result.text;
      chunks = result.chunks;
      extractionStatus = result.status;
      warnings.push(...result.warnings);
      meta.pages = result.pages;
      meta.text_pages = result.textPages;
      meta.scan_detected = result.status === 'needs_ocr';
    } else if (format.extractor === 'docx') {
      const result = await extractDocxText(buffer);
      text = result.text;
      chunks = result.chunks;
      extractionStatus = result.status;
      warnings.push(...result.warnings);
      meta.sections = new Set(chunks.map((chunk) => chunk.locator.section).filter(Boolean)).size;
    }
  }

  const hasText = Boolean(text?.trim());
  meta.extraction = {
    status: extractionStatus,
    extractor: format?.extractor ?? 'none',
    version: 1,
    processing_mode: processingMode,
    chunk_count: chunks.length,
    warnings,
  };

  return {
    filename,
    kind,
    mimeType,
    text,
    size: buffer.length,
    hasText,
    extractionStatus,
    chunks,
    warnings,
    meta,
  };
}

/**
 * Process a file from disk by path.
 * Used by the folder import endpoint.
 */
export async function processFile(
  filePath: string,
  processingMode: ImportProcessingMode = 'extract',
): Promise<ProcessedFile> {
  const filename = path.basename(filePath);
  const stat = await fs.stat(filePath);
  if (stat.size > MAX_IMPORT_FILE_BYTES) {
    throw new Error(`File exceeds the ${MAX_IMPORT_FILE_BYTES / (1024 * 1024)} MB import limit`);
  }
  const processed = await processBuffer(filename, await fs.readFile(filePath), processingMode);
  processed.meta.path = filePath;
  return processed;
}

/**
 * Walk a directory recursively, yielding file paths that match supported extensions.
 * Skips hidden dirs (like .obsidian, .git) and node_modules.
 */
export async function* walkDirectory(dirPath: string): AsyncGenerator<string> {
  const SKIP_DIRS = new Set(['.obsidian', '.git', '.svn', 'node_modules', '.trash', '.DS_Store']);

  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      yield* walkDirectory(fullPath);
    } else if (entry.isFile()) {
      if (isSupported(entry.name)) {
        yield fullPath;
      }
    }
  }
}

/**
 * Derive a title from a filename.
 * "my-meeting-notes.md" → "my meeting notes"
 */
export function titleFromFilename(filename: string): string {
  const name = path.basename(filename, path.extname(filename));
  return name.replace(/[-_]+/g, ' ').trim();
}

async function extractPdfText(buffer: Buffer): Promise<{
  text: string | undefined;
  pages: number;
  textPages: number;
  chunks: ExtractedChunk[];
  status: FileExtractionStatus;
  warnings: string[];
}> {
  let destroyParser: (() => Promise<void>) | undefined;
  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    return {
      text: undefined,
      pages: 0,
      textPages: 0,
      chunks: [],
      status: 'failed',
      warnings: ['PDF extraction failed: the file signature is not a PDF.'],
    };
  }
  try {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    destroyParser = () => parser.destroy();
    const result = await parser.getText();
    const textPages = result.pages.filter((page) => page.text.trim().length >= 10);
    const visibleCharacters = textPages.reduce(
      (total, page) => total + page.text.replace(/\s/g, '').length,
      0,
    );
    if (visibleCharacters < Math.max(20, (result.total ?? 0) * 8)) {
      return {
        text: undefined,
        pages: result.total ?? 0,
        textPages: textPages.length,
        chunks: [],
        status: 'needs_ocr',
        warnings: ['No usable text layer was found. This PDF needs OCR before it can be searched.'],
      };
    }

    const chunks = result.pages.flatMap((page) =>
      chunksForLocator(page.text, {
        kind: 'page',
        label: `Page ${page.num}`,
        page: page.num,
      }),
    );
    return {
      text: result.pages.map((page) => page.text.trim()).filter(Boolean).join('\n\n'),
      pages: result.total ?? 0,
      textPages: textPages.length,
      chunks: numberChunks(chunks),
      status: 'searchable',
      warnings: [],
    };
  } catch (error) {
    return {
      text: undefined,
      pages: 0,
      textPages: 0,
      chunks: [],
      status: 'failed',
      warnings: [`PDF extraction failed: ${errorMessage(error)}`],
    };
  } finally {
    await destroyParser?.().catch(() => undefined);
  }
}

async function extractDocxText(buffer: Buffer): Promise<{
  text: string | undefined;
  chunks: ExtractedChunk[];
  status: FileExtractionStatus;
  warnings: string[];
}> {
  try {
    await validateDocxArchive(buffer);
    const mammoth = await import('mammoth');
    const result = await mammoth.convertToHtml({ buffer });
    const text = htmlToStructuredText(result.value);
    const warnings = result.messages.map((message) => `${message.type}: ${message.message}`);
    if (!text) {
      return {
        text: undefined,
        chunks: [],
        status: 'metadata_only',
        warnings: [...warnings, 'The Word document did not contain extractable text.'],
      };
    }
    return {
      text,
      chunks: chunksFromStructuredText(text),
      status: 'searchable',
      warnings,
    };
  } catch (error) {
    return {
      text: undefined,
      chunks: [],
      status: 'failed',
      warnings: [`DOCX extraction failed: ${errorMessage(error)}`],
    };
  }
}

async function validateDocxArchive(buffer: Buffer): Promise<void> {
  if (buffer.subarray(0, 2).toString('ascii') !== 'PK') {
    throw new Error('the file signature is not a DOCX archive');
  }
  const { default: JSZip } = await import('jszip');
  const archive = await JSZip.loadAsync(buffer);
  const entries = Object.values(archive.files);
  if (!archive.file('word/document.xml')) {
    throw new Error('word/document.xml is missing');
  }
  if (entries.length > 2_000) {
    throw new Error('the DOCX archive contains too many entries');
  }
  const totalUncompressedBytes = entries.reduce((total, entry) => {
    const data = (entry as unknown as { _data?: { uncompressedSize?: number } })._data;
    return total + (data?.uncompressedSize ?? 0);
  }, 0);
  if (totalUncompressedBytes > 50 * 1024 * 1024) {
    throw new Error('the DOCX archive expands beyond the 50 MB safety limit');
  }
}

/* ── Helpers ── */

const MAX_CHUNK_CHARACTERS = 12_000;

function chunksFromStructuredText(text: string): ExtractedChunk[] {
  const lines = text.split(/\r?\n/);
  const chunks: ExtractedChunk[] = [];
  let section = 'Document';
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join('\n').trim();
    if (body) {
      chunks.push(...chunksForLocator(body, {
        kind: section === 'Document' ? 'document' : 'section',
        label: section,
        ...(section === 'Document' ? {} : { section }),
      }));
    }
    buffer = [];
  };

  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flush();
      section = heading[1]!.trim();
      buffer.push(line);
    } else {
      buffer.push(line);
    }
  }
  flush();
  return numberChunks(chunks);
}

function chunksForLocator(
  text: string,
  locator: ExtractedChunk['locator'],
): ExtractedChunk[] {
  const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const chunks: ExtractedChunk[] = [];
  let current = '';

  const pushCurrent = () => {
    if (!current.trim()) return;
    chunks.push({ index: 0, text: current.trim(), locator: { ...locator } });
    current = '';
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > MAX_CHUNK_CHARACTERS) {
      pushCurrent();
      for (let offset = 0; offset < paragraph.length; offset += MAX_CHUNK_CHARACTERS) {
        chunks.push({
          index: 0,
          text: paragraph.slice(offset, offset + MAX_CHUNK_CHARACTERS).trim(),
          locator: { ...locator },
        });
      }
    } else if (!current || current.length + paragraph.length + 2 <= MAX_CHUNK_CHARACTERS) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    } else {
      pushCurrent();
      current = paragraph;
    }
  }
  pushCurrent();
  return chunks.filter((chunk) => chunk.text);
}

function numberChunks(chunks: ExtractedChunk[]): ExtractedChunk[] {
  return chunks.map((chunk, index) => ({ ...chunk, index }));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function extractFrontmatter(text: string): StructuredFrontmatter | null {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const lines = match[1].split(/\r?\n/);
  const result: StructuredFrontmatter = {};
  let currentKey: string | null = null;

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;
    const listMatch = rawLine.match(/^\s*-\s+(.+)\s*$/);
    if (listMatch && currentKey) {
      const existing = Array.isArray(result[currentKey]) ? result[currentKey] as string[] : [];
      existing.push(cleanFrontmatterScalar(listMatch[1]!));
      result[currentKey] = existing;
      continue;
    }

    const colon = rawLine.indexOf(':');
    if (colon <= 0) {
      currentKey = null;
      continue;
    }

    const key = rawLine.slice(0, colon).trim();
    const value = rawLine.slice(colon + 1).trim();
    if (!key) {
      currentKey = null;
      continue;
    }

    if (!value) {
      result[key] = [];
      currentKey = key;
      continue;
    }

    result[key] = parseFrontmatterValue(value);
    currentKey = null;
  }
  return Object.keys(result).length > 0 ? result : null;
}

/**
 * Detect whether a processed markdown file contains skill frontmatter.
 * A skill file is a .md with frontmatter containing recognizable skill keys:
 *   type: skill | capability | tool | action
 *   triggers / trigger / commands / command
 *   permissions / capabilities
 *
 * Returns parsed skill metadata if detected, null otherwise.
 */
export function detectSkillFrontmatter(processed: ProcessedFile): {
  name: string;
  description: string;
  version: string;
  author: string;
  scope: string;
  permissions: string[];
  portability: 'local' | 'exportable' | 'synced';
} | null {
  if (processed.kind !== 'markdown') return null;
  const fm = processed.meta.frontmatter as StructuredFrontmatter | undefined;
  if (!fm) return null;

  const typeValue = String(fm.type ?? '').toLowerCase();
  const explicitSkillFlag = typeValue === 'skill' || fm.smartware_skill === true;
  if (!explicitSkillFlag) return null;

  const permissions = normaliseFrontmatterArray(fm.permissions ?? fm.capabilities);

  return {
    name: String(fm.name ?? fm.title ?? processed.filename.replace(/\.md$/i, '')),
    description: String(fm.description ?? fm.summary ?? ''),
    version: String(fm.version ?? '0.1.0'),
    author: String(fm.author ?? fm.by ?? 'unknown'),
    scope: String(fm.scope ?? 'personal'),
    permissions,
    portability: (fm.portability as 'local' | 'exportable' | 'synced') ?? 'local',
  };
}

export function isPossibleSkillFrontmatter(frontmatter: StructuredFrontmatter | null | undefined): boolean {
  if (!frontmatter) return false;
  if (String(frontmatter.type ?? '').toLowerCase() === 'skill' || frontmatter.smartware_skill === true) {
    return false;
  }
  return frontmatter.triggers !== undefined
    || frontmatter.trigger !== undefined
    || frontmatter.commands !== undefined
    || frontmatter.command !== undefined
    || frontmatter.capabilities !== undefined
    || (frontmatter.name !== undefined && frontmatter.version !== undefined && frontmatter.description !== undefined);
}

export function deriveObjectAnnotations(text: string, frontmatter?: StructuredFrontmatter | null): ObjectAnnotations {
  const tags = uniqueStrings([
    ...normaliseFrontmatterArray(frontmatter?.tags),
    ...normaliseFrontmatterArray(frontmatter?.tag),
  ]);

  const structured = {
    belongs_to: uniqueStrings(normaliseFrontmatterArray(frontmatter?.belongs_to)),
    related_to: uniqueStrings(normaliseFrontmatterArray(frontmatter?.related_to)),
    derived_from: uniqueStrings(normaliseFrontmatterArray(frontmatter?.derived_from)),
    mentions: uniqueStrings(normaliseFrontmatterArray(frontmatter?.mentions)),
    other_links: [] as string[],
  };

  const linkedTargets = new Set([
    ...structured.belongs_to,
    ...structured.related_to,
    ...structured.derived_from,
    ...structured.mentions,
  ].map(normaliseReferenceKey));

  structured.other_links = uniqueStrings(
    extractWikilinks(text).filter((link) => !linkedTargets.has(normaliseReferenceKey(link))),
  );

  return {
    summary: summarizeText(text),
    tags,
    references: structured,
  };
}

export function summarizeText(text: string): string | null {
  const body = stripFrontmatter(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith('#'));
  if (!body) return null;
  return body.length > 180 ? `${body.slice(0, 177).trimEnd()}...` : body;
}

export function extractWikilinks(text: string): string[] {
  const matches = [...stripFrontmatter(text).matchAll(/\[\[([^\]]+)\]\]/g)];
  return uniqueStrings(
    matches
      .map((match) => match[1]?.split('|')[0]?.trim() ?? '')
      .filter(Boolean),
  );
}

function stripFrontmatter(text: string): string {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
}

function parseFrontmatterValue(value: string): string | string[] | boolean | number {
  const clean = cleanFrontmatterScalar(value);
  if (clean.startsWith('[') && clean.endsWith(']')) {
    return normaliseFrontmatterArray(clean);
  }
  if (/^(true|false)$/i.test(clean)) {
    return clean.toLowerCase() === 'true';
  }
  if (/^-?\d+(?:\.\d+)?$/.test(clean)) {
    return Number(clean);
  }
  return clean;
}

function cleanFrontmatterScalar(value: string): string {
  return value.trim().replace(/^["']|["']$/g, '');
}

function normaliseFrontmatterArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return uniqueStrings(value.map((item) => String(item).trim()).filter(Boolean));
  }
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  const inner = trimmed.startsWith('[') && trimmed.endsWith(']')
    ? trimmed.slice(1, -1)
    : trimmed;
  return uniqueStrings(
    inner
      .split(/[,\n]/)
      .map((item) => cleanFrontmatterScalar(item))
      .map((item) => item.replace(/^#/, '').trim())
      .filter(Boolean),
  );
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const clean = value.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(clean);
  }
  return output;
}

function normaliseReferenceKey(value: string): string {
  return value.trim().toLowerCase();
}

function htmlToStructuredText(html: string): string {
  const structured = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_match, level: string, body: string) =>
      `\n\n${'#'.repeat(Number(level))} ${stripInlineHtml(body)}\n\n`)
    .replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, href: string, body: string) =>
      `[${stripInlineHtml(body)}](${href})`)
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/li>/gi, '')
    .replace(/<(?:p|div|section|article|blockquote|tr)[^>]*>/gi, '\n\n')
    .replace(/<\/(?:p|div|section|article|blockquote|tr)>/gi, '\n\n')
    .replace(/<(?:br|hr)\s*\/?>/gi, '\n')
    .replace(/<(?:td|th)[^>]*>/gi, ' | ')
    .replace(/<\/(?:td|th)>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ');
  return decodeHtmlEntities(structured).trim();
}

function stripInlineHtml(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
}
