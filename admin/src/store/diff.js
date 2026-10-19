// Turns the difference between a row's draft and its published value into a list of human-readable
// changes, and knows how to undo each one (put the published value back into the draft).

import { schema, ROW_KEYS, rowLabel, rowRoute, deepEqual, clone, stripHtml, itemTitle } from './content.js';

/* ------------------------------------------------------------------ value display */

export function describe(value, field) {
  if (value === undefined || value === null || value === '') return { text: 'empty', empty: true };
  const t = field?.type;
  if (t === 'boolean') return { text: value ? 'Yes' : 'No' };
  if (t === 'image') return { text: value.src ? `${value.alt || 'Image'}` : 'No image', image: value.src || '' };
  if (t === 'link') return { text: `${value.label || ''} → ${value.href || ''}`.trim() };
  if (t === 'stat') {
    const fig = value.figure ? schema.figures?.items?.find((i) => i.key === value.figure) : null;
    return { text: fig ? `Key figure: ${fig.label}${value.label ? ` (${value.label})` : ''}` : `${value.prefix || ''}${value.value ?? ''}${value.suffix || ''} ${value.label || ''}`.trim() };
  }
  if (t === 'document') return { text: schema.documents?.slots?.find((s) => s.key === value)?.label || String(value) };
  if (Array.isArray(value)) return { text: `${value.length} item${value.length === 1 ? '' : 's'}` };
  if (typeof value === 'object') return { text: JSON.stringify(value).slice(0, 160) };
  const s = stripHtml(String(value));
  return { text: s.length > 220 ? `${s.slice(0, 220)}…` : s };
}

/* ------------------------------------------------------------------ change computation */

/**
 * Every change in every row. Each change:
 * { id, rowKey, group, groupLabel, route, label, kind, before, after, field, revert(draft) => newDraft }
 */
export function computeChanges(rows) {
  const out = [];
  if (!rows) return out;
  for (const page of schema.pages) {
    const key = ROW_KEYS.page(page.slug);
    const r = rows[key];
    if (!r || deepEqual(r.draft, r.published)) continue;
    out.push(...pageChanges(page, key, r.draft || {}, r.published || {}));
  }
  for (const [name, col] of Object.entries(schema.collections)) {
    const key = ROW_KEYS.collection(name);
    const r = rows[key];
    if (!r || deepEqual(r.draft, r.published)) continue;
    out.push(...collectionChanges(name, col, key, Array.isArray(r.draft) ? r.draft : [], Array.isArray(r.published) ? r.published : []));
  }
  if (rows.figures && !deepEqual(rows.figures.draft, rows.figures.published)) out.push(...figureChanges(rows.figures.draft || {}, rows.figures.published || {}));
  if (rows.globals && !deepEqual(rows.globals.draft, rows.globals.published)) out.push(...globalChanges(rows.globals.draft || {}, rows.globals.published || {}));
  return out;
}

function pageChanges(page, key, draft, published) {
  const changes = [];
  const base = { rowKey: key, group: key, groupLabel: rowLabel(key), route: rowRoute(key) };
  const push = (c) => changes.push({ ...base, id: `${key}:${c.path}`, ...c });

  // Page-level visibility and search listing
  const dm = draft._meta || {}; const pm = published._meta || {};
  if ((dm.hidden === true) !== (pm.hidden === true)) {
    push({ path: '_meta.hidden', label: 'Page visibility', kind: 'visibility', before: pm.hidden ? 'Hidden' : 'Shown', after: dm.hidden ? 'Hidden' : 'Shown',
      revert: (d) => ({ ...d, _meta: { ...(d._meta || {}), hidden: pm.hidden === true } }) });
  }
  for (const f of ['title', 'description']) {
    if (!deepEqual(dm[f], pm[f])) push({ path: `_meta.${f}`, label: `Search listing: ${f === 'title' ? 'title' : 'description'}`, kind: 'field', before: pm[f], after: dm[f], field: { type: 'text' },
      revert: (d) => ({ ...d, _meta: { ...(d._meta || {}), [f]: pm[f] } }) });
  }

  for (const section of page.sections) {
    const ds = draft[section.key] || {}; const ps = published[section.key] || {};
    if (deepEqual(ds, ps)) continue;
    if ((ds._hidden === true) !== (ps._hidden === true)) {
      push({ path: `${section.key}._hidden`, label: `${section.label}: section visibility`, kind: 'visibility', before: ps._hidden ? 'Hidden' : 'Shown', after: ds._hidden ? 'Hidden' : 'Shown',
        revert: (d) => ({ ...d, [section.key]: { ...(d[section.key] || {}), _hidden: ps._hidden === true } }) });
    }
    const fields = section.fields || [];
    const keys = new Set([...Object.keys(ds), ...Object.keys(ps)].filter((k) => k !== '_hidden'));
    for (const fk of keys) {
      if (deepEqual(ds[fk], ps[fk])) continue;
      const field = fields.find((f) => f.key === fk) || { key: fk, type: 'text', label: fk };
      push({ path: `${section.key}.${fk}`, label: `${section.label}: ${field.label || fk}`, kind: 'field', before: ps[fk], after: ds[fk], field,
        revert: (d) => { const s = { ...(d[section.key] || {}) }; if (ps[fk] === undefined) delete s[fk]; else s[fk] = clone(ps[fk]); return { ...d, [section.key]: s }; } });
    }
  }
  return changes;
}

