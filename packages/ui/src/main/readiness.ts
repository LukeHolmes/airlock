import {
  engineRuntimeAllowsSessions,
  getSandboxImageCandidates,
  isSandboxImageAvailable,
  LOCAL_SANDBOX_IMAGE,
  refreshEngineRuntime,
} from '@airlock/core';
import { getSandboxBuildContextPath, hasPackagedSandboxContext } from './sandboxContext.js';

export type AirlockReadiness = {
  docker: { available: boolean };
  containerEngine: {
    connected: boolean;
    kind: string;
    displayName: string;
    endpoint: string;
    hardeningSupported: boolean;
    hardeningRefusalReason?: string;
  };
  sandboxImage: { available: boolean; image: string };
  canStartSession: boolean;
  setupRequired: boolean;
  pullCandidates: string[];
  buildContext: {
    available: boolean;
    packaged: boolean;
  };
};

export async function getReadiness(): Promise<AirlockReadiness> {
  return buildReadiness();
}

export async function refreshReadiness(): Promise<AirlockReadiness> {
  return buildReadiness(true);
}

async function buildReadiness(force = false): Promise<AirlockReadiness> {
  const engine = await refreshEngineRuntime({ force });
  const engineAllows = engineRuntimeAllowsSessions(engine);
  const dockerAvailable = engine.connected && engineAllows;
  const sandboxAvailable = dockerAvailable ? await isSandboxImageAvailable() : false;
  const buildContextPath = getSandboxBuildContextPath();

  const hardeningRefusal = engine.hardening.supported
    ? undefined
    : engine.hardening.reasons.join(' ');

  return {
    docker: { available: dockerAvailable },
    containerEngine: {
      connected: engine.connected,
      kind: engine.kind,
      displayName: engine.displayName,
      endpoint: engine.endpoint,
      hardeningSupported: engine.hardening.supported,
      hardeningRefusalReason: hardeningRefusal,
    },
    sandboxImage: { available: sandboxAvailable, image: LOCAL_SANDBOX_IMAGE },
    canStartSession: dockerAvailable && sandboxAvailable,
    setupRequired: engine.connected && engineAllows && !sandboxAvailable,
    pullCandidates: engineAllows ? getSandboxImageCandidates() : [],
    buildContext: {
      available: buildContextPath !== null,
      packaged: hasPackagedSandboxContext(),
    },
  };
}
