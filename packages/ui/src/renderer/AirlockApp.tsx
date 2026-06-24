import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, FileDown, Link, Zap, Trash2, Box, Terminal, Wifi, WifiOff } from 'lucide-react';
import VncViewer from './VncViewer';
import type {
  AirlockInput,
  AirlockSession,
  SessionAnalysisResult,
  SessionStartedEvent,
  SessionEndedEvent,
  SessionErrorEvent,
} from '../shared/ipc.js';

type ViewState = 'idle' | 'igniting' | 'active' | 'error';

const ipc = typeof window !== 'undefined' ? window.airlock : undefined;

function viewStateFromSession(session: AirlockSession | null): ViewState {
  if (!session) return 'idle';
  switch (session.status) {
    case 'starting':
      return 'igniting';
    case 'running':
      return 'active';
    case 'error':
      return 'error';
    case 'destroyed':
      return 'idle';
    default:
      return 'idle';
  }
}

export default function AirlockApp() {
  const [session, setSession] = useState<AirlockSession | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [networkEnabled, setNetworkEnabled] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [analysisResult, setAnalysisResult] = useState<SessionAnalysisResult | null>(null);

  const viewState = viewStateFromSession(session);

  const startIgnitionLogs = useCallback((inputType: 'file' | 'url' = 'file') => {
    setLogs([]);
    setError(null);

    const sequence =
      inputType === 'url'
        ? [
            '[sys] Allocating ephemeral workspace for URL...',
            '[docker] Pulling airlock/sandbox:latest...',
            '[net] Bridge network enabled — external egress active.',
            '[sec] CapDrop ALL, no-new-privileges, seccomp profile applied.',
            '[vnc] Establishing secure WebSocket bridge...',
            '[sys] Container sealed — awaiting KasmVNC feed...',
          ]
        : [
            '[sys] Allocating ephemeral workspace for file...',
            '[docker] Pulling airlock/sandbox:latest...',
            '[vol] Mounting payload read-only...',
            networkEnabled
              ? '[net] Bridge network enabled — external egress active.'
              : '[net] Air-gapped network adapters verified.',
            '[sec] CapDrop ALL, no-new-privileges, seccomp profile applied.',
            '[vnc] Establishing secure WebSocket bridge...',
            '[sys] Container sealed — awaiting KasmVNC feed...',
          ];

    let step = 0;
    const interval = setInterval(() => {
      if (step < sequence.length) {
        setLogs((prev) => [...prev, sequence[step]]);
        step++;
      } else {
        clearInterval(interval);
      }
    }, 400);

    return () => clearInterval(interval);
  }, [networkEnabled]);

  const startSession = useCallback(
    async (input: AirlockInput) => {
      if (!ipc) {
        setError('IPC not available');
        return;
      }

      const cleanup = startIgnitionLogs(input.type);

      setSession({
        sessionId: 'pending',
        containerId: '',
        status: 'starting',
        metadata: {
          startTime: Date.now(),
          inputType: input.type,
          networkMode:
            input.type === 'url' ? 'enabled' : (input.networkMode ?? 'isolated'),
        },
      });

      try {
        const result = await ipc.createSession(input);
        setSession(result);

        if (result.status === 'error') {
          setError('Session failed to start');
        } else if (result.status === 'running') {
          setLogs((prev) => [...prev, `[sys] Container sealed — ${result.sessionId.slice(0, 12)}`]);
          if (result.vncUrl) {
            setLogs((prev) => [...prev, `[vnc] Stream at ${result.vncUrl}`]);
          }
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setSession(null);
        setLogs((prev) => [...prev, `[err] ${message}`]);
      } finally {
        cleanup();
      }
    },
    [startIgnitionLogs],
  );

  const handleFilePath = useCallback(
    async (filePath: string) => {
      const input: AirlockInput = {
        type: 'file',
        filePath,
        ...(networkEnabled ? { networkMode: 'enabled' as const } : {}),
      };
      await startSession(input);
    },
    [networkEnabled, startSession],
  );

  const handleUrlSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const url = urlInput.trim();
      if (!url) {
        setError('URL is required');
        return;
      }

      if (!networkEnabled) {
        setError('Network access must be enabled for URL sessions');
        return;
      }

      const input: AirlockInput = {
        type: 'url',
        url,
        networkMode: 'enabled',
      };
      await startSession(input);
    },
    [urlInput, networkEnabled, startSession],
  );

  const handleFileDrop = useCallback(
    async (file: File) => {
      if (!ipc) {
        setError('IPC not available');
        return;
      }
      const filePath = ipc.getPathForFile(file);
      await handleFilePath(filePath);
    },
    [handleFilePath],
  );

  useEffect(() => {
    if (!ipc) return;

    ipc.installCrashTrap().catch((err: unknown) => {
      console.error('Failed to install crash trap:', err);
    });

    const unsubStarted = ipc.onSessionStarted((event: SessionStartedEvent) => {
      setSession(event.session);
      if (event.session.status === 'running' && event.session.vncUrl) {
        setLogs((prev) => [...prev, `[vnc] Stream at ${event.session.vncUrl}`]);
      }
    });

    const unsubEnded = ipc.onSessionEnded((event: SessionEndedEvent) => {
      setSession(event.session);
      setLogs([]);
      setError(null);
    });

    const unsubError = ipc.onSessionError((event: SessionErrorEvent) => {
      setError(event.error);
      setSession(event.session.status === 'error' ? event.session : null);
    });

    const unsubOpenFile = ipc.onOpenFile((filePath: string) => {
      void handleFilePath(filePath);
    });

    return () => {
      unsubStarted();
      unsubEnded();
      unsubError();
      unsubOpenFile();
    };
  }, [handleFilePath]);

  const handleDestroyWorkspace = useCallback(async () => {
    if (!session || session.status !== 'running' || !ipc) return;

    try {
      setLogs((prev) => [...prev, `[sys] Destroying workspace ${session.sessionId.slice(0, 12)}...`]);
      const result = await ipc.destroySession(session);
      if (result.status === 'destroyed') {
        setSession(result);
        setLogs([]);
      } else if (result.status === 'error') {
        setError('Failed to destroy workspace');
        setSession(result);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setSession(null);
      setLogs([]);
    }
  }, [session]);

  const handleAnalyzeSession = useCallback(async () => {
    if (!session || session.status !== 'destroyed' || !ipc) return;

    try {
      const result = await ipc.analyzeSession(session.sessionId);
      setAnalysisResult(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    }
  }, [session]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files?.length) {
        void handleFileDrop(e.dataTransfer.files[0]);
      }
    },
    [handleFileDrop],
  );

  return (
    <div className="min-h-screen w-full bg-[#08090B] text-[#ECEFF3] font-sans overflow-hidden flex flex-col selection:bg-[#3DE8D4]/20 selection:text-[#04201D]">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <header className="h-12 border-b border-[#23272F] bg-[#0C0E11]/80 backdrop-blur-md flex items-center justify-between px-4 z-10 window-drag">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-6 h-6 text-[#3DE8D4]">
            <ShieldCheck size={18} strokeWidth={2} />
          </div>
          <span className="font-mono text-[11px] font-medium tracking-[0.18em] uppercase text-[#7E8B9A]">
            Airlock
          </span>
        </div>

        <div className="flex items-center gap-4">
          {viewState === 'active' && session && (
            <div className="flex items-center gap-4 no-drag">
              <div className="flex items-center gap-2 bg-[#28D3BF]/10 border border-[#28D3BF]/20 px-2.5 py-1 rounded-[4px]">
                <span className="w-2 h-2 rounded-full bg-[#3DE8D4] shadow-[0_0_8px_#3DE8D4]" />
                <span className="font-mono text-[11px] font-medium tracking-widest text-[#3DE8D4] uppercase">
                  Sealed
                </span>
              </div>
              <button
                onClick={handleDestroyWorkspace}
                className="flex items-center gap-2 bg-[#F23D3D] hover:bg-[#FF5757] text-[#1A0A02] px-3 py-1.5 rounded-[6px] font-mono text-[12.5px] font-semibold transition-all duration-150 shadow-[0_0_15px_rgba(242,61,61,0.2)] active:scale-[0.97]"
              >
                <Trash2 size={14} />
                Destroy workspace
              </button>
            </div>
          )}
          {!ipc && (
            <div className="flex items-center gap-2 bg-[#F23D3D]/10 border border-[#F23D3D]/20 px-2.5 py-1 rounded-[4px]">
              <span className="font-mono text-[11px] font-medium tracking-widest text-[#F23D3D] uppercase">
                IPC Error
              </span>
            </div>
          )}
        </div>
      </header>

      {error && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-[#F23D3D]/10 border border-[#F23D3D]/30 rounded-[6px] px-4 py-2 flex items-center gap-3">
            <span className="text-[#F23D3D] text-[13px]">{error}</span>
            <button onClick={() => setError(null)} className="text-[#F23D3D] hover:text-[#FF5757]">
              ×
            </button>
          </div>
        </div>
      )}

      {analysisResult && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-30 p-4">
          <div className="bg-[#12151A] border border-[#23272F] rounded-[8px] p-4 max-w-lg w-full max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-semibold text-[#ECEFF3]">Session Analysis</h3>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase ${
                  analysisResult.analysis.riskLevel === 'low'
                    ? 'bg-[#3DE8D4]/15 text-[#3DE8D4] border border-[#3DE8D4]/30'
                    : analysisResult.analysis.riskLevel === 'medium'
                      ? 'bg-[#FF6A2B]/15 text-[#FF6A2B] border border-[#FF6A2B]/30'
                      : 'bg-[#F23D3D]/15 text-[#F23D3D] border border-[#F23D3D]/30'
                }`}
              >
                {analysisResult.analysis.riskLevel} risk
              </span>
            </div>

            <p className="text-[13px] text-[#AAB3BE] mb-4 leading-relaxed">
              {analysisResult.analysis.summary}
            </p>

            <div className="mb-4">
              <h4 className="text-[12px] font-mono text-[#7E8B9A] uppercase mb-2">Observations</h4>
              <ul className="text-[12px] text-[#AAB3BE] space-y-1 list-disc list-inside">
                {analysisResult.analysis.observations.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="mb-4">
              <h4 className="text-[12px] font-mono text-[#7E8B9A] uppercase mb-2">Signals</h4>
              <ul className="text-[12px] text-[#AAB3BE] space-y-1 list-disc list-inside">
                {analysisResult.analysis.signals.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>

            <p className="text-[13px] text-[#ECEFF3] mb-4 border-t border-[#23272F] pt-3">
              {analysisResult.analysis.recommendation}
            </p>

            <button
              type="button"
              onClick={() => setAnalysisResult(null)}
              className="px-3 py-1.5 bg-[#23272F] rounded-[4px] text-[12px] font-mono text-[#ECEFF3]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 relative flex items-center justify-center p-4 md:p-8 z-0">
        <AnimatePresence mode="wait">
          {viewState === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-2xl flex flex-col gap-6"
            >
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center h-80 rounded-[10px] border transition-all duration-200 ease-out
                  ${
                    isDragging
                      ? 'border-[#3DE8D4] bg-[#3DE8D4]/5 shadow-[0_0_0_1px_#0E5B53,0_0_22px_rgba(61,232,212,0.15)]'
                      : 'border-dashed border-[#333944] bg-[#0C0E11] hover:border-[#7E8B9A] hover:bg-[#12151A]'
                  }`}
              >
                <div
                  className={`p-4 rounded-full mb-4 transition-colors duration-200 ${isDragging ? 'bg-[#3DE8D4]/10 text-[#3DE8D4]' : 'bg-[#181C22] text-[#AAB3BE]'}`}
                >
                  <FileDown size={32} strokeWidth={1.5} />
                </div>
                <h2 className="text-[23px] font-semibold text-[#ECEFF3] tracking-tight mb-2">
                  Drop a file to detonate
                </h2>
                <p className="text-[15px] text-[#AAB3BE] max-w-[280px] text-center">
                  Opens in a sealed, air-gapped workspace.
                </p>
                {isDragging && (
                  <motion.div
                    className="absolute top-0 left-0 w-full h-[1px] bg-[#3DE8D4] shadow-[0_0_10px_#3DE8D4]"
                    initial={{ top: '0%', opacity: 1 }}
                    animate={{ top: '100%', opacity: 0 }}
                    transition={{ duration: 0.6, ease: 'linear' }}
                  />
                )}
              </div>

              <div className="flex items-center justify-between gap-4 px-1">
                <span className="text-[12px] font-mono text-[#7E8B9A] uppercase tracking-wider">
                  Network Access
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNetworkEnabled(false)}
                    disabled={viewState !== 'idle'}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-[6px] font-mono text-[11px] font-medium transition-all duration-150 border ${
                      !networkEnabled
                        ? 'bg-[#3DE8D4]/10 border-[#3DE8D4]/40 text-[#3DE8D4]'
                        : 'bg-[#12151A] border-[#23272F] text-[#6E7782] hover:border-[#7E8B9A]'
                    } disabled:opacity-50 disabled:pointer-events-none`}
                  >
                    <WifiOff size={13} />
                    OFF — Air-Gapped (Safe)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNetworkEnabled(true)}
                    disabled={viewState !== 'idle'}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-[6px] font-mono text-[11px] font-medium transition-all duration-150 border ${
                      networkEnabled
                        ? 'bg-[#FF6A2B]/15 border-[#FF6A2B]/50 text-[#FF6A2B] shadow-[0_0_12px_rgba(255,106,43,0.15)]'
                        : 'bg-[#12151A] border-[#23272F] text-[#6E7782] hover:border-[#7E8B9A]'
                    } disabled:opacity-50 disabled:pointer-events-none`}
                  >
                    <Wifi size={13} />
                    ON — Network Enabled (Less Safe)
                  </button>
                </div>
              </div>

              <form onSubmit={handleUrlSubmit} className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Link size={16} className="text-[#6E7782]" />
                </div>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/document.pdf"
                  disabled={viewState !== 'idle' || !ipc}
                  className="w-full bg-[#12151A] border border-[#23272F] rounded-[6px] py-3 pl-10 pr-24 text-[13px] font-mono text-[#AAB3BE] placeholder-[#474E58] focus:outline-none focus:border-[#3DE8D4]/50 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={viewState !== 'idle' || !ipc || !urlInput.trim()}
                  className="absolute inset-y-1 right-1 px-4 bg-[#3DE8D4] hover:bg-[#28D3BF] disabled:bg-[#333944] disabled:text-[#6E7782] text-[#04201D] disabled:cursor-not-allowed text-[13px] font-medium font-sans rounded-[4px] flex items-center gap-2 transition-colors"
                >
                  <Zap size={14} />
                  Detonate
                </button>
              </form>

              {session?.status === 'destroyed' && (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-[13px] text-[#AAB3BE] font-mono">
                    Session {session.sessionId.slice(0, 12)} destroyed
                  </p>
                  <button
                    type="button"
                    onClick={handleAnalyzeSession}
                    className="px-4 py-2 bg-[#181C22] border border-[#23272F] rounded-[6px] font-mono text-[12px] text-[#ECEFF3] hover:border-[#3DE8D4]/50"
                  >
                    Analyze Session
                  </button>
                </div>
              )}

              {!ipc && (
                <p className="text-[12px] text-[#F23D3D] text-center font-mono">
                  IPC API not available. Running in mock mode.
                </p>
              )}
            </motion.div>
          )}

          {viewState === 'igniting' && (
            <motion.div
              key="igniting"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-2xl bg-[#0C0E11] border border-[#23272F] rounded-[10px] p-6 shadow-[0_18px_44px_rgba(0,0,0,0.6)]"
            >
              <div className="flex items-center gap-3 mb-6 border-b border-[#1A1E24] pb-4">
                <Box size={20} className="text-[#3DE8D4] animate-pulse" />
                <h3 className="text-[17px] font-semibold text-[#ECEFF3]">
                  Orchestrating isolation...
                </h3>
              </div>
              <div className="font-mono text-[12.5px] text-[#AAB3BE] flex flex-col gap-2 min-h-[160px]">
                {logs.map((log, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={
                      log.includes('sealed')
                        ? 'text-[#3DE8D4]'
                        : log.includes('err')
                          ? 'text-[#F23D3D]'
                          : ''
                    }
                  >
                    {log}
                  </motion.div>
                ))}
                <motion.div
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="w-2 h-4 bg-[#AAB3BE] mt-1"
                />
              </div>
            </motion.div>
          )}

          {viewState === 'active' && session && (
            <motion.div
              key="active"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full h-full flex flex-col bg-[#12151A] rounded-[10px] border border-[#3DE8D4]/40 shadow-[0_0_0_1px_#0E5B53,0_0_22px_rgba(61,232,212,0.15)] overflow-hidden"
            >
              <div className="h-10 bg-[#0C0E11] border-b border-[#23272F] flex items-center px-4 gap-4">
                <div className="flex items-center gap-1.5 opacity-50">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#F23D3D]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#FF6A2B]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#3DE8D4]" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="bg-[#181C22] rounded-[4px] border border-[#23272F] px-3 py-1 flex items-center gap-2 max-w-sm w-full">
                    <Terminal size={12} className="text-[#6E7782]" />
                    <span className="font-mono text-[11px] text-[#AAB3BE] truncate">
                      {session.sessionId.slice(0, 12)} — {session.containerId.slice(0, 12)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-1 relative bg-[#08090B] min-h-0">
                <VncViewer vncUrl={session.vncUrl} sessionId={session.sessionId} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
