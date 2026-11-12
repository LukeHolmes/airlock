import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isPlainTextExportSupported } from './plainTextExportSupport.js';

test('isPlainTextExportSupported recognises pdf and office', () => {
  assert.equal(isPlainTextExportSupported('/tmp/report.PDF'), true);
  assert.equal(isPlainTextExportSupported('/tmp/macro.docm'), false);
  assert.equal(isPlainTextExportSupported('/tmp/sheet.xlsx'), true);
  assert.equal(isPlainTextExportSupported('/tmp/unknown.bin'), false);
});
