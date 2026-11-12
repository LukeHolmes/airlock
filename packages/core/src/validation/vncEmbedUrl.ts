/**
 * KasmVNC embed URLs must be loopback HTTP only (never remote origins).
 */
export function isAllowedVncEmbedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:') {
      return false;
    }
    return parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}
