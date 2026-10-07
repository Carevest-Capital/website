import React, { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useStore, SITE_URL } from '../store/index.jsx';
import { schema, ROW_KEYS } from '../store/content.js';
import Field from '../fields/Field.jsx';
import { SaveState, timeAgo } from '../components/ui.jsx';

export default function PageEditor() {
  const { slug } = useParams();
  const page = schema.pages.find((p) => p.slug === slug);
  const { rows, updateDraft, saving } = useStore();
  const [collapsed, setCollapsed] = useState({});
  if (!page) return <Navigate to="/" replace />;
  const key = ROW_KEYS.page(slug);
  const row = rows?.[key];
  if (!row) return <div className="skeleton" style={{ height: 200 }} />;
  const draft = row.draft || {};
  const setSection = (sKey, fKey, value) => updateDraft(key, (d) => { d = d || {}; d[sKey] = { ...(d[sKey] || {}), [fKey]: value }; return d; });
  const meta = draft._meta || {};

  return (
    <>
      <div className="page-h">
        <div>
          <h1>{page.title}</h1>
          <p>{page.description || `Every section of the ${page.title} page, in the order visitors see it. Edits save automatically; press Publish when you are ready.`}</p>
        </div>
        <div className="row">
          <SaveState state={saving[key]} />
          {row.updated_at && <span className="small faint">edited {timeAgo(row.updated_at)}</span>}
          <a className="btn" href={`${SITE_URL}${page.path}`} target="_blank" rel="noopener">Open page</a>
        </div>
      </div>

      <div className="row small muted" style={{ marginBottom: 18, gap: 8 }}>
        <span>Jump to:</span>
        {page.sections.map((s, i) => <a key={s.key} href={`#s-${s.key}`} className="badge" style={{ cursor: 'pointer' }}>{i + 1}. {s.label}</a>)}
        <a href="#s-meta" className="badge" style={{ cursor: 'pointer' }}>Search listing</a>
      </div>

      {page.sections.map((section, i) => {
        const isCollapsed = !!collapsed[section.key];
        const values = draft[section.key] || {};
        return (
          <div key={section.key} id={`s-${section.key}`} className={`card section-card${isCollapsed ? ' is-collapsed' : ''}`}>
            <div className="card__h">
              <span className="num tnum">{i + 1}</span>
              <div><h3>{section.label}</h3>{section.hint && <div className="hint">{section.hint}</div>}</div>
              <div className="spacer" />
              {section.collection && <Link className="badge badge--accent" to={`/collections/${section.collection}`}>Items come from {schema.collections[section.collection]?.label || section.collection}</Link>}
              <button className="toggle" onClick={() => setCollapsed({ ...collapsed, [section.key]: !isCollapsed })}>{isCollapsed ? 'Show' : 'Hide'} {isCollapsed ? '▾' : '▴'}</button>
            </div>
            {!isCollapsed && (
              <div className="card__b">
                {section.fields?.length ? (
                  <div className="fields">
                    {section.fields.map((f) => <Field key={f.key} field={f} value={values[f.key]} onChange={(v) => setSection(section.key, f.key, v)} />)}
                  </div>
                ) : <p className="muted">This section has nothing to edit here{section.collection ? `: its items are managed under ${schema.collections[section.collection]?.label || section.collection}.` : '.'}</p>}
              </div>
            )}
          </div>
        );
      })}

      <div id="s-meta" className="card section-card" style={{ marginTop: 18 }}>
        <div className="card__h"><span className="num">S</span><div><h3>Search listing</h3><div className="hint">What Google and link previews show for this page. Keep the description under about 160 characters.</div></div></div>
        <div className="card__b"><div className="fields">
          <Field field={{ key: 'title', type: 'text', label: 'Browser tab and search title' }} value={meta.title} onChange={(v) => setSection('_meta', 'title', v)} />
          <Field field={{ key: 'description', type: 'text', label: 'Search description', multiline: true }} value={meta.description} onChange={(v) => setSection('_meta', 'description', v)} />
        </div></div>
      </div>
    </>
  );
}
