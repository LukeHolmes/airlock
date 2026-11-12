import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildStaticTriageReport } from './normalize.js';
import { TRIAGE_NO_INDICATORS_MESSAGE, TRIAGE_SCHEMA_VERSION } from './types.js';

describe('buildStaticTriageReport', () => {
  test('builds benign pdf report', () => {
    const report = buildStaticTriageReport({
      version: 1,
      filePath: '/input/target.pdf',
      fileName: 'target.pdf',
      sizeBytes: 128,
      sha256: 'b'.repeat(64),
      detectedMime: 'application/pdf',
      declaredExtension: '.pdf',
      exiftool: [{ MIMEType: 'application/pdf', Title: 'Test' }],
    });
    assert.equal(report.schemaVersion, TRIAGE_SCHEMA_VERSION);
    assert.equal(report.riskLevel, 'none');
    assert.equal(report.statusMessage, TRIAGE_NO_INDICATORS_MESSAGE);
    assert.equal(report.input.magicMatchesExtension, true);
  });

  test('maps office macro fields', () => {
    const report = buildStaticTriageReport({
      version: 1,
      filePath: '/input/target.docm',
      fileName: 'target.docm',
      sizeBytes: 2048,
      sha256: 'c'.repeat(64),
      detectedMime: 'application/vnd.ms-office',
      declaredExtension: '.docm',
      office: {
        format: 'OLE',
        macros: true,
        auto_exec: ['AutoOpen'],
      },
      yara: [{ rule: 'airlock_office_autoexec_macro' }],
    });
    assert.equal(report.findings.office?.macrosPresent, true);
    assert.equal(report.riskLevel, 'high');
    assert.ok(report.indicators.length > 0);
  });
});
