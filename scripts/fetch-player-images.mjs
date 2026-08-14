/**
 * fetch-player-images.mjs
 *
 * Fetches player photos from the Wikipedia API and writes
 * src/data/player-images.json  →  { [globalNumber]: string | null }
 *
 * Run:  node scripts/fetch-player-images.mjs
 * Safe to re-run — already-fetched entries are skipped (resume support).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT  = join(ROOT, 'src/data/player-images.json');

// Wikipedia requires a descriptive User-Agent to avoid aggressive rate limiting
const UA = 'WC2026AlbumTracker/1.0 (https://github.com/cal5barton/world-cup-2026-tracker; bot)';

// ── Parse stickers.ts ────────────────────────────────────────────────────────
const src   = readFileSync(join(ROOT, 'src/data/stickers.ts'), 'utf8');
const match = src.match(/export const STICKERS[^=]+=\s*(\[[\s\S]+?\]);/);
if (!match) { console.error('Could not parse STICKERS'); process.exit(1); }
const STICKERS = eval(match[1]);

// ── Filter to players only ───────────────────────────────────────────────────
const SKIP = new Set([
  'Panini Logo', 'Official Emblem  1/2', 'Official Emblem  2/2',
  'Official Mascots', 'Official Slogan', 'Official Ball',
  'Canada', 'Mexico', 'USA', 'Emblem', 'Team Photo',
]);
const players = STICKERS.filter(s =>
  s.countryCode !== 'WP' && !SKIP.has(s.name) && !s.name.startsWith('Team Photo')
);

console.log(`Total stickers : ${STICKERS.length}`);
console.log(`Player stickers: ${players.length}\n`);

// ── Resume support ───────────────────────────────────────────────────────────
const results = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const cached  = Object.keys(results).length;
if (cached > 0) console.log(`Resuming — ${cached} already cached\n`);

// ── Wikipedia fetch with retry ───────────────────────────────────────────────
const WP = 'https://en.wikipedia.org/w/api.php';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function wpFetch(params, retries = 3) {
  const url = `${WP}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status === 429) {
      const wait = attempt * 8000; // 8s, 16s, 24s
      console.log(`    ⏳ 429 rate-limited — waiting ${wait / 1000}s (attempt ${attempt}/${retries})`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) return null;
    return res.json();
  }
  return null;
}

async function getThumb(title) {
  const data = await wpFetch({ action: 'query', titles: title, prop: 'pageimages', pithumbsize: 600 });
  if (!data) return null;
  const page = Object.values(data.query?.pages ?? {})[0];
  if (!page || page.missing !== undefined) return null;
  return page.thumbnail?.source ?? null;
}

async function wpSearch(query) {
  const data = await wpFetch({ action: 'query', list: 'search', srsearch: query, srlimit: 1 });
  return data?.query?.search?.[0]?.title ?? null;
}

async function getPlayerPhoto(name) {
  // 1. Exact title
  let url = await getThumb(name);
  if (url) return url;

  await sleep(150);

  // 2. "(footballer)" disambiguation
  url = await getThumb(`${name} (footballer)`);
  if (url) return url;

  await sleep(150);

  // 3. Full-text search
  const title = await wpSearch(`${name} footballer`);
  if (title) {
    url = await getThumb(title);
    if (url) return url;
  }

  return null;
}

// ── Main loop ────────────────────────────────────────────────────────────────
let found = 0, notFound = 0, skipped = 0;

for (let i = 0; i < players.length; i++) {
  const s = players[i];

  if (results[s.number] !== undefined) { skipped++; continue; }

  const url = await getPlayerPhoto(s.name);
  results[s.number] = url ?? null;

  const tag = url ? '✓' : '✗';
  console.log(`[${String(i + 1).padStart(3)}/${players.length}] ${tag}  ${s.name} (${s.countryCode})`);
  if (url) found++; else notFound++;

  // Save checkpoint every 25 players
  if ((i + 1) % 25 === 0) writeFileSync(OUT, JSON.stringify(results, null, 2));

  // 450ms between players — polite to Wikipedia
  await sleep(450);
}

writeFileSync(OUT, JSON.stringify(results, null, 2));

console.log('\n── Results ─────────────────────────────────────');
console.log(`Found    : ${found}`);
console.log(`Not found: ${notFound}`);
console.log(`Cached   : ${skipped}`);
console.log(`Coverage : ${Math.round((found / (found + notFound)) * 100)}%`);
console.log(`Output   : ${OUT}`);
