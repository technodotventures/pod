import type { SmartwareCore } from 'smartware';

import type { ExtractedChunk, FileExtractionStatus } from './file-processor.js';
import type { ImportProcessingMode } from '../shared/import-formats.js';
import type { MemoryVisibility } from './memory-settings.js';

export interface ImportMemoryFile {
  objectId: string;
  title: string;
  filename: string;
  sha256: string;
  chunks: ExtractedChunk[];
}

export interface ImportMemoryObservationResult {
  observationIds: string[];
  observations: Array<{ observation_id: string; source_id: string }>;
  warnings: string[];
}

export function processingStateForImport(
  mode: ImportProcessingMode,
  extractionStatus: FileExtractionStatus,
): string {
  if (mode === 'store') return 'stored';
  if (extractionStatus === 'needs_ocr') return 'needs_ocr';
  if (extractionStatus === 'metadata_only') return 'metadata_only';
  if (extractionStatus === 'failed') return 'failed';
  return mode === 'reflect' ? 'reflecting' : 'searchable';
}

export async function observeImportedFileContent(
  core: SmartwareCore,
  input: {
    actorId: string;
    scope: string;
    visibility: MemoryVisibility;
    sensitive: boolean;
    file: ImportMemoryFile;
  },
): Promise<ImportMemoryObservationResult> {
  const observationIds: string[] = [];
  const observations: ImportMemoryObservationResult['observations'] = [];
  const warnings: string[] = [];

  for (const chunk of input.file.chunks) {
    const sourceId = [
      'pod-object',
      input.file.objectId,
      input.file.sha256.slice(0, 16),
      'chunk',
      chunk.index + 1,
    ].join(':');
    const locatedText = [
      `# ${input.file.title}`,
      `Source: ${input.file.filename} · ${chunk.locator.label}`,
      '',
      chunk.text,
    ].join('\n');

    try {
      const result = await core.observe({
        actor: { type: 'agent', id: input.actorId, display_name: input.actorId },
        type: 'file',
        scope: input.scope,
        source_id: sourceId,
        content: {
          format: 'application/json',
          body: {
            body: locatedText,
            filename: input.file.filename,
            size: Buffer.byteLength(locatedText, 'utf8'),
            object_id: input.file.objectId,
            sha256: input.file.sha256,
            locator: chunk.locator,
            chunk_index: chunk.index,
          },
        },
        visibility: input.visibility,
        sensitive: input.sensitive,
        app: 'coffee-pod',
      });
      const observationId = result.existing_id ?? result.id;
      observationIds.push(observationId);
      observations.push({ observation_id: observationId, source_id: sourceId });
    } catch (error) {
      warnings.push(
        `${chunk.locator.label}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return { observationIds, observations, warnings };
}
