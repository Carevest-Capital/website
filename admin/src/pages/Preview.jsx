import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useStore, PREVIEW_URL } from '../store/index.jsx';
import { schema, rowsToContent } from '../store/content.js';
import { renderPage } from '../preview/render.js';
import { useToast } from '../components/ui.jsx';

/**
 * Instant preview: the page is rendered right here in the browser from the current drafts, using the
 * website's own templates. Nothing has to be built or deployed. Opens in its own tab.
 */
export default function Preview() {
  const { slug: slugParam } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { rows, documents, pending, requestPreview, flushAll } = useStore();
  const toast = useToast();
  const frame = useRef();
  const [sharing, setSharing] = useState(false);
  const [missing, setMissing] = useState('');

  const slug = slugParam || 'index';
  const section = params.get('section') || '';
  const hash = params.get('hash') || '';
  const page = schema.pages.find((p) => p.slug === slug);
  const content = useMemo(() => (rows ? rowsToContent(rows, documents) : null), [rows, documents]);

  const { html, error } = useMemo(() => {
    if (!content || !page) return { html: '', error: page ? '' : 'Unknown page' };
    try { return { html: renderPage({ slug, content, section, hash }), error: '' }; }
    catch (e) { return { html: '', error: e.message }; }
  }, [content, slug, section, hash, page]);

  const pageHidden = content?.pages?.[slug]?._meta?.hidden === true;
  const sectionDef = page?.sections.find((s) => s.key === section);
  const sectionHidden = section && content?.pages?.[slug]?.[section]?._hidden === true;

  /* Messages from the rendered page: internal link clicks, form submits, missing section. */
  useEffect(() => {
    const onMsg = (e) => {
      const d = e.data || {};
      if (d.type === 'cv-preview-nav') {
        const target = schema.pages.find((p) => p.path === (d.path || '/'));
        if (!target) { window.open(d.path, '_blank'); return; }
        if (d.hiddenTarget) toast('That page is hidden, so on the live site this link would go to the home page.', 'info', 5000);
        setMissing('');
        navigate(`/preview/${target.slug}${d.hash ? `?hash=${encodeURIComponent(d.hash)}` : ''}`);
      } else if (d.type === 'cv-preview-form') {
        toast('Forms are switched off in the preview.', 'info', 3000);
      } else if (d.type === 'cv-preview-missing') {
        setMissing(d.section);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [navigate, toast]);

  useEffect(() => { setMissing(''); }, [slug, section]);
  useEffect(() => { document.title = `Preview: ${page?.title || slug} | CareVest Website Manager`; }, [page, slug]);

  const share = async () => {
    if (!PREVIEW_URL) { toast('No shareable preview site is set up.', 'bad'); return; }
    setSharing(true);
    try {
      const since = Date.now();
      const p = new URLSearchParams({ to: page.path, section, since: String(since) });
      const tab = window.open(`/preview-wait?${p.toString()}`, '_blank');
      await flushAll();
      await requestPreview();
      toast('A shareable copy is being built; the new tab opens it when ready (about a minute).', 'ok', 6000);
      if (!tab) toast('Your browser blocked the new tab. Allow pop-ups for this site.', 'bad', 6000);
    } catch (e) { toast(`Could not build the shareable preview: ${e.message}`, 'bad', 7000); }
    finally { setSharing(false); }
  };

  return (
    <div className="pv">
      <div className="pv__bar">
        <img src="/logo-white.png" alt="CareVest" className="pv__logo" />
        <span className="pv__title">Preview of your drafts{page ? `: ${page.title}` : ''}{sectionDef ? ` › ${sectionDef.label}` : ''}</span>
        <span className="pv__note">{pending.length ? `${pending.length} unpublished change${pending.length === 1 ? '' : 's'} included` : 'Same as the live website'}</span>
        <select className="pv__select" value={slug} onChange={(e) => navigate(`/preview/${e.target.value}`)}>
          {schema.pages.map((p) => <option key={p.slug} value={p.slug}>{p.title}{content?.pages?.[p.slug]?._meta?.hidden ? ' (hidden)' : ''}</option>)}
        </select>
        <span className="pv__spacer" />
        <button className="btn btn--sm" onClick={() => frame.current?.contentWindow?.location.reload()} title="Re-render with the latest drafts">Refresh</button>
        {PREVIEW_URL && <button className="btn btn--sm" onClick={share} disabled={sharing} title="Build a copy on the preview website that you can send to a colleague">{sharing && <span className="spin" />}Get a shareable link</button>}
        <Link className="btn btn--sm btn--primary" to={page ? `/pages/${page.slug}${section ? `#s-${section}` : ''}` : '/'}>Back to editing</Link>
      </div>
      {pageHidden && <div className="pv__banner">This page is hidden. Visitors would be sent to the home page; you are seeing it here so you can still edit it.</div>}
      {sectionHidden && <div className="pv__banner">The section you chose ("{sectionDef?.label}") is hidden, so it does not appear below. Switch it back on in the editor to see it.</div>}
      {missing && !sectionHidden && <div className="pv__banner">Could not find that section on the page.</div>}
      {error ? (
        <div className="pv__error"><b>The preview could not be rendered.</b> {error}</div>
      ) : html ? (
        <iframe ref={frame} className="pv__frame" title="Website preview" srcDoc={html} sandbox="allow-scripts allow-same-origin allow-popups" />
      ) : (
        <div className="pv__error muted">Loading your drafts</div>
      )}
    </div>
  );
}
