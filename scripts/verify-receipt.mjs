#!/usr/bin/env node
/**
 * Verify a signed Airlock inspection receipt (offline).
 *
 * Usage:
 *   node scripts/verify-receipt.mjs <receipt.json> [--public-key <export.json|pem>]
 */
import { readFileSync } from 'node:fs';
import { createPublicKey } from 'node:crypto';
import { verifyReceiptJson } from '../packages/core/dist/receipt/verify.js';

function usage() {
  console.error('Usage: node scripts/verify-receipt.mjs <receipt.json> [--public-key <file>]');
  process.exit(2);
}

const args = process.argv.slice(2);
if (args.length < 1) {
  usage();
}

let receiptPath = args[0];
let publicKeySpki;
for (let i = 1; i < args.length; i += 1) {
  if (args[i] === '--public-key' && args[i + 1]) {
    const keyPath = args[++i];
    const raw = readFileSync(keyPath, 'utf8').trim();
    if (raw.startsWith('{')) {
      const doc = JSON.parse(raw);
      publicKeySpki = doc.publicKeySpki;
    } else {
      const key = createPublicKey(raw);
      publicKeySpki = key.export({ format: 'der', type: 'spki' }).toString('base64');
    }
  }
}

const jsonText = readFileSync(receiptPath, 'utf8');
const result = verifyReceiptJson(jsonText, publicKeySpki ? { publicKeySpkiBase64: publicKeySpki } : undefined);

if (result.ok) {
  console.log('OK: signature valid');
  console.log(`Public key fingerprint: ${result.fingerprint}`);
  console.log(`Static risk level: ${result.payload.riskLevel}`);
  console.log(`Input SHA-256: ${result.payload.input.sha256}`);
  process.exit(0);
}

console.error(`FAIL: ${result.reason}`);
process.exit(1);
