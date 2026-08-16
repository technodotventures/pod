/**
 * Local folder / Obsidian vault import endpoint.
 * Accepts a directory path, walks it recursively, and imports all supported files.
 * In Electron, the folder path comes from the native folder picker dialog.
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import type { FastifyInstance } from 'fastify';

import type { CoffeePodEnv } from '../config/env.js';
import { captureSkillRevision, getDb, getObject, upsertObject, upsertSkill, upsertCollection, createImport, updateImport, insertEvent, patchObject } from '../pod/db.js';
import {
  processBuffer,
  walkDirectory,
  titleFromFilename,
  detectSkillFrontmatter,
  isPossibleSkillFrontmatter,
  type StructuredFrontmatter,
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
  MAX_IMPORT_FILE_BYTES,
  normalizeImportProcessingMode,
  type ImportProcessingMode,
} from '../shared/import-formats.js';
import { ensureWorkspaceScope, requestWorkspaceId } from './workspaces.js';
import { adoptArtifactMemoryObservations } from '../services/artifact-memory.js';

interface FolderImportedFileResult {
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
  relativePath?: string;
  skill?: { name: string; status: string };
}

interface FolderImportedFileWork {
  result: FolderImportedFileResult;
  memoryFile: ImportMemoryFile;
}

/** Detect if a folder is an Obsidian vault */
async function isObsidianVault(dirPath: string): Promise<boolean> {
  try {
    await fs.access(path.join(dirPath, '.obsidian'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Refuse to walk into directories that almost certainly hold credentials or
 * OS-managed state. The intent is to stop a coerced import from quietly
 * scooping up the user's keychain backups, SSH keys, browser profile,
 * cloud-CLI credentials, etc. Importing from anywhere else under the user's
 * home — Documents, Notes, custom Obsidian vault locations — still works.
 *
 * /var and /private are deliberately not blocked wholesale because macOS
 * resolves the OS temp directory inside them. We block the specific sensitive
 * children instead.
 */
function isForbiddenImportRoot(resolved: string): { ok: false; reason: string } | { ok: true } {
  const home = os.homedir();
  const normalised = path.normalize(resolved);
  const denied = [
    path.join(home, 'Library'),
    path.join(home, '.ssh'),
    path.join(home, '.aws'),
    path.join(home, '.gnupg'),
    path.join(home, '.config'),
    path.join(home, '.docker'),
    path.join(home, '.kube'),
    '/etc',
    '/private/etc',
    '/var/db',
    '/private/var/db',
    '/System',
    '/usr',
  ];
  for (const root of denied) {
    if (normalised === root || normalised.startsWith(`${root}${path.sep}`)) {
      return { ok: false, reason: `refusing to import from ${root}` };
    }
  }
  return { ok: true };
}

export async function registerFolderImportRoutes(app: FastifyInstance, env: CoffeePodEnv): Promise<void> {
  const db = getDb(env);

  /**
   * POST /pod/import/folder
   * Body: { actor_id, path, collection_id?, preserve_structure?, processing_mode? }
   *
   * Walks the folder recursively, imports all supported files.
   * For Obsidian vaults, auto-detects and labels the collection accordingly.
   */
  app.post('/pod/import/folder', {
    schema: {
      summary: 'Import files from a local folder or Obsidian vault',
      body: {
        type: 'object',
        properties: {
          actor_id: { type: 'string' },
          path: { type: 'string', description: 'Absolute path to the folder to import' },
          collection_id: { type: 'string', description: 'Target collection (auto-created if needed)' },
          preserve_structure: { type: 'boolean', description: 'Store relative paths in metadata' },
          processing_mode: { type: 'string', enum: ['store', 'extract', 'reflect'] },
          reflect: { type: 'boolean', description: 'Run Smartware extraction after import' },
          visibility: { type: 'string', enum: ['private', 'scope', 'workspace', 'public'] },
          sensitive: { type: 'boolean' },
          use_llm: { type: 'boolean' },
        },
        required: ['actor_id', 'path'],
      },
    },
  }, async (request, reply) => {
    const body = request.body as {
      actor_id: string;
      path: string;
      collection_id?: string;
      preserve_structure?: boolean;
      processing_mode?: ImportProcessingMode;
      reflect?: boolean;
      visibility?: MemoryVisibility;
      sensitive?: boolean;
      use_llm?: boolean;
    };

    if (!await requireActorAuth(request, reply, env, body.actor_id)) return;
    const workspaceId = requestWorkspaceId(request);
    const processingMode = normalizeImportProcessingMode(body.processing_mode, body.reflect === true);
    const memoryPolicy = resolveObservationDefaults(db, {
      visibility: body.visibility,
      sensitive: body.sensitive,
    });

    // Validate the directory exists and is allowed.
    if (typeof body.path !== 'string' || !path.isAbsolute(body.path)) {
      return reply.code(400).send({ error: 'invalid_path', message: 'An absolute folder path is required' });
    }
    let dirPath: string;
    try {
      // realpath resolves any symlinks in the supplied path so that
      // attackers cannot point at a symlink under their control that
      // dereferences into a forbidden directory.
      dirPath = await fs.realpath(body.path);
      const stat = await fs.stat(dirPath);
      if (!stat.isDirectory()) {
        return reply.code(400).send({ error: 'not_directory', message: 'The provided path is not a directory' });
      }
    } catch {
      return reply.code(400).send({ error: 'not_found', message: 'Directory not found' });
    }
    const policy = isForbiddenImportRoot(dirPath);
    if (!policy.ok) {
      return reply.code(403).send({ error: 'forbidden_path', message: policy.reason });
    }

    const isVault = await isObsidianVault(dirPath);
    const folderName = path.basename(dirPath);
    const sourceApp = isVault ? 'obsidian' : 'local-folder';
    const preserveStructure = body.preserve_structure !== false; // default true

    // Create or use target collection
    const baseCollectionId = isVault ? `obsidian-${folderName.toLowerCase().replace(/\s+/g, '-')}` : 'inbox';
    const collectionId = body.collection_id
      ?? (workspaceId === 'default' || baseCollectionId === 'inbox' ? baseCollectionId : `${workspaceId}:${baseCollectionId}`);
    upsertCollection(db, {
      workspace_id: workspaceId,
      id: collectionId,
      name: isVault ? `Obsidian: ${folderName}` : folderName,
      description: isVault
        ? `Imported from Obsidian vault at ${dirPath}`
        : `Imported from folder at ${dirPath}`,
      metadata: { app: sourceApp, path: dirPath, is_vault: isVault },
    });

    // Count files first for the import record
    const filePaths: string[] = [];
    for await (const filePath of walkDirectory(dirPath)) {
      filePaths.push(filePath);
    }

    if (filePaths.length === 0) {
      return reply.code(400).send({
        error: 'no_files',
        message: 'No supported files found in the directory',
      });
    }

    // Create import record
    const imp = createImport(db, {
      workspace_id: workspaceId,
      source: sourceApp,
      file_count: filePaths.length,
      destination: collectionId,
    });

    updateImport(db, imp.id, { status: 'importing' });

    const imported: FolderImportedFileResult[] = [];
    const memoryWork: FolderImportedFileWork[] = [];
    let errors = 0;

    for (const filePath of filePaths) {
      try {
        const stat = await fs.stat(filePath);
        if (stat.size > MAX_IMPORT_FILE_BYTES) {
          throw new Error(`File exceeds the ${MAX_IMPORT_FILE_BYTES / (1024 * 1024)} MB import limit`);
        }
        const buffer = await fs.readFile(filePath);
        const processed = await processBuffer(path.basename(filePath), buffer, processingMode);
        const stored = await storeImportedFile(env.dataDir, path.basename(filePath), buffer);
        const relativePath = path.relative(dirPath, filePath);
        const title = titleFromFilename(processed.filename);
        const processingState = processingStateForImport(processingMode, processed.extractionStatus);

        // Use relative path as stable ID to support re-imports
        const objectId = workspaceId === 'default'
          ? `${sourceApp}:${relativePath}`
          : `${workspaceId}:${sourceApp}:${relativePath}`;

        const metadata: Record<string, unknown> = {
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
            filename: processed.filename,
          },
          ...processed.meta,
        };

        if (preserveStructure) {
          metadata.relative_path = relativePath;
          metadata.folder = path.dirname(relativePath);
        }

        const annotations = processed.meta.annotations as Record<string, unknown> | undefined;
        const frontmatter = processed.meta.frontmatter as StructuredFrontmatter | undefined;
        // Detect skill frontmatter early so we can set kind: 'skill' on the object
        const skillMeta = detectSkillFrontmatter(processed);
        const objectKind = skillMeta ? 'skill' : processed.kind;
        const object = upsertObject(db, {
          id: objectId,
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
          origin: sourceApp,
          created_origin: isVault ? 'synced' : 'imported',
          last_modified_by: isVault ? 'sync' : 'user',
          sync_status: isVault ? 'synced' : 'local',
          processing_state: processingState,
          tags: Array.isArray((annotations as any)?.tags) ? (annotations as any).tags : [],
          summary: typeof (annotations as any)?.summary === 'string' ? (annotations as any).summary : null,
          sensitive: memoryPolicy.sensitive,
          source: {
            app: sourceApp,
            external_id: relativePath,
            url: `file://${filePath}`,
          },
          metadata,
          needs_review: processingMode !== 'store' && processed.extractionStatus !== 'searchable',
        });

        // Register as skill if frontmatter was detected
        if (skillMeta) {
          try {
            const registeredSkill = upsertSkill(db, {
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
                imported_from: filePath,
                frontmatter: processed.meta.frontmatter,
              },
            });
            captureSkillRevision(db, {
              skill_id: registeredSkill.id,
              version: skillMeta.version,
              content: processed.text ?? null,
              origin: 'local',
              source_ref: filePath,
              created_by: body.actor_id,
              summary: skillMeta.description,
              status: 'draft',
              metadata: { source_object_id: object.id, imported_from: filePath },
            });
            app.log.info({ skill_name: skillMeta.name, object_id: object.id }, 'auto-registered skill from imported markdown');
          } catch (err) {
            app.log.warn({ error: err, object_id: object.id }, 'failed to auto-register skill');
          }
        } else if (isPossibleSkillFrontmatter(frontmatter)) {
          try {
            const possibleSkill = upsertSkill(db, {
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
                imported_from: filePath,
                frontmatter,
              },
            });
            captureSkillRevision(db, {
              skill_id: possibleSkill.id,
              version: String(frontmatter?.version ?? '0.1.0'),
              content: processed.text ?? null,
              origin: 'local',
              source_ref: filePath,
              created_by: body.actor_id,
              summary: String(frontmatter?.description ?? ''),
              status: 'draft',
              metadata: { source_object_id: object.id, possible_skill: true, imported_from: filePath },
            });
          } catch (err) {
            app.log.warn({ error: err, object_id: object.id }, 'failed to register possible skill');
          }
        }

        const result: FolderImportedFileResult = {
          id: object.id,
          title,
          filename: processed.filename,
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
          relativePath: preserveStructure ? relativePath : undefined,
          skill: skillMeta ? { name: skillMeta.name, status: 'review' } : undefined,
        };
        imported.push(result);
        if (processingMode === 'reflect' && processed.chunks.length > 0) {
          memoryWork.push({
            result,
            memoryFile: {
              objectId: object.id,
              title,
              filename: processed.filename,
              sha256: stored.sha256,
              chunks: processed.chunks,
            },
          });
        }
      } catch (error) {
        errors++;
        app.log.error({ error, filePath }, 'failed to process file during folder import');
      }
    }

    // Update import record
    updateImport(db, imp.id, {
      status: errors === 0 ? 'completed' : errors === filePaths.length ? 'failed' : 'partial',
      errors,
      completed_at: new Date().toISOString(),
    });

    // Log the event
    insertEvent(db, {
      workspace_id: workspaceId,
      type: 'folder_import',
      process: 'import',
      actor_id: body.actor_id,
      scope: 'personal',
      title: `Imported ${imported.length} files from ${isVault ? 'Obsidian vault' : 'folder'} "${folderName}"`,
      detail: `${imported.length} files imported, ${errors} errors`,
      content: { import_id: imp.id, source: sourceApp, folder: dirPath, is_vault: isVault },
    });

    if (processingMode === 'reflect' && memoryWork.length > 0) {
      try {
        const core = await getSmartwareCore(env);
        const workspaceScope = ensureWorkspaceScope(core, env, workspaceId);
        const reflectingObjectIds: string[] = [];

        for (const work of memoryWork) {
          const observed = await observeImportedFileContent(core, {
            actorId: body.actor_id,
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
            actor: { type: 'agent', id: body.actor_id, display_name: body.actor_id },
            scope: workspaceScope,
            use_llm: resolveReflectionModelUse(db, body.use_llm),
          }).then(() => {
            const reflectedAt = new Date().toISOString();
            for (const objectId of reflectingObjectIds) {
              patchObject(db, objectId, {
                processing_state: 'ready',
                needs_review: false,
                metadata: { reflected_at: reflectedAt },
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
            app.log.warn({ error }, 'background extraction failed after folder import');
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
        app.log.warn({ error }, 'smartware unavailable for folder import observation');
      }
    }

    return {
      import_id: imp.id,
      source: sourceApp,
      folder: folderName,
      is_vault: isVault,
      collection_id: collectionId,
      processing_mode: processingMode,
      imported,
      errors,
      failed: errors + imported.filter((file) => file.extraction_status === 'failed').length,
      total: filePaths.length,
    };
  });
}
