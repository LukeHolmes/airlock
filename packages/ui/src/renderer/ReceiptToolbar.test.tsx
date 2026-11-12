/**
 * @vitest-environment jsdom
 */
import { describe, expect, test, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach } from 'vitest';
import ReceiptToolbar from './ReceiptToolbar.js';
import ReceiptExportPanel from './receiptExportPanel.js';

describe('Receipt UI', () => {
  afterEach(() => cleanup());
  test('shows key warning when file-0600 protection', async () => {
    const ipc = {
      verifyReceipt: vi.fn(),
      exportReceiptPublicKey: vi.fn(),
      getReceiptKeyStatus: vi.fn().mockResolvedValue({
        protectionLevel: 'file-0600',
        warning: 'OS secret storage is unavailable',
      }),
    };

    render(<ReceiptToolbar ipc={ipc} onStatusMessage={() => {}} onError={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('receipt-key-warning')).toBeTruthy();
    });
  });

  test('verify receipt surfaces tamper failure via onError', async () => {
    const onError = vi.fn();
    const ipc = {
      getReceiptKeyStatus: vi
        .fn()
        .mockResolvedValue({ protectionLevel: 'os-keychain', warning: null }),
      exportReceiptPublicKey: vi.fn(),
      verifyReceipt: vi.fn().mockResolvedValue({
        ok: false,
        canceled: false,
        error: 'Signature verification failed (payload may have been altered)',
      }),
    };

    render(<ReceiptToolbar ipc={ipc} onStatusMessage={() => {}} onError={onError} />);
    fireEvent.click(screen.getByTestId('receipt-verify'));
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        'Signature verification failed (payload may have been altered)',
      );
    });
  });

  test('export public key reports path on success', async () => {
    const onStatus = vi.fn();
    const ipc = {
      getReceiptKeyStatus: vi
        .fn()
        .mockResolvedValue({ protectionLevel: 'os-keychain', warning: null }),
      verifyReceipt: vi.fn(),
      exportReceiptPublicKey: vi.fn().mockResolvedValue({
        ok: true,
        filePath: '/tmp/airlock-receipt-public.json',
        fingerprint: 'sha256:abc',
      }),
    };

    render(<ReceiptToolbar ipc={ipc} onStatusMessage={onStatus} onError={() => {}} />);
    fireEvent.click(screen.getByTestId('receipt-export-public-key'));
    await waitFor(() => {
      expect(onStatus).toHaveBeenCalledWith(
        'Public key exported to /tmp/airlock-receipt-public.json',
      );
    });
  });

  test('export signed receipt button triggers handler', () => {
    const onExport = vi.fn();
    render(<ReceiptExportPanel isExporting={false} exportMessage={null} onExport={onExport} />);
    fireEvent.click(screen.getByTestId('export-signed-receipt'));
    expect(onExport).toHaveBeenCalledOnce();
  });
});
