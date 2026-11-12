/** Static nutrition-label triage — document schema v1. */
export const TRIAGE_SCHEMA_VERSION = 1;

export type TriageRiskLevel = 'none' | 'low' | 'medium' | 'high';

/** Exact copy when no rule-based indicators fire (v0.5 UI contract). */
export const TRIAGE_NO_INDICATORS_MESSAGE =
  'No known risk indicators found (static checks)';

export type TriageYaraHit = {
  rule: string;
  namespace?: string;
  tags?: string[];
  severity?: 'info' | 'low' | 'medium' | 'high';
};

export type TriagePdfFinding = {
  javascript: boolean;
  openAction: boolean;
  launch: boolean;
  embeddedFileCount: number;
  suspiciousKeywords: string[];
};

export type TriageOfficeFinding = {
  format: string;
  macrosPresent: boolean;
  autoExecKeywords: string[];
  oleRiskFlags: string[];
  vbaHits: string[];
};

export type StaticTriageReport = {
  schemaVersion: 1;
  completedAt: string;
  durationMs: number;
  input: {
    fileName: string;
    sizeBytes: number;
    sha256: string;
    declaredExtension: string;
    detectedMime: string;
    magicMatchesExtension: boolean;
  };
  findings: {
    exifFieldCount: number;
    exifHighlights: string[];
    pdf?: TriagePdfFinding;
    office?: TriageOfficeFinding;
    yara: TriageYaraHit[];
  };
  indicators: string[];
  riskLevel: TriageRiskLevel;
  statusMessage: string;
  toolErrors: string[];
};

/** Raw JSON emitted by `airlock-triage` inside the sandbox (pre-normalisation). */
export type TriageRawOutput = {
  version: number;
  filePath: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  detectedMime: string;
  declaredExtension: string;
  exiftool?: unknown;
  yara?: Array<{
    rule: string;
    namespace?: string;
    tags?: string[];
  }>;
  pdf?: {
    javascript?: boolean;
    open_action?: boolean;
    launch?: boolean;
    embedded_files?: number;
    keywords?: string[];
  };
  office?: {
    format?: string;
    macros?: boolean;
    auto_exec?: string[];
    ole_flags?: string[];
    vba_hits?: string[];
  };
  errors?: string[];
};
