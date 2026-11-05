import React from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/index.jsx';
import { schema, ROW_KEYS } from '../store/content.js';
import Field from '../fields/Field.jsx';
import { SaveState } from '../components/ui.jsx';

/* Fields that hold legal or compliance wording, found by their key across the whole content model. */
const IS_DISCLAIMER = /(^|_)(fine|disclaimer|consent|footnote|note|notes)$|left_fine/;

/**
 * Every disclaimer, footnote, consent note and piece of fine print on the website, on one screen, so
 * compliance changes have one obvious place. Each field is the same one shown in its page section;
 * editing here or there is the same thing.
 */
export default function Disclaimers() {
  const { rows, updateDraft, saving } = useStore();
  if (!rows) return <div className="skeleton" style={{ height: 200 }} />;

  const groups = [];

  /* Site-wide footer disclaimer */
  const gField = (schema.globals?.fields || []).find((f) => f.key === 'disclaimer');
  if (gField) groups.push({ key: 'globals', title: 'Every page: footer', link: '/site', items: [{ id: 'g-disc', label: 'Disclaimer at the bottom of every page', field: gField, value: rows.globals?.draft?.disclaimer, onChange: (v) => updateDraft('globals', (d) => ({ ...(d || {}), disclaimer: v })), rowKey: 'globals' }] });

  /* Key figure footnotes */
  const figItems = (schema.figures?.items || []).map((f) => {
    const note = rows.figures?.draft?.[f.key]?.note;
    return { id: `fig-${f.key}`, label: `${f.label}: footnote`, where: placesForFigure(f.key, rows), field: { key: 'note', type: 'richtext', label: '' }, value: note, onChange: (v) => updateDraft('figures', (d) => ({ ...(d || {}), [f.key]: { ...((d || {})[f.key] || {}), note: v } })), rowKey: 'figures' };
  }).filter((x) => x.value || x.where.length);
  if (figItems.length) groups.push({ key: 'figures', title: 'Key figure footnotes', link: '/figures', items: figItems });

  /* Page sections */
  for (const page of schema.pages) {
    const rowKey = ROW_KEYS.page(page.slug);
    const draft = rows[rowKey]?.draft || {};
    const items = [];
    for (const section of page.sections) {
      for (const f of section.fields || []) {
        if (!IS_DISCLAIMER.test(f.key)) continue;
        if (f.type === 'list') {
          items.push({ id: `${page.slug}-${section.key}-${f.key}`, label: `${section.label}: ${f.label || f.key}`, field: f, value: draft[section.key]?.[f.key], onChange: (v) => updateDraft(rowKey, (d) => ({ ...(d || {}), [section.key]: { ...((d || {})[section.key] || {}), [f.key]: v } })), rowKey, section: section.key, page: page.slug });
        } else if (['text', 'richtext'].includes(f.type)) {
          items.push({ id: `${page.slug}-${section.key}-${f.key}`, label: `${section.label}: ${f.label || f.key}`, field: { ...f, label: '', multiline: true }, value: draft[section.key]?.[f.key], onChange: (v) => updateDraft(rowKey, (d) => ({ ...(d || {}), [section.key]: { ...((d || {})[section.key] || {}), [f.key]: v } })), rowKey, section: section.key, page: page.slug, hidden: draft[section.key]?._hidden === true });
        }
      }
    }
    if (items.length) groups.push({ key: page.slug, title: `Page: ${page.title}`, link: `/pages/${page.slug}`, items });
  }

  /* Collections with small print (for example FAQ source lines) */
  for (const [name, col] of Object.entries(schema.collections)) {
    const fns = (col.fields || []).filter((f) => IS_DISCLAIMER.test(f.key) && ['text', 'richtext'].includes(f.type));
    if (!fns.length) continue;
    const list = rows[ROW_KEYS.collection(name)]?.draft || [];
    const items = [];
    list.forEach((it, i) => fns.forEach((f) => {
      if (!it[f.key]) return;
      items.push({ id: `${name}-${it.id || i}-${f.key}`, label: `${it.question || it.title || it.name || it.heading || 'Item'}: ${f.label || f.key}`, field: { ...f, label: '', multiline: true }, value: it[f.key], onChange: (v) => updateDraft(ROW_KEYS.collection(name), (d) => (d || []).map((x, j) => (j === i ? { ...x, [f.key]: v } : x))), rowKey: ROW_KEYS.collection(name) });
    }));
    if (items.length) groups.push({ key: name, title: col.label, link: `/collections/${name}`, items });
  }

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Disclaimers &amp; fine print</h1>
          <p>Every disclaimer, footnote, consent note and piece of small print on the website, in one place. These are the same fields you see inside each page section, so editing here or there is the same change. Edits save as drafts; Preview, then Publish when compliance has approved them.</p>
        </div>
      </div>
      {groups.map((g) => (
        <div key={g.key} className="card section-card">
          <div className="card__h">
            <h3>{g.title}</h3>
            <div className="spacer" />
            <SaveState state={saving[g.items[0]?.rowKey]} />
            <Link className="btn btn--sm btn--ghost" to={g.link}>Open editor</Link>
          </div>
          <div className="card__b">
            <div className="fields">
              {g.items.map((it) => (
                <div key={it.id} className="field" style={{ minWidth: 0 }}>
                  <label>
                    {it.page && it.section ? <Link to={`/pages/${it.page}#s-${it.section}`} style={{ color: 'inherit' }}>{it.label}</Link> : it.label}
                    {it.hidden && <span className="badge">Section hidden</span>}
                  </label>
                  {it.where?.length > 0 && <div className="hint">Shown on: {it.where.join('; ')}</div>}
                  <Field field={it.field} value={it.value} onChange={it.onChange} hideLabel />
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

function placesForFigure(figKey, rows) {
  const out = [];
  for (const p of schema.pages) {
    for (const s of p.sections) {
      if ((s.figureNotes || []).includes(figKey)) out.push(`${p.title}: ${s.label}`);
    }
  }
  return out;
}
