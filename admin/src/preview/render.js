// Instant preview: renders a page in the browser from the editor's drafts with the very same templates
// and rules the website build uses (shared/render-core.js). No server, no rebuild, no waiting.

import nunjucks from 'nunjucks';
import * as schema from '@shared/content-schema.js';
import { registerFilters, pageContext, hiddenPages } from '@shared/render-core.js';
import { SITE_URL } from '../store/index.jsx';

/* Every template source, bundled as text. */
const files = import.meta.glob('../../../site/templates/*.njk', { query: '?raw', import: 'default', eager: true });
const templates = Object.fromEntries(Object.entries(files).map(([p, src]) => [p.split('/').pop(), src]));

const StringLoader = nunjucks.Loader.extend({
  getSource(name) {
    const src = templates[name];
    if (src === undefined) throw new Error(`Template not found: ${name}`);
    return { src, path: name, noCache: true };
  },
});

export function renderPage({ slug, content, section = '', hash = '' }) {
  const page = schema.pages.find((p) => p.slug === slug);
  if (!page) throw new Error(`Unknown page: ${slug}`);
  const env = new nunjucks.Environment(new StringLoader(), { autoescape: true, throwOnUndefined: false });
  registerFilters(env, { content, schema, SafeString: nunjucks.runtime.SafeString });
  const html = env.render(`${slug}.njk`, pageContext({ page, content, schema, theme: 'blue' }));
  return decorate(html, { section, hash, hidden: hiddenPages(content, schema).map((p) => p.path) });
}

/* Make the rendered page work inside the dashboard: assets come from the live site, internal links stay
   inside the preview, and the chosen section is scrolled to and highlighted once the page is ready. */
function decorate(html, { section, hash, hidden }) {
  const base = `${SITE_URL.replace(/\/$/, '')}/`;
  const inject = `
<base href="${base}">
<style>html{scroll-behavior:auto}</style>
<script>
(function(){
  var SECTION=${JSON.stringify(section)}, HASH=${JSON.stringify(hash)}, HIDDEN=${JSON.stringify(hidden)};
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[href]'); if(!a) return;
    var href = a.getAttribute('href') || '';
    if (/^(https?:)?\\/\\//i.test(href) || /^(mailto:|tel:)/i.test(href)) { a.target = '_blank'; return; }
    if (href.charAt(0) === '#') return;
    e.preventDefault();
    var path = href.split('#')[0].split('?')[0] || '/';
    var hash = href.indexOf('#') >= 0 ? href.slice(href.indexOf('#') + 1) : '';
    parent.postMessage({ type: 'cv-preview-nav', path: path, hash: hash, hiddenTarget: HIDDEN.indexOf(path) >= 0 }, '*');
  }, true);
  document.addEventListener('submit', function(e){ e.preventDefault(); parent.postMessage({ type: 'cv-preview-form' }, '*'); }, true);
  function go(){
    if (HASH && !SECTION) { var t = document.getElementById(HASH); if (t) t.scrollIntoView(); return; }
    if (!SECTION) return;
    var el = document.querySelector('[data-section="' + SECTION + '"]');
    if (!el) { parent.postMessage({ type: 'cv-preview-missing', section: SECTION }, '*'); return; }
    if (location.hash !== '#section=' + SECTION) location.hash = '#section=' + SECTION; else window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
  if (document.readyState === 'complete') setTimeout(go, 60); else window.addEventListener('load', function(){ setTimeout(go, 60); });
})();
</script>`;
  return html.replace(/<head>/i, `<head>${inject}`);
}

export { schema };
