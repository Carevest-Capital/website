// Helpers shared by both stores: turning database rows into the Content JSON object
// described in SPEC.md and back, plus empty values for every field type.

import * as schema from '@shared/content-schema.js';

export const ROW_KEYS = {
  page: (slug) => `page:${slug}`,
  collection: (name) => `collection:${name}`,
  figures: 'figures',
  globals: 'globals',
};

/** Every row key the system knows about, derived from the schema. */
export function allRowKeys() {
  return [
    ...schema.pages.map((p) => ROW_KEYS.page(p.slug)),
    ...Object.keys(schema.collections).map((c) => ROW_KEYS.collection(c)),
    ROW_KEYS.figures,
    ROW_KEYS.globals,
  ];
}

/** Split a full Content JSON object into { rowKey: value } pairs. */
export function contentToRows(content) {
  const rows = {};
  for (const p of schema.pages) rows[ROW_KEYS.page(p.slug)] = content.pages?.[p.slug] ?? {};
  for (const c of Object.keys(schema.collections)) rows[ROW_KEYS.collection(c)] = content.collections?.[c] ?? [];
  rows[ROW_KEYS.figures] = content.figures ?? {};
  rows[ROW_KEYS.globals] = content.globals ?? {};
  return rows;
}

/** Human label for a row key, for the "unpublished changes" list. */
export function rowLabel(key) {
  if (key.startsWith('page:')) {
    const slug = key.slice(5);
    return `Page: ${schema.pages.find((p) => p.slug === slug)?.title ?? slug}`;
  }
  if (key.startsWith('collection:')) {
    const name = key.slice(11);
    return schema.collections[name]?.label ?? name;
  }
  if (key === 'figures') return schema.figures.label || 'Key figures';
  if (key === 'globals') return schema.globals.label || 'Site-wide';
  return key;
}

/** Route in the admin that edits a given row key. */
export function rowRoute(key) {
  if (key.startsWith('page:')) return `/pages/${key.slice(5)}`;
  if (key.startsWith('collection:')) return `/collections/${key.slice(11)}`;
  if (key === 'figures') return '/figures';
  if (key === 'globals') return '/site';
  return '/';
}

export function emptyValue(field) {
  switch (field.type) {
    case 'text': case 'heading': case 'richtext': case 'select': case 'date': case 'url': case 'document': return '';
    case 'number': return 0;
    case 'boolean': return false;
    case 'stat': return { value: 0, prefix: '', suffix: '', decimals: 0, label: '', note: '' };
    case 'image': return { src: '', alt: '' };
    case 'link': return { label: '', href: '' };
    case 'list': return [];
    default: return '';
  }
}

export function newListItem(field) {
  const item = { id: shortId() };
  for (const f of field.of || []) item[f.key] = emptyValue(f);
  return item;
}

export function newCollectionItem(collection) {
  const item = { id: shortId() };
  for (const f of collection.fields || []) item[f.key] = emptyValue(f);
  return item;
}

export function shortId() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
}

export function deepEqual(a, b) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

export function clone(v) {
  return v === undefined ? v : JSON.parse(JSON.stringify(v));
}

/** Short plain-text preview of a field value for list rows. */
export function preview(value, field) {
  if (value == null) return '';
  if (typeof value === 'string') return stripHtml(value).slice(0, 90);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (field?.type === 'link') return value.label || value.href || '';
  if (field?.type === 'image') return value.alt || value.src || '';
  if (field?.type === 'stat') return `${value.prefix || ''}${value.value ?? ''}${value.suffix || ''} ${value.label || ''}`.trim();
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  return '';
}

export function stripHtml(s) {
  return String(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').replace(/\[\[|\]\]/g, '').trim();
}

/** Title for a collection item or list item, using the first text-like field. */
export function itemTitle(item, fields) {
  const f = (fields || []).find((x) => ['text', 'heading'].includes(x.type) && item[x.key]);
  if (f) return stripHtml(item[f.key]);
  const st = (fields || []).find((x) => x.type === 'stat' && item[x.key]);
  if (st) {
    const v = item[st.key];
    const fig = v.figure ? schema.figures?.items?.find((i) => i.key === v.figure) : null;
    return v.label || fig?.label || 'Figure';
  }
  const lk = (fields || []).find((x) => x.type === 'link' && item[x.key]?.label);
  if (lk) return item[lk.key].label;
  const g = (fields || []).find((x) => item[x.key] && typeof item[x.key] === 'string' && x.type !== 'select');
  return g ? stripHtml(item[g.key]).slice(0, 60) : 'Untitled';
}

/** Secondary field to show next to the title: the first text-like field that is not the title. */
export function itemSubtitle(item, fields) {
  const title = (fields || []).find((x) => ['text', 'heading'].includes(x.type) && item[x.key]);
  const f = (fields || []).find((x) => x !== title && ['text', 'heading', 'richtext', 'select', 'link', 'url'].includes(x.type) && item[x.key]);
  if (!f) return '';
  const v = item[f.key];
  return typeof v === 'string' ? stripHtml(v).slice(0, 70) : v?.label || v?.href || '';
}

export { schema };
