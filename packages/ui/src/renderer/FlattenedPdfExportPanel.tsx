import React from 'react';
import { FLATTENED_PDF_EXPORT_NOTICE } from '@airlock/core/browser';
import type { AirlockSession, FlattenedPdfExportResult } from '../shared/ipc.js';

export type FlattenedPdfExportIpc = {
  exportFlattenedPdf(session: AirlockSession): Promise<FlattenedPdfExportResult>;
};

export type FlattenedPdfExportPanelProps = {
  session: AirlockSession;
  ipc: FlattenedPdfExportIpc;
  onStatus: (message: string) => void;
  onError: (message: string) => void;
};

export default function FlattenedPdfExportPanel({
  session,
  ipc,
  onStatus,
  onError,
}: FlattenedPdfExportPanelProps) {
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const handleExport = async () => {
    if (!acknowledged) return;
    setExporting(true);
    try {
      const result = await ipc.exportFlattenedPdf(session);
      if (result.ok) {
        onStatus(`Flattened PDF written to ${result.filePath}`);
      } else if (!result.canceled) {
        onError(result.error);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      className="border-t border-[#23272F] p-3 flex flex-col gap-2"
      data-testid="flattened-pdf-panel"
    >
      <h4 className="text-[11px] font-mono text-[#7E8B9A] uppercase tracking-wide">
        Flattened PDF export
      </h4>
      <p className="text-[10px] text-[#6E7782] leading-snug">{FLATTENED_PDF_EXPORT_NOTICE}</p>
      <label className="flex items-start gap-2 text-[10px] text-[#AAB3BE] cursor-pointer">
        <input
          type="checkbox"
          data-testid="flattened-pdf-ack"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          I understand this is a best-effort visual flatten, not a guarantee of benign content.
        </span>
      </label>
      <button
        type="button"
        disabled={!acknowledged || exporting}
        data-testid="export-flattened-pdf"
        onClick={() => void handleExport()}
        className="px-2 py-1 text-[10px] font-mono border border-[#FF6A2B]/40 rounded-[4px] text-[#FF6A2B] hover:border-[#FF6A2B]/70 disabled:opacity-50"
      >
        {exporting ? 'Flattening…' : 'Export flattened PDF'}
      </button>
    </div>
  );
}
