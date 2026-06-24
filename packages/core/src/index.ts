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
} from './session/index.js';

export type { AirlockInput, AirlockSession, AirlockSessionStatus } from './session/index.js';
