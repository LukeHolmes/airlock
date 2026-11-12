import type { TriageUrlFinding } from './types.js';

const SHORTENER_HOSTS = new Set([
  'bit.ly',
  't.co',
  'tinyurl.com',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'rebrand.ly',
  'shorturl.at',
]);

const IPV4_HOST = /^\d{1,3}(\.\d{1,3}){3}$/;
const IPV6_BRACKET = /^\[.+\]$/;
const CYRILLIC_IN_HOST = /[\u0400-\u04FF]/;

/** Offline URL heuristics — parse only, no fetch or resolve. */
export function urlFlags(url: string): string[] {
  const flags: string[] = [];
  let parsed: URL;
  try {
    const normalized = /^https?:\/\//i.test(url) ? url : `http://${url}`;
    parsed = new URL(normalized);
  } catch {
    return flags;
  }

  const host = (parsed.hostname || '').toLowerCase();
  if (!host) {
    return flags;
  }

  if (IPV4_HOST.test(host) || IPV6_BRACKET.test(host)) {
    flags.push('ip_literal');
  }
  if (host.includes('xn--')) {
    flags.push('punycode');
  }
  if (CYRILLIC_IN_HOST.test(host) && /[a-zA-Z]/.test(host)) {
    flags.push('homoglyph');
  }
  for (const short of SHORTENER_HOSTS) {
    if (host === short || host.endsWith(`.${short}`)) {
      flags.push('url_shortener');
      break;
    }
  }
  return flags;
}

export function xrayUrlAsEntered(urlAsEntered: string): TriageUrlFinding[] {
  const trimmed = urlAsEntered.trim();
  if (!trimmed) {
    return [];
  }
  return [
    {
      url: trimmed.slice(0, 500),
      flags: urlFlags(trimmed),
    },
  ];
}

const ELEVATED_URL_FLAGS = new Set([
  'punycode',
  'homoglyph',
  'ip_literal',
  'url_shortener',
  'idn_encoding_error',
]);

/** Deterministic risk from offline URL checks only (no file static triage). */
export function deriveUrlOnlyRiskLevel(
  urls: TriageUrlFinding[],
): import('./types.js').TriageRiskLevel {
  if (urls.length === 0) {
    return 'none';
  }
  const allFlags = urls.flatMap((u) => u.flags);
  if (allFlags.some((f) => ELEVATED_URL_FLAGS.has(f))) {
    return 'medium';
  }
  return 'low';
}
