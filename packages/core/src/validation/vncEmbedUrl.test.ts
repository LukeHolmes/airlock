import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { isAllowedVncEmbedUrl } from './vncEmbedUrl.js';

describe('isAllowedVncEmbedUrl', () => {
  test('allows loopback HTTP VNC pages', () => {
    assert.equal(isAllowedVncEmbedUrl('http://127.0.0.1:32768/vnc.html?autoconnect=true'), true);
    assert.equal(isAllowedVncEmbedUrl('http://localhost:6901/'), true);
  });

  test('rejects remote or non-HTTP origins', () => {
    assert.equal(isAllowedVncEmbedUrl('https://127.0.0.1:1/'), false);
    assert.equal(isAllowedVncEmbedUrl('http://evil.example/vnc.html'), false);
  });
});
