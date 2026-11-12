import type {
  StaticTriageReport,
  TriageRawOutput,
  TriageRiskLevel,
  TriageYaraHit,
} from './types.js';
import { TRIAGE_NO_INDICATORS_MESSAGE } from './types.js';

const HIGH_YARA_RULES = new Set([
  'airlock_pdf_javascript',
  'airlock_pdf_launch_action',
  'airlock_office_autoexec_macro',
  'airlock_office_vba_shell',
  'airlock_embedded_pe',
  'airlock_eicar_test_string',
]);

const MEDIUM_YARA_RULES = new Set([
  'airlock_pdf_open_action',
  'airlock_office_macro_present',
  'airlock_suspicious_uri',
  'airlock_html_js_scheme',
  'airlock_office_dde',
]);

function yaraSeverity(hit: TriageYaraHit): 'high' | 'medium' | 'low' | 'info' {
  if (hit.severity) {
    return hit.severity === 'high'
      ? 'high'
      : hit.severity === 'medium'
        ? 'medium'
        : hit.severity === 'low'
          ? 'low'
          : 'info';
  }
  if (HIGH_YARA_RULES.has(hit.rule)) {
    return 'high';
  }
  if (MEDIUM_YARA_RULES.has(hit.rule)) {
    return 'medium';
  }
  return 'low';
}

/**
 * Deterministic risk level from structured findings (never from an LLM).
 * Documented precedence: high → medium → low → none.
 */
function xraySeverity(
  xray?: StaticTriageReport['findings']['xray'],
): 'high' | 'medium' | 'low' | 'none' {
  if (!xray) {
    return 'none';
  }
  const urlFlags = xray.urls.flatMap((u) => u.flags);
  if (urlFlags.includes('href_display_mismatch')) {
    return 'high';
  }
  if (urlFlags.some((f) => ['punycode', 'homoglyph', 'ip_literal', 'url_shortener'].includes(f))) {
    return 'medium';
  }
  if (xray.qrCodes.length > 0 && xray.urls.some((u) => u.flags.length > 0)) {
    return 'medium';
  }
  if (
    xray.hiddenText.some((h) =>
      ['white_on_white', 'vanish', 'off_page', 'tiny_font'].includes(h.kind),
    )
  ) {
    return 'medium';
  }
  if (xray.invisibleUnicode.length > 0) {
    return 'medium';
  }
  if (xray.hiddenText.length > 0 || xray.qrCodes.length > 0) {
    return 'low';
  }
  return 'none';
}

export function deriveTriageRiskLevel(input: {
  magicMatchesExtension: boolean;
  yara: TriageYaraHit[];
  pdf?: StaticTriageReport['findings']['pdf'];
  office?: StaticTriageReport['findings']['office'];
  xray?: StaticTriageReport['findings']['xray'];
  indicators: string[];
}): TriageRiskLevel {
  const yaraHigh = input.yara.some((h) => yaraSeverity(h) === 'high');
  const yaraMedium = input.yara.some((h) => yaraSeverity(h) === 'medium');

  if (yaraHigh) {
    return 'high';
  }

  if (
    input.pdf?.javascript &&
    (input.pdf.launch || input.pdf.openAction || input.pdf.embeddedFileCount > 0)
  ) {
    return 'high';
  }

  if (input.office?.autoExecKeywords.length) {
    return 'high';
  }

  if (!input.magicMatchesExtension) {
    return 'high';
  }

  const xrayLevel = xraySeverity(input.xray);
  if (xrayLevel === 'high') {
    return 'high';
  }

  if (yaraMedium || input.pdf?.javascript || input.pdf?.launch || xrayLevel === 'medium') {
    return 'medium';
  }

  if (input.office?.macrosPresent || input.pdf?.openAction) {
    return 'medium';
  }

  if (input.indicators.length > 0 || input.yara.length > 0 || xrayLevel === 'low') {
    return 'low';
  }

  return 'none';
}

export function deriveTriageStatusMessage(
  riskLevel: TriageRiskLevel,
  indicators: string[],
): string {
  if (riskLevel === 'none' && indicators.length === 0) {
    return TRIAGE_NO_INDICATORS_MESSAGE;
  }
  if (indicators.length === 0) {
    return 'Static checks completed with inconclusive metadata only.';
  }
  return `Static checks flagged ${indicators.length} indicator(s). Isolation remains the primary control.`;
}

export function extensionExpectsMime(ext: string, mime: string): boolean {
  const normalized = ext.toLowerCase().replace(/^\./, '');
  const map: Record<string, string[]> = {
    pdf: ['application/pdf'],
    doc: ['application/msword'],
    docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    xls: ['application/vnd.ms-excel'],
    xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ppt: ['application/vnd.ms-powerpoint'],
    pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    htm: ['text/html'],
    html: ['text/html'],
    txt: ['text/plain'],
    png: ['image/png'],
    jpg: ['image/jpeg'],
    jpeg: ['image/jpeg'],
    gif: ['image/gif'],
    zip: ['application/zip'],
  };
  const expected = map[normalized];
  if (!expected) {
    return true;
  }
  return expected.some((m) => mime.startsWith(m) || mime === m);
}

export function collectIndicators(raw: TriageRawOutput): string[] {
  const indicators: string[] = [];

  if (!extensionExpectsMime(raw.declaredExtension, raw.detectedMime)) {
    indicators.push(
      `Declared extension ".${raw.declaredExtension.replace(/^\./, '')}" does not match detected MIME ${raw.detectedMime}`,
    );
  }

  for (const hit of raw.yara ?? []) {
    indicators.push(`YARA: ${hit.rule}`);
  }

  if (raw.pdf?.javascript) {
    indicators.push('PDF contains /JavaScript');
  }
  if (raw.pdf?.launch) {
    indicators.push('PDF contains /Launch action');
  }
  if (raw.pdf?.open_action) {
    indicators.push('PDF contains /OpenAction');
  }
  if (raw.pdf?.embedded_files && raw.pdf.embedded_files > 0) {
    indicators.push(`PDF lists ${raw.pdf.embedded_files} embedded file reference(s)`);
  }

  if (raw.office?.macros) {
    indicators.push('Office document contains VBA macros');
  }
  for (const kw of raw.office?.auto_exec ?? []) {
    indicators.push(`Macro auto-exec keyword: ${kw}`);
  }

  for (const item of raw.xray?.hidden_text ?? []) {
    indicators.push(`Hidden content (${item.kind}): ${item.detail.slice(0, 120)}`);
  }
  for (const u of raw.xray?.invisible_unicode ?? []) {
    indicators.push(`Invisible Unicode: ${u.codepoint} (×${u.count})`);
  }
  for (const qr of raw.xray?.qr_codes ?? []) {
    indicators.push(`QR decoded: ${qr.payload.slice(0, 80)}`);
  }
  for (const url of raw.xray?.urls ?? []) {
    if (url.flags.length > 0) {
      indicators.push(`URL ${url.url.slice(0, 80)} [${url.flags.join(', ')}]`);
    }
  }

  return indicators;
}
