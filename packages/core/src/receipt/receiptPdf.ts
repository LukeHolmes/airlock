import type { SignedInspectionReceipt } from './types.js';

/** Escape text for PDF literal strings (deterministic, ASCII-safe subset). */
function pdfEscape(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/[^\t\n\r -~]/g, '?');
}

function wrapLines(text: string, maxLen: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let rest = paragraph.trim();
    while (rest.length > maxLen) {
      let cut = rest.lastIndexOf(' ', maxLen);
      if (cut < 20) {
        cut = maxLen;
      }
      lines.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest.length > 0) {
      lines.push(rest);
    }
  }
  if (lines.length === 0) {
    lines.push('');
  }
  return lines;
}

/**
 * One-page, deterministic PDF summary (authoritative data remains JSON).
 */
export function renderInspectionReceiptPdf(receipt: SignedInspectionReceipt): Buffer {
  const p = receipt.payload;
  const bodyLines = [
    'Airlock inspection receipt (human-readable summary)',
    '',
    receipt.integrityNotice,
    '',
    `App version: ${p.appVersion}`,
    `Receipt schema: ${p.schemaVersion}`,
    `Sandbox image: ${p.sandboxImage.ref}`,
    `Image digest: ${p.sandboxImage.digest}`,
    `YARA rules SHA-256: ${p.inspectionToolchain.yaraRulesSha256}`,
    `Input: ${p.input.fileName} (${p.input.sizeBytes} bytes)`,
    `Input SHA-256: ${p.input.sha256}`,
    `Risk level (static): ${p.riskLevel}`,
    `Session: ${p.session.sessionId}`,
    `Started (UTC): ${p.session.startedAt}`,
    `Ended (UTC): ${p.session.endedAt}`,
    `Public key fingerprint: ${p.signingKey.publicKeyFingerprint}`,
    `Indicators: ${p.staticTriage.indicators.join('; ') || 'none'}`,
    '',
    p.reserved.note,
    '',
    `Signature (base64, truncated): ${receipt.signature.slice(0, 48)}...`,
  ];

  const lines = wrapLines(bodyLines.join('\n'), 92);
  const leading = 14;
  const startY = 780;
  let stream = 'BT\n/F1 10 Tf\n';
  let y = startY;
  for (const line of lines.slice(0, 52)) {
    stream += `1 0 0 1 48 ${y} Tm (${pdfEscape(line)}) Tj\n`;
    y -= leading;
    if (y < 72) {
      break;
    }
  }
  stream += 'ET';

  const objects: string[] = [];
  objects.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj');
  objects.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj');
  objects.push(
    `3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>endobj`,
  );
  objects.push('4 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>endobj');
  objects.push(
    `5 0 obj<< /Length ${Buffer.byteLength(stream, 'utf8')} >>stream\n${stream}\nendstream\nendobj`,
  );

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${obj}\n`;
  }
  const xrefStart = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}
