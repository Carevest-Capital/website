import React, { useEffect, useRef, useState } from 'react';
import { useStore, SITE_URL } from '../store/index.jsx';
import { schema, emptyValue, newListItem, itemTitle, itemSubtitle } from '../store/content.js';
import { sanitize } from './sanitize.js';

/* ------------------------------------------------------------------ */
/*  Field: renders the right editor for a schema field                 */
/* ------------------------------------------------------------------ */
export default function Field({ field, value, onChange, compact = false }) {
  const v = value === undefined || value === null ? emptyValue(field) : value;
  const common = { field, value: v, onChange };
  const body = (() => {
    switch (field.type) {
      case 'text': return <TextField {...common} />;
      case 'heading': return <HeadingField {...common} />;
      case 'richtext': return <RichTextField {...common} />;
      case 'number': return <NumberField {...common} />;
      case 'stat': return <StatField {...common} />;
      case 'image': return <ImageField {...common} />;
      case 'document': return <DocumentField {...common} />;
      case 'link': return <LinkField {...common} />;
      case 'list': return <ListField {...common} />;
      case 'select': return <SelectField {...common} />;
      case 'boolean': return <BooleanField {...common} />;
      case 'date': return <input className="input" type="date" value={v || ''} onChange={(e) => onChange(e.target.value)} />;
      case 'url': return <input className="input" type="url" value={v || ''} placeholder="https://" onChange={(e) => onChange(e.target.value)} />;
      default: return <TextField {...common} />;
    }
  })();
  if (field.type === 'boolean') return body;
  return (
    <div className="field" data-type={field.type}>
      <label>{field.label || humanize(field.key)}{field.required && <span className="faint">required</span>}</label>
      {body}
      {field.hint && field.type !== 'heading' && <div className="hint">{field.hint}</div>}
    </div>
  );
}

export function humanize(key = '') {
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------ */
function TextField({ field, value, onChange }) {
  const long = (field.multiline ?? (String(value || '').length > 110)) || field.key.match(/body|paragraph|description|text|sub|lede|intro|note|foot/);
  if (long) return <textarea className="textarea" value={value || ''} onChange={(e) => onChange(e.target.value)} rows={Math.min(8, Math.max(2, Math.ceil(String(value || '').length / 95)))} />;
  return <input className="input" type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} />;
}

function HeadingField({ field, value, onChange }) {
  const html = escapeHtml(value || '').replace(/\[\[(.+?)\]\]/g, '<span class="accent-word">$1</span>');
  return (
    <>
      <input className="input input--heading" type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} />
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="hint">{field.hint || 'Wrap one word in [[double brackets]] to highlight it in the accent colour.'}</div>
        {/\[\[/.test(value || '') && <div className="heading-preview" dangerouslySetInnerHTML={{ __html: html }} />}
      </div>
    </>
  );
}

function NumberField({ value, onChange }) {
  return <input className="input" type="number" step="any" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} style={{ maxWidth: 220 }} />;
}

