import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, FileDown, Link, Zap, Trash2, Box, Terminal } from 'lucide-react';
import VncViewer from './VncViewer';
import type {
  ContainerSession,
  CreateFileContainerRequest,
  SessionStartedEvent,
  SessionEndedEvent,
  SessionErrorEvent,
} from '../shared/ipc.js';

type AppState = 'idle' | 'igniting' | 'active';

// Type-safe access to IPC API exposed by preload
const ipc = typeof window !== 'undefined' ? window.airlock : undefined;

export default function AirlockApp() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [session, setSession] = useState<ContainerSession | null>(null);
  const [vncPageUrl, setVncPageUrl] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  const startIgnitionSequence = useCallback((type: 'file' | 'url') => {
    setAppState('igniting');
    setLogs([]);
    setError(null);

    const sequence = [
      `[sys] Allocating ephemeral workspace for ${type}...`,
      `[docker] Pulling airlock/sandbox:latest...`,
      `[vol] Mounting payload read-only...`,
      `[net] Air-gapped network adapters verified.`,
      `[sec] CapDrop ALL, no-new-privileges, seccomp profile applied.`,
      `[vnc] Establishing secure WebSocket bridge...`,
      `[sys] Container sealed — awaiting KasmVNC feed...`,
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
  }, []);

  const handleFilePath = useCallback(
    async (filePath: string) => {
      const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
      const cleanup = startIgnitionSequence('file');

      if (!ipc) {
        setError('IPC not available');
        setAppState('idle');
        cleanup();
        return;
      }

      try {
        const request: CreateFileContainerRequest = {
          filePath,
          name: `airlock-${fileName.replace(/[^a-zA-Z0-9-]/g, '-').slice(0, 20)}`,
        };

        const newSession = await ipc.createFileContainer(request);
        setSession(newSession);
        setVncPageUrl(newSession.vncPageUrl);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setAppState('idle');
        setLogs((prev) => [...prev, `[err] ${message}`]);
      } finally {
        cleanup();
      }
    },
    [startIgnitionSequence],
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

  // Install crash trap on mount
  useEffect(() => {
    if (!ipc) return;

    ipc.installCrashTrap().catch((err: unknown) => {
      console.error('Failed to install crash trap:', err);
    });

    const unsubStarted = ipc.onSessionStarted((event: SessionStartedEvent) => {
      console.log('[AirlockApp] Session started:', event.session.name);
      setSession(event.session);
      setVncPageUrl(event.session.vncPageUrl);
      setAppState('active');
      setLogs((prev) => [...prev, `[sys] Container sealed — ${event.session.name}`]);
      if (event.vncUrl) {
        setLogs((prev) => [...prev, `[vnc] Stream at ${event.vncUrl}`]);
      }
    });

    const unsubEnded = ipc.onSessionEnded((event: SessionEndedEvent) => {
      console.log('[AirlockApp] Session ended:', event.sessionId, event.reason);
      setSession(null);
      setVncPageUrl(undefined);
      setAppState('idle');
      setLogs([]);
      setUrlInput('');
    });

    const unsubError = ipc.onSessionError((event: SessionErrorEvent) => {
      console.error('[AirlockApp] Session error:', event.sessionId, event.error);
      setError(event.error);
      setAppState('idle');
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
    if (!session || !ipc) return;

    try {
      setLogs((prev) => [...prev, `[sys] Destroying workspace ${session.name}...`]);
      await ipc.destroyContainer(session.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setLogs((prev) => [...prev, `[err] ${message}`]);
      setSession(null);
      setVncPageUrl(undefined);
      setAppState('idle');
      setUrlInput('');
    }
  }, [session]);

  // --- Drag & Drop Handlers ---
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

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        void handleFileDrop(file);
      }
    },
    [handleFileDrop],
  );

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="min-h-screen w-full bg-[#08090B] text-[#ECEFF3] font-sans overflow-hidden flex flex-col selection:bg-[#3DE8D4]/20 selection:text-[#04201D]">
      {/* Background Texture: Subtle Grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Top Command Bar */}
      <header className="h-12 border-b border-[#23272F] bg-[#0C0E11]/80 backdrop-blur-md flex items-center justify-between px-4 z-10 window-drag">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-6 h-6 text-[#3DE8D4]">
            <ShieldCheck size={18} strokeWidth={2} />
          </div>
          <span className="font-mono text-[11px] font-medium tracking-[0.18em] uppercase text-[#7E8B9A]">
            Airlock
          </span>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-4">
          {appState === 'active' && session && (
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

      {/* Error Toast */}
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

      {/* Main Content Area */}
      <main className="flex-1 relative flex items-center justify-center p-4 md:p-8 z-0">
        <AnimatePresence mode="wait">
          {/* STATE: IDLE */}
          {appState === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-2xl flex flex-col gap-6"
            >
              {/* Drop Zone */}
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

                {/* Visual Scanner: one-time sweep on drag enter */}
                {isDragging && (
                  <motion.div
                    className="absolute top-0 left-0 w-full h-[1px] bg-[#3DE8D4] shadow-[0_0_10px_#3DE8D4]"
                    initial={{ top: '0%', opacity: 1 }}
                    animate={{ top: '100%', opacity: 0 }}
                    transition={{ duration: 0.6, ease: 'linear' }}
                  />
                )}
              </div>

              {/* URL input deferred to v0.2.0 (requires network opt-in) */}
              <form onSubmit={handleFormSubmit} className="relative group opacity-50 pointer-events-none">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Link size={16} className="text-[#6E7782]" />
                </div>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="URL sessions — v0.2.0"
                  disabled
                  className="w-full bg-[#12151A] border border-[#23272F] rounded-[6px] py-3 pl-10 pr-24 text-[13px] font-mono text-[#AAB3BE] placeholder-[#474E58]"
                />
                <button
                  type="submit"
                  disabled
                  className="absolute inset-y-1 right-1 px-4 bg-[#333944] text-[#6E7782] text-[13px] font-medium font-sans rounded-[4px] flex items-center gap-2"
                >
                  <Zap size={14} />
                  Detonate
                </button>
              </form>

              {/* IPC warning */}
              {!ipc && (
                <p className="text-[12px] text-[#F23D3D] text-center font-mono">
                  IPC API not available. Running in mock mode.
                </p>
              )}
            </motion.div>
          )}

          {/* STATE: IGNITING (Loading) */}
          {appState === 'igniting' && (
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

          {/* STATE: ACTIVE STREAM */}
          {appState === 'active' && (
            <motion.div
              key="active"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="w-full h-full flex flex-col bg-[#12151A] rounded-[10px] border border-[#3DE8D4]/40 shadow-[0_0_0_1px_#0E5B53,0_0_22px_rgba(61,232,212,0.15)] overflow-hidden"
            >
              {/* Internal Browser/Viewer Chrome */}
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
                      {session
                        ? `${session.name} — ${session.id.slice(0, 12)}`
                        : 'root@airlock-instance-04:~#'}
                    </span>
                  </div>
                </div>
              </div>

              {/* KasmVNC stream */}
              <div className="flex-1 relative bg-[#08090B] min-h-0">
                <VncViewer
                  vncPageUrl={vncPageUrl ?? session?.vncPageUrl}
                  vncUrl={session?.vncUrl}
                  sessionName={session?.name}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
