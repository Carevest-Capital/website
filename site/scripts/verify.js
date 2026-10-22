#!/usr/bin/env node
/*
  Regression check for the templates.

  Builds the site from the local content.json and compares every page with the approved snapshot in
  site/__snapshot__/<theme>/. Any difference means a template or content change altered the output.
  When the change is intended, approve it with:   node scripts/verify.js --update

  (Until October 2026 this script compared against the original hand-built pages; those were retired when
  the first content changes were approved by the CareVest team.)
*/
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(HERE, '..');
const SNAP = path.join(SITE, '__snapshot__');
const THEMES = ['blue'];
const update = process.argv.includes('--update');

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', middot: '·', reg: '®', copy: '©', rarr: '→', hellip: '…' };
function normalise(str) {
  return str
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, ent) => {
      if (ent[0] === '#') return String.fromCodePoint(ent[1] === 'x' || ent[1] === 'X' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10));
      return ENTITIES[ent] ?? m;
    })
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

let failed = 0;
for (const theme of THEMES) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), `carevest-verify-${theme}-`));
  execFileSync(process.execPath, [path.join(SITE, 'build.js'), '--source=local', `--theme=${theme}`, `--out=${out}`], { stdio: 'pipe' });
  const snapDir = path.join(SNAP, theme);
  const pages = fs.readdirSync(out).filter((f) => f.endsWith('.html')).sort();
  if (update) {
    fs.rmSync(snapDir, { recursive: true, force: true });
    fs.mkdirSync(snapDir, { recursive: true });
    for (const p of pages) fs.copyFileSync(path.join(out, p), path.join(snapDir, p));
    console.log(`${theme.toUpperCase()}: snapshot updated (${pages.length} pages)`);
    continue;
  }
  console.log(`${theme.toUpperCase()}`);
  if (!fs.existsSync(snapDir)) { console.log(`  no snapshot yet; run with --update`); failed++; continue; }
  const expected = fs.readdirSync(snapDir).filter((f) => f.endsWith('.html')).sort();
  for (const p of new Set([...pages, ...expected])) {
    const a = fs.existsSync(path.join(out, p)) ? normalise(fs.readFileSync(path.join(out, p), 'utf8')) : null;
    const b = fs.existsSync(path.join(snapDir, p)) ? normalise(fs.readFileSync(path.join(snapDir, p), 'utf8')) : null;
    if (a === b) { console.log(`PASS  ${theme}/${p}`); continue; }
    failed++;
    if (a === null) { console.log(`FAIL  ${theme}/${p}: missing from build`); continue; }
    if (b === null) { console.log(`FAIL  ${theme}/${p}: not in snapshot`); continue; }
    let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
    const s = Math.max(0, i - 80);
    console.log(`FAIL  ${theme}/${p}\n      built:    …${a.slice(s, i + 120)}…\n      snapshot: …${b.slice(s, i + 120)}…`);
  }
  fs.rmSync(out, { recursive: true, force: true });
}
if (!update) {
  console.log(failed ? `\n${failed} FAILED` : `\nAll pages match the snapshot.`);
  process.exit(failed ? 1 : 0);
}
