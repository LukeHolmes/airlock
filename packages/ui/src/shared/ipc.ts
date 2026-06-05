/**
 * Airlock IPC Channel Definitions
 *
 * Shared between main process, preload, and renderer.
 * Provides type-safe IPC for UI ↔ ContainerManager communication.
 */

// Container lifecycle channels
export const IPC_CHANNELS = {
  // Lifecycle
  CONTAINER_CREATE: 'airlock:container:create',
  CONTAINER_CREATE_URL: 'airlock:container:create-url',
  CONTAINER_DESTROY: 'airlock:container:destroy',
  CONTAINER_KILL: 'airlock:container:kill',
  CONTAINER_LIST: 'airlock:container:list',
  CONTAINER_STATUS: 'airlock:container:status',

  // Session events (main → renderer)
  SESSION_STARTED: 'airlock:session:started',
  SESSION_ENDED: 'airlock:session:ended',
  SESSION_ERROR: 'airlock:session:error',

  // System
  INSTALL_CRASH_TRAP: 'airlock:system:install-crash-trap',
  GET_VERSION: 'airlock:system:get-version',
} as const;

// Type-safe channel names
type IpcChannels = typeof IPC_CHANNELS;
export type IpcChannel = IpcChannels[keyof IpcChannels];

// Request/Response types

export interface CreateFileContainerRequest {
  filePath: string;
  name?: string;
  debug?: boolean;
}

export interface CreateUrlContainerRequest {
  url: string;
  name?: string;
  debug?: boolean;
}

export interface ContainerSession {
  id: string;
  name: string;
  createdAt: string;
  config: {
    image: string;
    cmd: string[];
  };
}

export interface ContainerStatus {
  id: string;
  running: boolean;
}

export interface SessionStartedEvent {
  session: ContainerSession;
  vncUrl?: string;
}

export interface SessionEndedEvent {
  sessionId: string;
  reason: 'destroyed' | 'crashed' | 'error';
}

export interface SessionErrorEvent {
  sessionId: string;
  error: string;
}

// IPC API interface (exposed to renderer via preload)

export interface AirlockIpcApi {
  // Container lifecycle
  createFileContainer(request: CreateFileContainerRequest): Promise<ContainerSession>;
  createUrlContainer(request: CreateUrlContainerRequest): Promise<ContainerSession>;
  destroyContainer(sessionId: string): Promise<void>;
  killContainer(sessionId: string): Promise<void>;
  listContainers(): Promise<ContainerSession[]>;
  getContainerStatus(sessionId: string): Promise<ContainerStatus>;

  // Session events (subscribe via callbacks)
  onSessionStarted(callback: (event: SessionStartedEvent) => void): () => void;
  onSessionEnded(callback: (event: SessionEndedEvent) => void): () => void;
  onSessionError(callback: (event: SessionErrorEvent) => void): () => void;

  // System
  installCrashTrap(): Promise<void>;
  getVersion(): Promise<string>;
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    airlock?: AirlockIpcApi;
  }
}
