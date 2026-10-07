import React from 'react';
import { useStore } from '../store/index.jsx';
import { schema } from '../store/content.js';
import Field from '../fields/Field.jsx';
import { SaveState, timeAgo } from '../components/ui.jsx';
import { fmtNum } from './Overview.jsx';

const FIELD_META = {
  value:    { type: 'number',   label: 'Number' },
  prefix:   { type: 'text',     label: 'Shown before (e.g. $)' },
  suffix:   { type: 'text',     label: 'Shown after (e.g. %+, B+, M)' },
  decimals: { type: 'number',   label: 'Decimal places' },
  as_of:    { type: 'text',     label: 'As of (date written out, e.g. June 30, 2026)' },
  note:     { type: 'richtext', label: 'Footnote shown with this figure' },
  label:    { type: 'text',     label: 'Caption' },
};

export default function FiguresEditor() {
  const { rows, updateDraft, saving } = useStore();
  const row = rows?.figures;
  if (!row) return <div className="skeleton" style={{ height: 200 }} />;
  const figures = row.draft || {};
  const items = schema.figures?.items || [];
  const set = (figKey, fieldKey, v) => updateDraft('figures', (d) => ({ ...(d || {}), [figKey]: { ...((d || {})[figKey] || {}), [fieldKey]: v } }));
  const usage = (figKey) => {
    const places = [];
    for (const p of schema.pages) for (const s of p.sections) if (JSON.stringify(rows[`page:${p.slug}`]?.draft?.[s.key] || {}).includes(`"figure":"${figKey}"`)) places.push(`${p.title}: ${s.label}`);
    return places;
  };

  return (
    <>
      <div className="page-h">
        <div>
          <h1>{schema.figures?.label || 'Key figures'}</h1>
          <p>{schema.figures?.hint || 'The headline numbers quoted across the website. Change a figure here once and every place it appears updates together. Remember to update the "as of" date and the footnote that goes with it.'}</p>
        </div>
        <div className="row"><SaveState state={saving.figures} />{row.updated_at && <span className="small faint">edited {timeAgo(row.updated_at)}</span>}</div>
      </div>
      <div className="banner banner--warn" style={{ marginBottom: 18 }}><b>Compliance reminder.</b>&nbsp;Performance figures and their footnotes must match the most recent approved materials. If in doubt, check with the EMD before publishing.</div>

      {items.map((f) => {
        const v = figures[f.key] || {};
        const fields = Object.entries(f.fields || { value: 'number', prefix: 'text', suffix: 'text', decimals: 'number', as_of: 'text', note: 'richtext' });
        const where = usage(f.key);
        return (
          <div key={f.key} className="card section-card" id={`f-${f.key}`}>
            <div className="card__h">
              <div><h3>{f.label}</h3>{f.hint && <div className="hint">{f.hint}</div>}{where.length > 0 && <div className="hint">Appears in: {where.join('; ')}</div>}</div>
              <div className="spacer" />
              <div className="tnum" style={{ fontSize: 30, fontWeight: 300, letterSpacing: '-0.02em' }}>{v.prefix}{fmtNum(v)}{v.suffix}</div>
            </div>
            <div className="card__b">
              <div className="row--4" style={{ marginBottom: 14 }}>
                {fields.filter(([k]) => ['value', 'prefix', 'suffix', 'decimals'].includes(k)).map(([k, t]) => (
                  <Field key={k} field={{ key: k, type: t === 'richtext' ? 'richtext' : t, label: FIELD_META[k]?.label || k }} value={v[k]} onChange={(nv) => set(f.key, k, nv)} />
                ))}
              </div>
              <div className="fields">
                {fields.filter(([k]) => !['value', 'prefix', 'suffix', 'decimals'].includes(k)).map(([k, t]) => (
                  <Field key={k} field={{ key: k, type: t, label: FIELD_META[k]?.label || k }} value={v[k]} onChange={(nv) => set(f.key, k, nv)} />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
