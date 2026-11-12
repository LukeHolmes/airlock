/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ClipboardSanitiseDrawer from './ClipboardSanitiseDrawer.js';

describe('ClipboardSanitiseDrawer', () => {
  afterEach(() => cleanup());

  test('copy sanitised invokes IPC and status callback', async () => {
    const onStatus = vi.fn();
    const ipc = {
      pullGuestClipboardText: vi.fn(),
      writeSanitisedClipboard: vi.fn().mockResolvedValue({ ok: true, notice: 'ok' }),
    };
    render(
      <ClipboardSanitiseDrawer
        containerId="abc"
        ipc={ipc}
        onStatus={onStatus}
        onError={() => {}}
      />,
    );
    fireEvent.change(screen.getByTestId('clipboard-sanitise-text'), {
      target: { value: 'hello\u200b' },
    });
    fireEvent.click(screen.getByTestId('clipboard-copy-sanitised'));
    await waitFor(() => {
      expect(ipc.writeSanitisedClipboard).toHaveBeenCalledWith('hello\u200b');
      expect(onStatus).toHaveBeenCalledWith('Sanitised plain text copied to host clipboard');
    });
  });
});
