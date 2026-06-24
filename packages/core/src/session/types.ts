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
  };
};
