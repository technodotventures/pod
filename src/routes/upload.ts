/**
 * File upload endpoint for Pod.
 * Handles multipart file uploads, processes them through the file pipeline,
 * and stores them as Pod objects.
 */
import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';

import type { CoffeePodEnv } from '../config/env.js';
import { getDb, getObject, upsertObject, upsertSkill, createImport, updateImport, insertEvent, patchObject } from '../pod/db.js';
import {
  processBuffer,
  isSupported,
  titleFromFilename,
  detectSkillFrontmatter,
  isPossibleSkillFrontmatter,
  type StructuredFrontmatter,
  SUPPORTED_EXTENSIONS,
} from '../services/file-processor.js';
import { storeImportedFile } from '../services/imported-file-store.js';
import {
  observeImportedFileContent,
  processingStateForImport,
  type ImportMemoryFile,
} from '../services/import-memory.js';
import { requireActorAuth } from '../security/auth.js';
import { getSmartwareCore } from '../smartware/core.js';
import {
  resolveObservationDefaults,
  resolveReflectionModelUse,
  type MemoryVisibility,
} from '../services/memory-settings.js';
import {
  IMPORT_FORMATS,
  MAX_EXTRACT_FILE_BYTES,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_REQUEST_BYTES,
  normalizeImportProcessingMode,
  type ImportProcessingMode,
} from '../shared/import-formats.js';
import { ensureWorkspaceScope, requestWorkspaceId } from './workspaces.js';
import { adoptArtifactMemoryObservations } from '../services/artifact-memory.js';

interface ImportedFileResult {
  id: string;
  title: string;
  filename: string;
  kind: string;
  size: number;
  hasText: boolean;
  extraction_status: string;
  processing_state: string;
  warnings: string[];
  original: {
    sha256: string;
    relative_path: string;
  };
  skill?: { name: string; status: string };
}

interface ImportedFileWork {
  result: ImportedFileResult;
  memoryFile: ImportMemoryFile;
}

