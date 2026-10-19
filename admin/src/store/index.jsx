import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createDemoStore } from './demo.js';
import { createSupabaseStore } from './supabase.js';
import { allRowKeys, contentToRows, clone, deepEqual } from './content.js';
import seed from '@seed/content.json';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const store = SUPABASE_URL && SUPABASE_ANON_KEY ? createSupabaseStore(SUPABASE_URL, SUPABASE_ANON_KEY) : createDemoStore();
export const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://carevest-blue.vercel.app';
export const PREVIEW_URL = import.meta.env.VITE_PREVIEW_URL || '';

const Ctx = createContext(null);
export const useStore = () => useContext(Ctx);

const SAVE_DELAY = 900;

export function StoreProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = unknown yet
  const [profile, setProfile] = useState(null);
  const [rows, setRows] = useState(null);             // { key: { draft, published, updated_at, published_at } }
  const [documents, setDocuments] = useState([]);
  const [saving, setSaving] = useState({});           // { key: 'saving' | 'saved' | 'error' }
  const [error, setError] = useState(null);
  const timers = useRef({});
  const latest = useRef({});

  // Auth
  useEffect(() => {
    let off = () => {};
    store.getSession().then((s) => setSession(s || null));
    off = store.onAuthChange((s) => setSession(s || null));
    return off;
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); setRows(null); return; }
    store.currentProfile().then(setProfile).catch(() => setProfile(null));
    reload();
  }, [session]);

  const reload = useCallback(async () => {
    try {
      const [list, docs] = await Promise.all([store.loadRows(), store.listDocuments()]);
      const map = {};
      const seedRows = contentToRows(seed);
      for (const key of allRowKeys()) {
        const r = list.find((x) => x.key === key);
        map[key] = r
          ? { ...r, draft: r.draft ?? r.published ?? clone(seedRows[key]) }
          : { key, draft: clone(seedRows[key]), published: null, updated_at: null, published_at: null, _unseeded: true };
      }
      setRows(map);
      setDocuments(docs);
      setError(null);
    } catch (e) {
      setError(e.message || String(e));
    }
  }, []);

  const flush = useCallback(async (key) => {
    clearTimeout(timers.current[key]);
    const value = latest.current[key];
    if (value === undefined) return;
    setSaving((s) => ({ ...s, [key]: 'saving' }));
    try {
      const saved = await store.saveDraft(key, value);
      latest.current[key] = undefined;
      setRows((r) => ({ ...r, [key]: { ...r[key], ...saved, draft: value, _unseeded: false } }));
      setSaving((s) => ({ ...s, [key]: 'saved' }));
      setTimeout(() => setSaving((s) => (s[key] === 'saved' ? { ...s, [key]: undefined } : s)), 2000);
    } catch (e) {
      setSaving((s) => ({ ...s, [key]: 'error' }));
      setError(`Could not save: ${e.message}`);
    }
  }, []);

  /** Update a draft row with an updater fn (prev => next). Saves automatically after a short pause. */
  const updateDraft = useCallback((key, updater) => {
    setRows((r) => {
      const next = typeof updater === 'function' ? updater(clone(r[key]?.draft)) : updater;
      latest.current[key] = next;
      clearTimeout(timers.current[key]);
      timers.current[key] = setTimeout(() => flush(key), SAVE_DELAY);
      setSaving((s) => ({ ...s, [key]: 'pending' }));
      return { ...r, [key]: { ...r[key], draft: next } };
    });
  }, [flush]);

  const flushAll = useCallback(async () => {
    const keys = Object.keys(latest.current).filter((k) => latest.current[k] !== undefined);
    await Promise.all(keys.map(flush));
  }, [flush]);

  const pending = useMemo(() => {
    if (!rows) return [];
    return Object.values(rows).filter((r) => !deepEqual(r.draft, r.published)).map((r) => ({ key: r.key, updated_at: r.updated_at }));
  }, [rows]);

  const publish = useCallback(async (note) => {
    await flushAll();
    const entry = await store.publishAll(note);
    await reload();
    return entry;
  }, [flushAll, reload]);

  const requestPreview = useCallback(async () => {
    await flushAll();
    return store.requestPreview();
  }, [flushAll]);

  /**
   * Open a preview of one page (and optionally jump to one section) in a new tab.
   * The tab opens immediately (browsers only allow that inside the click), shows a waiting screen,
   * and moves on to the preview site as soon as the preview build with these drafts has landed.
   * When nothing is unpublished the preview equals the live site, so it opens straight away.
   */
  const openPreview = useCallback(async ({ path = '/', section = '' } = {}) => {
    const hash = section ? `#section=${encodeURIComponent(section)}` : '';
    const unsaved = Object.values(saving).some((st) => st === 'pending' || st === 'saving');
    const base = PREVIEW_URL || SITE_URL;
    if (!PREVIEW_URL || (pending.length === 0 && !unsaved)) {
      window.open(`${base.replace(/\/$/, '')}${path}${hash}`, '_blank', 'noopener');
      return { rebuilt: false };
    }
    const since = Date.now();
    const params = new URLSearchParams({ to: path, section, since: String(since) });
    const tab = window.open(`/preview-wait?${params.toString()}`, '_blank');
    try {
      await flushAll();
      await store.requestPreview();
      return { rebuilt: true };
    } catch (e) {
      try { localStorage.setItem(`cv-preview-error-${since}`, e.message || 'Preview request failed'); } catch {}
      if (tab && !tab.closed) tab.location.replace(`/preview-wait?${params.toString()}&error=1`);
      throw e;
    }
  }, [flushAll, pending, saving]);

  const refreshDocuments = useCallback(async () => setDocuments(await store.listDocuments()), []);

  const value = {
    store, session, profile, rows, documents, saving, error, pending,
    isAdmin: profile?.role === 'admin' || store.mode === 'demo',
    reload, updateDraft, flushAll, publish, requestPreview, openPreview, refreshDocuments,
    clearError: () => setError(null),
    signOut: () => store.signOut(),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
