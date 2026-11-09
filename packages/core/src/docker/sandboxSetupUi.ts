import type { SandboxSetupErrorCode, SandboxSetupProgress } from './sandboxImage.js';

export type FirstRunStageId = 'checking-docker' | 'preparing-image' | 'ready';

export type FirstRunStageState = 'pending' | 'active' | 'complete' | 'error';

export type FirstRunStage = {
  id: FirstRunStageId;
  label: string;
  state: FirstRunStageState;
};

export type SandboxSetupFailure = {
  code: SandboxSetupErrorCode | 'unknown';
  message: string;
  canRetry: boolean;
};

const STAGE_ORDER: FirstRunStageId[] = ['checking-docker', 'preparing-image', 'ready'];

export function mapProgressPhaseToStageId(
  phase: SandboxSetupProgress['phase'],
): FirstRunStageId | null {
  switch (phase) {
    case 'checking':
      return 'checking-docker';
    case 'pulling':
    case 'building':
    case 'tagging':
      return 'preparing-image';
    case 'ready':
      return 'ready';
    default:
      return null;
  }
}

/**
 * Derives the three first-run stage chips from the latest progress event and optional failure.
 */
export function deriveFirstRunStages(
  progress: SandboxSetupProgress | null,
  failed: SandboxSetupFailure | null,
): FirstRunStage[] {
  const labels: Record<FirstRunStageId, string> = {
    'checking-docker': 'Check Docker',
    'preparing-image': 'Pull or build image',
    ready: 'Ready',
  };

  const activeId = failed
    ? mapProgressPhaseToStageId(progress?.phase ?? 'checking')
    : progress
      ? mapProgressPhaseToStageId(progress.phase)
      : 'checking-docker';

  const activeIndex = activeId ? STAGE_ORDER.indexOf(activeId) : 0;
  const readyComplete = progress?.phase === 'ready' && !failed;

  return STAGE_ORDER.map((id, index) => {
    let state: FirstRunStageState = 'pending';

    if (failed && index === activeIndex) {
      state = 'error';
    } else if (readyComplete) {
      state = 'complete';
    } else if (index < activeIndex) {
      state = 'complete';
    } else if (index === activeIndex) {
      state = progress?.phase === 'ready' ? 'complete' : 'active';
    }

    return { id, label: labels[id], state };
  });
}

export function shouldAppendProgressDetail(
  previous: SandboxSetupProgress | null,
  next: SandboxSetupProgress,
): boolean {
  if (!next.detail) {
    return false;
  }
  if (!previous) {
    return true;
  }
  return previous.detail !== next.detail || previous.phase !== next.phase;
}

export function userMessageForSandboxSetupError(
  code: SandboxSetupErrorCode | 'unknown',
  fallbackMessage: string,
): SandboxSetupFailure {
  switch (code) {
    case 'docker_unavailable':
      return {
        code,
        message:
          'Docker is not installed or not running. Install Docker Desktop, start it, and wait until it reports running.',
        canRetry: true,
      };
    case 'pull_failed':
      return {
        code,
        message:
          'Could not download the sandbox image from the registry. Check your internet connection, or retry to build from bundled files if available.',
        canRetry: true,
      };
    case 'build_failed':
      return {
        code,
        message:
          'Building the sandbox image from bundled files failed. See the log below for details, then retry after fixing Docker disk space or permissions.',
        canRetry: true,
      };
    case 'no_strategy':
      return {
        code,
        message:
          'No sandbox image is available locally and download failed with no bundled build context. Build the image with pnpm sandbox:build or reinstall the app package.',
        canRetry: true,
      };
    default:
      return {
        code: 'unknown',
        message: fallbackMessage || 'Sandbox setup did not complete. Try again.',
        canRetry: true,
      };
  }
}

export function parseSandboxSetupFailure(err: unknown): SandboxSetupFailure {
  if (err && typeof err === 'object') {
    const record = err as { code?: string; message?: string; name?: string };
    const code = record.code;
    const message =
      typeof record.message === 'string' ? record.message : 'Sandbox setup did not complete.';

    if (
      code === 'docker_unavailable' ||
      code === 'pull_failed' ||
      code === 'build_failed' ||
      code === 'no_strategy'
    ) {
      return userMessageForSandboxSetupError(code, message);
    }

    if (record.name === 'SandboxSetupError' && code) {
      return userMessageForSandboxSetupError(code as SandboxSetupErrorCode, message);
    }
  }

  const fallback = err instanceof Error ? err.message : String(err);
  if (/docker|ECONNREFUSED|connect ENOENT/i.test(fallback)) {
    return userMessageForSandboxSetupError('docker_unavailable', fallback);
  }
  if (/pull|registry|ETIMEDOUT|network/i.test(fallback)) {
    return userMessageForSandboxSetupError('pull_failed', fallback);
  }

  return userMessageForSandboxSetupError('unknown', fallback);
}
