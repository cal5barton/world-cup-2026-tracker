import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const seedSql = readFileSync(join(ROOT, 'supabase/seed.sql'), 'utf8');

// Extract all INSERT statements
// Format: (number, 'name', 'country', 'countryCode', pageNumber, positionInPage, 'sectionType')
const regex = /\((\d+),\s*'([^']*(?:''[^']*)*)',\s*'([^']*)',\s*'([^']*)'\s*,\s*(\d+),\s*(\d+),\s*'([^']*)'\)/g;

const stickers = [];
let match;

while ((match = regex.exec(seedSql)) !== null) {
  stickers.push({
    number: parseInt(match[1]),
    name: match[2].replace(/''/, "'"), // unescape SQL quotes
    country: match[3],
    countryCode: match[4],
    pageNumber: parseInt(match[5]),
    positionInPage: parseInt(match[6]),
    sectionType: match[7],
  });
}

const output = `// Auto-generated from supabase/seed.sql
export interface Sticker {
  number: number;
  name: string;
  country: string;
  countryCode: string;
  pageNumber: number;
  positionInPage: number;
  sectionType: string;
}

export const STICKERS: Sticker[] = ${JSON.stringify(stickers, null, 2)};
`;

writeFileSync(join(ROOT, 'src/data/stickers.ts'), output);
console.log(`✓ Generated src/data/stickers.ts with ${stickers.length} stickers`);
