import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_GENERATED_DIR = path.resolve(__dirname, '../botinfo/generated');

/**
 * Robust in-memory loader for the generated knowledge corpus
 */
export class CorpusLoader {
  constructor(generatedDir = DEFAULT_GENERATED_DIR) {
    this.generatedDir = generatedDir;
    this.manifest = null;
    this.sourcesMap = new Map();
    this.chunks = [];
    this.isLoaded = false;
  }

  /**
   * Load corpus files into memory
   * @param {boolean} [forceReload=false]
   * @returns {Promise<{ ok: boolean, error?: string, chunkCount: number, sourceCount: number }>}
   */
  async load(forceReload = false) {
    if (this.isLoaded && !forceReload) {
      return {
        ok: true,
        chunkCount: this.chunks.length,
        sourceCount: this.sourcesMap.size
      };
    }

    const manifestPath = path.join(this.generatedDir, 'manifest.json');
    const sourcesPath = path.join(this.generatedDir, 'sources.json');
    const chunksPath = path.join(this.generatedDir, 'chunks.jsonl');

    // 1. Verify existence of files
    try {
      await fs.access(manifestPath);
      await fs.access(sourcesPath);
      await fs.access(chunksPath);
    } catch (err) {
      this.isLoaded = false;
      return {
        ok: false,
        error: 'KNOWLEDGE_CORPUS_UNAVAILABLE',
        details: err.message
      };
    }

    // 2. Read and parse manifest.json
    try {
      const manifestRaw = await fs.readFile(manifestPath, 'utf-8');
      this.manifest = JSON.parse(manifestRaw);
      if (!this.manifest.schema_version || !this.manifest.schema_version.startsWith('1.')) {
        return {
          ok: false,
          error: 'KNOWLEDGE_CORPUS_INVALID',
          details: `Unsupported schema_version: ${this.manifest.schema_version}`
        };
      }
    } catch (err) {
      return {
        ok: false,
        error: 'KNOWLEDGE_CORPUS_INVALID',
        details: `Corrupted manifest.json: ${err.message}`
      };
    }

    // 3. Read and parse sources.json
    try {
      const sourcesRaw = await fs.readFile(sourcesPath, 'utf-8');
      const sourcesArr = JSON.parse(sourcesRaw);
      this.sourcesMap.clear();
      for (const src of sourcesArr) {
        if (src.source_id) {
          this.sourcesMap.set(src.source_id, src);
        }
      }
    } catch (err) {
      return {
        ok: false,
        error: 'KNOWLEDGE_CORPUS_INVALID',
        details: `Corrupted sources.json: ${err.message}`
      };
    }

    // 4. Read and parse chunks.jsonl
    try {
      const chunksRaw = await fs.readFile(chunksPath, 'utf-8');
      const lines = chunksRaw.split('\n');
      const parsedChunks = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const chunk = JSON.parse(line);
          if (chunk.chunk_id && chunk.source_id && chunk.text) {
            parsedChunks.push(chunk);
          }
        } catch (lineErr) {
          return {
            ok: false,
            error: 'KNOWLEDGE_CORPUS_INVALID',
            details: `Invalid JSON at chunks.jsonl line ${i + 1}: ${lineErr.message}`
          };
        }
      }

      this.chunks = parsedChunks;
    } catch (err) {
      return {
        ok: false,
        error: 'KNOWLEDGE_CORPUS_INVALID',
        details: `Error reading chunks.jsonl: ${err.message}`
      };
    }

    // 5. Verify non-empty corpus
    if (this.chunks.length === 0 && this.sourcesMap.size === 0) {
      return {
        ok: false,
        error: 'KNOWLEDGE_CORPUS_EMPTY',
        details: 'No sources or chunks available in generated corpus'
      };
    }

    this.isLoaded = true;
    return {
      ok: true,
      chunkCount: this.chunks.length,
      sourceCount: this.sourcesMap.size
    };
  }

  getSource(sourceId) {
    return this.sourcesMap.get(sourceId) || null;
  }

  getChunks() {
    return this.chunks;
  }

  getManifest() {
    return this.manifest;
  }
}
