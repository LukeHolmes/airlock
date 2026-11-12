import {
  collectIndicators,
  deriveTriageRiskLevel,
  deriveTriageStatusMessage,
  extensionExpectsMime,
} from './riskRules.js';
import type { StaticTriageReport, TriageRawOutput, TriageYaraHit } from './types.js';
import { TRIAGE_SCHEMA_VERSION } from './types.js';

function exifHighlights(exiftool: unknown): { count: number; highlights: string[] } {
  if (!exiftool || typeof exiftool !== 'object') {
    return { count: 0, highlights: [] };
  }
  const rows = Array.isArray(exiftool) ? exiftool : [exiftool];
  const first = rows[0];
  if (!first || typeof first !== 'object') {
    return { count: 0, highlights: [] };
  }
  const record = first as Record<string, unknown>;
  const keys = Object.keys(record);
  const highlights: string[] = [];
  for (const key of ['MIMEType', 'FileType', 'Title', 'Author', 'Creator', 'Producer']) {
    const value = record[key];
    if (typeof value === 'string' && value.length > 0) {
      highlights.push(`${key}: ${value.slice(0, 120)}`);
    }
  }
  return { count: keys.length, highlights };
}

function mapYara(raw: TriageRawOutput): TriageYaraHit[] {
  return (raw.yara ?? []).map((hit) => ({
    rule: hit.rule,
    namespace: hit.namespace,
    tags: hit.tags,
  }));
}

/**
 * Map sandbox tool output to the versioned nutrition-label schema.
 */
export function buildStaticTriageReport(
  raw: TriageRawOutput,
  options?: { durationMs?: number; completedAt?: string },
): StaticTriageReport {
  const completedAt = options?.completedAt ?? new Date().toISOString();
  const durationMs = options?.durationMs ?? 0;
  const magicMatchesExtension = extensionExpectsMime(raw.declaredExtension, raw.detectedMime);
  const yara = mapYara(raw);
  const exif = exifHighlights(raw.exiftool);
  const indicators = collectIndicators(raw);

  const pdf =
    raw.pdf &&
    (raw.pdf.javascript ||
      raw.pdf.open_action ||
      raw.pdf.launch ||
      (raw.pdf.embedded_files ?? 0) > 0)
      ? {
          javascript: Boolean(raw.pdf.javascript),
          openAction: Boolean(raw.pdf.open_action),
          launch: Boolean(raw.pdf.launch),
          embeddedFileCount: raw.pdf.embedded_files ?? 0,
          suspiciousKeywords: raw.pdf.keywords ?? [],
        }
      : undefined;

  const office =
    raw.office &&
    (raw.office.macros ||
      (raw.office.auto_exec?.length ?? 0) > 0 ||
      (raw.office.ole_flags?.length ?? 0) > 0)
      ? {
          format: raw.office.format ?? 'unknown',
          macrosPresent: Boolean(raw.office.macros),
          autoExecKeywords: raw.office.auto_exec ?? [],
          oleRiskFlags: raw.office.ole_flags ?? [],
          vbaHits: raw.office.vba_hits ?? [],
        }
      : undefined;

  const riskLevel = deriveTriageRiskLevel({
    magicMatchesExtension,
    yara,
    pdf,
    office,
    indicators,
  });

  const statusMessage = deriveTriageStatusMessage(riskLevel, indicators);

  return {
    schemaVersion: TRIAGE_SCHEMA_VERSION,
    completedAt,
    durationMs,
    input: {
      fileName: raw.fileName,
      sizeBytes: raw.sizeBytes,
      sha256: raw.sha256,
      declaredExtension: raw.declaredExtension,
      detectedMime: raw.detectedMime,
      magicMatchesExtension,
    },
    findings: {
      exifFieldCount: exif.count,
      exifHighlights: exif.highlights,
      pdf,
      office,
      yara,
    },
    indicators,
    riskLevel,
    statusMessage,
    toolErrors: raw.errors ?? [],
  };
}
