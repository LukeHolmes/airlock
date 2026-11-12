import fs from 'node:fs';
import path from 'node:path';

import Dockerode from 'dockerode';

import {
  forceDestroyContainerId,
  isManagedAirlockLabels,
  listManagedAirlockContainers,
  MANAGED_LABEL,
} from '../docker/containerLifecycle.js';
import { isRemovableAirlockSandboxImageRef } from './airlockImageRefs.js';

export { isRemovableAirlockSandboxImageRef };

export type RemoveDataPreview = {
  userDataDir: string;
  userDataItems: string[];
  managedContainers: { id: string; name: string }[];
  sandboxImages: string[];
  warnings: string[];
};

export type RemoveAirlockDataResult = {
  containersRemoved: string[];
  containersFailed: string[];
  imagesRemoved: string[];
  imagesFailed: string[];
  userDataEntriesRemoved: string[];
  userDataFailed: string[];
};

const RECEIPT_KEY_FILES = ['airlock-receipt-signing.json', 'airlock-receipt-signing.v1.json'];

export function describeUserDataWipeTargets(userDataDir: string): string[] {
  const items = [
    `Receipt signing key (${RECEIPT_KEY_FILES.join(', ')})`,
    'Electron app settings and caches under the Airlock user data directory',
    'Session logs and local export caches stored in user data',
  ];
  if (fs.existsSync(userDataDir)) {
    try {
      const entries = fs.readdirSync(userDataDir);
      if (entries.length > 0) {
        items.push(`All files in ${userDataDir} (${entries.length} entries)`);
      }
    } catch {
      items.push(`Contents of ${userDataDir} (if present)`);
    }
  }
  return items;
}

export async function previewRemoveAirlockData(
  docker: Dockerode,
  userDataDir: string,
): Promise<RemoveDataPreview> {
  const warnings = [
    'Deleting the signing key means this install can no longer sign new receipts with the same key. Previously exported receipts still verify with the public key you saved.',
    'Only Docker containers labelled app.airlock.managed=true are removed. Other containers are not touched.',
  ];

  const managed = await listManagedAirlockContainers(docker);
  const sandboxImages = await listRemovableAirlockSandboxImages(docker);

  return {
    userDataDir,
    userDataItems: describeUserDataWipeTargets(userDataDir),
    managedContainers: managed.map((c) => ({ id: c.id, name: c.name })),
    sandboxImages,
    warnings,
  };
}

export async function listRemovableAirlockSandboxImages(docker: Dockerode): Promise<string[]> {
  const images = await docker.listImages();
  const refs = new Set<string>();
  for (const entry of images) {
    for (const tag of entry.RepoTags ?? []) {
      if (tag === '<none>:<none>') {
        continue;
      }
      if (isRemovableAirlockSandboxImageRef(tag)) {
        refs.add(tag);
      }
    }
  }
  return [...refs].sort();
}

/**
 * Destroy every container that still carries the Airlock managed label (user-initiated wipe).
 */
export async function destroyAllManagedAirlockContainers(
  docker: Dockerode,
): Promise<{ removed: string[]; failed: string[] }> {
  const removed: string[] = [];
  const failed: string[] = [];
  const listed = await listManagedAirlockContainers(docker);

  for (const entry of listed) {
    try {
      const info = await docker.getContainer(entry.id).inspect();
      const labels = info.Config?.Labels ?? {};
      if (!isManagedAirlockLabels(labels) && labels[MANAGED_LABEL] !== 'true') {
        failed.push(entry.id);
        continue;
      }
    } catch {
      failed.push(entry.id);
      continue;
    }

    if (await forceDestroyContainerId(docker, entry.id)) {
      removed.push(entry.id);
    } else {
      failed.push(entry.id);
    }
  }

  return { removed, failed };
}

export async function removeAirlockSandboxImages(
  docker: Dockerode,
): Promise<{ removed: string[]; failed: string[] }> {
  const removed: string[] = [];
  const failed: string[] = [];
  const refs = await listRemovableAirlockSandboxImages(docker);

  for (const ref of refs) {
    if (!isRemovableAirlockSandboxImageRef(ref)) {
      failed.push(ref);
      continue;
    }
    try {
      const image = docker.getImage(ref);
      await image.remove({ force: true });
      removed.push(ref);
    } catch {
      failed.push(ref);
    }
  }

  return { removed, failed };
}

export function wipeAirlockUserData(userDataDir: string): {
  removed: string[];
  failed: string[];
} {
  const removed: string[] = [];
  const failed: string[] = [];

  if (!fs.existsSync(userDataDir)) {
    return { removed, failed };
  }

  let entries: string[];
  try {
    entries = fs.readdirSync(userDataDir);
  } catch {
    failed.push(userDataDir);
    return { removed, failed };
  }

  for (const entry of entries) {
    const target = path.join(userDataDir, entry);
    try {
      fs.rmSync(target, { recursive: true, force: true });
      removed.push(target);
    } catch {
      failed.push(target);
    }
  }

  return { removed, failed };
}

export async function removeAirlockData(
  docker: Dockerode,
  userDataDir: string,
): Promise<RemoveAirlockDataResult> {
  const containers = await destroyAllManagedAirlockContainers(docker);
  const images = await removeAirlockSandboxImages(docker);
  const userData = wipeAirlockUserData(userDataDir);

  return {
    containersRemoved: containers.removed,
    containersFailed: containers.failed,
    imagesRemoved: images.removed,
    imagesFailed: images.failed,
    userDataEntriesRemoved: userData.removed,
    userDataFailed: userData.failed,
  };
}
