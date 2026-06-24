import { randomUUID } from 'node:crypto';
import fs from 'node:fs';

import { createFileContainer, createUrlContainer, destroyContainer } from '../docker/index.js';
import { logEvent } from './logger.js';
import type { AirlockInput, AirlockSession, NetworkMode } from './types.js';

function resolveNetworkMode(input: AirlockInput): NetworkMode {
  return input.networkMode ?? 'isolated';
}

function errorSession(sessionId: string, startTime: number): AirlockSession {
  return {
    sessionId,
    containerId: '',
    status: 'error',
    metadata: {
      startTime,
      endTime: Date.now(),
      exitReason: 'error',
    },
  };
}

function validateInput(input: AirlockInput, networkMode: NetworkMode): string | null {
  if (input.type === 'url') {
    if (networkMode !== 'enabled') {
      return 'URL sessions require network access';
    }

    if (!input.url || input.url.trim().length === 0) {
      return 'url is required';
    }

    try {
      const urlObj = new URL(input.url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return `Invalid URL protocol: ${urlObj.protocol}`;
      }
    } catch {
      return 'Invalid URL';
    }

    return null;
  }

  if (!input.filePath || input.filePath.trim().length === 0) {
    return 'filePath is required';
  }

  if (!fs.existsSync(input.filePath)) {
    return `File not found: ${input.filePath}`;
  }

  return null;
}

/**
 * Execute a session through the existing ContainerManager path.
 * Wraps createFileContainer / createUrlContainer — does not alter container security.
 */
export async function executeAirlockSession(input: AirlockInput): Promise<AirlockSession> {
  const startTime = Date.now();
  const sessionId = randomUUID();
  const networkMode = resolveNetworkMode(input);

  logEvent('INPUT_RECEIVED', {
    sessionId,
    type: input.type,
    networkMode,
    ...(input.type === 'file'
      ? { filePath: input.filePath, mimeType: input.mimeType }
      : { url: input.url }),
  });

  logEvent('NETWORK_MODE_SELECTED', { sessionId, networkMode });

  if (input.type === 'url') {
    logEvent('URL_SESSION_REQUESTED', { sessionId, url: input.url, networkMode });
  }

  const validationError = validateInput(input, networkMode);
  if (validationError) {
    logEvent('SESSION_ERROR', { sessionId, error: validationError, networkMode });
    return errorSession(sessionId, startTime);
  }

  try {
    const container =
      input.type === 'file'
        ? await createFileContainer(input.filePath, { networkMode })
        : await createUrlContainer(input.url, { networkMode: 'enabled' });

    logEvent('SESSION_CREATED', {
      sessionId,
      containerId: container.id,
      networkMode,
    });

    const session: AirlockSession = {
      sessionId,
      containerId: container.id,
      status: 'running',
      vncUrl: container.vncPageUrl ?? container.vncUrl,
      metadata: { startTime },
    };

    logEvent('SESSION_RUNNING', {
      sessionId,
      containerId: container.id,
      vncUrl: session.vncUrl,
      networkMode,
    });

    return session;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logEvent('SESSION_ERROR', { sessionId, error: message, networkMode });
    return errorSession(sessionId, startTime);
  }
}

/**
 * Destroy a running session via the existing ContainerManager path.
 */
export async function destroyAirlockSession(session: AirlockSession): Promise<AirlockSession> {
  logEvent('SESSION_DESTROY', {
    sessionId: session.sessionId,
    containerId: session.containerId,
  });

  try {
    await destroyContainer(session.containerId);
    const destroyed: AirlockSession = {
      ...session,
      status: 'destroyed',
      metadata: {
        ...session.metadata,
        endTime: Date.now(),
        exitReason: 'user_destroy',
      },
    };
    logEvent('SESSION_DESTROYED', {
      sessionId: session.sessionId,
      containerId: session.containerId,
    });
    return destroyed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logEvent('SESSION_ERROR', {
      sessionId: session.sessionId,
      containerId: session.containerId,
      error: message,
    });
    return {
      ...session,
      status: 'error',
      metadata: {
        ...session.metadata,
        endTime: Date.now(),
        exitReason: 'error',
      },
    };
  }
}
