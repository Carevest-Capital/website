import React, { useEffect, useState } from 'react';
import { PREVIEW_URL, SITE_URL } from '../store/index.jsx';

/**
 * Opened in a new tab by "Preview". Waits until the preview site has been rebuilt with the editor's
 * drafts (the build writes /build.json with its timestamp), then moves on to the requested page and
 * section. Falls back gracefully if the build takes too long or the request failed.
 */
export default function PreviewWait() {
  const params = new URLSearchParams(window.location.search);
  const to = params.get('to') || '/';
  const section = params.get('section') || '';
  const since = Number(params.get('since') || Date.now());
  const base = (PREVIEW_URL || SITE_URL).replace(/\/$/, '');
  const target = `${base}${to}${section ? `#section=${encodeURIComponent(section)}` : ''}`;
  const [elapsed, setElapsed] = useState(0);
  const [state, setState] = useState(params.get('error') ? 'error' : 'waiting'); // waiting | ready | slow | error
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    let stopped = false;
    const started = Date.now();
    const tick = async () => {
      if (stopped) return;
      const secs = Math.round((Date.now() - started) / 1000);
      setElapsed(secs);
      try {
        const err = localStorage.getItem(`cv-preview-error-${since}`);
        if (err) { setErrorText(err); setState('error'); return; }
      } catch {}
      try {
        const r = await fetch(`${base}/build.json?t=${Date.now()}`, { cache: 'no-store' });
        if (r.ok) {
          const b = await r.json();
          if (b && b.built_at && new Date(b.built_at).getTime() >= since - 15000) {
            setState('ready');
            window.location.replace(target);
            return;
          }
        }
      } catch {}
      if (secs > 240) { setState('slow'); return; }
      setTimeout(tick, 4000);
    };
    if (state === 'waiting') tick();
    return () => { stopped = true; };
  }, []);

  const pct = Math.min(96, Math.round((elapsed / 75) * 100));

  return (
    <div className="wait">
      <div className="wait__box">
        <img src="/logo-white.png" alt="CareVest" />
        {state === 'waiting' && <>
          <div className="ring" />
          <h1>Building your preview</h1>
          <p>Your unpublished changes are being applied to a private copy of the website. This usually takes about a minute. The page opens here by itself{section ? ' and scrolls to the section you edited' : ''}.</p>
          <div className="bar"><i style={{ width: `${pct}%` }} /></div>
          <p className="small">{elapsed}s</p>
        </>}
        {state === 'ready' && <>
          <h1>Ready</h1>
          <p>Opening the preview.</p>
          <a className="btn btn--primary" href={target}>Open preview</a>
        </>}
        {state === 'slow' && <>
          <h1>This is taking longer than usual</h1>
          <p>The preview build has not finished yet. You can open the preview now (it may still show the previous version) or close this tab and try again in a minute.</p>
          <a className="btn btn--primary" href={target}>Open preview anyway</a>
        </>}
        {state === 'error' && <>
          <h1>The preview could not be started</h1>
          <p>{errorText || 'The preview request did not go through.'} Go back to the dashboard and try again. If it keeps happening, check that the Preview website is set up under Publishing setup.</p>
          <a className="btn btn--primary" href={target}>Open the current preview</a>
        </>}
      </div>
    </div>
  );
}
