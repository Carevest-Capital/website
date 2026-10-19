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
  const pageHidden = meta.hidden === true;
  const canHidePage = page.hideable !== false;
  const setPageHidden = (hidden) => {
    if (hidden && !confirm(`Hide the ${page.title} page from the website?\n\nAfter you publish, it disappears from the menu and footer, and its address sends visitors to the home page. You can show it again at any time.`)) return;
    setSection('_meta', 'hidden', hidden);
  };
  const setSectionHidden = (sKey, hidden) => setSection(sKey, '_hidden', hidden);
  const hiddenCount = page.sections.filter((sec) => draft[sec.key]?._hidden === true).length;

  return (
    <>
      <div className="page-h">
        <div>
          <h1>{page.title}</h1>
          <p>{page.description || `Every section of the ${page.title} page, in the order visitors see it. Edits save automatically; press Publish when you are ready. Use the switch on a section to hide it from the website without losing its content.`}</p>
        </div>
        <div className="row">
          <SaveState state={saving[key]} />
          {row.updated_at && <span className="small faint">edited {timeAgo(row.updated_at)}</span>}
          {canHidePage && (
            <label className="toggle-sw" title={pageHidden ? 'Hidden from the website' : 'Shown on the website'}>
              <input type="checkbox" checked={!pageHidden} onChange={(e) => setPageHidden(!e.target.checked)} />
              <span className="small" style={{ fontWeight: 500 }}>{pageHidden ? 'Page hidden' : 'Page shown'}</span>
            </label>
          )}
          <a className="btn" href={`${SITE_URL}${page.path}`} target="_blank" rel="noopener">Open page</a>
        </div>
      </div>

      {pageHidden && (
        <div className="banner banner--warn" style={{ marginBottom: 18 }}>
          <span><b>This page is hidden.</b> Once published it leaves the menu and footer, and its address sends visitors to the home page. Your content stays saved here; switch the page back on whenever you need it.</span>
        </div>
      )}
      {!pageHidden && hiddenCount > 0 && (
        <div className="banner banner--info" style={{ marginBottom: 18 }}>
          <span>{hiddenCount} section{hiddenCount === 1 ? ' is' : 's are'} hidden on this page. Hidden sections keep their content and can be switched back on at any time.</span>
        </div>
      )}

      <div className="row small muted" style={{ marginBottom: 18, gap: 8 }}>
        <span>Jump to:</span>
        {page.sections.map((s, i) => <a key={s.key} href={`#s-${s.key}`} className="badge" style={{ cursor: 'pointer' }}>{i + 1}. {s.label}</a>)}
        <a href="#s-meta" className="badge" style={{ cursor: 'pointer' }}>Search listing</a>
      </div>

      {page.sections.map((section, i) => {
        const values = draft[section.key] || {};
        const isHidden = values._hidden === true;
        const isCollapsed = collapsed[section.key] ?? isHidden;
        return (
          <div key={section.key} id={`s-${section.key}`} className={`card section-card${isCollapsed ? ' is-collapsed' : ''}${isHidden ? ' is-hidden' : ''}`}>
            <div className="card__h">
              <span className="num tnum">{i + 1}</span>
              <div><h3>{section.label}{isHidden && <span className="badge badge--warn" style={{ marginLeft: 10, verticalAlign: 'middle' }}>Hidden from website</span>}</h3>{section.hint && <div className="hint">{section.hint}</div>}</div>
              <div className="spacer" />
              {section.collection && <Link className="badge badge--accent" to={`/collections/${section.collection}`}>Items come from {schema.collections[section.collection]?.label || section.collection}</Link>}
              {section.required ? (
                <span className="small faint" title="This section opens the page and cannot be hidden.">Always shown</span>
              ) : (
                <label className="toggle-sw" title={isHidden ? 'Hidden from the website' : 'Shown on the website'}>
                  <input type="checkbox" checked={!isHidden} onChange={(e) => setSectionHidden(section.key, !e.target.checked)} />
                  <span className="small" style={{ fontWeight: 500 }}>{isHidden ? 'Hidden' : 'Shown'}</span>
                </label>
              )}
              <button className="toggle" onClick={() => setCollapsed({ ...collapsed, [section.key]: !isCollapsed })}>{isCollapsed ? 'Expand' : 'Collapse'} {isCollapsed ? '▾' : '▴'}</button>
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
