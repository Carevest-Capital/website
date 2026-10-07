import React from 'react';
import { useStore } from '../store/index.jsx';
import { schema } from '../store/content.js';
import Field from '../fields/Field.jsx';
import { SaveState, timeAgo } from '../components/ui.jsx';

export default function Globals() {
  const { rows, updateDraft, saving } = useStore();
  const row = rows?.globals;
  if (!row) return <div className="skeleton" style={{ height: 200 }} />;
  const g = row.draft || {};
  const set = (k, v) => updateDraft('globals', (d) => ({ ...(d || {}), [k]: v }));
  const groups = schema.globals?.groups;
  const fields = schema.globals?.fields || [];

  const renderFields = (list) => <div className="fields">{list.map((f) => <Field key={f.key} field={f} value={g[f.key]} onChange={(v) => set(f.key, v)} />)}</div>;

  return (
    <>
      <div className="page-h">
        <div><h1>{schema.globals?.label || 'Site-wide'}</h1><p>{schema.globals?.hint || 'Details that appear on every page: the menu, phone numbers, office addresses, footer links and the legal disclaimer.'}</p></div>
        <div className="row"><SaveState state={saving.globals} />{row.updated_at && <span className="small faint">edited {timeAgo(row.updated_at)}</span>}</div>
      </div>
      {groups ? groups.map((grp) => (
        <div key={grp.label} className="card section-card"><div className="card__h"><div><h3>{grp.label}</h3>{grp.hint && <div className="hint">{grp.hint}</div>}</div></div><div className="card__b">{renderFields(fields.filter((f) => grp.fields.includes(f.key)))}</div></div>
      )) : (
        <div className="card"><div className="card__b">{renderFields(fields)}</div></div>
      )}
    </>
  );
}
