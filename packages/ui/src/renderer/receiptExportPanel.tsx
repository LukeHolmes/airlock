import React from 'react';
import { RECEIPT_INTEGRITY_NOTICE } from '@airlock/core/browser';

export type ReceiptExportPanelProps = {
  isExporting: boolean;
  exportMessage: string | null;
  onExport: () => void;
};

export default function ReceiptExportPanel({
  isExporting,
  exportMessage,
  onExport,
}: ReceiptExportPanelProps) {
  return (
    <div>
      <p className="text-[11px] text-[#7E8B9A] mb-3 leading-relaxed border border-[#23272F] rounded-[4px] p-2">
        {RECEIPT_INTEGRITY_NOTICE}
      </p>
      {exportMessage ? (
        <p
          className="text-[12px] text-[#3DE8D4] font-mono mb-3 break-all"
          data-testid="export-message"
        >
          {exportMessage}
        </p>
      ) : null}
      <button
        type="button"
        data-testid="export-signed-receipt"
        onClick={onExport}
        disabled={isExporting}
        className="px-3 py-1.5 bg-[#3DE8D4] text-[#04201D] rounded-[4px] text-[12px] font-medium disabled:opacity-50"
      >
        {isExporting ? 'Exporting…' : 'Export signed receipt'}
      </button>
    </div>
  );
}
