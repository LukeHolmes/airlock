/**
 * JSON Canonicalization Scheme (RFC 8785) — minimal implementation for signing.
 */

function serializeString(value: string): string {
  let out = '"';
  for (const ch of value) {
    const code = ch.charCodeAt(0);
    if (ch === '"') {
      out += '\\"';
    } else if (ch === '\\') {
      out += '\\\\';
    } else if (code < 0x20) {
      if (ch === '\b') {
        out += '\\b';
      } else if (ch === '\f') {
        out += '\\f';
      } else if (ch === '\n') {
        out += '\\n';
      } else if (ch === '\r') {
        out += '\\r';
      } else if (ch === '\t') {
        out += '\\t';
      } else {
        out += `\\u${code.toString(16).padStart(4, '0')}`;
      }
    } else if (code === 0x7f) {
      out += '\\u007f';
    } else {
      out += ch;
    }
  }
  out += '"';
  return out;
}

function serializeNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new TypeError('JCS does not support non-finite numbers');
  }
  if (Object.is(value, -0)) {
    return '0';
  }
  if (Math.abs(value) < 1e21 && Number.isInteger(value)) {
    return Number(value).toFixed(0);
  }
  return JSON.stringify(value);
}

function compareKeys(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  const min = Math.min(a.length, b.length);
  for (let i = 0; i < min; i += 1) {
    const ca = a.codePointAt(i)!;
    const cb = b.codePointAt(i)!;
    if (ca !== cb) {
      return ca < cb ? -1 : 1;
    }
    if (ca > 0xffff) {
      i += 1;
    }
  }
  return a.length < b.length ? -1 : a.length > b.length ? 1 : 0;
}

export function canonicalizeJson(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return serializeNumber(value);
  }
  if (typeof value === 'string') {
    return serializeString(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalizeJson(entry)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort(compareKeys);
    const entries = keys
      .filter((key) => record[key] !== undefined)
      .map((key) => `${serializeString(key)}:${canonicalizeJson(record[key])}`);
    return `{${entries.join(',')}}`;
  }
  throw new TypeError(`JCS cannot canonicalize type ${typeof value}`);
}
