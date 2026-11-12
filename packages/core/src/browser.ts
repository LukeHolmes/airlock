/**
 * @airlock/core/browser — renderer-safe surface (no Node.js, dockerode, or fs).
 *
 * Import only from this entry in the Electron renderer / Vite bundle.
 */

export { isAllowedVncEmbedUrl } from './validation/vncEmbedUrl.js';

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
  TRIAGE_SCHEMA_VERSION,
  TRIAGE_NO_INDICATORS_MESSAGE,
  type StaticTriageReport,
  type TriageRiskLevel,
  type TriageXrayFinding,
} from './triage/types.js';

export type { TriageSessionState } from './triage/triageStore.js';

export { RECEIPT_INTEGRITY_NOTICE } from './receipt/types.js';
