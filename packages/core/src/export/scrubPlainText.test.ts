import assert from 'node:assert/strict';
import { test } from 'node:test';

import { scrubPlainText } from './scrubPlainText.js';

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
