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
  SANDBOX_IMAGE,
  isSandboxImageAvailable,
  getSandboxImageStatus,
} from './imageCheck.js';

export {
  AIRLOCK_SECCOMP_PROFILE,
  serializeSeccompProfile,
  type SeccompProfile,
  type SeccompRule,
  type SeccompArch,
  type SeccompArg,
} from './seccomp.js';
