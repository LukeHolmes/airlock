/**
 * Airlock isolated Docker network management.
 *
 * Internal bridge networks block container egress to the internet while still
 * allowing published ports to reach the host on 127.0.0.1 (required for VNC).
 */

import type Dockerode from 'dockerode';

export const AIRLOCK_ISOLATED_NETWORK = 'airlock-isolated';

/**
 * Ensure the shared internal bridge network exists.
 * Containers on this network cannot reach external hosts.
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
      Internal: true,
      Labels: {
        'app.airlock.managed': 'true',
      },
    });
    return AIRLOCK_ISOLATED_NETWORK;
  }
}
