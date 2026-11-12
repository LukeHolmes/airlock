import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import RemoveAirlockDataSettings from './RemoveAirlockDataSettings.js';

describe('RemoveAirlockDataSettings', () => {
  it('invokes removeAirlockData when requested', async () => {
    const removeAirlockData = vi.fn().mockResolvedValue({
      ok: true,
      containersRemoved: [],
      imagesRemoved: ['airlock/sandbox:latest'],
      userDataEntriesRemoved: ['/tmp/x'],
      partialErrors: [],
    });
    render(
      <RemoveAirlockDataSettings
        ipc={{ removeAirlockData, exportReceiptPublicKey: vi.fn() }}
        onStatus={() => {}}
        onError={() => {}}
      />,
    );
    fireEvent.click(screen.getByTestId('remove-airlock-data'));
    await waitFor(() => expect(removeAirlockData).toHaveBeenCalled());
  });
});
