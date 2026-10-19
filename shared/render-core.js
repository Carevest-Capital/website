/*
  Rendering rules shared by the website build (site/build.js, Node) and the dashboard's instant
  preview (admin/, browser). Both create a Nunjucks environment, call registerFilters() on it and
  render each page with pageContext(). Keeping this in one place guarantees the preview shows exactly
  what the build will publish.

  Plain ESM, no imports: the caller passes in nunjucks' SafeString so this file works in both runtimes.
*/

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Add every filter the templates use to a Nunjucks environment. */
export function registerFilters(env, { content, schema, SafeString }) {
  const slotDefs = Object.fromEntries(schema.documents.slots.map((s) => [s.key, s]));

  /* [[word]] becomes the accent span; everything else is escaped. */
  env.addFilter('accent', (str) => {
    const escaped = escapeHtml(str ?? '');
    return new SafeString(escaped.replace(/\[\[(.+?)\]\]/g, '<span class="accent-word">$1</span>'));
  });

  /* A stat with `figure` takes value/prefix/suffix/decimals from that key figure. */
  const resolve = (stat) => {
    const st = stat || {};
    const fig = st.figure ? content.figures?.[st.figure] : null;
    const src = fig || st;
    return {
      value: Number(src.value ?? 0),
      prefix: src.prefix || '',
      suffix: src.suffix || '',
      decimals: Number(src.decimals || 0),
      label: st.label || '',
      note: st.note || '',
      figure: st.figure || '',
    };
  };
  env.addFilter('resolve', resolve);

  /* "7.75%+" style display string for a stat (prefix + fixed decimals + suffix). */
  env.addFilter('fmt', (stat) => {
    const r = resolve(stat);
    return `${r.prefix}${r.value.toFixed(r.decimals)}${r.suffix}`;
  });

  env.addFilter('fixed', (n, decimals) => Number(n ?? 0).toFixed(Number(decimals || 0)));
  env.addFilter('money', (n) => `$${Math.round(Number(n || 0)).toLocaleString('en-US')}`);
  env.addFilter('pad2', (n) => String(n).padStart(2, '0'));
  env.addFilter('numeric', (str) => /^\d+$/.test(String(str ?? '').trim()));
  env.addFilter('tel', (str) => String(str ?? '').replace(/\D/g, ''));
  env.addFilter('where', (arr, key, value) => (Array.isArray(arr) ? arr.filter((x) => x && x[key] === value) : []));

  /* The current file in a document slot, or the slot's fallback (contact page as a last resort). */
  env.addFilter('docurl', (slot) => {
    const doc = content.documents?.[slot];
    if (doc && doc.url) return doc.url;
    return slotDefs[slot]?.fallback || '/contact';
  });
  /* Only a real uploaded file, no fallback. Empty when the slot has no file. */
  env.addFilter('docfile', (slot) => content.documents?.[slot]?.url || '');

  /* Richtext rendered inside an element that is already a paragraph: drop the <p> wrappers. */
  env.addFilter('inlinep', (html) => {
    const s = String(html ?? '')
      .trim()
      .replace(/<\/p>\s*<p[^>]*>/gi, '<br /><br />')
      .replace(/^<p[^>]*>/i, '')
      .replace(/<\/p>$/i, '');
    return new SafeString(s);
  });

  /* Richtext whose links should take the accent colour (FAQ answers). */
  env.addFilter('accentlinks', (html) => {
    const s = String(html ?? '').replace(/<a\s+(?![^>]*\bstyle=)([^>]*)>/gi, '<a $1 style="color:var(--accent);">');
    return new SafeString(s);
  });

  return env;
}

/** Pages the team has hidden (pages[slug]._meta.hidden). Home can never be hidden. */
export function hiddenPages(content, schema) {
  return schema.pages.filter((p) => p.slug !== 'index' && content.pages?.[p.slug]?._meta?.hidden === true);
}

/** Globals with every menu and footer link to a hidden page removed. */
export function visibleGlobals(content, schema) {
  const hidden = new Set(hiddenPages(content, schema).map((p) => p.path));
  const linksTo = (href) => {
    const h = String(href || '').split(/[#?]/)[0].replace(/\/$/, '') || '/';
    return hidden.has(h);
  };
  const globals = JSON.parse(JSON.stringify(content.globals || {}));
  for (const key of ['nav', 'footer_invest_links', 'footer_company_links']) {
    if (Array.isArray(globals[key])) globals[key] = globals[key].filter((l) => !linksTo(l && l.href));
  }
  if (globals.header_cta && linksTo(globals.header_cta.href)) globals.header_cta = { ...globals.header_cta, href: '/contact' };
  return { globals, linksTo };
}

/** The template context for one page. */
export function pageContext({ page, content, schema, theme = 'blue' }) {
  const sections = content.pages?.[page.slug] || {};
  const { globals, linksTo } = visibleGlobals(content, schema);
  return {
    pg: page,
    meta: sections._meta || {},
    s: sections,
    g: globals,
    /* shown('sectionKey') is false when the team hid that section in the dashboard. */
    shown: (sectionKey) => !(sections[sectionKey] && sections[sectionKey]._hidden === true),
    /* Label used for a page when its own opening section is hidden: the menu label, else the page title. */
    pageLabel: (globals.nav || []).find((n) => n && n.href === page.path)?.label || page.title,
    hiddenPage: (href) => linksTo(href),
    col: content.collections || {},
    fig: content.figures || {},
    doc: content.documents || {},
    content,
    schema,
    theme,
    /* items('sectionKey') returns the collection a section renders, filtered by its group if any. */
    items: (sectionKey) => {
      const def = page.sections.find((sec) => sec.key === sectionKey);
      if (!def || !def.collection) return [];
      const arr = content.collections?.[def.collection] || [];
      return def.group ? arr.filter((x) => x && x.group === def.group) : arr;
    },
  };
}
