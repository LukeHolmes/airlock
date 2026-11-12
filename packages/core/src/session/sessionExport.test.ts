import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  SESSION_EXPORT_SCHEMA_VERSION,
  extractContainerIdFromLogs,
  formatSessionExportJson,
  serializeSessionExport,
  type SessionExportDocument,
} from './sessionExport.js';

const baseArtefacts = {
  sessionId: '11111111-1111-4111-8111-111111111111',
  input: { type: 'file' as const, value: '/tmp/report.pdf' },
  metadata: {
    startTime: 1_700_000_000_000,
    endTime: 1_700_000_060_000,
    exitReason: 'user_destroy' as const,
    inputType: 'file' as const,
    networkMode: 'isolated' as const,
  },
  logs: [
    {
      ts: 1_700_000_000_100,
      event: 'INPUT_RECEIVED',
      payload: { sessionId: '11111111-1111-4111-8111-111111111111', type: 'file' },
    },
    {
      ts: 1_700_000_000_200,
      event: 'SESSION_CREATED',
      payload: {
        sessionId: '11111111-1111-4111-8111-111111111111',
        containerId: 'abc123deadbeef',
      },
    },
  ],
};

const baseAnalysis = {
  summary: 'Isolated file session completed normally.',
  riskLevel: 'low' as const,
  observations: ['File opened read-only inside the sandbox.'],
  signals: ['Container reached running state.'],
  recommendation: 'No further action required for this session.',
};

test('serializeSessionExport builds a versioned document', () => {
  const document = serializeSessionExport({
    exportedAt: '2026-11-09T12:00:00.000Z',
    appVersion: '0.4.1',
    sessionId: baseArtefacts.sessionId,
    containerId: 'abc123deadbeef',
    artefacts: baseArtefacts,
    analysis: baseAnalysis,
    inputFingerprint: {
      fileName: 'report.pdf',
      sizeBytes: 42_000,
      mimeType: 'application/pdf',
      extension: '.pdf',
      sha256: 'deadbeef'.repeat(8),
    },
  });

  assert.equal(document.schemaVersion, SESSION_EXPORT_SCHEMA_VERSION);
  assert.equal(document.session.sessionId, baseArtefacts.sessionId);
  assert.equal(document.session.containerId, 'abc123deadbeef');
  const fingerprint = document.session.inputFingerprint;
  assert.ok(fingerprint && 'fileName' in fingerprint);
  if (fingerprint && 'fileName' in fingerprint) {
    assert.equal(fingerprint.fileName, 'report.pdf');
  }
  assert.deepEqual(document.analysis, baseAnalysis);
  assert.equal(document.artefacts.logs.length, 2);
});

test('formatSessionExportJson is stable JSON with trailing newline', () => {
  const document = serializeSessionExport({
    exportedAt: '2026-11-09T12:00:00.000Z',
    appVersion: '0.4.1',
    sessionId: baseArtefacts.sessionId,
    artefacts: baseArtefacts,
    analysis: baseAnalysis,
  });

  const json = formatSessionExportJson(document);
  assert.match(json, /\n$/);
  const parsed = JSON.parse(json) as SessionExportDocument;
  assert.equal(parsed.schemaVersion, SESSION_EXPORT_SCHEMA_VERSION);
});

test('extractContainerIdFromLogs prefers the latest container id', () => {
  const logs = [
    { ts: 1, event: 'SESSION_CREATED', payload: { containerId: 'old' } },
    { ts: 2, event: 'SESSION_DESTROYED', payload: { containerId: 'new' } },
  ];
  assert.equal(extractContainerIdFromLogs(logs), 'new');
});
