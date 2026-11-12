# Signed inspection receipt (M3)

- Payload is canonicalised with [RFC 8785 (JCS)](https://www.rfc-editor.org/rfc/rfc8785) and signed with **Ed25519** (`node:crypto`).
- The private key is stored only in Electron `userData` (`airlock-receipt-signing.json`, mode `600` on Unix).
- Verify offline: `pnpm verify-receipt -- <path-to-receipt.json>` after `pnpm --filter @airlock/core build`.

Integrity only — see `RECEIPT_INTEGRITY_NOTICE` in `types.ts`.
