import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildStaticTriageReport } from './normalize.js';
import { deriveTriageRiskLevel } from './riskRules.js';
import { TRIAGE_NO_INDICATORS_MESSAGE, TRIAGE_SCHEMA_VERSION } from './types.js';

describe('X-ray triage (M2)', () => {
  test('maps invisible unicode and URL flags', () => {
    const report = buildStaticTriageReport({
      version: 2,
      filePath: '/input/hidden.txt',
      fileName: 'hidden.txt',
      sizeBytes: 32,
      sha256: 'd'.repeat(64),
      detectedMime: 'text/plain',
      declaredExtension: '.txt',
      xray: {
        hidden_text: [{ kind: 'invisible_unicode', detail: 'U+200B ×1' }],
        invisible_unicode: [{ codepoint: 'U+200B', count: 1 }],
        qr_codes: [],
        urls: [
          {
            url: 'http://bit.ly/foo',
            flags: ['url_shortener'],
          },
        ],
      },
    });
    assert.equal(report.schemaVersion, TRIAGE_SCHEMA_VERSION);
    assert.ok(report.findings.xray);
    assert.equal(report.riskLevel, 'medium');
    assert.notEqual(report.statusMessage, TRIAGE_NO_INDICATORS_MESSAGE);
  });

  test('href mismatch elevates risk', () => {
    const level = deriveTriageRiskLevel({
      magicMatchesExtension: true,
      yara: [],
      indicators: [],
      xray: {
        hiddenText: [],
        invisibleUnicode: [],
        qrCodes: [],
        urls: [{ url: 'http://a.example', flags: ['href_display_mismatch'] }],
      },
    });
    assert.equal(level, 'high');
  });
});
