import assert from 'node:assert/strict';
import { test } from 'node:test';

import { assertFlattenedPdfBytes, containerTargetPathForHostFile } from './flattenedPdf.js';

test('containerTargetPathForHostFile preserves extension', () => {
  assert.equal(
    containerTargetPathForHostFile('/tmp/report.PDF'),
    '/home/airlock/workspace/input/target.pdf',
  );
});

test('assertFlattenedPdfBytes rejects javascript markers', () => {
  const bad = Buffer.from('%PDF-1.4\n/JavaScript foo\n');
  assert.throws(() => assertFlattenedPdfBytes(bad), /active-content/);
});

test('assertFlattenedPdfBytes accepts minimal benign pdf', () => {
  const ok = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj trailer<</Root 1 0 R>>\n',
  );
  assert.doesNotThrow(() => assertFlattenedPdfBytes(ok));
});
