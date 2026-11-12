import React from 'react';
import { PLAIN_TEXT_EXPORT_NOTICE } from '@airlock/core/browser';
import type { AirlockSession, PlainTextExportResult } from '../shared/ipc.js';

export type PlainTextExportIpc = {
  exportPlainText(session: AirlockSession): Promise<PlainTextExportResult>;
};

export type PlainTextExportPanelProps = {
  session: AirlockSession;
  ipc: PlainTextExportIpc;
  onStatus: (message: string) => void;
  onError: (message: string) => void;
};

export default function PlainTextExportPanel({
  session,
  ipc,
  onStatus,
  onError,
}: PlainTextExportPanelProps) {
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const handleExport = async () => {
    if (!acknowledged) return;
    setExporting(true);
    try {
      const result = await ipc.exportPlainText(session);
      if (result.ok) {
        const suffix = result.truncated ? ' (truncated to export limit)' : '';
        onStatus(`Plain text written to ${result.filePath}${suffix}`);
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
      data-testid="plain-text-export-panel"
    >
      <h4 className="text-[11px] font-mono text-[#7E8B9A] uppercase tracking-wide">
        Plain text export
      </h4>
      <p className="text-[10px] text-[#6E7782] leading-snug">{PLAIN_TEXT_EXPORT_NOTICE}</p>
      <label className="flex items-start gap-2 text-[10px] text-[#AAB3BE] cursor-pointer">
        <input
          type="checkbox"
          data-testid="plain-text-export-ack"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-0.5"
        />
        <span>
          I understand this is extracted and scrubbed plain text—review before reusing outside
          Airlock.
        </span>
      </label>
      <button
        type="button"
        disabled={!acknowledged || exporting}
        data-testid="export-plain-text"
        onClick={() => void handleExport()}
        className="px-2 py-1 text-[10px] font-mono border border-[#3DE8D4]/40 rounded-[4px] text-[#3DE8D4] hover:border-[#3DE8D4]/70 disabled:opacity-50"
      >
        {exporting ? 'Extracting…' : 'Export plain text'}
      </button>
    </div>
  );
}
