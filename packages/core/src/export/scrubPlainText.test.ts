import assert from 'node:assert/strict';
import { test } from 'node:test';

import { normalizeExportedPlainText, scrubPlainText } from './scrubPlainText.js';

test('scrubPlainText removes zero-width and controls', () => {
  const input = 'visible\u200bhidden\u0007\nok';
  const result = scrubPlainText(input);
  assert.equal(result.text, 'visiblehidden\nok');
  assert.ok(result.removedFormatChars >= 1);
  assert.ok(result.removedControlChars >= 1);
});

test('scrubPlainText strips HTML tags without retaining markup', () => {
  const input = '<b>Pay</b> now<script>x</script>';
  const result = scrubPlainText(input);
  assert.equal(result.text, 'Pay nowx');
  assert.ok(result.strippedHtmlTags >= 2);
});

test('normalizeExportedPlainText removes bidi overrides and caps size', () => {
  const raw = Buffer.from('hello\u202Eworld', 'utf8');
  const result = normalizeExportedPlainText(raw);
  assert.ok(!result.text.includes('\u202E'));
  assert.equal(result.byteLength, Buffer.byteLength(result.text, 'utf8'));
  const huge = Buffer.from('x'.repeat(3 * 1024 * 1024), 'utf8');
  const capped = normalizeExportedPlainText(huge, 1024);
  assert.equal(capped.truncated, true);
  assert.ok(capped.byteLength <= 1024);
});
