/**
 * @airlock/core — Orchestrator entry point
 *
 * Node.js + dockerode lifecycle management for Airlock.
 */

export * as docker from './docker/index.js';

export {
  executeAirlockSession,
  destroyAirlockSession,
  logEvent,
  getSessionArtefacts,
  analyzeSession,
} from './session/index.js';

export {
  SANDBOX_IMAGE,
  isSandboxImageAvailable,
  getSandboxImageStatus,
} from './docker/imageCheck.js';

export type {
  AirlockInput,
  AirlockSession,
  AirlockSessionStatus,
  NetworkMode,
  SessionArtefacts,
  SessionAnalysisResult,
  LightweightAnalysis,
} from './session/index.js';
