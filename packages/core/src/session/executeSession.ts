import { randomUUID } from 'node:crypto';
import fs from 'node:fs';

import { createFileContainer, destroyContainer } from '../docker/index.js';
import { logEvent } from './logger.js';
import type { AirlockInput, AirlockSession } from './types.js';

function validateInput(input: AirlockInput): string | null {
  if (input.type !== 'file') {
    return 'Unsupported input type';
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
 * Execute a file session through the existing ContainerManager path.
 * Wraps createFileContainer — does not alter container configuration.
 */
export async function executeAirlockSession(input: AirlockInput): Promise<AirlockSession> {
  const startTime = Date.now();
  const sessionId = randomUUID();

  logEvent('INPUT_RECEIVED', {
    sessionId,
    type: input.type,
    filePath: input.filePath,
    mimeType: input.mimeType,
  });

  const validationError = validateInput(input);
  if (validationError) {
    logEvent('SESSION_ERROR', { sessionId, error: validationError });
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

  try {
    const container = await createFileContainer(input.filePath);

    logEvent('SESSION_CREATED', {
      sessionId,
      containerId: container.id,
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
    });

    return session;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logEvent('SESSION_ERROR', { sessionId, error: message });
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
