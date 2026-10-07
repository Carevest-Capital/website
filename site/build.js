#!/usr/bin/env node
/*
  CareVest site build.

  Renders every page in shared/content-schema.js from Nunjucks templates into static HTML.

  Usage:   node build.js [--theme=cream|blue] [--state=published|draft] [--source=local|supabase] [--out=dist]

  Environment (flags win over environment):
    THEME                      blue | cream            (default blue)
    CONTENT_STATE              published | draft       (default published)
    SUPABASE_URL               project URL; when set (and --source is not "local") content is fetched
    SUPABASE_ANON_KEY          public key; published content comes from the published_content view,
                               draft content (preview project) from the draft_content view
    OUT                        output folder            (default dist)

  Supabase is optional. Anything missing from the database, or any network problem, falls back to
  site/content/content.json so the build never fails because of the database.
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import nunjucks from 'nunjucks';
import * as schema from '../shared/content-schema.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.join(HERE, 'templates');
const ASSETS = path.join(HERE, 'assets');
const STATIC = path.join(HERE, 'static');
const CONTENT_FILE = path.join(HERE, 'content', 'content.json');
const VERCEL_FILE = path.join(HERE, 'vercel.json');

/* ------------------------------------------------------------------ options */

const args = parseArgs(process.argv.slice(2));
const THEME = String(args.theme || process.env.THEME || 'blue').toLowerCase();
const STATE = String(args.state || process.env.CONTENT_STATE || 'published').toLowerCase();
const SOURCE = String(args.source || (process.env.SUPABASE_URL ? 'supabase' : 'local')).toLowerCase();
const OUT = path.resolve(HERE, String(args.out || process.env.OUT || 'dist'));

if (!['cream', 'blue'].includes(THEME)) fail(`Unknown THEME "${THEME}". Use cream or blue.`);
if (!['published', 'draft'].includes(STATE)) fail(`Unknown CONTENT_STATE "${STATE}". Use published or draft.`);
if (!['local', 'supabase'].includes(SOURCE)) fail(`Unknown --source "${SOURCE}". Use local or supabase.`);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > -1) out[a.slice(2, eq)] = a.slice(eq + 1);
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[a.slice(2)] = argv[++i];
    else out[a.slice(2)] = true;
  }
  return out;
}

function fail(msg) {
  console.error(`build: ${msg}`);
  process.exit(1);
}

function warn(msg) {
  console.warn(`build: warning: ${msg}`);
}

/* ------------------------------------------------------------------ content */

function loadLocalContent() {
  return JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
}

async function getJson(url, headers) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

/* Rows come from the published_content or draft_content view as { key, value }. The draft view already
   falls back to published for rows whose draft was never saved. Older { draft, published } rows still work. */
function pickState(row) {
  if (row.value != null) return row.value;
  if (row[STATE] != null) return row[STATE];
  if (STATE === 'draft' && row.published != null) return row.published;
  return null;
}

/* Merge Supabase rows onto the local content. Per row key: missing or null rows keep the local value. */
function mergeRows(local, rows, docs) {
  const content = structuredClone(local);
  for (const row of rows || []) {
    const value = pickState(row);
    if (value == null || typeof row.key !== 'string') continue;
    if (row.key.startsWith('page:')) {
      const slug = row.key.slice(5);
      const merged = { ...(local.pages[slug] || {}) };
      for (const [sectionKey, sectionValue] of Object.entries(value)) {
        merged[sectionKey] = isPlainObject(sectionValue) && isPlainObject(merged[sectionKey])
          ? { ...merged[sectionKey], ...sectionValue }
          : sectionValue;
      }
      content.pages[slug] = merged;
    } else if (row.key.startsWith('collection:')) {
      const name = row.key.slice(11);
      if (Array.isArray(value)) content.collections[name] = value;
    } else if (row.key === 'figures') {
      content.figures = { ...local.figures, ...value };
    } else if (row.key === 'globals') {
      content.globals = { ...local.globals, ...value };
    }
  }
  for (const d of docs || []) {
    if (!d || !d.slot) continue;
    content.documents[d.slot] = {
      title: d.title || '',
      url: d.url || '',
      version_label: d.version_label || '',
      uploaded_at: d.uploaded_at || '',
    };
  }
  return content;
}

function isPlainObject(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

async function loadContent() {
  const local = loadLocalContent();
  if (SOURCE !== 'supabase') return { content: local, from: 'local content.json' };

  const base = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const key = STATE === 'draft'
    ? process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!base || !key) {
    warn('SUPABASE_URL or a Supabase key is missing; using local content.json');
    return { content: local, from: 'local content.json' };
  }
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  try {
    const [rows, docs] = await Promise.all([
      getJson(`${base}/rest/v1/${STATE === 'draft' ? 'draft_content' : 'published_content'}?select=key,value`, headers),
      getJson(`${base}/rest/v1/documents?is_current=eq.true&select=slot,title,url,version_label,uploaded_at`, headers),
    ]);
    return {
      content: mergeRows(local, rows, docs),
      from: `Supabase (${STATE}, ${rows.length} content rows, ${docs.length} current documents)`,
    };
  } catch (err) {
    warn(`could not load content from Supabase (${err.message}); using local content.json`);
    return { content: local, from: 'local content.json (Supabase unreachable)' };
  }
}

