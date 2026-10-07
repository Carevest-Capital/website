import React, { useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useStore } from '../store/index.jsx';
import { schema, ROW_KEYS, newCollectionItem, itemTitle, itemSubtitle } from '../store/content.js';
import Field, { ListRow } from '../fields/Field.jsx';
import { SaveState, timeAgo } from '../components/ui.jsx';

export default function CollectionEditor() {
  const { name } = useParams();
  const col = schema.collections[name];
  const { rows, updateDraft, saving } = useStore();
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState('');
  if (!col) return <Navigate to="/" replace />;
  const key = ROW_KEYS.collection(name);
  const row = rows?.[key];
  if (!row) return <div className="skeleton" style={{ height: 200 }} />;
  const items = Array.isArray(row.draft) ? row.draft : [];
  const usedOn = schema.pages.filter((p) => p.sections.some((s) => s.collection === name)).map((p) => p.title);
  const groupField = col.fields.find((f) => f.type === 'select' && f.key === 'group');
  const q = filter.trim().toLowerCase();
  const visible = items.map((it, i) => ({ it, i })).filter(({ it }) => !q || JSON.stringify(it).toLowerCase().includes(q));

  const set = (i, item) => updateDraft(key, (d) => d.map((x, j) => (j === i ? item : x)));
  const move = (i, dir) => { updateDraft(key, (d) => { const n = [...d]; const [x] = n.splice(i, 1); n.splice(i + dir, 0, x); return n; }); setOpen(i + dir); };
  const remove = (i) => { if (confirm(`Remove this ${col.singular?.toLowerCase() || 'item'} from the website?`)) { updateDraft(key, (d) => d.filter((_, j) => j !== i)); setOpen(null); } };
  const add = () => { updateDraft(key, (d) => [...(d || []), newCollectionItem(col)]); setOpen(items.length); setFilter(''); };

  return (
    <>
      <div className="page-h">
        <div>
          <h1>{col.label}</h1>
          <p>{col.hint || `Add, reorder or edit each ${col.singular?.toLowerCase() || 'item'}. The order here is the order on the website.`}{usedOn.length ? ` Shown on: ${usedOn.join(', ')}.` : ''}</p>
        </div>
        <div className="row">
          <SaveState state={saving[key]} />
          {row.updated_at && <span className="small faint">edited {timeAgo(row.updated_at)}</span>}
          <button className="btn btn--primary" onClick={add}>+ Add {col.singular?.toLowerCase() || 'item'}</button>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 14, justifyContent: 'space-between' }}>
        <input className="input input--sm" style={{ maxWidth: 320 }} placeholder={`Search ${col.label.toLowerCase()}`} value={filter} onChange={(e) => setFilter(e.target.value)} />
        <span className="small muted">{items.length} {(col.singular || 'item').toLowerCase()}{items.length === 1 ? '' : 's'}</span>
      </div>

      <div className="list">
        {visible.map(({ it, i }) => (
          <ListRow key={it.id || i} index={i} total={items.length} title={itemTitle(it, col.fields)} subtitle={itemSubtitle(it, col.fields)}
            badge={groupField && it.group ? <span className="badge">{it.group}</span> : null}
            isOpen={open === i} onToggle={() => setOpen(open === i ? null : i)} onUp={() => move(i, -1)} onDown={() => move(i, 1)} onRemove={() => remove(i)}>
            <div className="fields">
              {col.fields.map((f) => <Field key={f.key} field={f} value={it[f.key]} onChange={(v) => set(i, { ...it, [f.key]: v })} />)}
            </div>
          </ListRow>
        ))}
        {visible.length === 0 && <div className="empty">{q ? 'Nothing matches that search.' : `No ${col.label.toLowerCase()} yet.`}</div>}
        <button className="list-add" onClick={add}>+ Add {col.singular?.toLowerCase() || 'item'}</button>
      </div>
    </>
  );
}
