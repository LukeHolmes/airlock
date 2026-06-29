import Dockerode from 'dockerode';

import { detectRuntimeSocket } from './runtime.js';

/** Local alias used by ContainerManager after provisioning. */
export const LOCAL_SANDBOX_IMAGE = 'airlock/sandbox:latest';

/** @deprecated Use LOCAL_SANDBOX_IMAGE — kept for backward compatibility. */
export const SANDBOX_IMAGE = LOCAL_SANDBOX_IMAGE;

let dockerClient: Dockerode | undefined;

function getDocker(): Dockerode {
  if (!dockerClient) {
    const { socketPath } = detectRuntimeSocket();
    dockerClient = new Dockerode({ socketPath });
  }
  return dockerClient;
}

export async function isSandboxImageAvailable(
  image: string = SANDBOX_IMAGE,
): Promise<boolean> {
  try {
    const docker = getDocker();
    await docker.getImage(image).inspect();
    return true;
  } catch {
    return false;
  }
}

export async function getSandboxImageStatus(
  image: string = SANDBOX_IMAGE,
): Promise<{ available: boolean; image: string }> {
  const available = await isSandboxImageAvailable(image);
  return { available, image };
}