/* ------------------------------------------------------------------ templates */

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createEnvironment(content) {
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(TEMPLATES, { noCache: true }), {
    autoescape: true,
    throwOnUndefined: false,
  });
  const { SafeString } = nunjucks.runtime;
  const slotDefs = Object.fromEntries(schema.documents.slots.map((s) => [s.key, s]));

  /* [[word]] becomes the accent span; everything else is escaped. */
  env.addFilter('accent', (str) => {
    const escaped = escapeHtml(str ?? '');
    return new SafeString(escaped.replace(/\[\[(.+?)\]\]/g, '<span class="accent-word">$1</span>'));
  });

  /* A stat with `figure` takes value/prefix/suffix/decimals from that key figure. */
  const resolve = (stat) => {
    const st = stat || {};
    const fig = st.figure ? content.figures?.[st.figure] : null;
    const src = fig || st;
    return {
      value: Number(src.value ?? 0),
      prefix: src.prefix || '',
      suffix: src.suffix || '',
      decimals: Number(src.decimals || 0),
      label: st.label || '',
      note: st.note || '',
      figure: st.figure || '',
    };
  };
  env.addFilter('resolve', resolve);

  /* "7.75%+" style display string for a stat (prefix + fixed decimals + suffix). */
  env.addFilter('fmt', (stat) => {
    const r = resolve(stat);
    return `${r.prefix}${r.value.toFixed(r.decimals)}${r.suffix}`;
  });

  env.addFilter('fixed', (n, decimals) => Number(n ?? 0).toFixed(Number(decimals || 0)));
  env.addFilter('money', (n) => `$${Math.round(Number(n || 0)).toLocaleString('en-US')}`);
  env.addFilter('pad2', (n) => String(n).padStart(2, '0'));
  env.addFilter('numeric', (str) => /^\d+$/.test(String(str ?? '').trim()));
  env.addFilter('tel', (str) => String(str ?? '').replace(/\D/g, ''));
  env.addFilter('where', (arr, key, value) => (Array.isArray(arr) ? arr.filter((x) => x && x[key] === value) : []));

  /* The current file in a document slot, or the slot's fallback (contact page as a last resort). */
  env.addFilter('docurl', (slot) => {
    const doc = content.documents?.[slot];
    if (doc && doc.url) return doc.url;
    return slotDefs[slot]?.fallback || '/contact';
  });
  /* Only a real uploaded file, no fallback. Empty when the slot has no file. */
  env.addFilter('docfile', (slot) => content.documents?.[slot]?.url || '');

  /* Richtext rendered inside an element that is already a paragraph: drop the <p> wrappers. */
  env.addFilter('inlinep', (html) => {
    const s = String(html ?? '')
      .trim()
      .replace(/<\/p>\s*<p[^>]*>/gi, '<br /><br />')
      .replace(/^<p[^>]*>/i, '')
      .replace(/<\/p>$/i, '');
    return new SafeString(s);
  });

  /* Richtext whose links should take the accent colour (FAQ answers). */
  env.addFilter('accentlinks', (html) => {
    const s = String(html ?? '').replace(/<a\s+(?![^>]*\bstyle=)([^>]*)>/gi, '<a $1 style="color:var(--accent);">');
    return new SafeString(s);
  });

  return env;
}

/* ------------------------------------------------------------------ files */

function copyDir(src, dest, { skip = () => false } = {}) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (skip(from)) continue;
    if (entry.isDirectory()) copyDir(from, to, { skip });
    else fs.copyFileSync(from, to);
  }
}

function formatBytes(n) {
  return `${n.toLocaleString('en-US')} bytes`;
}

/* ------------------------------------------------------------------ main */

async function main() {
  const { content, from } = await loadContent();
  const env = createEnvironment(content);

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  console.log(`build: theme=${THEME} state=${STATE} content=${from}`);
  console.log(`build: output ${OUT}`);

  for (const page of schema.pages) {
    const sections = content.pages?.[page.slug] || {};
    const context = {
      pg: page,
      meta: sections._meta || {},
      s: sections,
      g: content.globals || {},
      col: content.collections || {},
      fig: content.figures || {},
      doc: content.documents || {},
      content,
      schema,
      theme: THEME,
      /* items('sectionKey') returns the collection a section renders, filtered by its group if any. */
      items: (sectionKey) => {
        const def = page.sections.find((sec) => sec.key === sectionKey);
        if (!def || !def.collection) return [];
        const arr = content.collections?.[def.collection] || [];
        return def.group ? arr.filter((x) => x && x.group === def.group) : arr;
      },
    };
    const html = env.render(`${page.slug}.njk`, context);
    const file = path.join(OUT, `${page.slug}.html`);
    fs.writeFileSync(file, html);
    console.log(`built  ${path.basename(file).padEnd(26)} ${formatBytes(Buffer.byteLength(html)).padStart(14)}   ${page.title}`);
  }

  /* Assets: everything except the themes folder, then the chosen theme as styles.css. */
  copyDir(ASSETS, path.join(OUT, 'assets'), { skip: (p) => p === path.join(ASSETS, 'themes') });
  fs.copyFileSync(path.join(ASSETS, 'themes', `${THEME}.css`), path.join(OUT, 'assets', 'styles.css'));

  /* Static files (internal pages that are not part of the content model). */
  if (fs.existsSync(STATIC)) copyDir(STATIC, OUT);

  fs.copyFileSync(VERCEL_FILE, path.join(OUT, 'vercel.json'));
  console.log(`build: done, ${schema.pages.length} pages`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
