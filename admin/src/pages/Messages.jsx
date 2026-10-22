import React, { useEffect, useState } from 'react';
import { useStore } from '../store/index.jsx';
import { useToast, fmtDate, timeAgo } from '../components/ui.jsx';

const KIND = { new_investor: 'New Investor', borrower: 'Borrower', general: 'General Inquiries' };

/** Messages sent through the website contact form. A copy of every message is kept here even if the email failed. */
export default function Messages() {
  const { store } = useStore();
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(null);
  const [filter, setFilter] = useState('all');
  const toast = useToast();
  const load = () => store.listMessages().then(setList).catch((e) => toast(e.message, 'bad'));
  useEffect(() => { load(); }, []);

  const mark = async (m, read) => { try { await store.markMessageRead(m.id, read); load(); } catch (e) { toast(e.message, 'bad'); } };
  const del = async (m) => { if (!confirm('Delete this message permanently?')) return; try { await store.deleteMessage(m.id); setOpen(null); load(); } catch (e) { toast(e.message, 'bad'); } };
  const shown = (list || []).filter((m) => filter === 'all' || (filter === 'unread' ? !m.read_at : m.kind === filter));
  const unread = (list || []).filter((m) => !m.read_at).length;
  const failed = (list || []).filter((m) => !m.sent).length;

  return (
    <>
      <div className="page-h">
        <div><h1>Messages</h1><p>Everything sent through the website contact form. Each message is also emailed to the address set for its type on the Contact page. {failed > 0 && <b>{failed} message{failed === 1 ? '' : 's'} could not be emailed; read them here.</b>}</p></div>
        <div className="row">
          <select className="select input--sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option><option value="unread">Unread ({unread})</option><option value="new_investor">New investors</option><option value="borrower">Borrowers</option><option value="general">General inquiries</option>
          </select>
          <button className="btn btn--sm" onClick={load}>Refresh</button>
        </div>
      </div>
      <div className="card">
        <table className="table">
          <thead><tr><th>Received</th><th>From</th><th>Type</th><th>Message</th><th>Emailed to</th><th></th></tr></thead>
          <tbody>
            {shown.map((m) => (
              <React.Fragment key={m.id}>
                <tr style={{ fontWeight: m.read_at ? 400 : 500, cursor: 'pointer' }} onClick={() => { setOpen(open === m.id ? null : m.id); if (!m.read_at) mark(m, true); }}>
                  <td className="small" title={fmtDate(m.created_at)}>{timeAgo(m.created_at)}</td>
                  <td>{m.first_name} {m.last_name}<div className="small muted">{m.email}{m.province ? ` · ${m.province}` : ''}</div></td>
                  <td><span className="badge">{KIND[m.kind] || m.kind}</span></td>
                  <td className="small" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: open === m.id ? 'normal' : 'nowrap' }}>{m.message || <span className="faint">no message</span>}</td>
                  <td className="small">{m.routed_to}{m.sent ? <span className="badge badge--ok" style={{ marginLeft: 6 }}>Sent</span> : <span className="badge badge--bad" style={{ marginLeft: 6 }} title={m.send_error || ''}>Not emailed</span>}</td>
                  <td className="r" onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn--sm btn--ghost" onClick={() => mark(m, !m.read_at)}>{m.read_at ? 'Mark unread' : 'Mark read'}</button>
                    <a className="btn btn--sm btn--ghost" href={`mailto:${m.email}?subject=${encodeURIComponent('Re: your message to CareVest')}`}>Reply</a>
                    <button className="btn btn--sm btn--ghost btn--danger" onClick={() => del(m)}>Delete</button>
                  </td>
                </tr>
                {open === m.id && m.message && <tr><td colSpan="6" style={{ background: 'var(--panel-2)', whiteSpace: 'pre-wrap' }}>{m.message}{m.send_error && <div className="small" style={{ color: 'var(--bad)', marginTop: 8 }}>Email problem: {m.send_error}</div>}</td></tr>}
              </React.Fragment>
            ))}
            {list && shown.length === 0 && <tr><td colSpan="6" className="empty">No messages{filter !== 'all' ? ' match this filter' : ' yet'}.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
