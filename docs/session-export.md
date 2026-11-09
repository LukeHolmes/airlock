# Session export (opt-in)

Airlock does **not** persist sessions by default. When analysis has finished, the user may click **Export session**, choose a path in the native save dialog, and write a single JSON file to disk. Nothing is uploaded or sent over the network.

## Schema

- **Version field:** `schemaVersion` (currently `1`)
- **Machine-readable schema:** [`session-export.schema.json`](./session-export.schema.json)

## Contents

| Section | Description |
|---------|-------------|
| `session` | Session id, optional container id, timing/network metadata, and input descriptor |
| `session.inputFingerprint` | For files: basename, size, MIME, extension, and SHA-256 hash (no file bytes). For URLs: the requested URL. |
| `artefacts.logs` | In-memory structured events captured during the session |
| `analysis` | Deterministic risk summary from the lightweight analysis engine |

## Serializer

The pure function `serializeSessionExport` in `@airlock/core` builds the JSON object. Unit tests live in `packages/core/src/session/sessionExport.test.ts`.
