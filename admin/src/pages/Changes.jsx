import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore, SITE_URL } from '../store/index.jsx';
import { computeChanges, groupChanges, describe } from '../store/diff.js';
import { Modal, useToast, timeAgo } from '../components/ui.jsx';

/**
 * Review every unpublished change: what it was, what it is now. Discard any single change (the published
 * value goes back into the draft), discard a whole area, or publish what is left.
 */
export default function Changes() {
  const { rows, updateDraft, publish, openPreview, pending } = useStore();
  const toast = useToast();
  const [confirm, setConfirm] = useState(null); // { label, run }
  const [publishing, setPublishing] = useState(false);
  const [note, setNote] = useState('');
  const [showPublish, setShowPublish] = useState(false);

  const changes = useMemo(() => computeChanges(rows), [rows]);
  const groups = useMemo(() => groupChanges(changes), [changes]);

  const discardOne = (c) => updateDraft(c.rowKey, (d) => c.revert(d));
  const discardGroup = (g) => setConfirm({
    label: `Discard all ${g.changes.length} change${g.changes.length === 1 ? '' : 's'} in ${g.label}? The published version comes back; this cannot be undone.`,
    run: () => { updateDraft(g.key, () => clone(rows[g.key].published)); toast(`Discarded changes in ${g.label}.`, 'ok'); },
  });
  const discardAll = () => setConfirm({
    label: `Discard every unpublished change (${changes.length})? Everything goes back to what is live on the website. This cannot be undone.`,
    run: () => { for (const g of groups) updateDraft(g.key, () => clone(rows[g.key].published)); toast('All unpublished changes discarded.', 'ok'); },
  });
  const doPublish = async () => {
    setPublishing(true);
    try { await publish(note.trim()); setShowPublish(false); setNote(''); toast('Published. The website refreshes in about a minute.', 'ok', 6000); }
    catch (e) { toast(`Publish failed: ${e.message}`, 'bad', 7000); }
    finally { setPublishing(false); }
  };

  const previewFor = (g, c) => {
    const page = g.key.startsWith('page:') ? g.key.slice(5) : null;
    const section = page && c?.path && !c.path.startsWith('_meta') ? c.path.split('.')[0] : '';
    const path = page ? `/${page === 'index' ? '' : page}` : '/';
    return openPreview({ path: path === '//' ? '/' : path, section });
  };

  return (
    <>
      <div className="page-h">
        <div>
          <h1>Unpublished changes</h1>
          <p>Everything that differs between your drafts and the live website. Review each change, discard the ones you do not want, then publish the rest. Discarding puts the published version back; it does not delete anything from the website.</p>
        </div>
        <div className="row">
          {changes.length > 0 && <button className="btn btn--danger" onClick={discardAll}>Discard all</button>}
          <button className="btn btn--primary" onClick={() => setShowPublish(true)} disabled={changes.length === 0}>Publish {changes.length ? `${changes.length} change${changes.length === 1 ? '' : 's'}` : ''}</button>
        </div>
      </div>

      {changes.length === 0 && (
        <div className="card"><div className="empty"><div style={{ fontSize: 18, color: 'var(--fg)', marginBottom: 6 }}>Nothing waiting to be published</div>Your drafts match the live website. <a href={SITE_URL} target="_blank" rel="noopener">Open the website</a></div></div>
      )}

      {groups.map((g) => (
        <div key={g.key} className="card section-card">
          <div className="card__h">
            <div><h3>{g.label}</h3><div className="hint">{g.changes.length} change{g.changes.length === 1 ? '' : 's'}{rows[g.key]?.updated_at ? `, last edited ${timeAgo(rows[g.key].updated_at)}` : ''}</div></div>
            <div className="spacer" />
            {g.key.startsWith('page:') && <button className="btn btn--sm" onClick={() => previewFor(g)}>Preview page</button>}
            <Link className="btn btn--sm" to={g.route}>Open editor</Link>
            <button className="btn btn--sm btn--ghost btn--danger" onClick={() => discardGroup(g)}>Discard all here</button>
          </div>
          <div className="chg">
            {g.changes.map((c) => <ChangeRow key={c.id} change={c} onDiscard={() => discardOne(c)} onPreview={g.key.startsWith('page:') ? () => previewFor(g, c) : null} />)}
          </div>
        </div>
      ))}

      {confirm && (
        <Modal title="Are you sure?" onClose={() => setConfirm(null)} footer={<><button className="btn" onClick={() => setConfirm(null)}>Keep changes</button><button className="btn btn--primary" style={{ background: 'var(--bad)', borderColor: 'var(--bad)' }} onClick={() => { confirm.run(); setConfirm(null); }}>Discard</button></>}>
          <p>{confirm.label}</p>
        </Modal>
      )}
      {showPublish && (
        <Modal title="Publish to the live website" onClose={() => !publishing && setShowPublish(false)}
          footer={<><button className="btn" onClick={() => setShowPublish(false)} disabled={publishing}>Cancel</button><button className="btn btn--primary" onClick={doPublish} disabled={publishing}>{publishing && <span className="spin" />}{publishing ? 'Publishing' : `Publish ${changes.length} change${changes.length === 1 ? '' : 's'}`}</button></>}>
          <p className="muted">The {changes.length} change{changes.length === 1 ? '' : 's'} listed on this screen go live within about a minute.</p>
          <div className="field"><label>Note for the history (optional)</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Hid the events photo, updated AUA" /></div>
        </Modal>
      )}
    </>
  );
}

function ChangeRow({ change: c, onDiscard, onPreview }) {
  const before = describe(c.before, c.field);
  const after = describe(c.after, c.field);
  const kindBadge = { added: ['Added', 'badge--ok'], removed: ['Removed', 'badge--bad'], visibility: ['Visibility', 'badge--accent'], order: ['Reordered', 'badge--accent'], field: ['Edited', 'badge--warn'] }[c.kind] || ['Edited', ''];
  return (
    <div className="chg__row">
      <div className="chg__head">
        <span className={`badge ${kindBadge[1]}`}>{kindBadge[0]}</span>
        <span className="chg__label">{c.label}</span>
        <span className="spacer" />
        {onPreview && <button className="btn btn--sm btn--ghost" onClick={onPreview}>Preview</button>}
        <button className="btn btn--sm btn--ghost btn--danger" onClick={onDiscard} title="Put the published version back">Discard</button>
      </div>
      {c.kind !== 'order' && (
        <div className="chg__vals">
          <div className="chg__val chg__val--before"><span className="chg__k">Live now</span>{before.image && <img src={before.image} alt="" />}<span className={before.empty ? 'faint' : ''}>{before.text}</span></div>
          <div className="chg__arrow">→</div>
          <div className="chg__val chg__val--after"><span className="chg__k">After publish</span>{after.image && <img src={after.image} alt="" />}<span className={after.empty ? 'faint' : ''}>{after.text}</span></div>
        </div>
      )}
    </div>
  );
}

function clone(v) { return v === undefined ? v : JSON.parse(JSON.stringify(v)); }
