import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateInputFile, findSourceFiles, computeChecksum } from './utils/file-validator.js';
import { parseTxt } from './parsers/txt-parser.js';
import { parsePdf } from './parsers/pdf-parser.js';
import { parseDocx } from './parsers/docx-parser.js';
import { normalizeText } from './normalizers/text-normalizer.js';
import { chunkText, chunkMarkdown } from './chunker.js';
import { extractWebsiteKnowledge } from './website-source.js';
import { buildManifest, saveGeneratedCorpus } from './manifest.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base paths relative to backend/bob/
const BOB_DIR = path.resolve(__dirname, '..');
const ROOT_WORKSPACE_DIR = path.resolve(BOB_DIR, '../..');
const BOTINFO_DIR = path.resolve(BOB_DIR, 'botinfo');
const SOURCES_DIR = path.resolve(BOTINFO_DIR, 'sources');
const GENERATED_DIR = path.resolve(BOTINFO_DIR, 'generated');

/**
 * Infer document language deterministically from filename or content cues
 * Rules:
 * - filename contains "-en", "_en", ".en." -> "en"
 * - filename contains "-es", "_es", ".es." -> "es"
 * - deterministic simple stopword frequency: spanish (de, la, que, el, en, y, a, los, del) vs english (the, of, and, to, in, is, that, for)
 */
export function detectLanguage(filename, text) {
  const fn = filename.toLowerCase();
  if (fn.includes('-en.') || fn.includes('_en.') || fn.includes('.en.')) return 'en';
  if (fn.includes('-es.') || fn.includes('_es.') || fn.includes('.es.')) return 'es';

  const lower = text.toLowerCase();
  const esMatches = (lower.match(/\b(de|la|que|el|en|y|a|los|del|por|con|para)\b/g) || []).length;
  const enMatches = (lower.match(/\b(the|of|and|to|in|is|that|for|it|as|was|with)\b/g) || []).length;

  if (esMatches > 10 && esMatches > enMatches * 2) return 'es';
  if (enMatches > 10 && enMatches > esMatches * 2) return 'en';

  return 'unknown';
}

/**
 * Process a single valid physical source document
 */
async function processDocument(filePath, rootSourcesDir, existingCache = {}) {
  const validation = await validateInputFile(filePath, rootSourcesDir);
  if (!validation.valid) {
    return {
      status: 'failed',
      filename: path.basename(filePath),
      error: validation.error
    };
  }

  const { ext, filename, relPath, stats } = validation;
  const buffer = await fs.readFile(filePath);
  const checksum = computeChecksum(buffer);

  // Check cache for incremental ingestion
  const cached = existingCache[relPath];
  if (cached && cached.checksum === checksum && cached.status === 'processed') {
    return {
      status: 'cached',
      source: cached.source,
      chunks: cached.chunks
    };
  }

  // Parse raw text based on extension
  let parseResult;
  try {
    if (ext === '.txt' || ext === '.md') {
      parseResult = await parseTxt(filePath);
    } else if (ext === '.pdf') {
      parseResult = await parsePdf(filePath);
    } else if (ext === '.docx') {
      parseResult = await parseDocx(filePath);
    } else {
      return { status: 'failed', filename, error: `UNSUPPORTED_FORMAT: ${ext}` };
    }
  } catch (err) {
    return { status: 'failed', filename, error: err.message };
  }

  const { text: rawText, pageCount = 1, needsOcr = false } = parseResult;
  const normalized = normalizeText(rawText);
  const language = detectLanguage(filename, normalized);
  const sourceId = `doc-${path.parse(filename).name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}-${checksum.substring(0, 8)}`;

  const sourceMeta = {
    source_id: sourceId,
    source_type: 'document',
    source_name: filename,
    source_path: relPath,
    format: ext.replace('.', ''),
    language,
    title: path.parse(filename).name,
    checksum,
    size_bytes: stats.size,
    char_count: normalized.length,
    page_count: pageCount,
    needs_ocr: needsOcr,
    status: 'processed',
    ingested_at: new Date().toISOString(),
    modified_at: stats.mtime.toISOString(),
    text: normalized
  };

  let chunks;
  if (ext === '.md') {
    chunks = chunkMarkdown(rawText, {
      sourceId,
      documentTitle: sourceMeta.title
    });
  } else {
    chunks = chunkText(normalized, {
      sourceId,
      language,
      section: sourceMeta.title
    });
  }

  return {
    status: 'processed',
    source: sourceMeta,
    chunks
  };
}

/**
 * Load existing sources and chunks for checksum cache matching
 */
async function loadExistingCache(generatedDir) {
  const cache = {};
  try {
    const sourcesRaw = await fs.readFile(path.join(generatedDir, 'sources.json'), 'utf-8');
    const sources = JSON.parse(sourcesRaw);

    const chunksRaw = await fs.readFile(path.join(generatedDir, 'chunks.jsonl'), 'utf-8');
    const chunksBySource = {};
    for (const line of chunksRaw.split('\n')) {
      if (!line.trim()) continue;
      const c = JSON.parse(line);
      if (!chunksBySource[c.source_id]) chunksBySource[c.source_id] = [];
      chunksBySource[c.source_id].push(c);
    }

    for (const src of sources) {
      if (src.source_path) {
        cache[src.source_path] = {
          checksum: src.checksum,
          status: src.status,
          source: src,
          chunks: chunksBySource[src.source_id] || []
        };
      }
    }
  } catch (_) {}
  return cache;
}