export async function registerUploadRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  await app.register(multipart, {
    limits: {
      fileSize: MAX_IMPORT_FILE_BYTES,
      files: 50,
    },
  });

  const db = getDb(env);

  app.get('/pod/import/capabilities', {
    schema: { summary: 'List supported import formats and processing limits' },
  }, async () => ({
    formats: IMPORT_FORMATS.map((format) => ({
      ...format,
      can_extract_text: format.extractor !== 'none',
    })),
    processing_modes: ['store', 'extract', 'reflect'],
    limits: {
      max_file_bytes: MAX_IMPORT_FILE_BYTES,
      max_extract_bytes: MAX_EXTRACT_FILE_BYTES,
      max_request_bytes: MAX_IMPORT_REQUEST_BYTES,
    },
  }));

  /**
   * POST /pod/upload
   * Accepts multipart/form-data with one or more files.
   * Optional form fields: actor_id, collection_id, processing_mode
   */
  app.post('/pod/upload', {
    schema: { summary: 'Upload files to Pod' },
  }, async (request, reply) => {
    const parts = request.parts();

    let actorId = 'person-local';
    let collectionId = 'inbox';
    let processingMode: ImportProcessingMode = 'extract';
    let processingModeProvided = false;
    let legacyReflect = false;
    let visibility: MemoryVisibility | undefined;
    let sensitive: boolean | undefined;
    let useLlm: boolean | undefined;
    let totalBytes = 0;
    const files: Array<{ filename: string; buffer: Buffer }> = [];

    for await (const part of parts) {
      if (part.type === 'field') {
        const value = String(part.value);
        if (part.fieldname === 'actor_id') actorId = value;
        else if (part.fieldname === 'collection_id') collectionId = value;
        else if (part.fieldname === 'processing_mode') {
          processingMode = normalizeImportProcessingMode(value);
          processingModeProvided = true;
        }
        else if (part.fieldname === 'reflect') legacyReflect = value !== 'false';
        else if (part.fieldname === 'visibility' && ['private', 'scope', 'workspace', 'public'].includes(value)) visibility = value as MemoryVisibility;
        else if (part.fieldname === 'sensitive') sensitive = value === 'true';
        else if (part.fieldname === 'use_llm') useLlm = value === 'true';
      } else if (part.type === 'file') {
        if (!part.filename) continue;
        if (!isSupported(part.filename)) {
          app.log.warn({ filename: part.filename }, 'skipping unsupported file type');
          continue;
        }
        const buffer = await part.toBuffer();
        totalBytes += buffer.length;
        if (totalBytes > MAX_IMPORT_REQUEST_BYTES) {
          return reply.code(413).send({
            error: 'payload_too_large',
            message: `Upload exceeds the ${Math.round(MAX_IMPORT_REQUEST_BYTES / (1024 * 1024))} MB per-request cap`,
          });
        }
        files.push({ filename: part.filename, buffer });
      }
    }

    if (files.length === 0) {
      return reply.code(400).send({
        error: 'no_files',
        message: `No supported files found. Accepted: ${[...SUPPORTED_EXTENSIONS].join(', ')}`,
      });
    }

    if (!await requireActorAuth(request, reply, env, actorId)) return;
    const workspaceId = requestWorkspaceId(request);
    if (!processingModeProvided && legacyReflect) processingMode = 'reflect';
    const memoryPolicy = resolveObservationDefaults(db, { visibility, sensitive });

    // Create import record
    const imp = createImport(db, {
      workspace_id: workspaceId,
      source: 'upload',
      file_count: files.length,
      destination: collectionId,
    });

    updateImport(db, imp.id, { status: 'importing' });

    const imported: ImportedFileResult[] = [];
    const memoryWork: ImportedFileWork[] = [];
    let errors = 0;

    for (const file of files) {
      try {
        const stored = await storeImportedFile(env.dataDir, file.filename, file.buffer);
        const processed = await processBuffer(file.filename, file.buffer, processingMode);
        const title = titleFromFilename(file.filename);
        const processingState = processingStateForImport(processingMode, processed.extractionStatus);

        const annotations = processed.meta.annotations as Record<string, unknown> | undefined;
        const frontmatter = processed.meta.frontmatter as StructuredFrontmatter | undefined;
        // Detect skill frontmatter early so we can set kind: 'skill' on the object
        const skillMeta = detectSkillFrontmatter(processed);
        const objectKind = skillMeta ? 'skill' : processed.kind;
        const object = upsertObject(db, {
          workspace_id: workspaceId,
          collection_id: collectionId,
          kind: objectKind,
          title,
          content: {
            text: processed.text ?? '',
            filename: processed.filename,
            mime_type: processed.mimeType,
            size: processed.size,
            original_sha256: stored.sha256,
          },
          origin: 'upload',
          created_origin: 'imported',
          last_modified_by: 'user',
          sync_status: 'local',
          processing_state: processingState,
          tags: Array.isArray((annotations as any)?.tags) ? (annotations as any).tags : [],
          summary: typeof (annotations as any)?.summary === 'string' ? (annotations as any).summary : null,
          sensitive: memoryPolicy.sensitive,
          source: {
            app: 'upload',
            external_id: file.filename,
          },
          metadata: {
            mime_type: processed.mimeType,
            size: processed.size,
            has_text: processed.hasText,
            extraction_status: processed.extractionStatus,
            processing_mode: processingMode,
            warnings: processed.warnings,
            original_file: {
              sha256: stored.sha256,
              relative_path: stored.relativePath,
              bytes: stored.bytes,
              filename: file.filename,
            },
            frontmatter,
            ...processed.meta,
          },
          needs_review: processingMode !== 'store' && processed.extractionStatus !== 'searchable',
        });

        // Register as skill if frontmatter was detected
        if (skillMeta) {
          try {
            upsertSkill(db, {
              id: `sk:${object.id}`,
              name: skillMeta.name,
              description: skillMeta.description,
              version: skillMeta.version,
              author: skillMeta.author,
              source: 'local',
              scope: skillMeta.scope,
              status: 'review',
              trust_score: 0,
              trust_level: 'blocked',
              permissions: skillMeta.permissions,
              portability: skillMeta.portability,
              metadata: {
                source_object_id: object.id,
                auto_detected: true,
                frontmatter: processed.meta.frontmatter,
              },
            });
            app.log.info({ skill_name: skillMeta.name, object_id: object.id }, 'auto-registered skill from uploaded markdown');
          } catch (err) {
            app.log.warn({ error: err, object_id: object.id }, 'failed to auto-register skill from frontmatter');
          }
        } else if (isPossibleSkillFrontmatter(frontmatter)) {
          try {
            upsertSkill(db, {
              id: `sk:${object.id}`,
              name: String(frontmatter?.name ?? title),
              description: String(frontmatter?.description ?? ''),
              version: String(frontmatter?.version ?? '0.1.0'),
              author: String(frontmatter?.author ?? 'unknown'),
              source: 'local',
              scope: String(frontmatter?.scope ?? 'personal'),
              status: 'possible',
              trust_score: 0,
              trust_level: 'blocked',
              permissions: [],
              portability: 'local',
              metadata: {
                source_object_id: object.id,
                possible_skill: true,
                frontmatter,
              },
            });
          } catch (err) {
            app.log.warn({ error: err, object_id: object.id }, 'failed to register possible skill from frontmatter');
          }
        }

        const result: ImportedFileResult = {
          id: object.id,
          title,
          filename: file.filename,
          kind: processed.kind,
          size: processed.size,
          hasText: processed.hasText,
          extraction_status: processed.extractionStatus,
          processing_state: processingState,
          warnings: [...processed.warnings],
          original: {
            sha256: stored.sha256,
            relative_path: stored.relativePath,
          },
          skill: skillMeta ? { name: skillMeta.name, status: 'review' } : undefined,
        };
        imported.push(result);
        if (processingMode === 'reflect' && processed.chunks.length > 0) {
          memoryWork.push({
            result,
            memoryFile: {
              objectId: object.id,
              title,
              filename: file.filename,
              sha256: stored.sha256,
              chunks: processed.chunks,
            },
          });
        }
      } catch (error) {
        errors++;
        app.log.error({ error, filename: file.filename }, 'failed to process uploaded file');
      }
    }

    // Update import record
    updateImport(db, imp.id, {
      status: errors === 0 ? 'completed' : errors === files.length ? 'failed' : 'partial',
      errors,
      completed_at: new Date().toISOString(),
    });

    // Log the event
    insertEvent(db, {
      workspace_id: workspaceId,
      type: 'file_upload',
      process: 'import',
      actor_id: actorId,
      scope: 'personal',
      title: `Uploaded ${imported.length} file${imported.length !== 1 ? 's' : ''}`,
      detail: imported.map(f => f.title).join(', '),
      content: { import_id: imp.id, files: imported },
    });

    // Observe the actual extracted chunks. Compilation can then produce claims
    // grounded in page/section source locators instead of import metadata.
    if (processingMode === 'reflect' && memoryWork.length > 0) {
      try {
        const core = await getSmartwareCore(env);
        const workspaceScope = ensureWorkspaceScope(core, env, workspaceId);
        const reflectingObjectIds: string[] = [];

        for (const work of memoryWork) {
          const observed = await observeImportedFileContent(core, {
            actorId,
            scope: workspaceScope,
            visibility: memoryPolicy.visibility,
            sensitive: memoryPolicy.sensitive,
            file: work.memoryFile,
          });
          work.result.warnings.push(...observed.warnings);
          if (observed.observationIds.length > 0) {
            const artifact = getObject(db, work.result.id);
            if (artifact) {
              const adopted = await adoptArtifactMemoryObservations({
                db,
                core,
                object: artifact,
                source_app: 'coffee-pod',
                scope: workspaceScope,
                observations: observed.observations,
              });
              work.result.warnings.push(...adopted.retirement_failures.map(failure =>
                `Previous memory could not be retired: ${failure.message}`));
            }
            reflectingObjectIds.push(work.result.id);
            patchObject(db, work.result.id, {
              processing_state: 'reflecting',
              metadata: {
                memory_observation_ids: observed.observationIds,
                memory_warnings: observed.warnings,
              },
            });
          } else {
            work.result.processing_state = 'searchable';
            work.result.warnings.push('Extracted text was saved, but no memory chunks could be observed.');
            patchObject(db, work.result.id, {
              processing_state: 'searchable',
              needs_review: true,
              metadata: {
                memory_observation_ids: [],
                memory_warnings: observed.warnings,
              },
            });
          }
        }

        if (reflectingObjectIds.length > 0) {
          void core.compile({
            actor: { type: 'agent', id: actorId, display_name: actorId },
            scope: workspaceScope,
            use_llm: resolveReflectionModelUse(db, useLlm),
          }).then(result => {
            const reflectedAt = new Date().toISOString();
            for (const objectId of reflectingObjectIds) {
              patchObject(db, objectId, {
                processing_state: 'ready',
                needs_review: false,
                metadata: { reflected_at: reflectedAt },
              });
            }
            for (const entry of result.audit) {
              insertEvent(db, {
                workspace_id: workspaceId,
                type: 'entity_compiled',
                process: 'reflect',
                actor_id: actorId,
                scope: 'personal',
                title: entry.entity_name,
                detail: `Extracted from upload · ${entry.claims_used} claim${entry.claims_used !== 1 ? 's' : ''}`,
                content: { entity_id: entry.entity_id, claims_used: entry.claims_used, source: 'upload' },
              });
            }
          }).catch(error => {
            for (const objectId of reflectingObjectIds) {
              patchObject(db, objectId, {
                processing_state: 'searchable',
                needs_review: true,
                metadata: { reflection_error: error instanceof Error ? error.message : String(error) },
              });
            }
            app.log.warn({ error }, 'background extraction failed after upload');
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        for (const work of memoryWork) {
          work.result.processing_state = 'searchable';
          work.result.warnings.push(`Memory reflection could not start: ${message}`);
          patchObject(db, work.result.id, {
            processing_state: 'searchable',
            needs_review: true,
            metadata: { reflection_error: message },
          });
        }
        app.log.warn({ error }, 'smartware unavailable for upload observation');
      }
    }

    return {
      import_id: imp.id,
      processing_mode: processingMode,
      imported,
      errors,
      failed: errors + imported.filter((file) => file.extraction_status === 'failed').length,
      total: files.length,
    };
  });
}