function collectionChanges(name, col, key, draft, published) {
  const changes = [];
  const base = { rowKey: key, group: key, groupLabel: rowLabel(key), route: rowRoute(key) };
  const push = (c) => changes.push({ ...base, id: `${key}:${c.path}`, ...c });
  const pById = new Map(published.map((it, i) => [it.id, { it, i }]));
  const dById = new Map(draft.map((it, i) => [it.id, { it, i }]));
  const single = (col.singular || 'item').toLowerCase();

  for (const [id, { it }] of dById) {
    if (!pById.has(id)) {
      push({ path: `add.${id}`, label: `New ${single}: ${itemTitle(it, col.fields)}`, kind: 'added', before: undefined, after: itemTitle(it, col.fields),
        revert: (d) => d.filter((x) => x.id !== id) });
      continue;
    }
    const prev = pById.get(id).it;
    if (deepEqual(it, prev)) continue;
    const diffs = col.fields.filter((f) => !deepEqual(it[f.key], prev[f.key]));
    for (const f of diffs) {
      push({ path: `edit.${id}.${f.key}`, label: `${itemTitle(prev, col.fields)}: ${f.label || f.key}`, kind: 'field', before: prev[f.key], after: it[f.key], field: f,
        revert: (d) => d.map((x) => (x.id === id ? { ...x, [f.key]: clone(prev[f.key]) } : x)) });
    }
  }
  for (const [id, { it, i }] of pById) {
    if (!dById.has(id)) {
      push({ path: `remove.${id}`, label: `Removed ${single}: ${itemTitle(it, col.fields)}`, kind: 'removed', before: itemTitle(it, col.fields), after: undefined,
        revert: (d) => { const n = [...d]; n.splice(Math.min(i, n.length), 0, clone(it)); return n; } });
    }
  }
  const dOrder = draft.map((x) => x.id).filter((id) => pById.has(id));
  const pOrder = published.map((x) => x.id).filter((id) => dById.has(id));
  if (!deepEqual(dOrder, pOrder)) {
    push({ path: 'order', label: 'Order changed', kind: 'order', before: 'Previous order', after: 'New order',
      revert: (d) => { const rank = new Map(published.map((x, i) => [x.id, i])); return [...d].sort((a, b) => (rank.has(a.id) ? rank.get(a.id) : 1e9) - (rank.has(b.id) ? rank.get(b.id) : 1e9)); } });
  }
  return changes;
}

const FIG_LABEL = { value: 'number', prefix: 'prefix', suffix: 'suffix', decimals: 'decimal places', as_of: 'as of date', note: 'footnote' };
function figureChanges(draft, published) {
  const changes = [];
  const base = { rowKey: 'figures', group: 'figures', groupLabel: rowLabel('figures'), route: rowRoute('figures') };
  for (const item of schema.figures?.items || []) {
    const d = draft[item.key] || {}; const p = published[item.key] || {};
    if (deepEqual(d, p)) continue;
    for (const fk of new Set([...Object.keys(d), ...Object.keys(p)])) {
      if (deepEqual(d[fk], p[fk])) continue;
      changes.push({ ...base, id: `figures:${item.key}.${fk}`, path: `${item.key}.${fk}`, label: `${item.label}: ${FIG_LABEL[fk] || fk}`, kind: 'field', before: p[fk], after: d[fk], field: { type: fk === 'note' ? 'richtext' : 'text' },
        revert: (dr) => ({ ...dr, [item.key]: { ...(dr[item.key] || {}), [fk]: clone(p[fk]) } }) });
    }
  }
  return changes;
}

function globalChanges(draft, published) {
  const changes = [];
  const base = { rowKey: 'globals', group: 'globals', groupLabel: rowLabel('globals'), route: rowRoute('globals') };
  const fields = schema.globals?.fields || [];
  for (const fk of new Set([...Object.keys(draft), ...Object.keys(published)])) {
    if (deepEqual(draft[fk], published[fk])) continue;
    const field = fields.find((f) => f.key === fk) || { key: fk, type: 'text', label: fk };
    changes.push({ ...base, id: `globals:${fk}`, path: fk, label: field.label || fk, kind: 'field', before: published[fk], after: draft[fk], field,
      revert: (d) => { const n = { ...d }; if (published[fk] === undefined) delete n[fk]; else n[fk] = clone(published[fk]); return n; } });
  }
  return changes;
}

/** Group a change list by row for display. */
export function groupChanges(changes) {
  const map = new Map();
  for (const c of changes) {
    if (!map.has(c.group)) map.set(c.group, { key: c.group, label: c.groupLabel, route: c.route, changes: [] });
    map.get(c.group).changes.push(c);
  }
  return [...map.values()];
}
