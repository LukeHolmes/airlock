import Dockerode from 'dockerode';

export type DockerEngineConnection = {
  /** Human label for logs/UI */
  label: string;
  /** `unix://` or tcp/docker host string */
  host?: string;
  socketPath?: string;
};

let activeConnection: DockerEngineConnection | null = null;
let cachedClient: Dockerode | undefined;

function buildDockerodeOptions(
  connection: DockerEngineConnection,
): ConstructorParameters<typeof Dockerode>[0] {
  if (connection.host) {
    const host = connection.host;
    if (host.startsWith('unix://')) {
      return { socketPath: host.slice('unix://'.length) };
    }
    return { host };
  }
  if (connection.socketPath) {
    return { socketPath: connection.socketPath };
  }
  return {};
}

export function getActiveEngineConnection(): DockerEngineConnection | null {
  return activeConnection;
}

export function setActiveEngineConnection(connection: DockerEngineConnection | null): void {
  activeConnection = connection;
  cachedClient = undefined;
}

export function createDockerClient(connection?: DockerEngineConnection | null): Dockerode {
  const resolved = connection ?? activeConnection;
  if (!resolved) {
    return new Dockerode();
  }
  return new Dockerode(buildDockerodeOptions(resolved));
}

/** Shared client for the active engine (lazy, reset when connection changes). */
export function getSharedDockerClient(): Dockerode {
  if (!cachedClient) {
    cachedClient = createDockerClient();
  }
  return cachedClient;
}
