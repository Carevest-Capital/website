#!/usr/bin/env node
/*
  Acceptance test: builds the cream and blue sites from the local content and compares every page
  with the hand-written originals in carevest-site and carevest-blue.

  Both sides are normalised before comparing: HTML entities decoded, whitespace runs collapsed to one
  space, whitespace between tags removed. The internal welcome-series page is ignored.

  Exit code is non-zero if any page differs.
*/

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pages } from '../../shared/content-schema.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '..');
const BUILD = path.join(SITE, 'build.js');
const BRANDS = path.resolve(SITE, '..', '..');

const TARGETS = [
  { theme: 'cream', original: path.join(BRANDS, 'carevest-site') },
  { theme: 'blue', original: path.join(BRANDS, 'carevest-blue') },
];

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  copy: '©', reg: '®', trade: '™', deg: '°', middot: '·', times: '×',
  rarr: '→', larr: '←', uarr: '↑', darr: '↓',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  ndash: String.fromCharCode(0x2013), mdash: String.fromCharCode(0x2014), hellip: '…', bull: '•', laquo: '«', raquo: '»',
};

function decodeEntities(str) {
  return str.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, ent) => {
    if (ent[0] === '#') {
      const code = ent[1].toLowerCase() === 'x' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return Object.prototype.hasOwnProperty.call(NAMED, ent) ? NAMED[ent] : m;
  });
}

function normalise(html) {
  return decodeEntities(html)
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .replace(/ data-yield="[^"]*"/g, '') // deliberate addition: calculator reads the yield figure
    .trim();
}

function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : n;
}

function window(str, at) {
  const start = Math.max(0, at - 60);
  return str.slice(start, start + 200);
}

let failures = 0;
let comparisons = 0;

for (const { theme, original } of TARGETS) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), `carevest-verify-${theme}-`));
  try {
    execFileSync(process.execPath, [BUILD, '--theme', theme, '--source=local', '--out', out], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, SUPABASE_URL: '', SUPABASE_ANON_KEY: '', SUPABASE_SERVICE_ROLE_KEY: '' },
    });
  } catch (err) {
    console.error(`FAIL  ${theme}: build failed\n${err.stderr?.toString() || err.message}`);
    failures += pages.length;
    comparisons += pages.length;
    continue;
  }

  console.log(`\n${theme.toUpperCase()}  (${original})`);
  for (const page of pages) {
    comparisons++;
    const name = `${page.slug}.html`;
    const expectedFile = path.join(original, name);
    const actualFile = path.join(out, name);
    if (!fs.existsSync(expectedFile)) { console.log(`FAIL  ${theme}/${name}: original missing`); failures++; continue; }
    if (!fs.existsSync(actualFile)) { console.log(`FAIL  ${theme}/${name}: not built`); failures++; continue; }
    const expected = normalise(fs.readFileSync(expectedFile, 'utf8'));
    const actual = normalise(fs.readFileSync(actualFile, 'utf8'));
    const at = firstDiff(expected, actual);
    if (at === -1) {
      console.log(`PASS  ${theme}/${name}`);
    } else {
      failures++;
      console.log(`FAIL  ${theme}/${name}  (first difference at character ${at} of ${expected.length} expected / ${actual.length} built)`);
      console.log(`      expected: ${JSON.stringify(window(expected, at))}`);
      console.log(`      built:    ${JSON.stringify(window(actual, at))}`);
    }
  }

  /* The theme stylesheet must be byte-identical to the original. */
  const cssExpected = fs.readFileSync(path.join(original, 'assets', 'styles.css'));
  const cssActual = fs.readFileSync(path.join(out, 'assets', 'styles.css'));
  console.log(`${cssExpected.equals(cssActual) ? 'PASS' : 'FAIL'}  ${theme}/assets/styles.css (byte comparison)`);
  if (!cssExpected.equals(cssActual)) failures++;

  fs.rmSync(out, { recursive: true, force: true });
}

console.log(`\n${comparisons - failures} of ${comparisons} page comparisons passed${failures ? `, ${failures} FAILED` : ''}.`);
process.exit(failures ? 1 : 0);
