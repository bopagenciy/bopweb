import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ALLOWED_EXTENSIONS = new Set(['.txt', '.pdf', '.docx', '.md']);
export const SUPPORTED_EXTENSIONS = ALLOWED_EXTENSIONS;
export const DEFAULT_MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_FILE_SIZE_BYTES = DEFAULT_MAX_FILE_BYTES;

/**
 * Compute SHA-256 hash of a buffer or string
 * @param {Buffer|string} data 
 * @returns {string} Hex encoded sha256 checksum
 */
export function computeChecksum(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}
export const calculateFileChecksum = (filePath) => {
  const content = fsSync.readFileSync(filePath);
  return computeChecksum(content);
};
export const validateFilePath = (filePath, rootSourcesDir, maxBytes) => {
  const resolvedPath = path.resolve(filePath);
  const resolvedRootDir = path.resolve(rootSourcesDir);

  if (!resolvedPath.startsWith(resolvedRootDir + path.sep) && resolvedPath !== resolvedRootDir) {
    return { valid: false, reason: 'PATH_TRAVERSAL' };
  }

  const ext = path.extname(resolvedPath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, reason: 'UNSUPPORTED_EXTENSION' };
  }

  try {
    const lstats = fsSync.lstatSync(resolvedPath);
    if (lstats.isSymbolicLink()) {
      return { valid: false, reason: 'SYMLINK_NOT_ALLOWED' };
    }
    if (!lstats.isFile()) {
      return { valid: false, reason: 'NOT_A_REGULAR_FILE' };
    }
    if (maxBytes !== undefined && lstats.size > maxBytes) {
      return { valid: false, reason: 'FILE_TOO_LARGE' };
    }
    if (lstats.size === 0) {
      return { valid: false, reason: 'EMPTY_FILE' };
    }
    return { valid: true, stats: lstats, ext };
  } catch (err) {
    return { valid: false, reason: 'ACCESS_ERROR', message: err.message };
  }
};
export const findSupportedFiles = findSourceFiles;

/**
 * Validate an input file prior to parsing
 * @param {string} filePath Absolute or relative path to file
 * @param {string} rootSourcesDir Base sources directory to prevent path traversal
 * @param {number} maxBytes Maximum allowed file size in bytes
 * @returns {Promise<{ valid: boolean, error?: string, stats?: import('node:fs').Stats, ext?: string, filename?: string, relPath?: string }>}
 */
export async function validateInputFile(filePath, rootSourcesDir, maxBytes = DEFAULT_MAX_FILE_BYTES) {
  const resolvedPath = path.resolve(filePath);
  const resolvedRootDir = path.resolve(rootSourcesDir);

  // Path traversal check: must stay within rootSourcesDir
  if (!resolvedPath.startsWith(resolvedRootDir + path.sep) && resolvedPath !== resolvedRootDir) {
    return { valid: false, error: 'PATH_TRAVERSAL_DETECTED' };
  }

  // File extension check
  const ext = path.extname(resolvedPath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return { valid: false, error: `UNSUPPORTED_EXTENSION: ${ext}` };
  }

  try {
    const lstats = await fs.lstat(resolvedPath);
    if (lstats.isSymbolicLink()) {
      return { valid: false, error: 'SYMLINK_NOT_ALLOWED' };
    }
    if (!lstats.isFile()) {
      return { valid: false, error: 'NOT_A_REGULAR_FILE' };
    }

    if (lstats.size > maxBytes) {
      return { valid: false, error: `FILE_TOO_LARGE: ${lstats.size} bytes > max ${maxBytes} bytes` };
    }

    if (lstats.size === 0) {
      return { valid: false, error: 'EMPTY_FILE' };
    }

    const filename = path.basename(resolvedPath);
    const relPath = path.relative(resolvedRootDir, resolvedPath).replace(/\\/g, '/');

    return {
      valid: true,
      stats: lstats,
      ext,
      filename,
      relPath
    };
  } catch (err) {
    return { valid: false, error: `ACCESS_ERROR: ${err.message}` };
  }
}

/**
 * Scan a directory recursively for allowed candidate files
 * @param {string} dir Path to scan
 * @returns {Promise<string[]>} Array of absolute file paths
 */
export async function findSourceFiles(dir) {
  const results = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const nested = await findSourceFiles(fullPath);
        results.push(...nested);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ALLOWED_EXTENSIONS.has(ext) && entry.name !== '.gitkeep') {
          results.push(fullPath);
        }
      }
    }
  } catch (_) {}
  return results.sort();
}
