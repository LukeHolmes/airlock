import { execFileSync } from 'node:child_process';

const CLIPBOARD_COMMAND = ['xclip', '-selection', 'clipboard', '-o'];

/**
 * Read plain text from the guest X11 clipboard inside a running sandbox container.
 * Returns host-scrubbed-ready UTF-8 text (still pass through {@link scrubPlainText}).
 */
export function readGuestPlainClipboard(containerId: string): string {
  const stdout = execFileSync(
    'docker',
    ['exec', '-u', 'airlock', '-e', 'DISPLAY=:1', containerId, ...CLIPBOARD_COMMAND],
    { encoding: 'utf8', maxBuffer: 512 * 1024, timeout: 15_000 },
  );
  return stdout;
}
