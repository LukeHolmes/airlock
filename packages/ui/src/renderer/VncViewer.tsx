import React from 'react';

import { isAllowedVncEmbedUrl } from '@airlock/core/browser';

interface VncViewerProps {
  vncUrl?: string;
  sessionId?: string;
}

/**
 * Embeds the KasmVNC web client served from the sandbox container.
 */
export default function VncViewer({ vncUrl, sessionId }: VncViewerProps) {
  if (vncUrl && isAllowedVncEmbedUrl(vncUrl)) {
    return (
      <iframe
        title={sessionId ? `KasmVNC — ${sessionId.slice(0, 12)}` : 'KasmVNC stream'}
        src={vncUrl}
        className="absolute inset-0 h-full w-full border-0 bg-[#08090B]"
        sandbox="allow-scripts allow-same-origin allow-forms"
        referrerPolicy="no-referrer"
      />
    );
  }

  if (vncUrl && !isAllowedVncEmbedUrl(vncUrl)) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#08090B]">
        <p className="font-mono text-[12px] text-[#7E8B9A]">Blocked non-loopback VNC URL</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#08090B]">
      <div className="text-center">
        <p className="font-mono text-[13px] text-[#7E8B9A] mb-2">Awaiting KasmVNC endpoint…</p>
        <p className="font-mono text-[11px] text-[#474E58]">No VNC URL returned from session</p>
      </div>
    </div>
  );
}
