// Live store: talks to the CareVest Supabase project.
// Tables and functions are defined in ../../supabase/schema.sql.

import { createClient } from '@supabase/supabase-js';

export function createSupabaseStore(url, anonKey) {
  const sb = createClient(url, anonKey);

  const must = ({ data, error }) => {
    if (error) throw new Error(error.message || String(error));
    return data;
  };

  const safeName = (name) => name.normalize('NFKD').replace(/[^\w.\-]+/g, '-').replace(/-+/g, '-').toLowerCase();

  return {
    mode: 'live',
    client: sb,

    async getSession() { return (await sb.auth.getSession()).data.session; },
    onAuthChange(fn) {
      const { data } = sb.auth.onAuthStateChange((_event, session) => fn(session));
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
      return data.session;
    },
    async resetPassword(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/set-password` });
      if (error) throw new Error(error.message);
    },
    async updatePassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw new Error(error.message);
    },
    async signOut() { await sb.auth.signOut(); },
    async currentProfile() {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return null;
      const { data } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
      return data || { id: user.id, email: user.email, role: 'editor' };
    },

    async loadRows() { return must(await sb.from('content').select('key,draft,published,updated_at,published_at')); },
    async saveDraft(key, value) {
      return must(await sb.from('content').upsert({ key, draft: value }, { onConflict: 'key' }).select().single());
    },
    async pendingChanges() { return must(await sb.rpc('pending_changes')); },
    async publishAll(note) { return must(await sb.rpc('publish_all', { p_note: note || null })); },
    async requestPreview() { return must(await sb.rpc('request_preview')); },
    async publishLog() { return must(await sb.from('publish_log').select('*').order('created_at', { ascending: false }).limit(30)); },

    async listDocuments() { return must(await sb.from('documents').select('*').order('uploaded_at', { ascending: false })); },
    async uploadDocument({ slot, file, title, versionLabel }) {
      const path = `${slot}/${Date.now()}-${safeName(file.name)}`;
      must(await sb.storage.from('documents').upload(path, file, { upsert: false, contentType: file.type || 'application/octet-stream' }));
      const { data: { publicUrl } } = sb.storage.from('documents').getPublicUrl(path);
      const { data: { user } } = await sb.auth.getUser();
      return must(await sb.from('documents').insert({
        slot, title: title || file.name, url: publicUrl, storage_path: path, version_label: versionLabel || null,
        file_size: file.size, is_current: true, uploaded_by: user?.id,
      }).select().single());
    },
    async setCurrentDocument(id) { must(await sb.from('documents').update({ is_current: true }).eq('id', id)); },
    async deleteDocument(id) {
      const doc = must(await sb.from('documents').select('storage_path,is_current').eq('id', id).single());
      if (doc.is_current) throw new Error('Choose another current file for this slot before deleting this one.');
      if (doc.storage_path) await sb.storage.from('documents').remove([doc.storage_path]);
      must(await sb.from('documents').delete().eq('id', id));
    },
    async uploadImage(file) {
      const path = `${new Date().getFullYear()}/${Date.now()}-${safeName(file.name)}`;
      must(await sb.storage.from('media').upload(path, file, { upsert: false, contentType: file.type }));
      return sb.storage.from('media').getPublicUrl(path).data.publicUrl;
    },

    async listProfiles() { return must(await sb.from('profiles').select('*').order('created_at')); },
    async updateProfileRole(id, role) { must(await sb.from('profiles').update({ role }).eq('id', id)); },
    async listDeployTargets() { return must(await sb.from('deploy_targets').select('*').order('kind').order('name')); },
    async saveDeployTarget(t) {
      const row = { name: t.name, kind: t.kind, hook_url: t.hook_url, site_url: t.site_url || null, enabled: t.enabled ?? true };
      if (t.id) must(await sb.from('deploy_targets').update(row).eq('id', t.id));
      else must(await sb.from('deploy_targets').insert(row));
      return this.listDeployTargets();
    },
    async deleteDeployTarget(id) { must(await sb.from('deploy_targets').delete().eq('id', id)); },
  };
}
