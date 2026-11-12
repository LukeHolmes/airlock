import { useCallback, useEffect, useRef, useState } from 'react';

import {
  deriveFirstRunStages,
  parseSandboxSetupFailure,
  shouldAppendProgressDetail,
  type SandboxSetupFailure,
} from '@airlock/core/browser';

import type { AirlockIpcApi, AirlockReadiness, SandboxSetupProgress } from '../shared/ipc.js';
import type { FirstRunFailure, FirstRunStage } from './FirstRunProgress.js';

export type FirstRunSetupStatus = 'hidden' | 'running' | 'failed' | 'complete';

export function useFirstRunSetup(
  ipc: AirlockIpcApi | undefined,
  readiness: AirlockReadiness | null,
  onReadinessRefresh: () => Promise<void>,
) {
  const [status, setStatus] = useState<FirstRunSetupStatus>('hidden');
  const [progress, setProgress] = useState<SandboxSetupProgress | null>(null);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [failure, setFailure] = useState<FirstRunFailure | null>(null);
  const runGuard = useRef(false);
  const autoStarted = useRef(false);

  const visible =
    readiness !== null &&
    (!readiness.canStartSession || status === 'running' || status === 'failed');

  const failureForStages: SandboxSetupFailure | null = failure
    ? {
        code: (failure.code as SandboxSetupFailure['code']) ?? 'unknown',
        message: failure.message,
        canRetry: failure.canRetry,
      }
    : null;

  const stages: FirstRunStage[] = deriveFirstRunStages(progress, failureForStages);

  const appendProgress = useCallback((event: SandboxSetupProgress) => {
    setProgress((previous) => {
      if (shouldAppendProgressDetail(previous, event) && event.detail) {
        setLogLines((lines) => {
          const next = event.detail!;
          if (lines.length > 0 && lines[lines.length - 1] === next) {
            return lines;
          }
          return [...lines.slice(-199), next];
        });
      } else if (!previous && event.message) {
        setLogLines((lines) => {
          if (lines.length > 0 && lines[lines.length - 1] === event.message) {
            return lines;
          }
          return [...lines, event.message];
        });
      }
      return event;
    });
  }, []);

  const runSetup = useCallback(async () => {
    if (!ipc) {
      return;
    }

    runGuard.current = true;
    setStatus('running');
    setFailure(null);
    setLogLines([]);
    setProgress({ phase: 'checking', message: 'Checking Docker and local image…' });

    const latestReadiness = await ipc.getReadiness();
    await onReadinessRefresh();

    if (!latestReadiness.docker.available) {
      const dockerFailure = parseSandboxSetupFailure({
        name: 'SandboxSetupError',
        code: 'docker_unavailable',
        message: 'Docker is not available.',
      });
      setFailure({
        message: dockerFailure.message,
        canRetry: dockerFailure.canRetry,
        code: dockerFailure.code,
      });
      setStatus('failed');
      runGuard.current = false;
      return;
    }

    const outcome = await ipc.ensureSandboxImage();

    if (outcome.ok) {
      setProgress({ phase: 'ready', message: `${outcome.result.image} is ready` });
      setStatus('complete');
      await onReadinessRefresh();
      setStatus('hidden');
    } else {
      const parsed = parseSandboxSetupFailure(outcome);
      setFailure({
        message: parsed.message,
        canRetry: parsed.canRetry,
        code: parsed.code,
      });
      setStatus('failed');
    }

    runGuard.current = false;
  }, [ipc, onReadinessRefresh]);

  const handleRetry = useCallback(async () => {
    await onReadinessRefresh();
    await runSetup();
  }, [onReadinessRefresh, runSetup]);

  useEffect(() => {
    if (!ipc) {
      return;
    }

    return ipc.onSandboxSetupProgress(appendProgress);
  }, [ipc, appendProgress]);

  useEffect(() => {
    if (!ipc || !readiness) {
      return;
    }

    if (readiness.canStartSession) {
      setStatus('hidden');
      autoStarted.current = false;
      return;
    }

    if (autoStarted.current || runGuard.current) {
      return;
    }

    autoStarted.current = true;
    void runSetup();
  }, [ipc, readiness, runSetup]);

  return {
    visible,
    status,
    progress,
    logLines,
    failure,
    stages,
    runSetup,
    handleRetry,
  };
}
