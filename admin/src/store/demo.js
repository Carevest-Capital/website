// Demo store: runs the whole dashboard in memory against the bundled seed content.
// Used when no Supabase environment variables are set, so the team can try the
// dashboard before the real project is connected. Nothing here persists after reload.

import seed from '@seed/content.json';
import { contentToRows, clone, shortId } from './content.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function createDemoStore() {
  const rows = {};
  for (const [key, value] of Object.entries(contentToRows(seed))) {
    rows[key] = { key, draft: clone(value), published: clone(value), updated_at: new Date(Date.now() - 86400000 * 3).toISOString(), published_at: new Date(Date.now() - 86400000 * 3).toISOString() };
  }
  let documents = Object.entries(seed.documents || {}).filter(([, d]) => d && d.url).map(([slot, d]) => ({
    id: shortId(), slot, title: d.title || slot, url: d.url || '', version_label: d.version_label || '',
    is_current: true, uploaded_at: d.uploaded_at || new Date(Date.now() - 86400000 * 40).toISOString(), file_size: null,
  }));
  let log = [{ id: shortId(), kind: 'production', note: 'Initial import from the current website', created_at: new Date(Date.now() - 86400000 * 3).toISOString(), hooks_called: 2 }];
  let session = (() => { try { return sessionStorage.getItem('cv-demo-session') ? { user: { id: 'demo-admin', email: 'demo@carevest.com' } } : null; } catch { return null; } })();
  if (!session && typeof location !== 'undefined' && /autologin/.test(location.search)) session = { user: { id: 'demo-admin', email: 'demo@carevest.com' } };
  const listeners = new Set();
  const profiles = [
    { id: 'demo-admin', email: 'demo@carevest.com', full_name: 'Demo Admin', role: 'admin', created_at: new Date().toISOString() },
    { id: 'demo-editor', email: 'editor@carevest.com', full_name: 'Demo Editor', role: 'editor', created_at: new Date().toISOString() },
  ];
  let targets = [
    { id: shortId(), name: 'Website (cream)', kind: 'production', hook_url: 'https://api.vercel.com/v1/integrations/deploy/prj_demo/cream', site_url: 'https://carevest-wireframe.vercel.app', enabled: true },
    { id: shortId(), name: 'Website (blue)', kind: 'production', hook_url: 'https://api.vercel.com/v1/integrations/deploy/prj_demo/blue', site_url: 'https://carevest-blue.vercel.app', enabled: true },
    { id: shortId(), name: 'Preview', kind: 'preview', hook_url: 'https://api.vercel.com/v1/integrations/deploy/prj_demo/preview', site_url: 'https://carevest-preview.vercel.app', enabled: true },
  ];

  const emit = () => listeners.forEach((fn) => fn(session));

  return {
    mode: 'demo',
    async getSession() { return session; },
    onAuthChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async signIn(email) {
      await wait(400);
      session = { user: { id: 'demo-admin', email: email || 'demo@carevest.com' } };
      try { sessionStorage.setItem('cv-demo-session', '1'); } catch {}
      emit();
      return session;
    },
    async signOut() { session = null; try { sessionStorage.removeItem('cv-demo-session'); } catch {} emit(); },
    async currentProfile() { return profiles[0]; },

    async loadRows() { await wait(150); return Object.values(rows).map(clone); },
    async saveDraft(key, value) {
      await wait(250);
      rows[key] = { ...(rows[key] || { key, published: null }), draft: clone(value), updated_at: new Date().toISOString() };
      return clone(rows[key]);
    },
    async pendingChanges() {
      return Object.values(rows).filter((r) => JSON.stringify(r.draft) !== JSON.stringify(r.published)).map((r) => ({ key: r.key, updated_at: r.updated_at }));
    },
    async publishAll(note) {
      await wait(900);
      const now = new Date().toISOString();
      for (const r of Object.values(rows)) { if (JSON.stringify(r.draft) !== JSON.stringify(r.published)) { r.published = clone(r.draft); r.published_at = now; } }
      const entry = { id: shortId(), kind: 'production', note: note || null, created_at: now, hooks_called: targets.filter((t) => t.kind === 'production' && t.enabled).length };
      log = [entry, ...log];
      return entry;
    },
    async requestPreview() {
      await wait(500);
      const entry = { id: shortId(), kind: 'preview', created_at: new Date().toISOString(), hooks_called: targets.filter((t) => t.kind === 'preview' && t.enabled).length };
      log = [entry, ...log];
      return entry;
    },
    async publishLog() { return clone(log); },

    async listDocuments() { await wait(100); return clone(documents); },
    async uploadDocument({ slot, file, title, versionLabel }) {
      await wait(700);
      const url = URL.createObjectURL(file);
      documents = documents.map((d) => (d.slot === slot ? { ...d, is_current: false } : d));
      const doc = { id: shortId(), slot, title: title || file.name, url, version_label: versionLabel || '', is_current: true, uploaded_at: new Date().toISOString(), file_size: file.size };
      documents = [doc, ...documents];
      return doc;
    },
    async setCurrentDocument(id) {
      await wait(200);
      const target = documents.find((d) => d.id === id);
      documents = documents.map((d) => (d.slot === target.slot ? { ...d, is_current: d.id === id } : d));
    },
    async deleteDocument(id) { await wait(200); documents = documents.filter((d) => d.id !== id); },
    async uploadImage(file) { await wait(500); return URL.createObjectURL(file); },

    async listProfiles() { return clone(profiles); },
    async updateProfileRole(id, role) { const p = profiles.find((x) => x.id === id); if (p) p.role = role; },
    async listDeployTargets() { return clone(targets); },
    async saveDeployTarget(t) {
      if (t.id) targets = targets.map((x) => (x.id === t.id ? { ...x, ...t } : x));
      else targets = [...targets, { ...t, id: shortId() }];
      return clone(targets);
    },
    async deleteDeployTarget(id) { targets = targets.filter((x) => x.id !== id); },
  };
}
