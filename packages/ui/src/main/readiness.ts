import {
  getSandboxImageCandidates,
  isSandboxImageAvailable,
  LOCAL_SANDBOX_IMAGE,
} from '@airlock/core';
import { isDockerAvailable, refreshDockerAvailability } from './dockerCheck.js';
import { getSandboxBuildContextPath, hasPackagedSandboxContext } from './sandboxContext.js';

export type AirlockReadiness = {
  docker: { available: boolean };
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
  return buildReadiness();
}

async function buildReadiness(): Promise<AirlockReadiness> {
  refreshDockerAvailability();
  const dockerAvailable = isDockerAvailable();
  const sandboxAvailable = dockerAvailable ? await isSandboxImageAvailable() : false;
  const buildContextPath = getSandboxBuildContextPath();

  return {
    docker: { available: dockerAvailable },
    sandboxImage: { available: sandboxAvailable, image: LOCAL_SANDBOX_IMAGE },
    canStartSession: dockerAvailable && sandboxAvailable,
    setupRequired: dockerAvailable && !sandboxAvailable,
    pullCandidates: dockerAvailable ? getSandboxImageCandidates() : [],
    buildContext: {
      available: buildContextPath !== null,
      packaged: hasPackagedSandboxContext(),
    },
  };
}
