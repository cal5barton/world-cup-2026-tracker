/**
 * patch-vercel-runtime.mjs
 *
 * @astrojs/vercel v7 hardcodes nodejs18.x, which Vercel no longer accepts
 * (Node 18 reached EOL April 2025). This script patches the generated
 * .vc-config.json to use nodejs22.x after every build.
 *
 * Node 22 is used (not 20) because @supabase/supabase-js constructs a
 * RealtimeClient internally even when realtime isn't used, and that throws
 * on Node < 22 without native WebSocket support.
 *
 * Run automatically via the "postbuild" npm script.
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const functionsDir = join(__dirname, '../.vercel/output/functions');

function patchDir(dir) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }

  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      patchDir(full);
    } else if (entry === '.vc-config.json') {
      const raw = JSON.parse(readFileSync(full, 'utf8'));
      if (raw.runtime === 'nodejs18.x' || raw.runtime === 'nodejs20.x') {
        const from = raw.runtime;
        raw.runtime = 'nodejs22.x';
        writeFileSync(full, JSON.stringify(raw, null, 2));
        console.log(`patched: ${full.replace(join(__dirname, '..'), '')} (${from} → nodejs22.x)`);
      }
    }
  }
}

patchDir(functionsDir);
console.log('runtime patch done — target: nodejs22.x');
