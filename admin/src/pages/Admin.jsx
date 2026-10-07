import React, { useEffect, useState } from 'react';
import { useStore } from '../store/index.jsx';
import { Modal, useToast, fmtDate } from '../components/ui.jsx';

/* ---------------- Users ---------------- */
export function Users() {
  const { store, profile } = useStore();
  const [list, setList] = useState(null);
  const toast = useToast();
  const load = () => store.listProfiles().then(setList).catch((e) => toast(e.message, 'bad'));
  useEffect(() => { load(); }, []);
  const setRole = async (id, role) => { try { await store.updateProfileRole(id, role); load(); } catch (e) { toast(e.message, 'bad'); } };
  const projectRef = (import.meta.env.VITE_SUPABASE_URL || '').replace('https://', '').split('.')[0];

  return (
    <>
      <div className="page-h"><div><h1>Users</h1><p>Who can sign in to this dashboard. Editors can change content, upload documents and publish. Administrators can also manage users and the publishing setup.</p></div></div>
      <div className="card">
        <div className="card__h"><h3>People with access</h3></div>
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Added</th></tr></thead>
          <tbody>
            {(list || []).map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 500 }}>{u.full_name || <span className="faint">No name yet</span>}{u.id === profile?.id && <span className="badge" style={{ marginLeft: 8 }}>You</span>}</td>
                <td>{u.email}</td>
                <td>
                  <select className="select input--sm" style={{ width: 160 }} value={u.role} disabled={u.id === profile?.id} onChange={(e) => setRole(u.id, e.target.value)}>
                    <option value="editor">Editor</option><option value="admin">Administrator</option>
                  </select>
                </td>
                <td className="small muted">{fmtDate(u.created_at)}</td>
              </tr>
            ))}
            {list && list.length === 0 && <tr><td colSpan="4" className="empty">No users yet.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <div className="card__h"><h3>Adding someone new</h3></div>
        <div className="card__b">
          <ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
            <li>Open the Supabase project{projectRef ? <> (<a href={`https://supabase.com/dashboard/project/${projectRef}/auth/users`} target="_blank" rel="noopener">Authentication, Users</a>)</> : ''} and choose <b>Invite user</b>.</li>
            <li>Enter their work email. They receive an email with a link to choose a password.</li>
            <li>They appear in the list above as an Editor. Change the role here if they should be an Administrator.</li>
          </ol>
          <p className="small muted" style={{ marginTop: 12 }}>To remove someone, delete them from the same Supabase screen. Their access ends immediately.</p>
        </div>
      </div>
    </>
  );
}

