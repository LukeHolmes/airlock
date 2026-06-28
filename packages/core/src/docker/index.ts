/**
 * Airlock Docker Module
 *
 * Container lifecycle management with security hardening.
 * Derived from Dangerzone's isolation provider model.
 */

export {
  installCrashTrap,
  violentGarbageCollect,
  createContainer,
  destroyContainer,
  killContainer,
  getActiveSessions,
  isContainerRunning,
  createFileContainer,
  createUrlContainer,
  type AirlockContainerConfig,
  type ContainerSession,
} from './ContainerManager.js';

export {
  AIRLOCK_ISOLATED_NETWORK,
  ensureIsolatedNetwork,
} from './network.js';

export {
  LOCAL_SANDBOX_IMAGE,
  SANDBOX_IMAGE,
  isSandboxImageAvailable,
  getSandboxImageStatus,
} from './imageCheck.js';

export {
  SANDBOX_BUILD_FILES,
  SandboxSetupError,
  configureSandboxImage,
  ensureSandboxImageReady,
  getGhcrSandboxImageRef,
  getSandboxImageCandidates,
  getSandboxImageConfig,
  isBundledBuildContext,
  type EnsureSandboxImageOptions,
  type EnsureSandboxImageResult,
  type SandboxImageConfig,
  type SandboxSetupErrorCode,
  type SandboxSetupProgress,
} from './sandboxImage.js';

export {
  AIRLOCK_SECCOMP_PROFILE,
  serializeSeccompProfile,
  type SeccompProfile,
  type SeccompRule,
  type SeccompArch,
  type SeccompArg,
} from './seccomp.js';
