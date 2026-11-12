import React from 'react';
import type {
  ReceiptExportPublicKeyResult,
  ReceiptKeyStatus,
  ReceiptVerifyResult,
} from '../shared/ipc.js';

export type ReceiptToolbarIpc = {
  verifyReceipt(): Promise<ReceiptVerifyResult>;
  exportReceiptPublicKey(): Promise<ReceiptExportPublicKeyResult>;
  getReceiptKeyStatus(): Promise<ReceiptKeyStatus>;
};

export type ReceiptToolbarProps = {
  ipc: ReceiptToolbarIpc;
  onStatusMessage: (message: string) => void;
  onError: (message: string) => void;
};

export default function ReceiptToolbar({ ipc, onStatusMessage, onError }: ReceiptToolbarProps) {
  const [keyWarning, setKeyWarning] = React.useState<string | null>(null);

  React.useEffect(() => {
    void ipc.getReceiptKeyStatus().then((status) => {
      setKeyWarning(status.warning);
    });
  }, [ipc]);

  const handleVerify = async () => {
    const result = await ipc.verifyReceipt();
    if (result.ok) {
      onStatusMessage(
        `Signature valid for ${result.fileName} (static risk: ${result.riskLevel}). Key ${result.fingerprint.slice(0, 20)}…`,
      );
    } else if (!result.canceled) {
      onError(result.error);
    }
  };

  const handleExportKey = async () => {
    const result = await ipc.exportReceiptPublicKey();
    if (result.ok) {
      onStatusMessage(`Public key exported to ${result.filePath}`);
    } else if (!result.canceled) {
      onError(result.error);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {keyWarning ? (
        <p
          className="text-[11px] leading-snug text-[#FF6A2B] border border-[#FF6A2B]/30 bg-[#FF6A2B]/10 rounded-[4px] px-2 py-1 max-w-md"
          data-testid="receipt-key-warning"
        >
          {keyWarning}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="receipt-verify"
          onClick={() => void handleVerify()}
          className="px-2.5 py-1 rounded-[4px] text-[11px] font-mono border border-[#23272F] text-[#AAB3BE] hover:border-[#3DE8D4]/40"
        >
          Verify receipt
        </button>
        <button
          type="button"
          data-testid="receipt-export-public-key"
          onClick={() => void handleExportKey()}
          className="px-2.5 py-1 rounded-[4px] text-[11px] font-mono border border-[#23272F] text-[#AAB3BE] hover:border-[#3DE8D4]/40"
        >
          Export public key
        </button>
      </div>
    </div>
  );
}
