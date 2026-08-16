import { createHash } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { importExtension } from '../shared/import-formats.js';

export interface StoredImportedFile {
  sha256: string;
  relativePath: string;
  bytes: number;
}

export async function storeImportedFile(
  dataDir: string,
  filename: string,
  buffer: Buffer,
): Promise<StoredImportedFile> {
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const extension = importExtension(filename);
  const relativePath = path.join('files', 'imports', sha256.slice(0, 2), `${sha256}${extension}`);
  const absolutePath = path.join(dataDir, relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true, mode: 0o700 });
  try {
    await writeFile(absolutePath, buffer, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const existingStat = await lstat(absolutePath);
    if (!existingStat.isFile()) {
      throw new Error('Import storage path exists but is not a regular file');
    }
    const existingHash = createHash('sha256').update(await readFile(absolutePath)).digest('hex');
    if (existingHash !== sha256) {
      throw new Error('Import storage hash mismatch');
    }
    await chmod(absolutePath, 0o600);
  }

  return {
    sha256,
    relativePath,
    bytes: buffer.length,
  };
}
