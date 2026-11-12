import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { canonicalizeJson } from './jcs.js';

describe('JCS canonicalizeJson', () => {
  test('sorts object keys and omits whitespace', () => {
    const a = canonicalizeJson({ b: 2, a: 1 });
    const b = canonicalizeJson({ a: 1, b: 2 });
    assert.equal(a, b);
    assert.equal(a, '{"a":1,"b":2}');
  });

  test('is stable across key order permutations', () => {
    const values = [
      { z: 1, m: 2, a: 3 },
      { a: 3, m: 2, z: 1 },
      { m: 2, z: 1, a: 3 },
    ];
    const canon = values.map((v) => canonicalizeJson(v));
    assert.ok(canon.every((c) => c === canon[0]));
  });

  test('escapes control characters in strings', () => {
    assert.equal(canonicalizeJson({ key: 'a\nb' }), '{"key":"a\\nb"}');
  });
});
