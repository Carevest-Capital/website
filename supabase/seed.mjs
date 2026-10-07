#!/usr/bin/env node
// One-time import of the current website content into Supabase.
// Usage:  SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node supabase/seed.mjs [--force]
// Without --force it only fills rows that are missing, so re-running never overwrites edits made in the dashboard.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const content = JSON.parse(readFileSync(path.join(here, '../site/content/content.json'), 'utf8'));
const schema = await import(path.join(here, '../shared/content-schema.js'));

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const force = process.argv.includes('--force');
if (!URL_ || !KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.'); process.exit(1); }

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const api = async (p, init = {}) => {
  const r = await fetch(`${URL_}/rest/v1/${p}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  if (!r.ok) throw new Error(`${init.method || 'GET'} ${p}: ${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
};

const rows = {};
for (const p of schema.pages) rows[`page:${p.slug}`] = content.pages?.[p.slug] ?? {};
for (const c of Object.keys(schema.collections)) rows[`collection:${c}`] = content.collections?.[c] ?? [];
rows.figures = content.figures ?? {};
rows.globals = content.globals ?? {};

const existing = new Set((await api('content?select=key')).map((r) => r.key));
const payload = Object.entries(rows)
  .filter(([key]) => force || !existing.has(key))
  .map(([key, value]) => ({ key, draft: value, published: value, published_at: new Date().toISOString() }));

if (payload.length) {
  await api('content?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(payload) });
}
console.log(`Content rows: ${payload.length} written, ${Object.keys(rows).length - payload.length} already present${force ? ' (forced)' : ''}.`);

// Documents: create a row per slot that already has a public URL (e.g. the Wix-hosted PDFs) so the links keep working.
const haveDocs = new Set((await api('documents?select=slot&is_current=eq.true')).map((r) => r.slot));
const docs = Object.entries(content.documents || {})
  .filter(([slot, d]) => d?.url && (force || !haveDocs.has(slot)))
  .map(([slot, d]) => ({ slot, title: d.title || slot, url: d.url, version_label: d.version_label || 'Carried over from the previous website', is_current: true }));
if (docs.length) await api('documents', { method: 'POST', body: JSON.stringify(docs) });
console.log(`Documents: ${docs.length} slot(s) linked to existing files.`);
console.log('Done. Open the dashboard; every page should show its content.');
