import { execSync } from 'node:child_process';

const DOCKER_DOWNLOAD_URL = 'https://www.docker.com/products/docker-desktop/';

let dockerAvailable: boolean | null = null;

export function isDockerAvailable(): boolean {
  if (dockerAvailable !== null) {
    return dockerAvailable;
  }

  try {
    execSync('docker info', { stdio: 'ignore', timeout: 5000 });
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
