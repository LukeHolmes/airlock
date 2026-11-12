import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import { canonicalizeJson } from './jcs.js';

const here = path.dirname(fileURLToPath(import.meta.url));

describe('RFC 8785 vectors', () => {
  test('Section 3.2.3 sorting sample canonical form', () => {
    const input = {
      string: `€$\u000f\nA'B"\\"/`,
      numbers: [333333333.3333333, 1e30, 4.5, 0.002, 1e-27],
      literals: [null, true, false],
    };
    const canon = canonicalizeJson(input);
    assert.equal(
      canon,
      '{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"string":"€$\\u000f\\nA\'B\\"\\\\\\"/"}',
    );
  });

  test('property name UTF-16 sort order', () => {
    const input = JSON.parse(
      '{"\\u20ac":"Euro Sign","\\r":"Carriage Return","\\ufb33":"Hebrew","1":"One","\\ud83d\\ude00":"Emoji","\\u0080":"Control","\\u00f6":"Latin o"}',
    );
    const canon = canonicalizeJson(input);
    const valueOrder = [
      'Carriage Return',
      'One',
      'Control',
      'Latin o',
      'Euro Sign',
      'Emoji',
      'Hebrew',
    ];
    let last = -1;
    for (const value of valueOrder) {
      const index = canon.indexOf(`:"${value}"`);
      assert.ok(index > last, `expected ${value} after prior keys in ${canon}`);
      last = index;
    }
  });

  test('fixtures file round-trip expectations', () => {
    const vectorsPath = path.join(
      here,
      '..',
      '..',
      'src',
      'receipt',
      'fixtures',
      'jcs-vectors.json',
    );
    const vectors = JSON.parse(readFileSync(vectorsPath, 'utf8')) as Array<{
      name: string;
      input: unknown;
      expected: string;
    }>;
    for (const vector of vectors) {
      assert.equal(canonicalizeJson(vector.input), vector.expected, vector.name);
    }
  });
});
