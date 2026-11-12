import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PlainTextExportPanel from './PlainTextExportPanel.js';
import type { AirlockSession } from '../shared/ipc.js';

const session: AirlockSession = {
  sessionId: 'sess-1',
  containerId: 'cid-1',
  status: 'running',
  metadata: {
    startTime: 1,
    inputType: 'file',
    networkMode: 'isolated',
  },
};

describe('PlainTextExportPanel', () => {
  it('requires acknowledgement before export', async () => {
    const exportPlainText = vi
      .fn()
      .mockResolvedValue({ ok: true, filePath: '/tmp/out.txt', truncated: false });
    render(
      <PlainTextExportPanel
        session={session}
        ipc={{ exportPlainText }}
        onStatus={() => {}}
        onError={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('export-plain-text'));
    expect(exportPlainText).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('plain-text-export-ack'));
    fireEvent.click(screen.getByTestId('export-plain-text'));
    await waitFor(() => expect(exportPlainText).toHaveBeenCalledWith(session));
  });
});
