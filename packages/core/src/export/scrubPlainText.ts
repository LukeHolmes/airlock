/** Strip format characters and C0/C1 controls (keep TAB, LF, CR). */
const FORMAT_AND_ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF\u00AD\u180E]/g;

/** C0/C1 controls except tab, newline, carriage return. */
// eslint-disable-next-line no-control-regex -- intentional stripping of control bytes
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

const HTML_TAG = /<[^>]*>/g;

export type ScrubPlainTextResult = {
  text: string;
  removedControlChars: number;
  removedFormatChars: number;
  strippedHtmlTags: number;
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

export const CLIPBOARD_SCRUB_NOTICE =
  'Sanitised copy is plain text only—control characters, zero-width code points, and HTML tags are removed. This is best-effort; paste untrusted content with care.';

export const FLATTENED_PDF_EXPORT_NOTICE =
  'Flattened export is a best-effort pixel rebuild (pdftoppm → img2pdf). Active content and hidden layers may not match the source; verify visually before relying on the file outside Airlock.';
