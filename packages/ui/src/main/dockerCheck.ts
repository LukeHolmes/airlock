import { docker } from '@airlock/core';

const DOCKER_DOWNLOAD_URL = 'https://www.docker.com/products/docker-desktop/';

let dockerAvailable: boolean | null = null;

export function isDockerAvailable(): boolean {
  if (dockerAvailable !== null) {
    return dockerAvailable;
  }

  try {
    docker.detectRuntimeSocket();
    dockerAvailable = true;
  } catch {
    dockerAvailable = false;
  }

  return dockerAvailable;
}

export function refreshDockerAvailability(): boolean {
  dockerAvailable = null;
  return isDockerAvailable();
}

export { DOCKER_DOWNLOAD_URL };
