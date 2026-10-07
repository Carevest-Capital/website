import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, SITE_URL } from '../store/index.jsx';
import { schema, ROW_KEYS, rowLabel, rowRoute } from '../store/content.js';
import { timeAgo, fmtDate } from '../components/ui.jsx';

export default function Overview() {
  const { rows, pending, documents, store, profile } = useStore();
  const [log, setLog] = useState(null);
  useEffect(() => { store.publishLog().then(setLog).catch(() => setLog([])); }, [pending.length]);

  const lastPublish = log?.find((l) => l.kind === 'production');
  const slots = schema.documents?.slots || [];
  const missingDocs = slots.filter((s) => !documents.some((d) => d.slot === s.key && d.is_current));
  const pendingKeys = new Set(pending.map((p) => p.key));
  const figures = rows?.figures?.draft || {};
  const figureItems = (schema.figures?.items || []).slice(0, 4);

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Good {greeting()}{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}.</h1>
          <p>Everything on carevest.com is managed from here. Pick a page to edit its sections, update the key figures, or upload a newer document. Nothing visitors see changes until you press Publish.</p>
        </div>
      </div>

      <div className="grid grid--4" style={{ marginBottom: 22 }}>
        <div className="card kpi"><div className="k">Unpublished changes</div><div className="v tnum">{pending.length}</div><div className="s">{pending.length ? 'Ready to publish when you are' : 'The website matches your edits'}</div></div>
        <div className="card kpi"><div className="k">Last published</div><div className="v">{lastPublish ? timeAgo(lastPublish.created_at) : 'Not yet'}</div><div className="s">{lastPublish ? fmtDate(lastPublish.created_at) : 'Press Publish to go live'}</div></div>
        <div className="card kpi"><div className="k">Documents</div><div className="v tnum">{slots.length - missingDocs.length}<span className="muted" style={{ fontSize: 16 }}> / {slots.length}</span></div><div className="s">{missingDocs.length ? `${missingDocs.length} slot${missingDocs.length === 1 ? '' : 's'} without a file` : 'Every slot has a current file'}</div></div>
        <div className="card kpi"><div className="k">Pages</div><div className="v tnum">{schema.pages.length}</div><div className="s">{schema.pages.reduce((n, p) => n + p.sections.length, 0)} editable sections</div></div>
      </div>

      {pending.length > 0 && (
        <div className="card" style={{ marginBottom: 22 }}>
          <div className="card__h"><h3>Waiting to be published</h3><div className="spacer" /><span className="small muted">Use the Publish button at the top right</span></div>
          <div className="card__b" style={{ paddingTop: 10, paddingBottom: 10 }}>
            {pending.map((p) => <div key={p.key} className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}><Link to={rowRoute(p.key)}>{rowLabel(p.key)}</Link><span className="faint small">edited {timeAgo(p.updated_at)}</span></div>)}
          </div>
        </div>
      )}

      <h2 style={{ fontSize: 13, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)', margin: '6px 0 12px' }}>Pages</h2>
      <div className="grid grid--3" style={{ marginBottom: 26 }}>
        {schema.pages.map((p) => {
          const r = rows?.[ROW_KEYS.page(p.slug)];
          return (
            <Link key={p.slug} to={`/pages/${p.slug}`} className="card pagecard">
              <div className="row" style={{ justifyContent: 'space-between' }}><h3>{p.title}</h3>{pendingKeys.has(ROW_KEYS.page(p.slug)) ? <span className="badge badge--warn">Edited</span> : <span className="badge badge--ok">Live</span>}</div>
              <div className="sections">{p.sections.map((s) => s.label).join(' · ')}</div>
              <div className="foot"><span className="mono">{p.path}</span><span>{r?.updated_at ? `edited ${timeAgo(r.updated_at)}` : ''}</span></div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid--2">
        <div className="card">
          <div className="card__h"><div><h3>{schema.figures?.label || 'Key figures'}</h3><div className="hint">The numbers investors look for first. They appear in several places at once.</div></div><div className="spacer" /><Link className="btn btn--sm" to="/figures">Update</Link></div>
          <div className="card__b" style={{ paddingTop: 8, paddingBottom: 8 }}>
            {figureItems.map((f) => { const v = figures[f.key] || {}; return (
              <div key={f.key} className="row" style={{ justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <div><div style={{ fontWeight: 500 }}>{f.label}</div>{v.as_of && <div className="small muted">as of {v.as_of}</div>}</div>
                <div className="tnum" style={{ fontSize: 22, fontWeight: 300 }}>{v.prefix}{fmtNum(v)}{v.suffix}</div>
              </div>); })}
          </div>
        </div>
        <div className="card">
          <div className="card__h"><div><h3>Documents</h3><div className="hint">The website always links to the most recent file in each slot.</div></div><div className="spacer" /><Link className="btn btn--sm" to="/documents">Manage</Link></div>
          <div className="card__b" style={{ paddingTop: 8, paddingBottom: 8 }}>
            {slots.slice(0, 6).map((s) => { const d = documents.find((x) => x.slot === s.key && x.is_current); return (
              <div key={s.key} className="row" style={{ justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <div><div style={{ fontWeight: 500 }}>{s.label}</div><div className="small muted">{d ? `${d.version_label || d.title}` : 'No file yet'}</div></div>
                {d ? <span className="faint small">{timeAgo(d.uploaded_at)}</span> : <span className="badge badge--warn">Missing</span>}
              </div>); })}
          </div>
        </div>
      </div>

      <p className="small faint" style={{ marginTop: 26 }}>Live site: <a href={SITE_URL} target="_blank" rel="noopener">{SITE_URL}</a></p>
    </>
  );
}

function greeting() { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'; }
export function fmtNum(v) { if (v?.value === undefined || v?.value === null || v.value === '') return ''; return Number(v.value).toLocaleString('en-CA', { minimumFractionDigits: v.decimals || 0, maximumFractionDigits: v.decimals || 0 }); }
