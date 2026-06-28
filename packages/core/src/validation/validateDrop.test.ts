import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { validateDrop } from './validateDrop.js';

function withTempFile(name: string, contents: string | Buffer, run: (filePath: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'airlock-validate-drop-'));
  const filePath = join(dir, name);
  writeFileSync(filePath, contents);
  try {
    run(filePath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('accepts a valid PDF', () => {
  withTempFile('sample.pdf', '%PDF-1.4\n% Airlock test\n', (filePath) => {
    const result = validateDrop(filePath);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.mimeType, 'application/pdf');
      assert.equal(result.extension, '.pdf');
    }
  });
});

test('rejects extension spoofing for executables', () => {
  withTempFile('invoice.pdf', 'MZ\x90\x00fake exe payload', (filePath) => {
    const result = validateDrop(filePath);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'extension_mismatch');
    }
  });
});

test('rejects empty files', () => {
  withTempFile('empty.txt', '', (filePath) => {
    const result = validateDrop(filePath);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'empty');
    }
  });
});

test('rejects missing files', () => {
  const result = validateDrop(join(tmpdir(), `missing-${process.pid}.dat`));
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'not_found');
  }
});

test('detects HTML by content', () => {
  withTempFile('page.html', '<!DOCTYPE html><html><body>hi</body></html>', (filePath) => {
    const result = validateDrop(filePath);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.mimeType, 'text/html');
    }
  });
});

test('accepts docx-shaped zip payloads', () => {
  const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]);
  withTempFile('report.docx', zipHeader, (filePath) => {
    const result = validateDrop(filePath);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.mimeType, 'application/zip');
    }
  });
});
