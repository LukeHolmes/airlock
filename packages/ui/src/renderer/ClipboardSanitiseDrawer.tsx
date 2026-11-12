import React from 'react';
import { CLIPBOARD_SCRUB_NOTICE } from '@airlock/core/browser';
import type { ClipboardPullGuestResult, ClipboardWriteSanitisedResult } from '../shared/ipc.js';

export type ClipboardSanitiseIpc = {
  pullGuestClipboardText(containerId: string): Promise<ClipboardPullGuestResult>;
  writeSanitisedClipboard(text: string): Promise<ClipboardWriteSanitisedResult>;
};

export type ClipboardSanitiseDrawerProps = {
  containerId: string;
  ipc: ClipboardSanitiseIpc;
  onStatus: (message: string) => void;
  onError: (message: string) => void;
};

export default function ClipboardSanitiseDrawer({
  containerId,
  ipc,
  onStatus,
  onError,
}: ClipboardSanitiseDrawerProps) {
  const [draft, setDraft] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const handlePull = async () => {
    setBusy(true);
    try {
      const result = await ipc.pullGuestClipboardText(containerId);
      if (result.ok) {
        setDraft(result.scrubbed);
        onStatus(`Pulled ${result.rawLength} bytes from guest clipboard (sanitised preview shown)`);
      } else {
        onError(result.error);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = async () => {
    setBusy(true);
    try {
      const result = await ipc.writeSanitisedClipboard(draft);
      if (result.ok) {
        onStatus('Sanitised plain text copied to host clipboard');
      } else {
        onError(result.error);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="border-t border-[#23272F] p-3 flex flex-col gap-2"
      data-testid="clipboard-sanitise-drawer"
    >
      <h4 className="text-[11px] font-mono text-[#7E8B9A] uppercase tracking-wide">
        Sanitised copy (plain text)
      </h4>
      <p className="text-[10px] text-[#6E7782] leading-snug">{CLIPBOARD_SCRUB_NOTICE}</p>
      <textarea
        data-testid="clipboard-sanitise-text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={4}
        className="w-full bg-[#0C0E11] border border-[#23272F] rounded-[4px] p-2 text-[11px] font-mono text-[#AAB3BE] resize-y"
        placeholder="Pull from guest or paste text to sanitise before copying to the host"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          data-testid="clipboard-pull-guest"
          onClick={() => void handlePull()}
          className="px-2 py-1 text-[10px] font-mono border border-[#23272F] rounded-[4px] text-[#AAB3BE] hover:border-[#3DE8D4]/40 disabled:opacity-50"
        >
          Pull guest clipboard
        </button>
        <button
          type="button"
          disabled={busy || draft.length === 0}
          data-testid="clipboard-copy-sanitised"
          onClick={() => void handleCopy()}
          className="px-2 py-1 text-[10px] font-mono border border-[#3DE8D4]/30 rounded-[4px] text-[#3DE8D4] hover:border-[#3DE8D4]/60 disabled:opacity-50"
        >
          Copy sanitised text to host
        </button>
      </div>
    </div>
  );
}
