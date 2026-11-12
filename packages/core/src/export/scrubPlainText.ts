/** Strip format characters and C0/C1 controls (keep TAB, LF, CR). */
const FORMAT_AND_ZERO_WIDTH =
  /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00AD\u180E\u061C\u2066-\u2069]/g;

/** C0/C1 controls except tab, newline, carriage return. */
// eslint-disable-next-line no-control-regex -- intentional stripping of control bytes
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

const HTML_TAG = /<[^>]*>/g;

/** Default cap for in-container plain-text exports (host-enforced after scrub). */
export const PLAIN_TEXT_EXPORT_MAX_BYTES = 2 * 1024 * 1024;

export type ScrubPlainTextResult = {
  text: string;
  removedControlChars: number;
  removedFormatChars: number;
  strippedHtmlTags: number;
};

export type NormalizePlainTextResult = ScrubPlainTextResult & {
  truncated: boolean;
  byteLength: number;
};

/**
 * Host-side plain-text sanitiser for guest-origin clipboard content.
 * Never emits HTML; tags are removed, not parsed for execution.
 */
export function scrubPlainText(raw: string): ScrubPlainTextResult {
  const strippedTags = (raw.match(HTML_TAG) ?? []).length;
  let text = raw.replace(HTML_TAG, '');

  const beforeControl = text.length;
  text = text.replace(CONTROL_CHARS, '');
  const removedControlChars = beforeControl - text.length;

  const beforeFormat = text.length;
  text = text.replace(FORMAT_AND_ZERO_WIDTH, '');
  const removedFormatChars = beforeFormat - text.length;

  return {
    text,
    removedControlChars,
    removedFormatChars,
    strippedHtmlTags: strippedTags,
  };
}

/**
 * Normalise in-container extracts for host export: UTF-8 decode, scrub, NFC, size cap.
 */
export function normalizeExportedPlainText(
  rawBytes: Buffer,
  maxBytes = PLAIN_TEXT_EXPORT_MAX_BYTES,
): NormalizePlainTextResult {
  let utf8 = rawBytes.toString('utf8');
  if (utf8.includes('\uFFFD') && rawBytes.length > 0) {
    utf8 = rawBytes.toString('latin1');
  }

  const scrubbed = scrubPlainText(utf8);
  let text = scrubbed.text.normalize('NFC');

  const encoder = new TextEncoder();
  let encoded = encoder.encode(text);
  let truncated = false;
  if (encoded.length > maxBytes) {
    truncated = true;
    encoded = encoded.slice(0, maxBytes);
    text = new TextDecoder('utf-8', { fatal: false }).decode(encoded);
    text = text.replace(/\uFFFD+$/u, '').trimEnd();
  }

  return {
    ...scrubbed,
    text,
    truncated,
    byteLength: encoder.encode(text).length,
  };
}

export const CLIPBOARD_SCRUB_NOTICE =
  'Sanitised copy is plain text only—control characters, zero-width code points, and HTML tags are removed. This is best-effort; paste untrusted content with care.';

export const FLATTENED_PDF_EXPORT_NOTICE =
  'Flattened export is a best-effort pixel rebuild (pdftoppm → img2pdf). Active content and hidden layers may not match the source; verify visually before relying on the file outside Airlock.';

export const PLAIN_TEXT_EXPORT_NOTICE =
  'Plain-text export is extracted inside the sandbox and scrubbed on the host (controls, bidi overrides, and zero-width code points removed). Layout, images, and macros are not preserved—review the output before reuse.';
