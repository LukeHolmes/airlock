import React from 'react';
import { ListTree, Loader2 } from 'lucide-react';

import type {
  StaticTriageReport,
  TriageSessionState,
  TriageXrayFinding,
} from '@airlock/core/browser';

type NutritionLabelPanelProps = {
  triageState: TriageSessionState;
  footer?: React.ReactNode;
};

function riskBadgeClass(level: StaticTriageReport['riskLevel'] | undefined): string {
  switch (level) {
    case 'high':
      return 'bg-[#F23D3D]/15 text-[#F23D3D] border-[#F23D3D]/30';
    case 'medium':
      return 'bg-[#FF6A2B]/15 text-[#FF6A2B] border-[#FF6A2B]/30';
    case 'low':
      return 'bg-[#3DE8D4]/10 text-[#3DE8D4] border-[#3DE8D4]/30';
    default:
      return 'bg-[#23272F] text-[#AAB3BE] border-[#333944]';
  }
}

export default function NutritionLabelPanel({ triageState, footer }: NutritionLabelPanelProps) {
  const report = triageState.status === 'complete' ? triageState.report : undefined;

  return (
    <aside className="w-full md:w-[320px] lg:w-[360px] shrink-0 border-l border-[#23272F] bg-[#0C0E11] flex flex-col min-h-0">
      <div className="h-10 border-b border-[#23272F] flex items-center gap-2 px-3">
        <ListTree size={14} className="text-[#3DE8D4]" />
        <span className="font-mono text-[11px] uppercase tracking-widest text-[#7E8B9A]">
          Static nutrition label
        </span>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-3 text-[12px]">
        {triageState.status === 'pending' || triageState.status === 'running' ? (
          <div className="flex items-center gap-2 text-[#AAB3BE] font-mono">
            <Loader2 size={14} className="animate-spin text-[#3DE8D4]" />
            Running offline static triage…
          </div>
        ) : null}

        {triageState.status === 'failed' ? (
          <p className="text-[#F23D3D] font-mono text-[11px]">
            Triage unavailable: {triageState.error}
          </p>
        ) : null}

        {report ? <TriageReportBody report={report} /> : null}
      </div>
      {footer}
    </aside>
  );
}

function TriageReportBody({ report }: { report: StaticTriageReport }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[#ECEFF3] text-[13px] leading-snug">{report.statusMessage}</p>
        <span
          className={`shrink-0 px-2 py-0.5 rounded border font-mono text-[10px] uppercase ${riskBadgeClass(report.riskLevel)}`}
        >
          {report.riskLevel}
        </span>
      </div>

      <TriageMeta report={report} />

      {report.indicators.length > 0 ? <TriageIndicatorList indicators={report.indicators} /> : null}

      {report.findings.xray ? <TriageXraySection xray={report.findings.xray} /> : null}

      {report.findings.yara.length > 0 ? (
        <div>
          <h4 className="font-mono text-[10px] uppercase text-[#6E7782] mb-1">YARA</h4>
          <ul className="space-y-0.5 text-[#AAB3BE] font-mono list-disc list-inside">
            {report.findings.yara.map((hit) => (
              <li key={hit.rule}>{hit.rule}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-[10px] text-[#474E58] font-mono border-t border-[#1A1E24] pt-2">
        Isolation is the primary control — static checks are not a verdict.
      </p>
    </>
  );
}

function TriageMeta({ report }: { report: StaticTriageReport }) {
  const { input } = report;
  return (
    <dl className="font-mono text-[#7E8B9A] space-y-1">
      <div>
        <dt className="inline text-[#6E7782]">SHA-256 </dt>
        <dd className="inline break-all text-[#AAB3BE]">{input.sha256.slice(0, 16)}…</dd>
      </div>
      <div>
        <dt className="inline text-[#6E7782]">MIME </dt>
        <dd className="inline text-[#AAB3BE]">{input.detectedMime}</dd>
      </div>
      <div>
        <dt className="inline text-[#6E7782]">Extension match </dt>
        <dd className="inline text-[#AAB3BE]">
          {input.magicMatchesExtension ? 'yes' : 'no — mismatch'}
        </dd>
      </div>
    </dl>
  );
}

function TriageXraySection({ xray }: { xray: TriageXrayFinding }) {
  const hasData =
    xray.hiddenText.length > 0 ||
    xray.invisibleUnicode.length > 0 ||
    xray.qrCodes.length > 0 ||
    xray.urls.length > 0;
  if (!hasData) {
    return null;
  }
  return (
    <div className="border border-[#23272F] rounded-[6px] p-2 space-y-2 bg-[#12151A]/80">
      <h4 className="font-mono text-[10px] uppercase tracking-wider text-[#3DE8D4]">
        Content X-ray (offline)
      </h4>
      {xray.hiddenText.length > 0 ? (
        <ul className="text-[#AAB3BE] list-disc list-inside space-y-0.5">
          {xray.hiddenText.slice(0, 8).map((h) => (
            <li key={`${h.kind}-${h.detail}`}>
              <span className="font-mono text-[#7E8B9A]">{h.kind}: </span>
              {h.detail.slice(0, 100)}
            </li>
          ))}
        </ul>
      ) : null}
      {xray.qrCodes.length > 0 ? <XrayQrList codes={xray.qrCodes} /> : null}
      {xray.urls.length > 0 ? <XrayUrlList urls={xray.urls} /> : null}
    </div>
  );
}

function XrayQrList({ codes }: { codes: TriageXrayFinding['qrCodes'] }) {
  return (
    <XraySubsection title="QR (decoded, not fetched)">
      <ul className="font-mono text-[11px] text-[#AAB3BE] space-y-1 break-all">
        {codes.map((qr) => (
          <li key={`${qr.source}-${qr.payload}`}>{qr.payload.slice(0, 120)}</li>
        ))}
      </ul>
    </XraySubsection>
  );
}

function XrayUrlList({ urls }: { urls: TriageXrayFinding['urls'] }) {
  return (
    <XraySubsection title="URLs (not resolved)">
      <ul className="space-y-1">
        {urls.slice(0, 10).map((u) => (
          <li key={u.url} className="font-mono text-[11px] break-all text-[#AAB3BE]">
            {u.url.slice(0, 100)}
            {u.flags.length > 0 ? (
              <span className="text-[#FF6A2B]"> [{u.flags.join(', ')}]</span>
            ) : null}
          </li>
        ))}
      </ul>
    </XraySubsection>
  );
}

function XraySubsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h5 className="font-mono text-[9px] uppercase text-[#6E7782] mb-0.5">{title}</h5>
      {children}
    </div>
  );
}

function TriageIndicatorList({ indicators }: { indicators: string[] }) {
  return (
    <div>
      <h4 className="font-mono text-[10px] uppercase text-[#6E7782] mb-1">Indicators</h4>
      <ul className="space-y-1 text-[#AAB3BE] list-disc list-inside">
        {indicators.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
