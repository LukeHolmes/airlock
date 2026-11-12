import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  collectIndicators,
  deriveTriageRiskLevel,
  deriveTriageStatusMessage,
  extensionExpectsMime,
} from './riskRules.js';
import { TRIAGE_NO_INDICATORS_MESSAGE } from './types.js';

describe('deriveTriageRiskLevel', () => {
  test('returns none when no signals', () => {
    assert.equal(
      deriveTriageRiskLevel({
        magicMatchesExtension: true,
        yara: [],
        indicators: [],
      }),
      'none',
    );
  });

  test('extension mismatch is high', () => {
    assert.equal(
      deriveTriageRiskLevel({
        magicMatchesExtension: false,
        yara: [],
        indicators: ['mismatch'],
      }),
      'high',
    );
  });

  test('critical YARA rule is high', () => {
    assert.equal(
      deriveTriageRiskLevel({
        magicMatchesExtension: true,
        yara: [{ rule: 'airlock_eicar_test_string' }],
        indicators: ['YARA: airlock_eicar_test_string'],
      }),
      'high',
    );
  });

  test('PDF javascript plus launch is high', () => {
    assert.equal(
      deriveTriageRiskLevel({
        magicMatchesExtension: true,
        yara: [],
        pdf: {
          javascript: true,
          openAction: false,
          launch: true,
          embeddedFileCount: 0,
          suspiciousKeywords: [],
        },
        indicators: [],
      }),
      'high',
    );
  });
});

describe('deriveTriageStatusMessage', () => {
  test('uses exact none copy', () => {
    assert.equal(deriveTriageStatusMessage('none', []), TRIAGE_NO_INDICATORS_MESSAGE);
  });
});

describe('extensionExpectsMime', () => {
  test('detects pdf spoof', () => {
    assert.equal(extensionExpectsMime('.pdf', 'application/x-msdownload'), false);
    assert.equal(extensionExpectsMime('.pdf', 'application/pdf'), true);
  });
});

describe('collectIndicators', () => {
  test('collects pdf and yara strings', () => {
    const indicators = collectIndicators({
      version: 1,
      filePath: '/x',
      fileName: 'x.pdf',
      sizeBytes: 1,
      sha256: 'a'.repeat(64),
      detectedMime: 'application/pdf',
      declaredExtension: '.pdf',
      yara: [{ rule: 'airlock_pdf_javascript' }],
      pdf: { javascript: true },
    });
    assert.ok(indicators.some((i) => i.startsWith('YARA:')));
    assert.ok(indicators.some((i) => i.includes('JavaScript')));
  });
});
