#!/usr/bin/env node
/**
 * Fail CI if renderer code imports Node-only @airlock/core entry points.
 */
import fs from 'node:fs';
import path from 'node:path';

const RENDERER_ROOT = path.join(process.cwd(), 'packages/ui/src/renderer');
const ALLOWED = new Set(['@airlock/core/browser']);

function walk(dir, violations) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full, violations);
      continue;
    }
    if (!/\.tsx?$/.test(name)) {
      continue;
    }
    const text = fs.readFileSync(full, 'utf8');
    for (const match of text.matchAll(/\bfrom\s+['"](@airlock\/core[^'"]*)['"]/g)) {
      const specifier = match[1];
      if (!ALLOWED.has(specifier)) {
        violations.push({ file: full, specifier });
      }
    }
    for (const match of text.matchAll(/\bimport\s+['"](@airlock\/core[^'"]*)['"]/g)) {
      const specifier = match[1];
      if (!ALLOWED.has(specifier)) {
        violations.push({ file: full, specifier });
      }
    }
  }
}

const violations = [];
if (fs.existsSync(RENDERER_ROOT)) {
  walk(RENDERER_ROOT, violations);
}

if (violations.length > 0) {
  console.error('Renderer must only import @airlock/core/browser:\n');
  for (const { file, specifier } of violations) {
    console.error(`  ${path.relative(process.cwd(), file)}: ${specifier}`);
  }
  process.exit(1);
}

console.log('Renderer @airlock/core import check: OK');
