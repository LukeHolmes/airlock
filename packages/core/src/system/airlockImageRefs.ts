/** Local tag provisioned after pull/build. */
export const AIRLOCK_LOCAL_SANDBOX_REPO = 'airlock/sandbox';

/** Published GHCR repository (no tag — match any tag). */
export const AIRLOCK_GHCR_SANDBOX_REPO = 'ghcr.io/lukeholmes/airlock-sandbox';

/**
 * True only for Airlock-owned sandbox image references (never other registries/images).
 */
export function isRemovableAirlockSandboxImageRef(imageRef: string): boolean {
  const ref = imageRef.trim().toLowerCase();
  if (!ref) {
    return false;
  }
  const repoPart = ref.includes('@') ? ref.split('@')[0] : ref.split(':')[0];
  const repo = repoPart ?? '';
  if (repo === AIRLOCK_LOCAL_SANDBOX_REPO || repo.startsWith(`${AIRLOCK_LOCAL_SANDBOX_REPO}/`)) {
    return true;
  }
  if (repo === AIRLOCK_GHCR_SANDBOX_REPO || repo.startsWith(`${AIRLOCK_GHCR_SANDBOX_REPO}/`)) {
    return true;
  }
  return false;
}
