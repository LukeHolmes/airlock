import type Dockerode from 'dockerode';

import { buildAirlockHostConfig } from './containerHostConfig.js';
import { LOCAL_SANDBOX_IMAGE } from './imageCheck.js';

export type EngineHardeningProbe = {
  supported: boolean;
  reasons: string[];
};

const PROBE_LABEL = 'app.airlock.hardening-probe';

export async function probeEngineHardening(docker: Dockerode): Promise<EngineHardeningProbe> {
  const reasons: string[] = [];

  let info: {
    SecurityOptions?: string[];
  };
  try {
    info = await docker.info();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { supported: false, reasons: [`Could not read engine info: ${message}`] };
  }

  const securityOptions = (info.SecurityOptions ?? []).map((opt: string) => opt.toLowerCase());
  if (!securityOptions.some((opt: string) => opt.includes('seccomp'))) {
    reasons.push('Engine does not advertise seccomp in SecurityOptions.');
  }

  const hostConfig = buildAirlockHostConfig({ networkMode: 'none', binds: [] });

  let probeImage = LOCAL_SANDBOX_IMAGE;
  try {
    await docker.getImage(probeImage).inspect();
  } catch {
    const images = await docker.listImages();
    const fallback = images
      .flatMap((entry) => entry.RepoTags ?? [])
      .find((tag) => tag && tag !== '<none>:<none>' && !tag.includes('airlock'));
    if (!fallback) {
      return { supported: reasons.length === 0, reasons };
    }
    probeImage = fallback;
  }

  try {
    const container = await docker.createContainer({
      Image: probeImage,
      Cmd: ['true'],
      HostConfig: hostConfig,
      Labels: { [PROBE_LABEL]: 'true' },
    });
    await container.remove({ force: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    reasons.push(
      `Refusing this engine: hardened container spec rejected (${message}). Airlock requires cap-drop ALL, seccomp, read-only root, and cgroup limits.`,
    );
  }

  return { supported: reasons.length === 0, reasons };
}
