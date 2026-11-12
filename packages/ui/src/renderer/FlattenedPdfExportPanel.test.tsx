/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import FlattenedPdfExportPanel from './FlattenedPdfExportPanel.js';

const session = {
  sessionId: 'sess-1',
  containerId: 'ctr-1',
  status: 'running' as const,
  metadata: { startTime: 0, inputType: 'file' as const, networkMode: 'isolated' as const },
};

describe('FlattenedPdfExportPanel', () => {
  afterEach(() => cleanup());

  test('blocks export until acknowledgement', async () => {
    const ipc = {
      exportFlattenedPdf: vi
        .fn()
        .mockResolvedValue({ ok: true, filePath: '/tmp/out.flattened.pdf' }),
    };
    render(
      <FlattenedPdfExportPanel
        session={session}
        ipc={ipc}
        onStatus={() => {}}
        onError={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('export-flattened-pdf'));
    expect(ipc.exportFlattenedPdf).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('flattened-pdf-ack'));
    fireEvent.click(screen.getByTestId('export-flattened-pdf'));
    await waitFor(() => expect(ipc.exportFlattenedPdf).toHaveBeenCalledOnce());
  });
});
