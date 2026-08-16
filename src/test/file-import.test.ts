import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import JSZip from 'jszip';

import { buildApp } from '../app.js';
import type { CoffeePodEnv } from '../config/env.js';
import {
  isSupported,
  processBuffer,
} from '../services/file-processor.js';
import { closeSmartwareCore, getPodProfile, getSmartwareCore } from '../smartware/core.js';
import {
  MAX_EXTRACT_FILE_BYTES,
  SUPPORTED_IMPORT_EXTENSIONS,
} from '../shared/import-formats.js';

function testEnv(dataDir: string): CoffeePodEnv {
  return {
    host: '127.0.0.1',
    port: 0,
    dataDir,
    ownerId: undefined,
    podId: 'file-import-test',
    podName: 'File Import Test Pod',
    apiToken: undefined,
    mcpClientEnabled: false,
    mcpDockerCommand: 'docker',
    mcpPortBase: 5100,
  };
}

function multipartPayload(
  fields: Record<string, string>,
  files: Array<{ filename: string; mimeType: string; buffer: Buffer }>,
): { payload: Buffer; headers: Record<string, string> } {
  const boundary = `coffee-pod-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const chunks: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    chunks.push(Buffer.from(
      `--${boundary}\r\n`
      + `Content-Disposition: form-data; name="${name}"\r\n\r\n`
      + `${value}\r\n`,
    ));
  }
  for (const file of files) {
    chunks.push(Buffer.from(
      `--${boundary}\r\n`
      + `Content-Disposition: form-data; name="files"; filename="${file.filename}"\r\n`
      + `Content-Type: ${file.mimeType}\r\n\r\n`,
    ));
    chunks.push(file.buffer);
    chunks.push(Buffer.from('\r\n'));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return {
    payload: Buffer.concat(chunks),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

function pdfFixture(pageTexts: Array<string | null>): Buffer {
  const objects: string[] = [];
  const pageObjectIds = pageTexts.map((_text, index) => 3 + index);
  const fontObjectId = 3 + pageTexts.length;
  const firstContentObjectId = fontObjectId + 1;

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageTexts.length} >>`);
  for (let index = 0; index < pageTexts.length; index += 1) {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] `
      + `/Resources << /Font << /F1 ${fontObjectId} 0 R >> >> `
      + `/Contents ${firstContentObjectId + index} 0 R >>`,
    );
  }
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  for (const text of pageTexts) {
    const stream = text
      ? `BT /F1 12 Tf 72 720 Td (${text.replace(/[()\\]/g, '\\$&')}) Tj ET`
      : 'q Q';
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  }

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf);
}

async function docxFixture(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);
  zip.folder('_rels')!.file('.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.folder('word')!.file('document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Project Aurora</w:t></w:r></w:p>
    <w:p><w:r><w:t>The launch deadline is 2032-04-05.</w:t></w:r></w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Owner</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>Stevie</w:t></w:r></w:p></w:tc>
      </w:tr>
    </w:tbl>
    <w:sectPr/>
  </w:body>
</w:document>`);
  zip.folder('word')!.file('styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
  </w:style>
</w:styles>`);
  zip.folder('word')!.folder('_rels')!.file('document.xml.rels', `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

test('shared import capabilities cover text, PDF, DOCX, and honest legacy DOC storage', async () => {
  assert.ok(SUPPORTED_IMPORT_EXTENSIONS.includes('.tsv'));
  assert.ok(SUPPORTED_IMPORT_EXTENSIONS.includes('.docx'));
  assert.equal(isSupported('notes.markdown'), true);

  const stored = await processBuffer('notes.txt', Buffer.from('searchable text'), 'store');
  assert.equal(stored.extractionStatus, 'stored');
  assert.equal(stored.hasText, false);
  assert.equal(stored.chunks.length, 0);

  const legacyDoc = await processBuffer('legacy.doc', Buffer.from('binary-placeholder'), 'extract');
  assert.equal(legacyDoc.extractionStatus, 'metadata_only');
  assert.equal(legacyDoc.hasText, false);
  assert.match(legacyDoc.warnings[0] ?? '', /Legacy \.doc/);

  const oversized = await processBuffer(
    'large.txt',
    Buffer.alloc(MAX_EXTRACT_FILE_BYTES + 1, 65),
    'extract',
  );
  assert.equal(oversized.extractionStatus, 'metadata_only');
  assert.match(oversized.warnings[0] ?? '', /extraction limit/);
});

test('DOCX extraction preserves headings and produces section-located chunks', async () => {
  const processed = await processBuffer('aurora.docx', await docxFixture(), 'extract');
  assert.equal(processed.extractionStatus, 'searchable');
  assert.match(processed.text ?? '', /Project Aurora/);
  assert.match(processed.text ?? '', /launch deadline is 2032-04-05/);
  assert.ok(processed.chunks.some((chunk) => chunk.locator.section === 'Project Aurora'));
});

test('PDF extraction preserves page locators and detects image-only documents', async () => {
  const searchable = await processBuffer(
    'two-pages.pdf',
    pdfFixture(['First page evidence', 'Second page evidence']),
    'extract',
  );
  assert.equal(searchable.extractionStatus, 'searchable');
  assert.deepEqual(searchable.chunks.map((chunk) => chunk.locator.page), [1, 2]);
  assert.match(searchable.chunks[1]?.text ?? '', /Second page evidence/);

  const scanned = await processBuffer('scan.pdf', pdfFixture([null]), 'extract');
  assert.equal(scanned.extractionStatus, 'needs_ocr');
  assert.equal(scanned.meta.scan_detected, true);
  assert.match(scanned.warnings[0] ?? '', /needs OCR/);
});

test('upload retains the original, reports real modes, and observes extracted content with locators', async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), 'coffee-pod-file-import-'));
  const env = testEnv(dataDir);
  const app = await buildApp(env, false);

  try {
    const capabilities = await app.inject({ method: 'GET', url: '/pod/import/capabilities' });
    assert.equal(capabilities.statusCode, 200);
    assert.ok(capabilities.json().formats.some((format: { extension: string }) => format.extension === '.docx'));

    const storedUpload = multipartPayload(
      {
        actor_id: 'person-local',
        collection_id: 'inbox',
        processing_mode: 'store',
      },
      [{ filename: 'source.txt', mimeType: 'text/plain', buffer: Buffer.from('Original retained bytes') }],
    );
    const storedResponse = await app.inject({
      method: 'POST',
      url: '/pod/upload',
      headers: storedUpload.headers,
      payload: storedUpload.payload,
    });
    assert.equal(storedResponse.statusCode, 200);
    const storedFile = storedResponse.json().imported[0];
    assert.equal(storedFile.processing_state, 'stored');
    assert.equal(storedFile.hasText, false);
    const retainedPath = path.join(dataDir, storedFile.original.relative_path);
    assert.equal((await readFile(retainedPath)).toString(), 'Original retained bytes');
    assert.equal((await stat(retainedPath)).mode & 0o777, 0o600);

    const reflectedUpload = multipartPayload(
      {
        actor_id: 'person-local',
        collection_id: 'inbox',
        processing_mode: 'reflect',
        use_llm: 'false',
      },
      [{
        filename: 'aurora.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: await docxFixture(),
      }],
    );
    const reflectedResponse = await app.inject({
      method: 'POST',
      url: '/pod/upload',
      headers: reflectedUpload.headers,
      payload: reflectedUpload.payload,
    });
    assert.equal(reflectedResponse.statusCode, 200);
    const reflectedFile = reflectedResponse.json().imported[0];
    assert.equal(reflectedFile.extraction_status, 'searchable');
    assert.equal(reflectedFile.processing_state, 'reflecting');

    const core = await getSmartwareCore(env);
    const profile = getPodProfile(core, env);
    const observations = core.searchObservations('aurora deadline', profile.scopes.workspace);
    assert.ok(observations.length > 0);
    const evidence = core.readObservationEvidence({
      actor: { type: 'person', id: 'person-local', display_name: 'person-local' },
      observation_id: observations[0]!.id,
    });
    assert.ok(evidence);
    const content = evidence!.content as {
      body: string;
      locator: { kind: string; section?: string };
      sha256: string;
    };
    assert.match(content.body, /launch deadline is 2032-04-05/);
    assert.equal(content.locator.kind, 'section');
    assert.equal(content.locator.section, 'Project Aurora');
    assert.match(content.sha256, /^[a-f0-9]{64}$/);
  } finally {
    await app.close();
    await closeSmartwareCore();
  }
});