/**
 * Main ingestion orchestration function
 * 
 * @param {object} options
 * @param {boolean} [options.dryRun=false] When true, scans and validates without writing generated/
 * @param {string} [options.sourcesDir=SOURCES_DIR]
 * @param {string} [options.generatedDir=GENERATED_DIR]
 * @param {string} [options.rootDir=ROOT_WORKSPACE_DIR]
 * @returns {Promise<object>} Summary report
 */
export async function runIngestion(options = {}) {
  const {
    dryRun = false,
    sourcesDir = SOURCES_DIR,
    generatedDir = GENERATED_DIR,
    rootDir = ROOT_WORKSPACE_DIR
  } = options;

  const startTime = Date.now();
  console.log(`\n==================================================`);
  console.log(`BOP AGENCIA — BOB KNOWLEDGE INGESTION PIPELINE`);
  console.log(`Mode: ${dryRun ? 'DRY-RUN (No writes)' : 'LIVE INGESTION'}`);
  console.log(`Sources root: ${sourcesDir}`);
  console.log(`==================================================\n`);

  // 1. Discover local files
  const filePaths = await findSourceFiles(sourcesDir);
  console.log(`Discovered ${filePaths.length} candidate document(s) in sources directory.`);

  // 2. Load existing cache for change detection
  const existingCache = await loadExistingCache(generatedDir);

  const processedSources = [];
  const allChunks = [];
  const failedSources = [];

  let cachedCount = 0;
  let newOrUpdatedCount = 0;

  // 3. Process documents
  for (const fp of filePaths) {
    const filename = path.basename(fp);
    const result = await processDocument(fp, sourcesDir, existingCache);

    if (result.status === 'cached') {
      cachedCount++;
      processedSources.push(result.source);
      allChunks.push(...result.chunks);
      console.log(`  [CACHED]     ${filename} (${result.source.format}, checksum: ${result.source.checksum.substring(0, 8)})`);
    } else if (result.status === 'processed') {
      newOrUpdatedCount++;
      processedSources.push(result.source);
      allChunks.push(...result.chunks);
      console.log(`  [PROCESSED]  ${filename} (${result.source.format}, ${result.source.size_bytes} bytes, ${result.chunks.length} chunks, needs_ocr: ${result.source.needs_ocr})`);
    } else {
      failedSources.push(result);
      console.warn(`  [FAILED]     ${filename} -> ${result.error}`);
    }
  }

  // 4. Ingest authoritative website knowledge
  console.log(`\nExtracting authoritative website knowledge from index.html & portfolio.html...`);
  const websiteSources = await extractWebsiteKnowledge(rootDir);

  for (const ws of websiteSources) {
    const wsChunks = chunkText(ws.text, {
      sourceId: ws.source_id,
      language: ws.language,
      section: ws.section
    });
    processedSources.push(ws);
    allChunks.push(...wsChunks);
    console.log(`  [WEBSITE]    ${ws.source_id} (${ws.language.toUpperCase()}, ${ws.char_count} chars, ${wsChunks.length} chunks)`);
  }

  // 5. Build manifest
  const manifest = buildManifest({
    sources: processedSources,
    chunks: allChunks,
    failedSources
  });

  const durationMs = Date.now() - startTime;

  // 6. Save corpus if not in dry-run mode
  if (!dryRun) {
    await saveGeneratedCorpus(generatedDir, manifest, processedSources, allChunks);
    console.log(`\nCorpus saved successfully to: ${generatedDir}`);
  } else {
    console.log(`\n[DRY-RUN] Skipped writing generated files.`);
  }

  // 7. Output summary
  console.log(`\n==================================================`);
  console.log(`INGESTION SUMMARY`);
  console.log(`==================================================`);
  console.log(`Total Sources:       ${manifest.source_count}`);
  console.log(`  - Documents:       ${manifest.document_count} (${cachedCount} cached, ${newOrUpdatedCount} updated)`);
  console.log(`  - Website Sections: ${manifest.website_source_count}`);
  console.log(`Total Chunks:        ${manifest.chunk_count}`);
  console.log(`Languages (Chunks):  ES: ${manifest.chunk_language_counts.es}, EN: ${manifest.chunk_language_counts.en}, Unknown: ${manifest.chunk_language_counts.unknown}`);
  console.log(`Needs OCR:           ${manifest.needs_ocr_count}`);
  console.log(`Failed:              ${manifest.failed_count}`);
  console.log(`Duration:            ${durationMs}ms`);
  console.log(`==================================================\n`);

  return {
    manifest,
    sources: processedSources,
    chunks: allChunks,
    failedSources,
    durationMs
  };
}

// Allow direct CLI invocation: node ingest.js [--dry-run]
if (process.argv[1] && process.argv[1].endsWith('ingest.js')) {
  const isDryRun = process.argv.includes('--dry-run');
  runIngestion({ dryRun: isDryRun }).catch((err) => {
    console.error('Fatal ingestion error:', err);
    process.exit(1);
  });
}
