import React from 'react';

interface VncViewerProps {
  vncPageUrl?: string;
  vncUrl?: string;
  sessionName?: string;
}

/**
 * Embeds the KasmVNC web client served from the sandbox container.
 * The container publishes port 6901 to a dynamic host port on 127.0.0.1.
 */
export default function VncViewer({ vncPageUrl, vncUrl, sessionName }: VncViewerProps) {
  if (vncPageUrl) {
    return (
      <iframe
        title={sessionName ? `KasmVNC — ${sessionName}` : 'KasmVNC stream'}
        src={vncPageUrl}
        className="w-full h-full border-0 bg-[#08090B]"
        allow="clipboard-read; clipboard-write"
      />
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#08090B]">
      <div className="text-center">
        <p className="font-mono text-[13px] text-[#7E8B9A] mb-2">Awaiting KasmVNC endpoint…</p>
        <p className="font-mono text-[11px] text-[#474E58]">
          {vncUrl ? `Endpoint: ${vncUrl}` : 'No VNC URL returned from container'}
        </p>
      </div>
    </div>
  );
}
