/**
 * Airlock IPC Channel Definitions
 *
 * Shared between main process, preload, and renderer.
 * Canonical session contract aligned with @airlock/core session types.
 */

// Session lifecycle channels
export const IPC_CHANNELS = {
  SESSION_CREATE: 'airlock:session:create',
  SESSION_DESTROY: 'airlock:session:destroy',
  SESSION_ANALYZE: 'airlock:session:analyze',

  // Session events (main → renderer)
  SESSION_STARTED: 'airlock:session:started',
  SESSION_ENDED: 'airlock:session:ended',
  SESSION_ERROR: 'airlock:session:error',

  // System
  INSTALL_CRASH_TRAP: 'airlock:system:install-crash-trap',
  GET_VERSION: 'airlock:system:get-version',
  GET_READINESS: 'airlock:system:get-readiness',
} as const;

// Type-safe channel names
type IpcChannels = typeof IPC_CHANNELS;
export type IpcChannel = IpcChannels[keyof IpcChannels];

// Canonical session contract (mirrors @airlock/core session/types)

export type NetworkMode = 'isolated' | 'enabled';

export type AirlockInput =
  | {
      type: 'file';
      filePath: string;
      mimeType?: string;
      networkMode?: NetworkMode;
    }
  | {
      type: 'url';
      url: string;
      networkMode?: NetworkMode;
    };

export type AirlockSessionStatus = 'starting' | 'running' | 'error' | 'destroyed';

export type AirlockSession = {
  sessionId: string;
  containerId: string;
  status: AirlockSessionStatus;
  vncUrl?: string;
  metadata: {
    startTime: number;
    endTime?: number;
    exitReason?: 'user_destroy' | 'crash' | 'error';
    inputType: 'file' | 'url';
    networkMode: NetworkMode;
  };
};

export type SessionAnalysisResult = {
  sessionId: string;
  analysis: {
    summary: string;
    riskLevel: 'low' | 'medium' | 'high';
    observations: string[];
    signals: string[];
    recommendation: string;
  };
};

export type AirlockReadiness = {
  docker: { available: boolean };
  sandboxImage: { available: boolean; image: string };
  canStartSession: boolean;
};

export interface SessionStartedEvent {
  session: AirlockSession;
}

export interface SessionEndedEvent {
  session: AirlockSession;
}

export interface SessionErrorEvent {
  session: AirlockSession;
  error: string;
}

// IPC API interface (exposed to renderer via preload)

export interface AirlockIpcApi {
  createSession(input: AirlockInput): Promise<AirlockSession>;
  destroySession(session: AirlockSession): Promise<AirlockSession>;
  analyzeSession(sessionId: string): Promise<SessionAnalysisResult>;

  onSessionStarted(callback: (event: SessionStartedEvent) => void): () => void;
  onSessionEnded(callback: (event: SessionEndedEvent) => void): () => void;
  onSessionError(callback: (event: SessionErrorEvent) => void): () => void;

  installCrashTrap(): Promise<void>;
  getVersion(): Promise<string>;
  getReadiness(): Promise<AirlockReadiness>;
  getPathForFile(file: File): string;
  onOpenFile(callback: (filePath: string) => void): () => void;
}

declare global {
  interface Window {
    airlock?: AirlockIpcApi;
  }
}
