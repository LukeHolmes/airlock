#!/usr/bin/env node
/**
 * Ensures sandbox build context files exist before electron-builder packages the app.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const sandboxDir = path.join(root, 'packages/sandbox');

const requiredFiles = [
  'Dockerfile',
  'entrypoint.sh',
  'supervisord.conf',
  'launch-target.sh',
  'start-kasmvnc.sh',
  'cleanup.sh',
];

let missing = false;

for (const file of requiredFiles) {
  const filePath = path.join(sandboxDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`[verify-sandbox-bundle] Missing required file: ${filePath}`);
    missing = true;
  }
}

if (missing) {
  process.exit(1);
}

console.log(`[verify-sandbox-bundle] OK — ${requiredFiles.length} sandbox files present`);
