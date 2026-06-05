import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, FileDown, Link, Zap, Trash2, Box, Terminal } from 'lucide-react';

type AppState = 'idle' | 'igniting' | 'active';

export default function AirlockApp() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // --- Mock IPC Backend Calls ---
  const mockDetonate = (type: 'file' | 'url', payload: string) => {
    setAppState('igniting');
    setLogs([]);

    const sequence = [
      `[sys] Allocating ephemeral workspace for ${type}...`,
      '[docker] Pulling minimal-linux base image...',
      '[vol] Mounting payload read-only...',
      '[net] Air-gapped network adapters verified.',
      '[vnc] Establishing secure WebRTC/WebSocket bridge...',
      '[sys] Container sealed in 312 ms.'
    ];

    let step = 0;
    const interval = setInterval(() => {
      setLogs((prev) => [...prev, sequence[step]]);
      step++;
      if (step >= sequence.length) {
        clearInterval(interval);
        setTimeout(() => setAppState('active'), 600); // Brief pause before opening canvas
      }
    }, 400); // Simulate mechanical deterministic steps
  };

  const mockBurn = () => {
    setAppState('idle');
    setUrlInput('');
    setLogs([]);
  };

  // --- Drag & Drop Handlers ---
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      mockDetonate('file', file.name);
    }
  }, []);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      mockDetonate('url', urlInput);
    }
  };

  // --- Canvas Placeholder Render ---
  useEffect(() => {
    if (appState === 'active' && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#12151A'; // surface-1
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        ctx.fillStyle = '#23272F'; // line
        ctx.font = '13px "JetBrains Mono", monospace';
        ctx.fillText('kasm-stream initialized. Awaiting X11 frames...', 20, 30);
      }
    }
  }, [appState]);

  return (
    <div className="min-h-screen w-full bg-[#08090B] text-[#ECEFF3] font-sans overflow-hidden flex flex-col selection:bg-[#3DE8D4]/20 selection:text-[#04201D]">
      
      {/* Background Texture: Subtle Grid */}
      <div className="absolute inset-0 pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

      {/* Top Command Bar */}
      <header className="h-12 border-b border-[#23272F] bg-[#0C0E11]/80 backdrop-blur-md flex items-center justify-between px-4 z-10 window-drag">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-6 h-6 text-[#3DE8D4]">
            <ShieldCheck size={18} strokeWidth={2} />
          </div>
          <span className="font-mono text-[11px] font-medium tracking-[0.18em] uppercase text-[#7E8B9A]">Airlock</span>
        </div>
        
        {appState === 'active' && (
          <div className="flex items-center gap-4 no-drag">
            <div className="flex items-center gap-2 bg-[#28D3BF]/10 border border-[#28D3BF]/20 px-2.5 py-1 rounded-[4px]">
              <span className="w-2 h-2 rounded-full bg-[#3DE8D4] shadow-[0_0_8px_#3DE8D4]" />
              <span className="font-mono text-[11px] font-medium tracking-widest text-[#3DE8D4] uppercase">Sealed</span>
            </div>
            <button 
              onClick={mockBurn}
              className="flex items-center gap-2 bg-[#F23D3D] hover:bg-[#FF5757] text-[#1A0A02] px-3 py-1.5 rounded-[6px] font-mono text-[12.5px] font-semibold transition-all duration-150 shadow-[0_0_15px_rgba(242,61,61,0.2)] active:scale-[0.97]"
            >
              <Trash2 size={14} />
              Destroy workspace
            </button>
          </div>
        )}
      </header>

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
                  ${isDragging 
                    ? 'border-[#3DE8D4] bg-[#3DE8D4]/5 shadow-[0_0_0_1px_#0E5B53,0_0_22px_rgba(61,232,212,0.15)]' 
                    : 'border-dashed border-[#333944] bg-[#0C0E11] hover:border-[#7E8B9A] hover:bg-[#12151A]'
                  }`}
              >
                <div className={`p-4 rounded-full mb-4 transition-colors duration-200 ${isDragging ? 'bg-[#3DE8D4]/10 text-[#3DE8D4]' : 'bg-[#181C22] text-[#AAB3BE]'}`}>
                  <FileDown size={32} strokeWidth={1.5} />
                </div>
                <h2 className="text-[23px] font-semibold text-[#ECEFF3] tracking-tight mb-2">
                  Drop a file to detonate
                </h2>
                <p className="text-[15px] text-[#AAB3BE] max-w-[280px] text-center">
                  Opens in a sealed, air-gapped workspace.
                </p>
                
                {/* Visual Scanner: one-time sweep on drag enter, fades out at bottom */}
                {isDragging && (
                  <motion.div 
                    className="absolute top-0 left-0 w-full h-[1px] bg-[#3DE8D4] shadow-[0_0_10px_#3DE8D4]"
                    initial={{ top: '0%', opacity: 1 }}
                    animate={{ top: '100%', opacity: 0 }}
                    transition={{ duration: 0.6, ease: 'linear' }}
                  />
                )}
              </div>

              {/* URL Input Bar */}
              <form onSubmit={handleUrlSubmit} className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Link size={16} className="text-[#6E7782] group-focus-within:text-[#FF6A2B] transition-colors" />
                </div>
                <input 
                  type="url" 
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Or paste an untrusted URL..."
                  className="w-full bg-[#12151A] border border-[#23272F] rounded-[6px] py-3 pl-10 pr-24 text-[13px] font-mono text-[#AAB3BE] placeholder-[#474E58] focus:outline-none focus:border-[#FF6A2B] focus:ring-1 focus:ring-[#FF6A2B]/30 transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.03),_0_1px_2px_rgba(0,0,0,0.4)]"
                />
                <button 
                  type="submit"
                  disabled={!urlInput}
                  className="absolute inset-y-1 right-1 px-4 bg-[#FF6A2B] hover:bg-[#FF7A36] disabled:bg-[#333944] disabled:text-[#6E7782] text-[#1A0A02] text-[13px] font-medium font-sans rounded-[4px] flex items-center gap-2 transition-colors duration-150"
                >
                  <Zap size={14} />
                  Detonate
                </button>
              </form>
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
                <h3 className="text-[17px] font-semibold text-[#ECEFF3]">Orchestrating isolation...</h3>
              </div>
              <div className="font-mono text-[12.5px] text-[#AAB3BE] flex flex-col gap-2 min-h-[160px]">
                {logs.map((log, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={log.includes('sealed') ? 'text-[#3DE8D4]' : ''}
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
                       root@airlock-instance-04:~#
                     </span>
                   </div>
                </div>
              </div>
              
              {/* Canvas Rendering the VNC Feed */}
              <div className="flex-1 relative bg-[#08090B]">
                <canvas 
                  ref={canvasRef}
                  id="kasm-stream"
                  width={1024}
                  height={768}
                  className="w-full h-full object-contain"
                />
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </main>
    </div>
  );
}
