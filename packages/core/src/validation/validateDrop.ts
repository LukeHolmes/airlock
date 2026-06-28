import fs from 'node:fs';
import path from 'node:path';

/** Maximum payload size accepted for file sessions (250 MiB). */
export const MAX_DROP_FILE_BYTES = 250 * 1024 * 1024;

const SNIFF_BYTES = 560;

const DOCUMENT_EXTENSIONS = new Set([
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.html',
  '.htm',
  '.txt',
  '.md',
  '.csv',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
]);

const EXECUTABLE_MIME_PREFIXES = [
  'application/x-msdownload',
  'application/x-executable',
  'application/x-elf',
  'application/x-mach-binary',
  'application/vnd.microsoft.portable-executable',
];

export type DropValidationErrorCode =
  | 'not_found'
  | 'not_a_file'
  | 'symlink'
  | 'empty'
  | 'too_large'
  | 'unreadable'
  | 'extension_mismatch';

export type DropValidationResult =
  | {
      ok: true;
      filePath: string;
      mimeType: string;
      extension: string;
      sizeBytes: number;
      sniffedMime: string;
    }
  | {
      ok: false;
      filePath: string;
      code: DropValidationErrorCode;
      message: string;
      sniffedMime?: string;
      extension?: string;
    };

type SignatureRule = {
  mime: string;
  test: (buffer: Buffer) => boolean;
};

const SIGNATURE_RULES: SignatureRule[] = [
  {
    mime: 'application/pdf',
    test: (buffer) => buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-',
  },
  {
    mime: 'image/png',
    test: (buffer) =>
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a,
  },
  {
    mime: 'image/jpeg',
    test: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  },
  {
    mime: 'image/gif',
    test: (buffer) => {
      if (buffer.length < 6) return false;
      const header = buffer.subarray(0, 6).toString('ascii');
      return header === 'GIF87a' || header === 'GIF89a';
    },
  },
  {
    mime: 'image/webp',
    test: (buffer) =>
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  {
    mime: 'application/zip',
    test: (buffer) =>
      buffer.length >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
      (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08),
  },
  {
    mime: 'application/x-msdownload',
    test: (buffer) => buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a,
  },
  {
    mime: 'application/x-elf',
    test: (buffer) =>
      buffer.length >= 4 &&
      buffer[0] === 0x7f &&
      buffer[1] === 0x45 &&
      buffer[2] === 0x4c &&
      buffer[3] === 0x46,
  },
  {
    mime: 'application/x-mach-binary',
    test: (buffer) => {
      if (buffer.length < 4) return false;
      const magic = buffer.readUInt32BE(0);
      return magic === 0xfeedface || magic === 0xfeedfacf || magic === 0xcefaedfe || magic === 0xcffaedfe;
    },
  },
];

function sniffMime(buffer: Buffer): string {
  for (const rule of SIGNATURE_RULES) {
    if (rule.test(buffer)) {
      return rule.mime;
    }
  }

  const trimmed = buffer.toString('utf8', 0, Math.min(buffer.length, 256)).trimStart().toLowerCase();
  if (trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html')) {
    return 'text/html';
  }

  if (buffer.length > 0 && isMostlyText(buffer)) {
    return 'text/plain';
  }

  return 'application/octet-stream';
}

function isMostlyText(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 512));
  if (sample.length === 0) return false;

  let printable = 0;
  for (const byte of sample) {
    if (byte === 0x09 || byte === 0x0a || byte === 0x0d || (byte >= 0x20 && byte <= 0x7e)) {
      printable++;
    }
  }

  return printable / sample.length >= 0.9;
}

function extensionMimeHint(extension: string): string | undefined {
  switch (extension) {
    case '.pdf':
      return 'application/pdf';
    case '.html':
    case '.htm':
      return 'text/html';
    case '.txt':
    case '.md':
    case '.csv':
      return 'text/plain';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.webp':
      return 'image/webp';
    case '.svg':
      return 'image/svg+xml';
    case '.docx':
    case '.xlsx':
    case '.pptx':
      return 'application/zip';
    default:
      return undefined;
  }
}

function isExecutableMime(mime: string): boolean {
  return EXECUTABLE_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix));
}

function mimeMatchesExtension(sniffedMime: string, extension: string): boolean {
  const hint = extensionMimeHint(extension);
  if (!hint) return true;

  if (hint === sniffedMime) return true;

  if (hint === 'application/zip' && sniffedMime === 'application/zip') return true;

  if (hint.startsWith('text/') && sniffedMime.startsWith('text/')) return true;

  if (hint === 'image/svg+xml' && (sniffedMime === 'text/plain' || sniffedMime === 'image/svg+xml')) {
    return true;
  }

  return false;
}

function readSniffBuffer(filePath: string): Buffer {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(SNIFF_BYTES);
    const bytesRead = fs.readSync(fd, buffer, 0, SNIFF_BYTES, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Validate a dropped or opened file before starting a sandbox session.
 * Sniffs MIME from magic bytes and rejects obvious extension spoofing.
 */
export function validateDrop(filePath: string): DropValidationResult {
  const normalizedPath = filePath.trim();
  if (!normalizedPath) {
    return {
      ok: false,
      filePath: normalizedPath,
      code: 'not_found',
      message: 'File path is required',
    };
  }

  let stat: fs.Stats;
  try {
    stat = fs.lstatSync(normalizedPath);
  } catch {
    return {
      ok: false,
      filePath: normalizedPath,
      code: 'not_found',
      message: `File not found: ${normalizedPath}`,
    };
  }

  if (stat.isSymbolicLink()) {
    return {
      ok: false,
      filePath: normalizedPath,
      code: 'symlink',
      message: 'Symlinks are not accepted. Drop the target file directly.',
    };
  }

  if (!stat.isFile()) {
    return {
      ok: false,
      filePath: normalizedPath,
      code: 'not_a_file',
      message: 'Only regular files can be opened in Airlock.',
    };
  }

  if (stat.size === 0) {
    return {
      ok: false,
      filePath: normalizedPath,
      code: 'empty',
      message: 'File is empty.',
    };
  }

  if (stat.size > MAX_DROP_FILE_BYTES) {
    return {
      ok: false,
      filePath: normalizedPath,
      code: 'too_large',
      message: `File exceeds the ${Math.floor(MAX_DROP_FILE_BYTES / (1024 * 1024))} MiB limit.`,
    };
  }

  let sniffBuffer: Buffer;
  try {
    sniffBuffer = readSniffBuffer(normalizedPath);
  } catch {
    return {
      ok: false,
      filePath: normalizedPath,
      code: 'unreadable',
      message: 'File could not be read.',
    };
  }

  const extension = path.extname(normalizedPath).toLowerCase();
  const sniffedMime = sniffMime(sniffBuffer);

  if (DOCUMENT_EXTENSIONS.has(extension) && isExecutableMime(sniffedMime)) {
    return {
      ok: false,
      filePath: normalizedPath,
      code: 'extension_mismatch',
      message: `File content looks like an executable but has a ${extension} extension.`,
      sniffedMime,
      extension,
    };
  }

  if (extension && !mimeMatchesExtension(sniffedMime, extension)) {
    return {
      ok: false,
      filePath: normalizedPath,
      code: 'extension_mismatch',
      message: `File content (${sniffedMime}) does not match the ${extension} extension.`,
      sniffedMime,
      extension,
    };
  }

  return {
    ok: true,
    filePath: normalizedPath,
    mimeType: sniffedMime,
    extension,
    sizeBytes: stat.size,
    sniffedMime,
  };
}
