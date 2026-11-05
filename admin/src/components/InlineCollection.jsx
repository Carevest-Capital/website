import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/index.jsx';
import { schema, ROW_KEYS, newCollectionItem, itemTitle, itemSubtitle } from '../store/content.js';
import Field, { ListRow } from '../fields/Field.jsx';

/**
 * The items a page section shows (team members, transactions, FAQs, ...), editable right inside that
 * section. They are stored in the shared collection, so a change here also shows everywhere else the
 * same items appear; the note under the heading says where.
 */
export default function InlineCollection({ section, page }) {
  const { rows, updateDraft } = useStore();
  const [open, setOpen] = useState(null);
  const name = section.collection;
  const col = schema.collections[name];
  if (!col) return null;
  const key = ROW_KEYS.collection(name);
  const all = Array.isArray(rows?.[key]?.draft) ? rows[key].draft : [];
  const inSection = (it) => !section.group || (it && it.group === section.group);
  const visible = all.map((it, i) => ({ it, i })).filter(({ it }) => inSection(it));
  const fields = section.group ? col.fields.filter((f) => f.key !== 'group') : col.fields;
  const single = (col.singular || 'item').toLowerCase();

  const elsewhere = schema.pages
    .flatMap((p) => p.sections.filter((s) => s.collection === name && (s.group || '') === (section.group || '') && !(p.slug === page.slug && s.key === section.key)).map(() => p.title))
    .filter((v, i, a) => a.indexOf(v) === i);

  const set = (i, item) => updateDraft(key, (d) => (d || []).map((x, j) => (j === i ? item : x)));
  /* Move among the items this section shows, keeping everything else in place. */
  const move = (pos, dir) => {
    const a = visible[pos].i; const b = visible[pos + dir].i;
    updateDraft(key, (d) => { const n = [...(d || [])]; [n[a], n[b]] = [n[b], n[a]]; return n; });
    setOpen(pos + dir);
  };
  const remove = (i) => {
    if (!confirm(`Remove this ${single}?${elsewhere.length ? ` It will also disappear from: ${elsewhere.join(', ')}.` : ''}`)) return;
    updateDraft(key, (d) => (d || []).filter((_, j) => j !== i));
    setOpen(null);
  };
  const add = () => {
    const item = newCollectionItem(col);
    if (section.group) item.group = section.group;
    updateDraft(key, (d) => [...(d || []), item]);
    setOpen(visible.length);
  };

  return (
    <div className="inline-col">
      <div className="inline-col__h">
        <div>
          <div className="lbl" style={{ fontWeight: 500 }}>{section.group ? `${col.label}: ${section.group}` : col.label}</div>
          <div className="hint">
            {elsewhere.length ? `Shared: changes here also appear on ${elsewhere.join(', ')}. ` : ''}
            The order here is the order on the website.
          </div>
        </div>
        <Link className="btn btn--sm btn--ghost" to={`/collections/${name}`}>Open full list</Link>
      </div>
      <div className="list">
        {visible.map(({ it, i }, pos) => (
          <ListRow key={it.id || i} index={pos} total={visible.length} title={itemTitle(it, fields)} subtitle={itemSubtitle(it, fields)}
            isOpen={open === pos} onToggle={() => setOpen(open === pos ? null : pos)}
            onUp={() => move(pos, -1)} onDown={() => move(pos, 1)} onRemove={() => remove(i)}>
            <div className="fields">
              {fields.map((f) => <Field key={f.key} field={f} value={it[f.key]} onChange={(v) => set(i, { ...it, [f.key]: v })} />)}
            </div>
          </ListRow>
        ))}
        {visible.length === 0 && <div className="empty" style={{ padding: 16 }}>No {col.label.toLowerCase()} here yet.</div>}
        <button type="button" className="list-add" onClick={add}>+ Add {single}</button>
      </div>
    </div>
  );
}
