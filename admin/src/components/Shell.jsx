import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { useStore, SITE_URL, PREVIEW_URL } from '../store/index.jsx';
import { schema, rowLabel, rowRoute, ROW_KEYS } from '../store/content.js';
import { Modal, useToast, timeAgo } from './ui.jsx';

export default function Shell() {
  const { profile, pending, publish, openPreview, signOut, store, isAdmin, error, clearError, rows } = useStore();
  const [publishing, setPublishing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [note, setNote] = useState('');
  const [menu, setMenu] = useState(false);
  const toast = useToast();
  const loc = useLocation();

  const pendingKeys = new Set(pending.map((p) => p.key));

  const doPublish = async () => {
    setPublishing(true);
    try {
      await publish(note.trim());
      setShowPublish(false); setNote('');
      toast(store.mode === 'demo' ? 'Published (demo mode: nothing was deployed).' : 'Published. The website will refresh in about a minute.', 'ok', 6000);
    } catch (e) { toast(`Publish failed: ${e.message}`, 'bad', 7000); }
    finally { setPublishing(false); }
  };

  const currentPage = (() => {
    const m = loc.pathname.match(/^\/pages\/([^/]+)/);
    return m ? schema.pages.find((p) => p.slug === m[1]) : null;
  })();
  const doPreview = async () => {
    setPreviewing(true);
    try {
      await openPreview({ path: currentPage?.path || '/' });
    } catch (e) { toast(`Preview failed: ${e.message}`, 'bad', 7000); }
    finally { setPreviewing(false); }
  };

  const crumbs = crumbsFor(loc.pathname);

  return (
    <div className="shell">
      <aside className={`side${menu ? ' is-open' : ''}`}>
        <div className="side__brand">
          <img src="/logo-white.png" alt="CareVest" />
          <div><span>Website Manager</span></div>
          <button className="side__menu" onClick={() => setMenu(!menu)}>Menu</button>
        </div>
        <nav onClick={() => setMenu(false)}>
          <NavLink to="/" end className={({ isActive }) => `nav${isActive ? ' active' : ''}`}>Overview</NavLink>
          <NavLink to="/changes" className={({ isActive }) => `nav${isActive ? ' active' : ''}`}>Unpublished changes{pending.length > 0 && <span className="dot" />}</NavLink>
          <div className="grp">Pages</div>
          {schema.pages.map((p) => (
            <NavLink key={p.slug} to={`/pages/${p.slug}`} className={({ isActive }) => `nav${isActive ? ' active' : ''}`}>
              {p.title}{pendingKeys.has(ROW_KEYS.page(p.slug)) && <span className="dot" title="Unpublished changes" />}
            </NavLink>
          ))}
          <div className="grp">Shared content</div>
          <NavLink to="/figures" className={({ isActive }) => `nav${isActive ? ' active' : ''}`}>{schema.figures?.label || 'Key figures'}{pendingKeys.has('figures') && <span className="dot" />}</NavLink>
          <NavLink to="/documents" className={({ isActive }) => `nav${isActive ? ' active' : ''}`}>Documents</NavLink>
          {Object.entries(schema.collections).map(([name, c]) => (
            <NavLink key={name} to={`/collections/${name}`} className={({ isActive }) => `nav${isActive ? ' active' : ''}`}>{c.label}{pendingKeys.has(ROW_KEYS.collection(name)) && <span className="dot" />}</NavLink>
          ))}
          <NavLink to="/site" className={({ isActive }) => `nav${isActive ? ' active' : ''}`}>{schema.globals?.label || 'Site-wide'}{pendingKeys.has('globals') && <span className="dot" />}</NavLink>
          {isAdmin && <>
            <div className="grp">Administration</div>
            <NavLink to="/users" className={({ isActive }) => `nav${isActive ? ' active' : ''}`}>Users</NavLink>
            <NavLink to="/settings" className={({ isActive }) => `nav${isActive ? ' active' : ''}`}>Publishing setup</NavLink>
            <NavLink to="/history" className={({ isActive }) => `nav${isActive ? ' active' : ''}`}>Publish history</NavLink>
          </>}
        </nav>
        <div className="side__foot">
          <b>{profile?.full_name || profile?.email || 'Signed in'}</b>
          <span className="small">{profile?.role === 'admin' ? 'Administrator' : 'Editor'}{store.mode === 'demo' ? ' (demo)' : ''}</span>
          <br /><button onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="crumbs">{crumbs.map((c, i) => <React.Fragment key={i}>{i > 0 && <span className="faint">/</span>}{i === crumbs.length - 1 ? <b>{c.label}</b> : <Link to={c.to}>{c.label}</Link>}</React.Fragment>)}</div>
          <div className="spacer" />
          {store.mode === 'demo' && <span className="badge badge--demo">Demo mode</span>}
          {pending.length > 0
            ? <Link className="badge badge--warn badge--link" to="/changes" title="Review, discard or publish your changes">{pending.length} area{pending.length === 1 ? '' : 's'} with unpublished changes · Review</Link>
            : <span className="badge badge--ok">Website is up to date</span>}
          <a className="btn" href={SITE_URL} target="_blank" rel="noopener">View website</a>
          <button className="btn" onClick={doPreview} disabled={previewing} title={currentPage ? `Preview the ${currentPage.title} page with your unpublished changes` : 'Preview the website with your unpublished changes'}>{previewing && <span className="spin" />}Preview changes</button>
          <button className="btn btn--primary" onClick={() => setShowPublish(true)} disabled={pending.length === 0}>Publish</button>
        </div>
        {error && <div className="banner banner--bad" style={{ margin: '16px 32px 0' }}><span style={{ flex: 1 }}>{error}</span><button className="btn btn--sm" onClick={clearError}>Dismiss</button></div>}
        {rows && Object.values(rows).some((r) => r._unseeded) && store.mode !== 'demo' && (
          <div className="banner banner--info" style={{ margin: '16px 32px 0' }}>Some content has not been imported into the database yet. It is shown from the built-in copy of the website; the first time you save a section it is stored properly. To import everything at once, run the seed script described in the setup guide.</div>
        )}
        <div className="content"><Outlet /></div>
      </div>

      {showPublish && (
        <Modal title="Publish to the live website" onClose={() => !publishing && setShowPublish(false)}
          footer={<>
            <button className="btn" onClick={() => setShowPublish(false)} disabled={publishing}>Cancel</button>
            <button className="btn btn--primary" onClick={doPublish} disabled={publishing}>{publishing && <span className="spin" />}{publishing ? 'Publishing' : `Publish ${pending.length} change${pending.length === 1 ? '' : 's'}`}</button>
          </>}>
          <p className="muted">These areas have changes that visitors cannot see yet. Publishing makes them live within about a minute. Want to check or discard individual changes first? <Link to="/changes" onClick={() => setShowPublish(false)}>Review them</Link>.</p>
          <div className="changes">{pending.map((p) => <div key={p.key}><Link to={rowRoute(p.key)} onClick={() => setShowPublish(false)}>{rowLabel(p.key)}</Link><span className="faint">{timeAgo(p.updated_at)}</span></div>)}</div>
          <div className="field"><label>Note for the history (optional)</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Updated June fund highlights" /></div>
        </Modal>
      )}
    </div>
  );
}

function crumbsFor(path) {
  const parts = path.split('/').filter(Boolean);
  const out = [{ label: 'Overview', to: '/' }];
  if (parts[0] === 'pages' && parts[1]) out.push({ label: 'Pages', to: '/' }, { label: schema.pages.find((p) => p.slug === parts[1])?.title || parts[1], to: path });
  else if (parts[0] === 'collections' && parts[1]) out.push({ label: schema.collections[parts[1]]?.label || parts[1], to: path });
  else if (parts[0]) out.push({ label: { figures: schema.figures?.label || 'Key figures', documents: 'Documents', site: schema.globals?.label || 'Site-wide', users: 'Users', settings: 'Publishing setup', history: 'Publish history' }[parts[0]] || parts[0], to: path });
  return out;
}
