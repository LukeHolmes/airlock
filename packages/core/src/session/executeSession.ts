import { randomUUID } from 'node:crypto';

import { createFileContainer, createUrlContainer, destroyContainer } from '../docker/index.js';
import { validateDrop, type DropValidationResult } from '../validation/validateDrop.js';
import { registerSessionRecord, updateSessionRecord } from './artefacts.js';
import { debugLog } from './debug.js';
import { logEvent } from './logger.js';
import type { AirlockInput, AirlockSession, NetworkMode } from './types.js';

function resolveNetworkMode(input: AirlockInput): NetworkMode {
  return input.networkMode ?? 'isolated';
}

function inputDescriptor(input: AirlockInput): { type: 'file' | 'url'; value: string } {
  return input.type === 'file'
    ? { type: 'file', value: input.filePath }
    : { type: 'url', value: input.url };
}

function errorSession(
  sessionId: string,
  startTime: number,
  inputType: 'file' | 'url',
  networkMode: NetworkMode,
): AirlockSession {
  const metadata: AirlockSession['metadata'] = {
    startTime,
    endTime: Date.now(),
    exitReason: 'error',
    inputType,
    networkMode,
  };
  updateSessionRecord(sessionId, metadata);

  return {
    sessionId,
    containerId: '',
    status: 'error',
    metadata,
  };
}

function validateInput(
  input: AirlockInput,
  networkMode: NetworkMode,
): { error: string | null; dropValidation?: DropValidationResult } {
  if (input.type === 'url') {
    if (networkMode !== 'enabled') {
      return { error: 'URL sessions require network access' };
    }

    if (!input.url || input.url.trim().length === 0) {
      return { error: 'url is required' };
    }

    try {
      const urlObj = new URL(input.url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { error: `Invalid URL protocol: ${urlObj.protocol}` };
      }
    } catch {
      return { error: 'Invalid URL' };
    }

    return { error: null };
  }

  if (!input.filePath || input.filePath.trim().length === 0) {
    return { error: 'filePath is required' };
  }

  const dropValidation = validateDrop(input.filePath);
  if (!dropValidation.ok) {
    return { error: dropValidation.message, dropValidation };
  }

  return { error: null, dropValidation };
}

/**
 * Execute a session through the existing ContainerManager path.
 * Wraps createFileContainer / createUrlContainer — does not alter container security.
 */
export async function executeAirlockSession(input: AirlockInput): Promise<AirlockSession> {
  const startTime = Date.now();
  const sessionId = randomUUID();
  const networkMode = resolveNetworkMode(input);
  const inputType = input.type;
  const descriptor = inputDescriptor(input);

  const baseMetadata: AirlockSession['metadata'] = {
    startTime,
    inputType,
    networkMode,
  };
  registerSessionRecord(sessionId, descriptor, baseMetadata);

  debugLog('executeAirlockSession start', { sessionId, inputType, networkMode });

  const { error: validationError, dropValidation } = validateInput(input, networkMode);

  logEvent('INPUT_RECEIVED', {
    sessionId,
    type: input.type,
    networkMode,
    ...(input.type === 'file'
      ? {
          filePath: input.filePath,
          mimeType:
            input.mimeType ??
            (dropValidation?.ok ? dropValidation.mimeType : undefined),
        }
      : { url: input.url }),
  });

  logEvent('NETWORK_MODE_SELECTED', { sessionId, networkMode });

  if (input.type === 'url') {
    logEvent('URL_SESSION_REQUESTED', { sessionId, url: input.url, networkMode });
  }

  if (validationError) {
    debugLog('executeAirlockSession validation failed', { sessionId, validationError });
    logEvent('SESSION_ERROR', { sessionId, error: validationError, networkMode });
    return errorSession(sessionId, startTime, inputType, networkMode);
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
      metadata: baseMetadata,
    };
    updateSessionRecord(sessionId, session.metadata);

    logEvent('SESSION_RUNNING', {
      sessionId,
      containerId: container.id,
      vncUrl: session.vncUrl,
      networkMode,
    });

    debugLog('executeAirlockSession running', {
      sessionId,
      containerId: container.id,
      vncUrl: session.vncUrl,
    });

    return session;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debugLog('executeAirlockSession error', { sessionId, message });
    logEvent('SESSION_ERROR', { sessionId, error: message, networkMode });
    return errorSession(sessionId, startTime, inputType, networkMode);
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
    updateSessionRecord(session.sessionId, destroyed.metadata);
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
    const errored: AirlockSession = {
      ...session,
      status: 'error',
      metadata: {
        ...session.metadata,
        endTime: Date.now(),
        exitReason: 'error',
      },
    };
    updateSessionRecord(session.sessionId, errored.metadata);
    return errored;
  }
}
