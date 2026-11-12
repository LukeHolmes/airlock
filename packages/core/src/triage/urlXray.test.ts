import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { deriveUrlOnlyRiskLevel, urlFlags, xrayUrlAsEntered } from './urlXray.js';

describe('offline url xray', () => {
  test('flags shortener without network', () => {
    assert.ok(urlFlags('https://bit.ly/example').includes('url_shortener'));
  });

  test('builds url session xray entry', () => {
    const hits = xrayUrlAsEntered('http://10.0.0.1/login');
    assert.equal(hits.length, 1);
    assert.ok(hits[0].flags.includes('ip_literal'));
  });

  test('deriveUrlOnlyRiskLevel is deterministic', () => {
    assert.equal(deriveUrlOnlyRiskLevel(xrayUrlAsEntered('https://example.com')), 'low');
    assert.equal(deriveUrlOnlyRiskLevel(xrayUrlAsEntered('http://bit.ly/x')), 'medium');
  });
});
