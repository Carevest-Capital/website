import React, { useRef, useState } from 'react';
import { useStore } from '../store/index.jsx';
import { schema } from '../store/content.js';
import { Modal, useToast, timeAgo, fmtDate, fmtBytes } from '../components/ui.jsx';

export default function Documents() {
  const { documents, store, refreshDocuments } = useStore();
  const [uploadFor, setUploadFor] = useState(null);
  const [historyFor, setHistoryFor] = useState(null);
  const slots = schema.documents?.slots || [];
  const toast = useToast();

  const makeCurrent = async (id) => { try { await store.setCurrentDocument(id); await refreshDocuments(); toast('That file is now the one the website links to. Publish to make it live.', 'ok'); } catch (e) { toast(e.message, 'bad'); } };
  const del = async (id) => { if (!confirm('Delete this file permanently?')) return; try { await store.deleteDocument(id); await refreshDocuments(); } catch (e) { toast(e.message, 'bad', 6000); } };

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Documents</h1>
          <p>{schema.documents?.hint || 'Each slot is a document the website links to. Upload the newest version into its slot and the link on the website points to it automatically after you publish. Older versions stay in the history in case you need to go back.'}</p>
        </div>
      </div>
      {groupSlots(slots).map(([groupName, groupSlots]) => (
      <div className="card" key={groupName || 'main'}>
        {groupName && <div className="card__h"><h3>{groupName}</h3></div>}
        {groupSlots.map((s) => {
          const cur = documents.find((d) => d.slot === s.key && d.is_current);
          const count = documents.filter((d) => d.slot === s.key).length;
          return (
            <div key={s.key} className="doc-slot">
              <div>
                <div className="name">{s.label}</div>
                {s.hint && <div className="small muted">{s.hint}</div>}
                <div className="cur">
                  {cur ? <>
                    <a href={cur.url} target="_blank" rel="noopener">{cur.title}</a>
                    {cur.version_label && <span className="badge">{cur.version_label}</span>}
                    <span className="faint">uploaded {timeAgo(cur.uploaded_at)}{cur.file_size ? ` · ${fmtBytes(cur.file_size)}` : ''}</span>
                  </> : <span className="badge badge--warn">No file uploaded{s.fallback ? `, website links to ${s.fallback}` : ''}</span>}
                </div>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                {count > 1 && <button className="btn btn--sm btn--ghost" onClick={() => setHistoryFor(s)}>History ({count})</button>}
                <button className="btn btn--sm btn--primary" onClick={() => setUploadFor(s)}>{cur ? 'Upload newer version' : 'Upload'}</button>
              </div>
            </div>
          );
        })}
      </div>
      ))}

      {uploadFor && <UploadModal slot={uploadFor} onClose={() => setUploadFor(null)} onDone={async () => { setUploadFor(null); await refreshDocuments(); toast('Uploaded. Publish to make it live on the website.', 'ok', 5000); }} />}
      {historyFor && (
        <Modal title={`${historyFor.label}: all versions`} onClose={() => setHistoryFor(null)} footer={<button className="btn" onClick={() => setHistoryFor(null)}>Close</button>}>
          <table className="table">
            <thead><tr><th>File</th><th>Version</th><th>Uploaded</th><th></th></tr></thead>
            <tbody>
              {documents.filter((d) => d.slot === historyFor.key).map((d) => (
                <tr key={d.id}>
                  <td><a href={d.url} target="_blank" rel="noopener">{d.title}</a>{d.is_current && <span className="badge badge--ok" style={{ marginLeft: 8 }}>Current</span>}</td>
                  <td>{d.version_label || <span className="faint">none</span>}</td>
                  <td className="small muted">{fmtDate(d.uploaded_at)}</td>
                  <td className="r">{!d.is_current && <><button className="btn btn--sm" onClick={() => makeCurrent(d.id)}>Use this one</button> <button className="btn btn--sm btn--ghost btn--danger" onClick={() => del(d.id)}>Delete</button></>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </>
  );
}

function UploadModal({ slot, onClose, onDone }) {
  const { store } = useStore();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState(slot.label);
  const [version, setVersion] = useState(defaultVersion());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [over, setOver] = useState(false);
  const inputRef = useRef();
  const accept = slot.accept || '.pdf,.doc,.docx,.xls,.xlsx';

  const choose = (f) => {
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) return setErr('That file is larger than 25 MB.');
    setErr(null); setFile(f);
    if (!title || title === slot.label) setTitle(slot.label);
  };
  const go = async () => {
    if (!file) return setErr('Choose a file first.');
    setBusy(true); setErr(null);
    try { await store.uploadDocument({ slot: slot.key, file, title: title.trim() || file.name, versionLabel: version.trim() }); onDone(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Modal title={`Upload: ${slot.label}`} onClose={() => !busy && onClose()}
      footer={<><button className="btn" onClick={onClose} disabled={busy}>Cancel</button><button className="btn btn--primary" onClick={go} disabled={busy || !file}>{busy && <span className="spin" />}{busy ? 'Uploading' : 'Upload and make current'}</button></>}>
      <div className={`drop${over ? ' is-over' : ''}`} onClick={() => inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); choose(e.dataTransfer.files[0]); }}>
        {file ? <span className="filechip">{file.name} <span className="faint">{fmtBytes(file.size)}</span></span> : <>Drop the file here or <b>click to choose</b><div className="small faint" style={{ marginTop: 4 }}>PDF or Office documents, up to 25 MB</div></>}
        <input ref={inputRef} type="file" accept={accept} hidden onChange={(e) => choose(e.target.files[0])} />
      </div>
      <div className="row--split">
        <div className="field"><label>Title shown on the website</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field"><label>Version label</label><input className="input" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="e.g. June 2026" /></div>
      </div>
      <p className="small muted">The new file becomes the current one for this slot straight away in the dashboard. Visitors see it after the next Publish.</p>
      {err && <div className="banner banner--bad">{err}</div>}
    </Modal>
  );
}

function groupSlots(slots) {
  const order = []; const map = new Map();
  for (const s of slots) { const g = s.group || ''; if (!map.has(g)) { map.set(g, []); order.push(g); } map.get(g).push(s); }
  return order.map((g) => [g, map.get(g)]);
}

function defaultVersion() { return new Date().toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }); }
