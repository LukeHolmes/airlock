import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { TRIAGE_SCHEMA_VERSION, TRIAGE_NO_INDICATORS_MESSAGE } from '../triage/types.js';
import type { StaticTriageReport } from '../triage/types.js';
import { buildInspectionReceiptPayload } from './buildPayload.js';
import { generateEd25519KeyMaterial } from './crypto.js';
import { canonicalizeReceiptPayload, signInspectionReceipt } from './sign.js';
import { verifySignedInspectionReceipt } from './verify.js';

function sampleReport(): StaticTriageReport {
  return {
    schemaVersion: TRIAGE_SCHEMA_VERSION,
    completedAt: '2026-01-01T00:00:00.000Z',
    durationMs: 12,
    inspectionToolchain: {
      yaraRulesSha256: 'abc'.repeat(21).slice(0, 64),
      tools: { yara: '4.5.0' },
    },
    input: {
      fileName: 'sample.pdf',
      sizeBytes: 4,
      sha256: 'deadbeef',
      declaredExtension: '.pdf',
      detectedMime: 'application/pdf',
      magicMatchesExtension: true,
    },
    findings: {
      exifFieldCount: 0,
      exifHighlights: [],
      yara: [],
    },
    indicators: [],
    riskLevel: 'none',
    statusMessage: TRIAGE_NO_INDICATORS_MESSAGE,
    toolErrors: [],
  };
}

describe('signed inspection receipt', () => {
  test('sign and verify round trip', () => {
    const keys = generateEd25519KeyMaterial();
    const payload = buildInspectionReceiptPayload({
      kind: 'file',
      appVersion: '0.5.0-test',
      sandboxImage: { ref: 'airlock/sandbox:test', digest: 'sha256:1111' },
      inspectionToolchain: sampleReport().inspectionToolchain!,
      staticTriage: sampleReport(),
      sessionId: 'sess-1',
      startedAtMs: Date.parse('2026-01-01T00:00:00.000Z'),
      endedAtMs: Date.parse('2026-01-01T00:05:00.000Z'),
      signingPublicKeySpki: keys.publicKeySpki,
      keyProtectionLevel: 'os-keychain',
    });

    const receipt = signInspectionReceipt(payload, keys.privateKeyPkcs8, keys.publicKeySpki);
    const result = verifySignedInspectionReceipt(receipt);
    assert.equal(result.ok, true);
  });

  test('tampered payload fails verification', () => {
    const keys = generateEd25519KeyMaterial();
    const payload = buildInspectionReceiptPayload({
      kind: 'file',
      appVersion: '0.5.0-test',
      sandboxImage: { ref: 'airlock/sandbox:test', digest: 'sha256:1111' },
      inspectionToolchain: sampleReport().inspectionToolchain!,
      staticTriage: sampleReport(),
      sessionId: 'sess-1',
      startedAtMs: Date.parse('2026-01-01T00:00:00.000Z'),
      endedAtMs: Date.parse('2026-01-01T00:05:00.000Z'),
      signingPublicKeySpki: keys.publicKeySpki,
      keyProtectionLevel: 'os-keychain',
    });
    const receipt = signInspectionReceipt(payload, keys.privateKeyPkcs8, keys.publicKeySpki);
    const tampered = structuredClone(receipt);
    if (tampered.payload.input) {
      tampered.payload.input.sha256 = '0000';
    }
    const result = verifySignedInspectionReceipt(tampered);
    assert.equal(result.ok, false);
  });

  test('canonical payload is stable', () => {
    const keys = generateEd25519KeyMaterial();
    const payload = buildInspectionReceiptPayload({
      kind: 'file',
      appVersion: '0.5.0',
      sandboxImage: { ref: 'airlock/sandbox:latest', digest: 'sha256:abcd' },
      inspectionToolchain: { yaraRulesSha256: 'ff', tools: {} },
      staticTriage: sampleReport(),
      sessionId: 'id',
      startedAtMs: 1,
      endedAtMs: 2,
      signingPublicKeySpki: keys.publicKeySpki,
      keyProtectionLevel: 'file-0600',
    });
    const a = canonicalizeReceiptPayload(payload);
    const b = canonicalizeReceiptPayload(structuredClone(payload));
    assert.equal(a, b);
  });

  test('url session receipt verifies', () => {
    const keys = generateEd25519KeyMaterial();
    const payload = buildInspectionReceiptPayload({
      kind: 'url',
      appVersion: '0.5.0',
      sandboxImage: { ref: 'airlock/sandbox:latest', digest: 'sha256:abcd' },
      urlAsEntered: 'https://bit.ly/example',
      offlineUrlXray: [{ url: 'https://bit.ly/example', flags: ['url_shortener'] }],
      riskLevel: 'medium',
      sessionId: 'url-1',
      startedAtMs: 1,
      endedAtMs: 2,
      signingPublicKeySpki: keys.publicKeySpki,
      keyProtectionLevel: 'os-keychain',
    });
    const receipt = signInspectionReceipt(payload, keys.privateKeyPkcs8, keys.publicKeySpki);
    const result = verifySignedInspectionReceipt(receipt);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(
        result.payload.urlInspection?.noFileStaticTriage,
        'no_file_static_triage_performed',
      );
    }
  });
});
