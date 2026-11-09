import React from 'react';
import { Loader2, CheckCircle2, Circle, AlertCircle, RefreshCw } from 'lucide-react';

import type { AirlockReadiness, SandboxSetupProgress } from '../shared/ipc.js';

export type FirstRunStage = {
  id: 'checking-docker' | 'preparing-image' | 'ready';
  label: string;
  state: 'pending' | 'active' | 'complete' | 'error';
};

export type FirstRunFailure = {
  message: string;
  canRetry: boolean;
  code?: string;
};

type FirstRunProgressProps = {
  readiness: AirlockReadiness | null;
  stages: FirstRunStage[];
  progress: SandboxSetupProgress | null;
  logLines: string[];
  status: 'idle' | 'running' | 'failed' | 'complete';
  failure: FirstRunFailure | null;
  onRetry: () => void;
  onOpenDockerDownload: () => void;
  onOpenSetupGuide: () => void;
};

function stageIcon(state: FirstRunStage['state']) {
  switch (state) {
    case 'complete':
      return <CheckCircle2 size={18} className="text-[#3DE8D4]" />;
    case 'active':
      return <Loader2 size={18} className="text-[#3DE8D4] animate-spin" />;
    case 'error':
      return <AlertCircle size={18} className="text-[#F23D3D]" />;
    default:
      return <Circle size={18} className="text-[#474E58]" />;
  }
}

export default function FirstRunProgress({
  readiness,
  stages,
  progress,
  logLines,
  status,
  failure,
  onRetry,
  onOpenDockerDownload,
  onOpenSetupGuide,
}: FirstRunProgressProps) {
  const dockerMissing = readiness !== null && !readiness.docker.available;
  const headline = dockerMissing
    ? 'Docker is required'
    : status === 'failed'
      ? 'Sandbox setup failed'
      : status === 'complete'
        ? 'Sandbox ready'
        : 'Preparing your sandbox';

  const subline = dockerMissing
    ? 'Install Docker Desktop, start it, and click Retry when Docker is running.'
    : (progress?.message ??
      'One-time download or build (~1–2 GB). Keep Docker running until setup finishes.');

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#08090B]/95 backdrop-blur-sm p-6"
      data-testid="first-run-progress"
    >
      <div className="w-full max-w-xl rounded-[10px] border border-[#23272F] bg-[#0C0E11] shadow-[0_18px_44px_rgba(0,0,0,0.65)] p-6">
        <h2 className="text-[20px] font-semibold text-[#ECEFF3] mb-1">{headline}</h2>
        <p className="text-[14px] text-[#AAB3BE] mb-6 leading-relaxed">{subline}</p>

        <ol className="flex flex-col gap-3 mb-6">
          {stages.map((stage) => (
            <li
              key={stage.id}
              className={`flex items-center gap-3 rounded-[6px] border px-3 py-2.5 ${
                stage.state === 'active'
                  ? 'border-[#3DE8D4]/40 bg-[#3DE8D4]/5'
                  : stage.state === 'error'
                    ? 'border-[#F23D3D]/40 bg-[#F23D3D]/5'
                    : stage.state === 'complete'
                      ? 'border-[#23272F] bg-[#12151A]'
                      : 'border-[#23272F] bg-[#12151A]/60 opacity-80'
              }`}
            >
              {stageIcon(stage.state)}
              <span
                className={`text-[13px] font-medium ${
                  stage.state === 'error'
                    ? 'text-[#F23D3D]'
                    : stage.state === 'active'
                      ? 'text-[#3DE8D4]'
                      : 'text-[#ECEFF3]'
                }`}
              >
                {stage.label}
              </span>
            </li>
          ))}
        </ol>

        {!dockerMissing && (
          <div className="rounded-[6px] border border-[#23272F] bg-[#08090B] p-3 mb-5 min-h-[120px] max-h-[180px] overflow-y-auto font-mono text-[11.5px] text-[#7E8B9A] leading-relaxed">
            {logLines.length === 0 ? (
              <span className="text-[#6E7782]">Waiting for Docker output…</span>
            ) : (
              logLines.map((line, index) => (
                <div key={`${index}-${line.slice(0, 24)}`} className="whitespace-pre-wrap">
                  {line}
                </div>
              ))
            )}
          </div>
        )}

        {failure && (
          <p className="text-[13px] text-[#F23D3D] mb-4 leading-relaxed" role="alert">
            {failure.message}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {(dockerMissing || failure?.canRetry === true || status === 'failed') && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#3DE8D4] text-[#04201D] rounded-[4px] text-[12px] font-medium"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          )}
          {dockerMissing && (
            <button
              type="button"
              onClick={onOpenDockerDownload}
              className="px-3 py-1.5 bg-[#23272F] rounded-[4px] text-[12px] text-[#ECEFF3]"
            >
              Download Docker Desktop
            </button>
          )}
          <button
            type="button"
            onClick={onOpenSetupGuide}
            className="px-3 py-1.5 bg-[#181C22] border border-[#23272F] rounded-[4px] text-[12px] text-[#AAB3BE]"
          >
            Setup guide
          </button>
        </div>
      </div>
    </div>
  );
}
