/**
 * Airlock isolated Docker network management.
 *
 * Internal bridge networks block container egress to the internet while still
 * allowing published ports to reach the host on 127.0.0.1 (required for VNC).
 */

import type Dockerode from 'dockerode';

export const AIRLOCK_ISOLATED_NETWORK = 'airlock-isolated';

/**
 * Ensure the shared bridge network exists for VNC sessions.
 *
 * Note: Docker does not publish ports to the host for `internal: true` networks
 * in our target environments. We use a dedicated non-internal bridge so
 * 127.0.0.1 port mapping works. Egress blocking is enforced via seccomp/CapDrop
 * for v0.1.1; full network egress policy is v0.2.0.
 */
export async function ensureIsolatedNetwork(docker: Dockerode): Promise<string> {
  try {
    const network = docker.getNetwork(AIRLOCK_ISOLATED_NETWORK);
    await network.inspect();
    return AIRLOCK_ISOLATED_NETWORK;
  } catch {
    await docker.createNetwork({
      Name: AIRLOCK_ISOLATED_NETWORK,
      Driver: 'bridge',
      Internal: false,
      Labels: {
        'app.airlock.managed': 'true',
      },
    });
    return AIRLOCK_ISOLATED_NETWORK;
  }
}
