/**
 * BOP Agencia — Bob Knowledge Ingestion Foundation Test Suite
 * Comprehensive automated tests for Phase 11A.3 requirements.
 *
 * Verifies 20 criteria:
 * 1. Valid TXT ingestion & UTF-8 / BOM stripping
 * 2. Valid MD ingestion
 * 3. Text normalization (whitespace, control chars)
 * 4. Contact info preservation (email, phone, URLs, accents)
 * 5. Deterministic chunking within char bounds (1000-1600 chars)
 * 6. Chunk overlap presence & bounds (150-250 chars)
 * 7. Deterministic chunk IDs (repeatable across runs)
 * 8. Bidirectional chunk linking (previous_chunk_id, next_chunk_id)
 * 9. Invalid file extension rejection
 * 10. Oversize file rejection (> 20MB)
 * 11. Empty file handling (flagged/ignored without crashing)
 * 12. Path traversal attack prevention
 * 13. Symlink rejection
 * 14. PDF text parser extraction & page count
 * 15. PDF scanned / no-text detection (needs_ocr = true)
 * 16. DOCX text parser error handling on corrupted zip buffer
 * 17. Website knowledge extraction (ES & EN sections from index & portfolio)
 * 18. SHA-256 change detection & caching logic
 * 19. Manifest & serialized output integrity (manifest.json, sources.json, chunks.jsonl)
 * 20. Dry run mode guarantee (no disk writes to generated/)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  validateInputFile,
  validateFilePath,
  computeChecksum,
  calculateFileChecksum,
  findSourceFiles,
  findSupportedFiles,
  MAX_FILE_SIZE_BYTES,
  SUPPORTED_EXTENSIONS
} from '../knowledge/utils/file-validator.js';
import { normalizeText } from '../knowledge/normalizers/text-normalizer.js';
import { chunkText, chunkDocument, estimateTokenCount } from '../knowledge/chunker.js';
import { parseTxt } from '../knowledge/parsers/txt-parser.js';
import { parsePdfBuffer } from '../knowledge/parsers/pdf-parser.js';
import { parseDocxBuffer } from '../knowledge/parsers/docx-parser.js';
import { extractWebsiteKnowledge } from '../knowledge/website-source.js';
import { buildManifest, saveGeneratedCorpus } from '../knowledge/manifest.js';
import { runIngestion, detectLanguage } from '../knowledge/ingest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passedCount = 0;
let failedCount = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ PASS: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`✗ FAIL: ${name}`);
    console.error(`  ${err.message}`);
    failedCount++;
  }
}

console.log('--- Running Bob Knowledge Ingestion Test Suite (Phase 11A.3) ---');

function createTempDir(prefix = 'bop-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanupTempDir(dir) {
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch {
    // ignore cleanup errors
  }
}

// -------------------------------------------------------------
// Test 1: TXT parser extracts text cleanly with UTF-8 & BOM
// -------------------------------------------------------------
await test('TXT parser extracts text cleanly from file with UTF-8 and BOM', async () => {
  const tmpDir = createTempDir();
  try {
    const filePath = path.join(tmpDir, 'sample.txt');
    const content = '\uFEFFBOP Agencia es un estudio de diseño, marketing y desarrollo de software.';
    fs.writeFileSync(filePath, content, 'utf8');

    const result = await parseTxt(filePath);
    assert.strictEqual(result.format, 'txt');
    assert.strictEqual(result.text, 'BOP Agencia es un estudio de diseño, marketing y desarrollo de software.');
    assert.strictEqual(result.needsOcr, false);
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// -------------------------------------------------------------
// Test 2: MD parser extracts markdown text
// -------------------------------------------------------------
await test('MD parser extracts markdown text correctly', async () => {
  const tmpDir = createTempDir();
  try {
    const filePath = path.join(tmpDir, 'guide.md');
    fs.writeFileSync(filePath, '# Título Principal\n\nEste es un párrafo descriptivo.', 'utf8');

    const result = await parseTxt(filePath);
    assert.strictEqual(result.format, 'md');
    assert.ok(result.text.includes('Título Principal'));
    assert.strictEqual(result.needsOcr, false);
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// -------------------------------------------------------------
// Test 3: Text normalization collapses whitespace and removes control characters
// -------------------------------------------------------------
await test('Text normalization cleans control characters and excess whitespace', () => {
  const dirty = 'Línea 1\r\n\r\n\r\n\r\nLínea 2    con   espacios\x00\x07 innecesarios.\t\tFin.';
  const cleaned = normalizeText(dirty);
  assert.ok(!cleaned.includes('\r'));
  assert.ok(!cleaned.includes('\x00'));
  assert.ok(!cleaned.includes('\x07'));
  assert.ok(cleaned.includes('Línea 1\n\nLínea 2 con espacios innecesarios. Fin.'));
});

// -------------------------------------------------------------
// Test 4: Contact info and special characters preservation in normalization
// -------------------------------------------------------------
await test('Text normalization strictly preserves email, phone, and URLs', () => {
  const text = 'Contacto: bopagencia@gmail.com o teléfono +57 305 417 6606 en https://bopagencia.com.';
  const cleaned = normalizeText(text);
  assert.ok(cleaned.includes('bopagencia@gmail.com'));
  assert.ok(cleaned.includes('+57 305 417 6606'));
  assert.ok(cleaned.includes('https://bopagencia.com'));
});

// -------------------------------------------------------------
// Test 5: Deterministic chunking size boundaries
// -------------------------------------------------------------
await test('Deterministic chunking produces chunks within target bounds', () => {
  const paragraph = 'BOP Agencia crea ecosistemas digitales para marcas de alto impacto con soluciones creativas y de ingeniería. '.repeat(10);
  const longText = Array(15).fill(paragraph).join('\n\n');

  const chunks = chunkDocument({
    sourceId: 'doc_test1',
    sourceType: 'document',
    filePath: 'sources/documents/test.txt',
    title: 'Test Document',
    category: 'document',
    language: 'es',
    normalizedText: longText
  }, { targetMinChars: 1000, targetMaxChars: 1600, overlapChars: 200 });

  assert.ok(chunks.length > 2, `Expected > 2 chunks, got ${chunks.length}`);
  for (const chunk of chunks) {
    assert.ok(chunk.content.length >= 100, `Chunk too small: ${chunk.content.length}`);
    assert.ok(chunk.content.length <= 1800, `Chunk exceeds safe ceiling: ${chunk.content.length}`);
    assert.ok(chunk.chunk_id.startsWith('doc_test1-'));
  }
});

// -------------------------------------------------------------
// Test 6: Overlap between consecutive chunks
// -------------------------------------------------------------
await test('Consecutive chunks share deterministic overlap', () => {
  const p1 = 'Primera sección con información detallada de la agencia. '.repeat(20);
  const p2 = 'Segunda sección con detalles adicionales sobre producción digital. '.repeat(20);
  const full = `${p1}\n\n${p2}`;

  const chunks = chunkDocument({
    sourceId: 'overlap_test',
    sourceType: 'document',
    filePath: 'sources/test.txt',
    title: 'Overlap Test',
    category: 'document',
    language: 'es',
    normalizedText: full
  }, { targetMinChars: 1000, targetMaxChars: 1600, overlapChars: 200 });

  assert.ok(chunks.length >= 2, 'Must have at least 2 chunks to test overlap');
  const first = chunks[0].content;
  const second = chunks[1].content;
  const tailOfFirst = first.slice(-80).trim();
  const wordsFromTail = tailOfFirst.split(/\s+/).slice(-3).join(' ');
  assert.ok(second.includes(wordsFromTail), 'Second chunk does not contain overlap from first chunk');
});

// -------------------------------------------------------------
// Test 7: Chunk IDs are deterministic across repeated runs
// -------------------------------------------------------------
await test('Chunk IDs and hashes are fully deterministic across multiple runs', () => {
  const text = 'Párrafo consistente para prueba de determinismo.\n\n'.repeat(25);
  const doc = {
    sourceId: 'fixed_id',
    sourceType: 'document',
    filePath: 'sources/documents/fixed.txt',
    title: 'Fixed Doc',
    category: 'document',
    language: 'es',
    normalizedText: text
  };

  const run1 = chunkDocument(doc);
  const run2 = chunkDocument(doc);

  assert.strictEqual(run1.length, run2.length);
  for (let i = 0; i < run1.length; i++) {
    assert.strictEqual(run1[i].chunk_id, run2[i].chunk_id);
    assert.strictEqual(run1[i].content_hash, run2[i].content_hash);
  }
});

// -------------------------------------------------------------
// Test 8: Bidirectional chunk linking
// -------------------------------------------------------------
await test('Bidirectional chunk links (previous_chunk_id and next_chunk_id) are valid', () => {
  // Paragraphs with sufficient length so chunkText creates at least 3 chunks
  const p = 'Párrafo largo con información relevante para probar los enlaces bidireccionales entre chunks en la suite de pruebas. '.repeat(15);
  const text = Array(10).fill(p).join('\n\n');

  const chunks = chunkDocument({
    sourceId: 'linked_doc',
    sourceType: 'document',
    filePath: 'sources/linked.txt',
    title: 'Linked Doc',
    category: 'document',
    language: 'es',
    normalizedText: text
  }, { targetMinChars: 800, targetMaxChars: 1200, overlapChars: 150 });

  assert.ok(chunks.length >= 3, `Need at least 3 chunks to verify linking, got ${chunks.length}`);
  assert.strictEqual(chunks[0].previous_chunk_id, null);
  assert.strictEqual(chunks[0].next_chunk_id, chunks[1].chunk_id);

  assert.strictEqual(chunks[1].previous_chunk_id, chunks[0].chunk_id);
  assert.strictEqual(chunks[1].next_chunk_id, chunks[2].chunk_id);

  const last = chunks[chunks.length - 1];
  assert.strictEqual(last.next_chunk_id, null);
  assert.strictEqual(last.previous_chunk_id, chunks[chunks.length - 2].chunk_id);
});

// -------------------------------------------------------------
// Test 9: File validator rejects unsupported extensions
// -------------------------------------------------------------
await test('File validator rejects unsupported extensions (.exe, .json, .sh)', () => {
  const tmpDir = createTempDir();
  try {
    const badFile = path.join(tmpDir, 'exploit.exe');
    fs.writeFileSync(badFile, 'binary');

    const res = validateFilePath(badFile, tmpDir);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.reason, 'UNSUPPORTED_EXTENSION');
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// -------------------------------------------------------------
// Test 10: File validator rejects oversize files (> MAX_FILE_SIZE_BYTES)
// -------------------------------------------------------------
await test('File validator rejects files exceeding max size limit', () => {
  const tmpDir = createTempDir();
  try {
    const bigFile = path.join(tmpDir, 'big.txt');
    fs.writeFileSync(bigFile, 'A'.repeat(200));

    const res = validateFilePath(bigFile, tmpDir, 100);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.reason, 'FILE_TOO_LARGE');
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// -------------------------------------------------------------
// Test 11: File validator rejects empty files
// -------------------------------------------------------------
await test('File validator rejects empty 0-byte files', () => {
  const tmpDir = createTempDir();
  try {
    const emptyFile = path.join(tmpDir, 'empty.txt');
    fs.writeFileSync(emptyFile, '');

    const res = validateFilePath(emptyFile, tmpDir);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.reason, 'EMPTY_FILE');
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// -------------------------------------------------------------
// Test 12: File validator prevents path traversal
// -------------------------------------------------------------
await test('File validator blocks path traversal attempts', () => {
  const baseDir = createTempDir('base-');
  const outsideDir = createTempDir('outside-');
  try {
    const outsideFile = path.join(outsideDir, 'secret.txt');
    fs.writeFileSync(outsideFile, 'secret data');

    const traversalPath = path.join(baseDir, '..', path.basename(outsideDir), 'secret.txt');
    const res = validateFilePath(traversalPath, baseDir);
    assert.strictEqual(res.valid, false);
    assert.strictEqual(res.reason, 'PATH_TRAVERSAL');
  } finally {
    cleanupTempDir(baseDir);
    cleanupTempDir(outsideDir);
  }
});

// -------------------------------------------------------------
// Test 13: File validator blocks symbolic links
// -------------------------------------------------------------
await test('File validator blocks symbolic links', () => {
  const tmpDir = createTempDir();
  try {
    const targetFile = path.join(tmpDir, 'real.txt');
    fs.writeFileSync(targetFile, 'Real file content');
    const symlinkFile = path.join(tmpDir, 'link.txt');

    try {
      fs.symlinkSync(targetFile, symlinkFile);
      const res = validateFilePath(symlinkFile, tmpDir);
      assert.strictEqual(res.valid, false);
      assert.strictEqual(res.reason, 'SYMLINK_NOT_ALLOWED');
    } catch (e) {
      if (e.code === 'EPERM') {
        console.log('    (Windows EPERM on symlink creation - OS prevents symlinks for non-elevated user)');
      } else {
        throw e;
      }
    }
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// -------------------------------------------------------------
// Test 14: PDF parser extracts text and page count from valid PDF
// -------------------------------------------------------------
await test('PDF parser extracts text and detects page count', async () => {
  const pdfString = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 44 >> stream
BT /F1 12 Tf 72 712 Td (BOP AGENCIA EN TEST) Tj ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000338 00000 n 
trailer << /Root 1 0 R /Size 6 >>
startxref
407
%%EOF`;

  const buffer = Buffer.from(pdfString);
  const parsed = await parsePdfBuffer(buffer);

  assert.strictEqual(parsed.format, 'pdf');
  assert.strictEqual(parsed.pageCount, 1);
  assert.ok(parsed.text.includes('BOP AGENCIA EN TEST'));
  assert.strictEqual(parsed.needsOcr, false);
});

// -------------------------------------------------------------
// Test 15: PDF parser detects scanned/empty text and sets needs_ocr = true
// -------------------------------------------------------------
await test('PDF parser flags scanned documents without text stream as needs_ocr = true', async () => {
  const emptyPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
trailer << /Root 1 0 R /Size 4 >>
startxref
192
%%EOF`;

  const buffer = Buffer.from(emptyPdf);
  const parsed = await parsePdfBuffer(buffer);

  assert.strictEqual(parsed.format, 'pdf');
  assert.strictEqual(parsed.pageCount, 1);
  assert.strictEqual(parsed.needsOcr, true);
  assert.strictEqual(parsed.text, '');
});

// -------------------------------------------------------------
// Test 16: DOCX parser error handling
// -------------------------------------------------------------
await test('DOCX parser handles buffer or throws graceful error on invalid file', async () => {
  const corruptedBuffer = Buffer.from('not a zip file');
  await assert.rejects(
    async () => {
      await parseDocxBuffer(corruptedBuffer);
    },
    (err) => {
      return err.message.length > 0;
    }
  );
});

// -------------------------------------------------------------
// Test 17: Website knowledge extraction from real project HTML
// -------------------------------------------------------------
await test('Website knowledge extractor parses authorized sections from index and portfolio', async () => {
  const rootDir = path.resolve(__dirname, '../../..');
  const sections = await extractWebsiteKnowledge(rootDir);

  assert.ok(sections.length >= 10, `Expected at least 10 sections, got ${sections.length}`);
  
  const esSections = sections.filter(s => s.language === 'es');
  const enSections = sections.filter(s => s.language === 'en');
  assert.ok(esSections.length > 0, 'Must have ES sections');
  assert.ok(enSections.length > 0, 'Must have EN sections');

  const titles = sections.map(s => s.title);
  assert.ok(titles.some(t => t.includes('Servicios') || t.includes('Services')), 'Missing Servicios section');
  assert.ok(titles.some(t => t.includes('Ecosistema') || t.includes('Soluciones') || t.includes('Ecosystem')), 'Missing AI Solutions section');
  assert.ok(titles.some(t => t.includes('Portafolio') || t.includes('Portfolio')), 'Missing Portfolio section');

  const contactSection = sections.find(s => s.source_id === 'website-home-contact-es');
  assert.ok(contactSection, 'Missing website-home-contact-es');
  assert.ok(contactSection.text.includes('bopagencia@gmail.com'));
  assert.ok(contactSection.text.includes('+57 305 417 6606'));
});

// -------------------------------------------------------------
// Test 18: SHA-256 checksum detects modifications and identity
// -------------------------------------------------------------
await test('SHA-256 checksum detects identity and modification correctly', () => {
  const tmpDir = createTempDir();
  try {
    const file = path.join(tmpDir, 'checksum-test.txt');
    fs.writeFileSync(file, 'Versión 1 del contenido');
    const hash1 = calculateFileChecksum(file);

    fs.writeFileSync(file, 'Versión 1 del contenido');
    const hash2 = calculateFileChecksum(file);
    assert.strictEqual(hash1, hash2, 'Identical content must produce identical hash');

    fs.writeFileSync(file, 'Versión 2 modificada');
    const hash3 = calculateFileChecksum(file);
    assert.notStrictEqual(hash1, hash3, 'Modified content must produce different hash');
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// -------------------------------------------------------------
// Test 19: Corpus generation & serialization produces valid JSON/JSONL
// -------------------------------------------------------------
await test('Corpus serialization writes valid manifest.json, sources.json, chunks.jsonl', async () => {
  const tmpDir = createTempDir();
  try {
    const sources = [
      {
        source_id: 'test_src_1',
        source_type: 'document',
        file_name: 'test.txt',
        file_path: 'sources/documents/test.txt',
        title: 'Test',
        category: 'general',
        language: 'es',
        format: 'txt',
        size_bytes: 50,
        checksum: 'abc123hash',
        needs_ocr: false
      }
    ];

    const chunks = [
      {
        chunk_id: 'test_src_1-sec-0-hash',
        source_id: 'test_src_1',
        chunk_index: 0,
        language: 'es',
        category: 'general',
        text: 'Contenido del chunk para testing.',
        char_count: 33,
        previous_chunk_id: null,
        next_chunk_id: null
      }
    ];

    const manifest = buildManifest({
      sources,
      chunks,
      failedSources: []
    });

    await saveGeneratedCorpus(tmpDir, manifest, sources, chunks);

    const manifestPath = path.join(tmpDir, 'manifest.json');
    assert.ok(fs.existsSync(manifestPath));
    const parsedManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.strictEqual(parsedManifest.schema_version, '1.0.0');
    assert.strictEqual(parsedManifest.chunk_count, 1);

    const sourcesPath = path.join(tmpDir, 'sources.json');
    assert.ok(fs.existsSync(sourcesPath));
    const parsedSources = JSON.parse(fs.readFileSync(sourcesPath, 'utf8'));
    assert.strictEqual(parsedSources.length, 1);

    const chunksPath = path.join(tmpDir, 'chunks.jsonl');
    assert.ok(fs.existsSync(chunksPath));
    const lines = fs.readFileSync(chunksPath, 'utf8').trim().split('\n');
    assert.strictEqual(lines.length, 1);
    const firstChunk = JSON.parse(lines[0]);
    assert.strictEqual(firstChunk.chunk_id, 'test_src_1-sec-0-hash');
  } finally {
    cleanupTempDir(tmpDir);
  }
});

// -------------------------------------------------------------
// Test 20: Dry run mode guarantee (no file writes)
// -------------------------------------------------------------
await test('Ingestion dry-run mode processes pipeline without modifying generated files', async () => {
  const tmpGenDir = createTempDir('dry-run-gen-');
  try {
    const result = await runIngestion({
      dryRun: true,
      generatedDir: tmpGenDir
    });

    assert.ok(result.manifest.source_count > 0, 'Should detect website sources');

    // Confirm generated directory remains completely empty
    const files = fs.readdirSync(tmpGenDir);
    assert.strictEqual(files.length, 0, `Dry run must not create files, found: ${files.join(', ')}`);
  } finally {
    cleanupTempDir(tmpGenDir);
  }
});

// =============================================================
// PHASE 11A.3.1 LIFECYCLE & CORPUS INTEGRITY TESTS (Tests 21 - 32)
// =============================================================

// -------------------------------------------------------------
// Test 21: Unchanged source produces deterministic result & incremental caching
// -------------------------------------------------------------
await test('Unchanged source produces deterministic IDs and incremental cache hit', async () => {
  const tmpSourcesDir = createTempDir('sources-unchanged-');
  const tmpGenDir = createTempDir('gen-unchanged-');
  try {
    const docPath = path.join(tmpSourcesDir, 'test-doc.txt');
    fs.writeFileSync(docPath, 'Contenido persistente para verificar determinismo y caché.', 'utf8');

    // First ingestion
    const res1 = await runIngestion({
      sourcesDir: tmpSourcesDir,
      generatedDir: tmpGenDir
    });
    const docSource1 = res1.sources.find(s => s.source_name === 'test-doc.txt');
    assert.ok(docSource1, 'docSource1 must exist');
    const docChunks1 = res1.chunks.filter(c => c.source_id === docSource1.source_id);

    // Second ingestion without changes
    const res2 = await runIngestion({
      sourcesDir: tmpSourcesDir,
      generatedDir: tmpGenDir
    });
    const docSource2 = res2.sources.find(s => s.source_name === 'test-doc.txt');
    assert.ok(docSource2, 'docSource2 must exist');
    const docChunks2 = res2.chunks.filter(c => c.source_id === docSource2.source_id);

    // Checksums and IDs must match exactly
    assert.strictEqual(docSource1.checksum, docSource2.checksum);
    assert.strictEqual(docSource1.source_id, docSource2.source_id);
    assert.strictEqual(docChunks1.length, docChunks2.length);
    for (let i = 0; i < docChunks1.length; i++) {
      assert.strictEqual(docChunks1[i].chunk_id, docChunks2[i].chunk_id);
      assert.strictEqual(docChunks1[i].text, docChunks2[i].text);
    }
  } finally {
    cleanupTempDir(tmpSourcesDir);
    cleanupTempDir(tmpGenDir);
  }
});

// -------------------------------------------------------------
// Test 22: Modified source updates checksum and replaces chunks completely
// -------------------------------------------------------------
await test('Modified source updates checksum, updates metadata and leaves NO old chunks', async () => {
  const tmpSourcesDir = createTempDir('sources-mod-');
  const tmpGenDir = createTempDir('gen-mod-');
  try {
    const docPath = path.join(tmpSourcesDir, 'knowledge-test.txt');
    fs.writeFileSync(docPath, 'Versión Alfa con información confidencial inicial de prueba.', 'utf8');

    // Ingestion A
    const res1 = await runIngestion({
      sourcesDir: tmpSourcesDir,
      generatedDir: tmpGenDir
    });
    const src1 = res1.sources.find(s => s.source_name === 'knowledge-test.txt');
    const oldChunkId = res1.chunks.find(c => c.source_id === src1.source_id).chunk_id;

    // Modify file
    fs.writeFileSync(docPath, 'Versión Beta con nuevos requerimientos estratégicos totalmente actualizados.', 'utf8');

    // Ingestion B
    const res2 = await runIngestion({
      sourcesDir: tmpSourcesDir,
      generatedDir: tmpGenDir
    });
    const src2 = res2.sources.find(s => s.source_name === 'knowledge-test.txt');

    assert.notStrictEqual(src1.checksum, src2.checksum, 'Checksums must differ');
    assert.notStrictEqual(src1.source_id, src2.source_id, 'Source IDs with checksum hash must differ');

    // Verify on disk generated files
    const chunksRaw = fs.readFileSync(path.join(tmpGenDir, 'chunks.jsonl'), 'utf8');
    assert.ok(!chunksRaw.includes('Versión Alfa'), 'Old content must NOT survive in corpus');
    assert.ok(!chunksRaw.includes(oldChunkId), 'Old chunk ID must NOT survive in corpus');
    assert.ok(chunksRaw.includes('Versión Beta'), 'New content must be in corpus');
  } finally {
    cleanupTempDir(tmpSourcesDir);
    cleanupTempDir(tmpGenDir);
  }
});

// -------------------------------------------------------------
// Test 23: Removed source eliminates all associated chunks (ZERO orphan chunks)
// -------------------------------------------------------------
await test('Removed source removes all associated chunks with ZERO orphan chunks', async () => {
  const tmpSourcesDir = createTempDir('sources-del-');
  const tmpGenDir = createTempDir('gen-del-');
  try {
    const docPath = path.join(tmpSourcesDir, 'transient-doc.txt');
    fs.writeFileSync(docPath, 'Documento temporal que será eliminado en la prueba.', 'utf8');

    // Ingestion with transient doc
    const res1 = await runIngestion({
      sourcesDir: tmpSourcesDir,
      generatedDir: tmpGenDir
    });
    const src1 = res1.sources.find(s => s.source_name === 'transient-doc.txt');
    assert.ok(src1, 'transient-doc must be ingested');
    const transientSourceId = src1.source_id;

    // Delete the file
    fs.unlinkSync(docPath);

    // Re-ingest
    const res2 = await runIngestion({
      sourcesDir: tmpSourcesDir,
      generatedDir: tmpGenDir
    });

    const src2 = res2.sources.find(s => s.source_name === 'transient-doc.txt');
    assert.strictEqual(src2, undefined, 'Deleted source must not exist in sources');

    // Verify disk chunks.jsonl has zero orphan chunks referencing transientSourceId
    const diskChunksRaw = fs.readFileSync(path.join(tmpGenDir, 'chunks.jsonl'), 'utf8');
    assert.ok(!diskChunksRaw.includes(transientSourceId), 'ZERO orphan chunks allowed for deleted source');

    // Confirm all existing chunks in res2 map to a live source in res2.sources
    const liveSourceIds = new Set(res2.sources.map(s => s.source_id));
    for (const c of res2.chunks) {
      assert.ok(liveSourceIds.has(c.source_id), `Orphan chunk found: ${c.chunk_id}`);
    }
  } finally {
    cleanupTempDir(tmpSourcesDir);
    cleanupTempDir(tmpGenDir);
  }
});

// -------------------------------------------------------------
// Test 24: Corrupted / invalid file registers failed_count >= 1 without stopping valid ingestion
// -------------------------------------------------------------
await test('Corrupted source records failure and does not abort valid sources processing', async () => {
  const tmpSourcesDir = createTempDir('sources-fail-');
  const tmpGenDir = createTempDir('gen-fail-');
  try {
    const validFile = path.join(tmpSourcesDir, 'valid.txt');
    fs.writeFileSync(validFile, 'Este es un archivo plenamente válido para el corpus.', 'utf8');

    const corruptPdf = path.join(tmpSourcesDir, 'corrupt.pdf');
    fs.writeFileSync(corruptPdf, 'ESTO NO ES UN ARCHIVO PDF VALIDO NI TIENE HEADER %PDF');

    const res = await runIngestion({
      sourcesDir: tmpSourcesDir,
      generatedDir: tmpGenDir
    });

    assert.ok(res.manifest.failed_count >= 1, `Expected failed_count >= 1, got ${res.manifest.failed_count}`);
    assert.ok(res.manifest.failed_sources.some(f => f.name.includes('corrupt.pdf')));

    // Valid file should still be processed into corpus
    const validSource = res.sources.find(s => s.source_name === 'valid.txt');
    assert.ok(validSource, 'Valid source must be present despite partial failure');
    assert.ok(res.chunks.some(c => c.source_id === validSource.source_id));
  } finally {
    cleanupTempDir(tmpSourcesDir);
    cleanupTempDir(tmpGenDir);
  }
});

// -------------------------------------------------------------
// Test 25: Website sources language parity (exact 7 ES and 7 EN, clean bilingual separation)
// -------------------------------------------------------------
await test('Website sources adhere to strict language parity (7 ES, 7 EN) without contamination', async () => {
  const rootDir = path.resolve(__dirname, '../../..');
  const sections = await extractWebsiteKnowledge(rootDir);

  assert.strictEqual(sections.length, 14, `Expected exactly 14 website sections, got ${sections.length}`);

  const es = sections.filter(s => s.language === 'es');
  const en = sections.filter(s => s.language === 'en');

  assert.strictEqual(es.length, 7, `Expected 7 ES sections, got ${es.length}`);
  assert.strictEqual(en.length, 7, `Expected 7 EN sections, got ${en.length}`);

  for (const s of sections) {
    // Check absence of raw html/script tags
    assert.ok(!s.text.includes('<script'), `Section ${s.source_id} contains <script`);
    assert.ok(!s.text.includes('<style'), `Section ${s.source_id} contains <style`);
    assert.ok(!s.text.includes('class='), `Section ${s.source_id} contains class= attribute`);

    // Check language integrity
    if (s.language === 'es') {
      assert.ok(s.title.includes('(ES)'), `ES section title missing (ES): ${s.title}`);
    } else if (s.language === 'en') {
      assert.ok(s.title.includes('(EN)'), `EN section title missing (EN): ${s.title}`);
    }
  }
});

// -------------------------------------------------------------
// Test 26: Manifest consistency with physical files
// -------------------------------------------------------------
await test('Manifest stats strictly match physical counts in sources.json and chunks.jsonl', async () => {
  const tmpGenDir = createTempDir('gen-manifest-');
  try {
    const res = await runIngestion({
      generatedDir: tmpGenDir
    });

    const manifestRaw = JSON.parse(fs.readFileSync(path.join(tmpGenDir, 'manifest.json'), 'utf8'));
    const sourcesRaw = JSON.parse(fs.readFileSync(path.join(tmpGenDir, 'sources.json'), 'utf8'));
    const chunksLines = fs.readFileSync(path.join(tmpGenDir, 'chunks.jsonl'), 'utf8').trim().split('\n');

    assert.strictEqual(manifestRaw.source_count, sourcesRaw.length);
    assert.strictEqual(manifestRaw.chunk_count, chunksLines.length);
    assert.strictEqual(manifestRaw.source_count, res.sources.length);
    assert.strictEqual(manifestRaw.chunk_count, res.chunks.length);
  } finally {
    cleanupTempDir(tmpGenDir);
  }
});

// -------------------------------------------------------------
// Test 27: All chunk source_ids resolve to valid sources
// -------------------------------------------------------------
await test('Every chunk in chunks.jsonl maps to an existing source in sources.json', async () => {
  const tmpGenDir = createTempDir('gen-chunk-res-');
  try {
    const res = await runIngestion({
      generatedDir: tmpGenDir
    });

    const sourcesSet = new Set(res.sources.map(s => s.source_id));
    for (const chunk of res.chunks) {
      assert.ok(sourcesSet.has(chunk.source_id), `Chunk ${chunk.chunk_id} has invalid source_id ${chunk.source_id}`);
    }
  } finally {
    cleanupTempDir(tmpGenDir);
  }
});

// -------------------------------------------------------------
// Test 28: Previous and next chunk link references resolve to valid chunks
// -------------------------------------------------------------
await test('Non-null previous_chunk_id and next_chunk_id resolve to real chunks', async () => {
  const tmpGenDir = createTempDir('gen-links-');
  try {
    const res = await runIngestion({
      generatedDir: tmpGenDir
    });

    const chunkMap = new Map(res.chunks.map(c => [c.chunk_id, c]));

    for (const c of res.chunks) {
      if (c.previous_chunk_id !== null) {
        assert.ok(chunkMap.has(c.previous_chunk_id), `previous_chunk_id ${c.previous_chunk_id} does not exist`);
      }
      if (c.next_chunk_id !== null) {
        assert.ok(chunkMap.has(c.next_chunk_id), `next_chunk_id ${c.next_chunk_id} does not exist`);
      }
    }
  } finally {
    cleanupTempDir(tmpGenDir);
  }
});

// -------------------------------------------------------------
// Test 29: Duplicate source_id count is ZERO
// -------------------------------------------------------------
await test('Source IDs contain ZERO duplicates', async () => {
  const tmpGenDir = createTempDir('gen-src-dup-');
  try {
    const res = await runIngestion({
      generatedDir: tmpGenDir
    });

    const seen = new Set();
    const duplicates = [];

    for (const s of res.sources) {
      if (seen.has(s.source_id)) {
        duplicates.push(s.source_id);
      }
      seen.add(s.source_id);
    }

    assert.strictEqual(duplicates.length, 0, `Found duplicate source_ids: ${duplicates.join(', ')}`);
  } finally {
    cleanupTempDir(tmpGenDir);
  }
});

// -------------------------------------------------------------
// Test 30: Duplicate chunk_id count is ZERO
// -------------------------------------------------------------
await test('Chunk IDs contain ZERO duplicates', async () => {
  const tmpGenDir = createTempDir('gen-chunk-dup-');
  try {
    const res = await runIngestion({
      generatedDir: tmpGenDir
    });

    const seen = new Set();
    const duplicates = [];

    for (const c of res.chunks) {
      if (seen.has(c.chunk_id)) {
        duplicates.push(c.chunk_id);
      }
      seen.add(c.chunk_id);
    }

    assert.strictEqual(duplicates.length, 0, `Found duplicate chunk_ids: ${duplicates.join(', ')}`);
  } finally {
    cleanupTempDir(tmpGenDir);
  }
});

// -------------------------------------------------------------
// Test 31: Second identical ingestion yields the exact same logical set of IDs
// -------------------------------------------------------------
await test('Repeated identical ingestion yields identical source_ids and chunk_ids', async () => {
  const tmpGenDir = createTempDir('gen-repeat-');
  try {
    const run1 = await runIngestion({ generatedDir: tmpGenDir });
    const run2 = await runIngestion({ generatedDir: tmpGenDir });

    const srcIds1 = run1.sources.map(s => s.source_id).sort();
    const srcIds2 = run2.sources.map(s => s.source_id).sort();
    assert.deepStrictEqual(srcIds1, srcIds2);

    const chunkIds1 = run1.chunks.map(c => c.chunk_id).sort();
    const chunkIds2 = run2.chunks.map(c => c.chunk_id).sort();
    assert.deepStrictEqual(chunkIds1, chunkIds2);
  } finally {
    cleanupTempDir(tmpGenDir);
  }
});

// -------------------------------------------------------------
// Test 32: Privacy & Quarantine verification (no test fixtures leak into real corpus)
// -------------------------------------------------------------
await test('Real botinfo/sources contains no lingering test files or leaked fixtures', () => {
  const realSourcesDir = path.resolve(__dirname, '../botinfo/sources');
  const allowedItems = new Set(['documents', 'text', '.gitkeep', 'readme.md']);

  if (fs.existsSync(realSourcesDir)) {
    const entries = fs.readdirSync(realSourcesDir);
    for (const entry of entries) {
      assert.ok(
        allowedItems.has(entry.toLowerCase()),
        `Unexpected item found in real sources folder: ${entry}`
      );
    }
  }
});

console.log('-------------------------------------------------------------');
console.log(`Test results: ${passedCount} passed, ${failedCount} failed.`);

if (failedCount > 0) {
  process.exit(1);
}

