import { isSandboxImageAvailable, SANDBOX_IMAGE } from '@airlock/core';
import { isDockerAvailable, refreshDockerAvailability } from './dockerCheck.js';

export type AirlockReadiness = {
  docker: { available: boolean };
  sandboxImage: { available: boolean; image: string };
  canStartSession: boolean;
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

  return {
    docker: { available: dockerAvailable },
    sandboxImage: { available: sandboxAvailable, image: SANDBOX_IMAGE },
    canStartSession: dockerAvailable && sandboxAvailable,
  };
}
