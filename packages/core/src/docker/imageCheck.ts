import Dockerode from 'dockerode';

export const SANDBOX_IMAGE = 'airlock/sandbox:latest';

let dockerClient: Dockerode | undefined;

function getDocker(): Dockerode {
  if (!dockerClient) {
    dockerClient = new Dockerode();
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
