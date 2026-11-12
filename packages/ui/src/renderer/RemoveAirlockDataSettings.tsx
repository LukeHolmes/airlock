import React from 'react';
import type { RemoveAirlockDataOutcome } from '../shared/ipc.js';

export type RemoveAirlockDataIpc = {
  removeAirlockData(): Promise<RemoveAirlockDataOutcome>;
  exportReceiptPublicKey(): Promise<{ ok: boolean; canceled?: boolean; filePath?: string }>;
};

export type RemoveAirlockDataSettingsProps = {
  ipc: RemoveAirlockDataIpc;
  onStatus: (message: string) => void;
  onError: (message: string) => void;
};

export default function RemoveAirlockDataSettings({
  ipc,
  onStatus,
  onError,
}: RemoveAirlockDataSettingsProps) {
  const [loading, setLoading] = React.useState(false);

  const runRemove = async () => {
    setLoading(true);
    try {
      const result = await ipc.removeAirlockData();
      if (result.ok) {
        const parts = [
          `${result.containersRemoved.length} container(s)`,
          `${result.imagesRemoved.length} image(s)`,
          `${result.userDataEntriesRemoved.length} user-data item(s)`,
        ];
        onStatus(`Removed Airlock data: ${parts.join(', ')}`);
        if (result.partialErrors.length > 0) {
          onError(result.partialErrors.join('; '));
        }
      } else if (!result.canceled) {
        onError(result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="border border-[#23272F] rounded-[4px] p-3 flex flex-col gap-2"
      data-testid="remove-data-settings"
    >
      <h4 className="text-[11px] font-mono text-[#7E8B9A] uppercase tracking-wide">Settings</h4>
      <p className="text-[10px] text-[#6E7782] leading-snug">
        Remove Airlock-managed containers (
        <code className="text-[#AAB3BE]">app.airlock.managed</code>
        ), <code className="text-[#AAB3BE]">airlock/sandbox</code> and{' '}
        <code className="text-[#AAB3BE]">ghcr.io/lukeholmes/airlock-sandbox</code> images, and local
        user data including the receipt signing key. A confirmation dialog lists exactly what will
        be removed. Deleting the signing key means this install cannot re-sign; previously exported
        receipts still verify with your saved public key.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="remove-airlock-data"
          disabled={loading}
          onClick={() => void runRemove()}
          className="px-2 py-1 text-[10px] font-mono border border-[#FF6A2B]/40 rounded-[4px] text-[#FF6A2B] hover:border-[#FF6A2B]/70 disabled:opacity-50"
        >
          Remove Airlock data…
        </button>
        <button
          type="button"
          data-testid="remove-data-export-key-first"
          disabled={loading}
          onClick={() =>
            void ipc.exportReceiptPublicKey().then((r) => {
              if (r.ok && r.filePath) {
                onStatus(`Public key exported to ${r.filePath}`);
              }
            })
          }
          className="px-2 py-1 text-[10px] font-mono border border-[#23272F] rounded-[4px] text-[#AAB3BE] hover:border-[#3DE8D4]/40 disabled:opacity-50"
        >
          Export public key
        </button>
      </div>
    </div>
  );
}