function SelectField({ field, value, onChange }) {
  return (
    <select className="select" value={value || ''} onChange={(e) => onChange(e.target.value)} style={{ maxWidth: 320 }}>
      {!field.options?.includes(value) && <option value="">Choose</option>}
      {(field.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function BooleanField({ field, value, onChange }) {
  return (
    <label className="toggle-sw field">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
      <span className="lbl" style={{ fontWeight: 500 }}>{field.label || humanize(field.key)}</span>
      {field.hint && <span className="hint">{field.hint}</span>}
    </label>
  );
}

function LinkField({ value, onChange }) {
  const v = value || { label: '', href: '' };
  return (
    <div className="row--split">
      <div className="field"><span className="sub">Button text</span><input className="input" value={v.label || ''} onChange={(e) => onChange({ ...v, label: e.target.value })} /></div>
      <div className="field"><span className="sub">Goes to (page path or web address)</span><input className="input" value={v.href || ''} placeholder="/contact or https://" onChange={(e) => onChange({ ...v, href: e.target.value })} /></div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function StatField({ field, value, onChange }) {
  const { rows } = useStore();
  const figures = rows?.figures?.draft || {};
  const v = { value: 0, prefix: '', suffix: '', decimals: 0, label: '', note: '', ...(value || {}) };
  const linked = v.figure && figures[v.figure];
  const shown = linked ? figures[v.figure] : v;
  const num = Number(shown.value || 0).toLocaleString('en-CA', { minimumFractionDigits: shown.decimals || 0, maximumFractionDigits: shown.decimals || 0 });
  return (
    <div className="stat-field nested">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div className="big tnum">{shown.prefix}{num}{shown.suffix}</div>
        <div className="field" style={{ minWidth: 260 }}>
          <span className="sub">Number comes from</span>
          <select className="select input--sm" value={v.figure || ''} onChange={(e) => onChange({ ...v, figure: e.target.value || undefined })}>
            <option value="">Typed in here</option>
            {(schema.figures?.items || []).map((f) => <option key={f.key} value={f.key}>Key figure: {f.label}</option>)}
          </select>
        </div>
      </div>
      {linked ? (
        <div className="hint">Linked to the key figure <b>{schema.figures.items.find((f) => f.key === v.figure)?.label}</b>. Change the number on the Key figures screen and every place it appears updates together.</div>
      ) : (
        <div className="row--4">
          <div className="field"><span className="sub">Number</span><input className="input input--sm" type="number" step="any" value={v.value ?? ''} onChange={(e) => onChange({ ...v, value: Number(e.target.value) })} /></div>
          <div className="field"><span className="sub">Before (e.g. $)</span><input className="input input--sm" value={v.prefix || ''} onChange={(e) => onChange({ ...v, prefix: e.target.value })} /></div>
          <div className="field"><span className="sub">After (e.g. %+)</span><input className="input input--sm" value={v.suffix || ''} onChange={(e) => onChange({ ...v, suffix: e.target.value })} /></div>
          <div className="field"><span className="sub">Decimals</span><input className="input input--sm" type="number" min="0" max="3" value={v.decimals ?? 0} onChange={(e) => onChange({ ...v, decimals: Number(e.target.value) })} /></div>
        </div>
      )}
      <div className="row--split">
        <div className="field"><span className="sub">Caption under the number</span><input className="input input--sm" value={v.label || ''} onChange={(e) => onChange({ ...v, label: e.target.value })} /></div>
        {'note' in v && <div className="field"><span className="sub">Small note (optional)</span><input className="input input--sm" value={v.note || ''} onChange={(e) => onChange({ ...v, note: e.target.value })} /></div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function ImageField({ value, onChange }) {
  const { store } = useStore();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const inputRef = useRef();
  const v = value || { src: '', alt: '' };
  const pick = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('Please choose an image file (JPG, PNG or WebP).'); return; }
    if (file.size > 8 * 1024 * 1024) { setErr('That image is larger than 8 MB. Please resize it first.'); return; }
    setBusy(true); setErr(null);
    try { onChange({ ...v, src: await store.uploadImage(file) }); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div className="img-field">
      <div className="img-field__thumb">{v.src ? <img src={resolveSrc(v.src)} alt="" /> : 'No image'}</div>
      <div className="fields" style={{ gap: 10 }}>
        <div className="row">
          <button type="button" className="btn btn--sm" disabled={busy} onClick={() => inputRef.current.click()}>{busy ? <span className="spin" /> : null}{v.src ? 'Replace image' : 'Upload image'}</button>
          {v.src && <button type="button" className="btn btn--sm btn--ghost btn--danger" onClick={() => onChange({ ...v, src: '' })}>Remove</button>}
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files[0])} />
        </div>
        <div className="field"><span className="sub">Describe the image (read aloud by screen readers)</span><input className="input input--sm" value={v.alt || ''} onChange={(e) => onChange({ ...v, alt: e.target.value })} /></div>
        {v.src && <div className="mono faint" style={{ wordBreak: 'break-all' }}>{v.src}</div>}
        {err && <div className="banner banner--bad">{err}</div>}
      </div>
    </div>
  );
}

function DocumentField({ value, onChange }) {
  const { documents } = useStore();
  const slots = schema.documents?.slots || [];
  const cur = documents.find((d) => d.slot === value && d.is_current);
  return (
    <div className="fields" style={{ gap: 6 }}>
      <select className="select" value={value || ''} onChange={(e) => onChange(e.target.value)} style={{ maxWidth: 420 }}>
        <option value="">None</option>
        {slots.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
      {value && <div className="hint">{cur ? <>Currently links to <b>{cur.title}</b>{cur.version_label ? ` (${cur.version_label})` : ''}. Upload a newer file on the Documents screen.</> : 'No file uploaded for this document yet. Upload one on the Documents screen.'}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
export function ListField({ field, value, onChange }) {
  const items = Array.isArray(value) ? value : [];
  const [open, setOpen] = useState(null);
  const fields = field.of || [];
  const atMax = field.max && items.length >= field.max;
  const set = (i, item) => onChange(items.map((x, j) => (j === i ? item : x)));
  const move = (i, d) => { const n = [...items]; const [it] = n.splice(i, 1); n.splice(i + d, 0, it); onChange(n); setOpen(i + d); };
  const remove = (i) => { if (confirm('Remove this item?')) { onChange(items.filter((_, j) => j !== i)); setOpen(null); } };
  const add = () => { onChange([...items, newListItem(field)]); setOpen(items.length); };
  return (
    <div className="list">
      {items.map((item, i) => (
        <ListRow key={item.id || i} index={i} total={items.length} title={itemTitle(item, fields)} subtitle={itemSubtitle(item, fields)} isOpen={open === i}
          onToggle={() => setOpen(open === i ? null : i)} onUp={() => move(i, -1)} onDown={() => move(i, 1)} onRemove={field.min && items.length <= field.min ? null : () => remove(i)}>
          <div className="fields">
            {fields.map((f) => <Field key={f.key} field={f} value={item[f.key]} onChange={(nv) => set(i, { ...item, [f.key]: nv })} />)}
          </div>
        </ListRow>
      ))}
      {!atMax && <button type="button" className="list-add" onClick={add}>+ Add {field.singular || 'item'}</button>}
      {atMax && <div className="hint">This section holds a maximum of {field.max}.</div>}
    </div>
  );
}

export function ListRow({ index, total, title, subtitle, isOpen, onToggle, onUp, onDown, onRemove, children, badge }) {
  return (
    <div className={`list-item${isOpen ? ' is-open' : ''}`}>
      <div className="list-item__h" onClick={onToggle}>
        <span className="handle">⋮⋮</span>
        <span className="faint tnum small">{index + 1}</span>
        <span className="t">{title}{subtitle && <span className="p small">{subtitle}</span>}</span>
        {badge}
        <span className="ops" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn btn--icon btn--ghost" title="Move up" disabled={index === 0} onClick={onUp}>↑</button>
          <button type="button" className="btn btn--icon btn--ghost" title="Move down" disabled={index === total - 1} onClick={onDown}>↓</button>
          {onRemove && <button type="button" className="btn btn--icon btn--ghost btn--danger" title="Remove" onClick={onRemove}>×</button>}
        </span>
        <span className="faint">{isOpen ? '▴' : '▾'}</span>
      </div>
      {isOpen && <div className="list-item__b">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Rich text: a small contenteditable with bold / italic / link / list */
/* ------------------------------------------------------------------ */
function RichTextField({ value, onChange }) {
  const ref = useRef();
  const last = useRef(value);
  useEffect(() => {
    if (ref.current && value !== last.current && document.activeElement !== ref.current) {
      ref.current.innerHTML = value || '';
      last.current = value;
    }
  }, [value]);
  useEffect(() => { if (ref.current) ref.current.innerHTML = value || ''; last.current = value; }, []);
  const emit = () => { const html = sanitize(ref.current.innerHTML); last.current = html; onChange(html); };
  const cmd = (c, arg) => { ref.current.focus(); document.execCommand(c, false, arg); emit(); };
  const link = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { alert('Select the words you want to turn into a link first.'); return; }
    const existing = sel.anchorNode?.parentElement?.closest('a')?.getAttribute('href') || '';
    const url = prompt('Link address (a page like /contact or a full https:// address). Leave empty to remove the link.', existing);
    if (url === null) return;
    if (url === '') cmd('unlink'); else cmd('createLink', url);
  };
  const paste = (e) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertHTML', false, html ? sanitize(html) : escapeHtml(text).replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>'));
    emit();
  };
  return (
    <div className="rt">
      <div className="rt__bar">
        <button type="button" title="Bold" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('bold')}><b>B</b></button>
        <button type="button" title="Italic" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('italic')}><i>I</i></button>
        <button type="button" title="Link" onMouseDown={(e) => e.preventDefault()} onClick={link}>Link</button>
        <button type="button" title="Bulleted list" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('insertUnorderedList')}>• List</button>
        <button type="button" title="Numbered list" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('insertOrderedList')}>1. List</button>
        <button type="button" title="New paragraph" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('formatBlock', 'p')}>¶</button>
        <span style={{ flex: 1 }} />
        <button type="button" title="Remove formatting" onMouseDown={(e) => e.preventDefault()} onClick={() => cmd('removeFormat')}>Clear</button>
      </div>
      <div ref={ref} className="rt__area" contentEditable suppressContentEditableWarning data-placeholder="Type here" onInput={emit} onBlur={emit} onPaste={paste} />
    </div>
  );
}

export function resolveSrc(src = '') {
  return src.startsWith('/') ? `${SITE_URL.replace(/\/$/, '')}${src}` : src;
}

export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
