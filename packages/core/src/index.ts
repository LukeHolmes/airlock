/**
 * @airlock/core — Orchestrator entry point
 *
 * Node.js + dockerode lifecycle management for Airlock.
 */

export * as docker from './docker/index.js';

export { log, type LogLevel, type DebugLogContext, type DebugPhase } from './debug/logger.js';

export {
  executeAirlockSession,
  destroyAirlockSession,
  logEvent,
  getSessionArtefacts,
  analyzeSession,
  prepareSessionExport,
  prepareInspectionReceipt,
  serializeSessionExport,
  formatSessionExportJson,
  SESSION_EXPORT_SCHEMA_VERSION,
} from './session/index.js';

export {
  verifyReceiptJson,
  verifySignedInspectionReceipt,
  RECEIPT_INTEGRITY_NOTICE,
  exportPublicKeyPem,
  exportPublicKeyDocument,
  renderInspectionReceiptPdf,
  PLAINTEXT_KEY_WARNING,
  loadOrCreateReceiptKey,
  type KeyProtector,
  type ReceiptKeyProtectionLevel,
  type ReceiptSigningKeyMaterial,
  type SignedInspectionReceipt,
  type VerifyReceiptResult,
} from './receipt/index.js';

export {
  LOCAL_SANDBOX_IMAGE,
  SANDBOX_IMAGE,
  isSandboxImageAvailable,
  getSandboxImageStatus,
} from './docker/imageCheck.js';

export {
  SANDBOX_BUILD_FILES,
  SandboxSetupError,
  configureSandboxImage,
  ensureSandboxImageReady,
  getGhcrSandboxImageRef,
  getSandboxImageCandidates,
  getSandboxImageConfig,
  isBundledBuildContext,
  isSandboxBuildContext,
  resolveSandboxContextFromCandidates,
  type EnsureSandboxImageOptions,
  type EnsureSandboxImageResult,
  type SandboxImageConfig,
  type SandboxSetupErrorCode,
  type SandboxSetupProgress,
} from './docker/sandboxImage.js';

export {
  deriveFirstRunStages,
  mapProgressPhaseToStageId,
  parseSandboxSetupFailure,
  shouldAppendProgressDetail,
  userMessageForSandboxSetupError,
  type FirstRunStage,
  type FirstRunStageId,
  type FirstRunStageState,
  type SandboxSetupFailure,
} from './docker/sandboxSetupUi.js';

export {
  MAX_DROP_FILE_BYTES,
  validateDrop,
  isAllowedVncEmbedUrl,
  type DropValidationErrorCode,
  type DropValidationResult,
} from './validation/index.js';

export {
  getSessionTriage,
  TRIAGE_SCHEMA_VERSION,
  TRIAGE_NO_INDICATORS_MESSAGE,
  type StaticTriageReport,
  type SessionTriageSnapshot,
  type TriageSessionState,
} from './triage/index.js';

export {
  scrubPlainText,
  normalizeExportedPlainText,
  CLIPBOARD_SCRUB_NOTICE,
  FLATTENED_PDF_EXPORT_NOTICE,
  PLAIN_TEXT_EXPORT_NOTICE,
  PLAIN_TEXT_EXPORT_MAX_BYTES,
  type ScrubPlainTextResult,
  type NormalizePlainTextResult,
} from './export/scrubPlainText.js';
export {
  flattenPdfInContainer,
  containerTargetPathForHostFile,
  assertFlattenedPdfBytes,
} from './export/flattenedPdf.js';
export {
  extractPlainTextInContainer,
  isPlainTextExportSupported,
  EXTRACT_SCRIPT_PATH,
  type PlainTextExtractResult,
} from './export/plainTextExport.js';
export { readGuestPlainClipboard } from './export/guestClipboard.js';

export type {
  AirlockInput,
  AirlockSession,
  AirlockSessionStatus,
  NetworkMode,
  SessionArtefacts,
  SessionAnalysisResult,
  LightweightAnalysis,
  SessionExportDocument,
  PreparedSessionExport,
} from './session/index.js';
