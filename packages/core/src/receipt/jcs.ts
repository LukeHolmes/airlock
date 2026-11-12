/**
 * JSON Canonicalization Scheme (RFC 8785).
 */

function hasLoneSurrogate(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        return true;
      }
      i += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function serializeString(value: string): string {
  if (hasLoneSurrogate(value)) {
    throw new TypeError('JCS: lone surrogate in string');
  }
  let out = '"';
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    const code = value.charCodeAt(i);
    if (ch === '"') {
      out += '\\"';
    } else if (ch === '\\') {
      out += '\\\\';
    } else if (code === 0x08) {
      out += '\\b';
    } else if (code === 0x09) {
      out += '\\t';
    } else if (code === 0x0a) {
      out += '\\n';
    } else if (code === 0x0c) {
      out += '\\f';
    } else if (code === 0x0d) {
      out += '\\r';
    } else if (code >= 0x00 && code <= 0x1f) {
      out += `\\u${code.toString(16).padStart(4, '0')}`;
    } else {
      out += ch;
    }
  }
  out += '"';
  return out;
}

/** ECMAScript Number::toString (IEEE-754) — rejects NaN/Infinity. */
function serializeNumber(value: number): string {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    throw new TypeError('JCS: non-finite number');
  }
  if (Object.is(value, -0)) {
    return '0';
  }
  return Number(value).toString();
}

function sortPropertyNames(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    if (a === b) {
      return 0;
    }
    return a < b ? -1 : 1;
  });
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
    const keys = sortPropertyNames(Object.keys(record));
    const entries = keys
      .filter((key) => record[key] !== undefined)
      .map((key) => `${serializeString(key)}:${canonicalizeJson(record[key])}`);
    return `{${entries.join(',')}}`;
  }
  throw new TypeError(`JCS cannot canonicalize type ${typeof value}`);
}