/* ---------------- Publishing setup ---------------- */
export function Settings() {
  const { store } = useStore();
  const [targets, setTargets] = useState(null);
  const [edit, setEdit] = useState(null);
  const toast = useToast();
  const load = () => store.listDeployTargets().then(setTargets).catch((e) => toast(e.message, 'bad'));
  useEffect(() => { load(); }, []);
  const save = async () => { try { await store.saveDeployTarget(edit); setEdit(null); load(); toast('Saved', 'ok'); } catch (e) { toast(e.message, 'bad'); } };
  const del = async (id) => { if (confirm('Remove this website from publishing?')) { await store.deleteDeployTarget(id); load(); } };

  return (
    <>
      <div className="page-h"><div><h1>Publishing setup</h1><p>When someone presses Publish, each website listed under Production is rebuilt with the new content. "Update preview" rebuilds the Preview site with unpublished drafts. Set this up once; editors never need to see it.</p></div>
        <button className="btn btn--primary" onClick={() => setEdit({ name: '', kind: 'production', hook_url: '', site_url: '', enabled: true })}>+ Add website</button></div>
      <div className="card">
        <table className="table">
          <thead><tr><th>Website</th><th>Used for</th><th>Address</th><th>Deploy hook</th><th></th></tr></thead>
          <tbody>
            {(targets || []).map((t) => (
              <tr key={t.id}>
                <td style={{ fontWeight: 500 }}>{t.name}{!t.enabled && <span className="badge" style={{ marginLeft: 8 }}>Paused</span>}</td>
                <td><span className={`badge ${t.kind === 'production' ? 'badge--ok' : 'badge--accent'}`}>{t.kind === 'production' ? 'Production' : 'Preview'}</span></td>
                <td>{t.site_url ? <a href={t.site_url} target="_blank" rel="noopener">{t.site_url.replace('https://', '')}</a> : <span className="faint">not set</span>}</td>
                <td className="mono faint">{mask(t.hook_url)}</td>
                <td className="r"><button className="btn btn--sm" onClick={() => setEdit(t)}>Edit</button> <button className="btn btn--sm btn--ghost btn--danger" onClick={() => del(t.id)}>Remove</button></td>
              </tr>
            ))}
            {targets && targets.length === 0 && <tr><td colSpan="5" className="empty">No websites connected yet. Add the deploy hook from each Vercel project.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <div className="card__h"><h3>Where to find a deploy hook</h3></div>
        <div className="card__b"><ol style={{ margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
          <li>In Vercel open the website project, then <b>Settings, Git, Deploy Hooks</b>.</li>
          <li>Create a hook named "CMS publish" on the production branch and copy its address.</li>
          <li>Paste it here as a Production website. Do the same for the preview project as a Preview website.</li>
        </ol></div>
      </div>
      {edit && (
        <Modal title={edit.id ? 'Edit website' : 'Add website'} onClose={() => setEdit(null)} footer={<><button className="btn" onClick={() => setEdit(null)}>Cancel</button><button className="btn btn--primary" onClick={save} disabled={!edit.name || !edit.hook_url}>Save</button></>}>
          <div className="field"><label>Name</label><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="e.g. carevest.com" /></div>
          <div className="field"><label>Used for</label><select className="select" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}><option value="production">Production (rebuilt on Publish)</option><option value="preview">Preview (rebuilt on Update preview)</option></select></div>
          <div className="field"><label>Deploy hook address</label><input className="input mono" value={edit.hook_url} onChange={(e) => setEdit({ ...edit, hook_url: e.target.value })} placeholder="https://api.vercel.com/v1/integrations/deploy/..." /></div>
          <div className="field"><label>Website address (optional)</label><input className="input" value={edit.site_url || ''} onChange={(e) => setEdit({ ...edit, site_url: e.target.value })} placeholder="https://" /></div>
          <label className="toggle-sw"><input type="checkbox" checked={edit.enabled ?? true} onChange={(e) => setEdit({ ...edit, enabled: e.target.checked })} /> <span>Enabled</span></label>
        </Modal>
      )}
    </>
  );
}

function mask(u = '') { return u.length > 44 ? `${u.slice(0, 36)}…${u.slice(-6)}` : u; }

/* ---------------- History ---------------- */
export function History() {
  const { store } = useStore();
  const [log, setLog] = useState(null);
  useEffect(() => { store.publishLog().then(setLog).catch(() => setLog([])); }, []);
  return (
    <>
      <div className="page-h"><div><h1>Publish history</h1><p>Every time the website or the preview was rebuilt from this dashboard.</p></div></div>
      <div className="card">
        <table className="table">
          <thead><tr><th>When</th><th>What</th><th>Note</th><th className="r">Sites rebuilt</th></tr></thead>
          <tbody>
            {(log || []).map((l) => <tr key={l.id}><td className="small">{fmtDate(l.created_at)}</td><td><span className={`badge ${l.kind === 'production' ? 'badge--ok' : 'badge--accent'}`}>{l.kind === 'production' ? 'Published' : 'Preview'}</span></td><td>{l.note || <span className="faint">none</span>}</td><td className="r tnum">{l.hooks_called}</td></tr>)}
            {log && log.length === 0 && <tr><td colSpan="4" className="empty">Nothing published yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
