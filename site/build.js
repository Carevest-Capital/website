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
import * as render from '../shared/render-core.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES = path.join(HERE, 'templates');
const ASSETS = path.join(HERE, 'assets');
const STATIC = path.join(HERE, 'static');
const CONTENT_FILE = process.env.CONTENT_FILE ? path.resolve(process.env.CONTENT_FILE) : path.join(HERE, 'content', 'content.json');
const VERCEL_FILE = path.join(HERE, 'vercel.json');

/* ------------------------------------------------------------------ options */

const args = parseArgs(process.argv.slice(2));
const THEME = String(args.theme || process.env.THEME || 'blue').toLowerCase();
const STATE = String(args.state || process.env.CONTENT_STATE || 'published').toLowerCase();
const SOURCE = String(args.source || (process.env.SUPABASE_URL ? 'supabase' : 'local')).toLowerCase();
const OUT = path.resolve(HERE, String(args.out || process.env.OUT || 'dist'));
/* Launch switches (production project only). SITE_INDEXING=on lets search engines in: drops the noindex tag,
   publishes a real robots.txt and leaves internal pages out of the build. SITE_URL is used for the sitemap. */
const INDEXING = /^(on|true|1|yes)$/i.test(String(args.indexing || process.env.SITE_INDEXING || ''));
const SITE_URL = String(process.env.SITE_URL || 'https://www.carevest.com').replace(/\/+$/, '');

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

function createEnvironment(content) {
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(TEMPLATES, { noCache: true }), {
    autoescape: true,
    throwOnUndefined: false,
  });
  render.registerFilters(env, { content, schema, SafeString: nunjucks.runtime.SafeString });
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

  /* Pages the team has hidden in the dashboard are not rendered, every menu or footer link to them is
     dropped (render-core), and their address redirects to the home page so nothing can 404. */
  const hiddenPages = render.hiddenPages(content, schema);
  const hiddenPaths = new Set(hiddenPages.map((p) => p.path));
  if (hiddenPages.length) console.log(`build: hidden pages: ${hiddenPages.map((p) => p.path).join(', ')} (redirected to /)`);

  for (const page of schema.pages) {
    if (hiddenPaths.has(page.path)) continue;
    const context = render.pageContext({ page, content, schema, theme: THEME });
    let html = env.render(`${page.slug}.njk`, context);
    if (INDEXING) html = html.replace(/\s*<meta name="robots" content="noindex, nofollow" \/>/, '');
    const file = path.join(OUT, `${page.slug}.html`);
    fs.writeFileSync(file, html);
    console.log(`built  ${path.basename(file).padEnd(26)} ${formatBytes(Buffer.byteLength(html)).padStart(14)}   ${page.title}`);
  }

  /* Assets: everything except the themes folder, then the chosen theme as styles.css. */
  copyDir(ASSETS, path.join(OUT, 'assets'), { skip: (p) => p === path.join(ASSETS, 'themes') });
  fs.copyFileSync(path.join(ASSETS, 'themes', `${THEME}.css`), path.join(OUT, 'assets', 'styles.css'));

  /* Static files. Internal pages (welcome-series plans) are left out once the site is indexed; the
     legal/ folder always ships. */
  if (fs.existsSync(STATIC)) copyDir(STATIC, OUT, { skip: (p) => INDEXING && /welcome-series/.test(path.basename(p)) });

  /* Hidden pages: a tiny page at their address that sends visitors to the home page. This works on any
     host (Vercel reads redirects only from the project's own vercel.json, not from the build output). */
  for (const page of hiddenPages) {
    const stub = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="robots" content="noindex" /><meta http-equiv="refresh" content="0; url=/" /><link rel="canonical" href="${SITE_URL}/" /><title>CareVest Group</title><script>location.replace('/')</script></head><body><a href="/">CareVest Group</a></body></html>\n`;
    fs.writeFileSync(path.join(OUT, `${page.slug}.html`), stub);
  }

  /* robots.txt and sitemap.xml */
  const visible = schema.pages.filter((p) => !hiddenPaths.has(p.path));
  const today = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${visible.map((p) => `  <url><loc>${SITE_URL}${p.path === '/' ? '/' : p.path}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
  fs.writeFileSync(path.join(OUT, 'robots.txt'), INDEXING ? `User-agent: *\nAllow: /\nDisallow: /welcome-series\n\nSitemap: ${SITE_URL}/sitemap.xml\n` : `User-agent: *\nDisallow: /\n`);

  /* build.json: lets the dashboard know when a preview or publish build has landed. */
  fs.writeFileSync(path.join(OUT, 'build.json'), JSON.stringify({ built_at: new Date().toISOString(), state: STATE, theme: THEME, source: from }, null, 2) + '\n');

  /* vercel.json: the project file plus a temporary redirect for every hidden page. */
  const vercelConfig = JSON.parse(fs.readFileSync(VERCEL_FILE, 'utf8'));
  if (hiddenPages.length) {
    vercelConfig.redirects = [
      ...(vercelConfig.redirects || []).filter((r) => !hiddenPaths.has(r.source)),
      ...hiddenPages.map((p) => ({ source: p.path, destination: '/', permanent: false })),
    ];
  }
  fs.writeFileSync(path.join(OUT, 'vercel.json'), JSON.stringify(vercelConfig, null, 2) + '\n');
  console.log(`build: done, ${schema.pages.length - hiddenPages.length} pages${hiddenPages.length ? `, ${hiddenPages.length} hidden` : ''}, indexing ${INDEXING ? 'ON' : 'off'}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
