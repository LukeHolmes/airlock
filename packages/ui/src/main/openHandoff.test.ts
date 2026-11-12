import { describe, expect, it } from 'vitest';

import { parseAirlockUrl } from './openHandoff.js';

describe('parseAirlockUrl', () => {
  it('reads path segment and query parameters', () => {
    expect(parseAirlockUrl('airlock:///tmp/report.pdf')).toBe('/tmp/report.pdf');
    expect(parseAirlockUrl('airlock://open?path=%2Fhome%2Fme%2Fdoc.pdf')).toBe('/home/me/doc.pdf');
    expect(parseAirlockUrl('airlock://open?url=https%3A%2F%2Fexample.com')).toBe(
      'https://example.com',
    );
  });
});
