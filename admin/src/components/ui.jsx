import React, { createContext, useCallback, useContext, useState } from 'react';

/* ---------- Toasts ---------- */
const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, kind = 'info', ms = 3600) => {
    const id = Math.random();
    setItems((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), ms);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-wrap">{items.map((t) => <div key={t.id} className={`toast toast--${t.kind}`}>{t.msg}</div>)}</div>
    </ToastCtx.Provider>
  );
}

/* ---------- Modal ---------- */
export function Modal({ title, children, footer, onClose }) {
  return (
    <div className="modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="modal" role="dialog" aria-modal="true">
        {title && <div className="modal__h"><h2>{title}</h2></div>}
        <div className="modal__b">{children}</div>
        {footer && <div className="modal__f">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Save state ---------- */
export function SaveState({ state }) {
  if (!state) return null;
  const map = { pending: ['Unsaved edits', ''], saving: ['Saving', ''], saved: ['Saved', 'badge--ok'], error: ['Not saved', 'badge--bad'] };
  const [label, cls] = map[state] || [state, ''];
  return <span className={`badge ${cls}`}>{state === 'saving' && <span className="spin" style={{ width: 10, height: 10, border: '2px solid currentColor', borderRightColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />}{label}</span>;
}

/* ---------- Time ---------- */
export function timeAgo(iso) {
  if (!iso) return 'never';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function fmtBytes(n) {
  if (!n && n !== 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
