// Reduce arbitrary HTML (pasted from Word, email, the web) to the small subset the site templates accept:
// p, b, strong, i, em, a[href], br, ul, ol, li. Everything else is unwrapped; styles and scripts are dropped.

const ALLOWED = new Set(['P', 'B', 'STRONG', 'I', 'EM', 'A', 'BR', 'UL', 'OL', 'LI']);
const DROP = new Set(['SCRIPT', 'STYLE', 'META', 'LINK', 'HEAD', 'TITLE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'IMG', 'VIDEO']);

export function sanitize(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<div id="r">${html}</div>`, 'text/html');
  const root = doc.getElementById('r');
  walk(root);
  // Block-level wrappers: turn stray text / inline runs directly under root into paragraphs when any <p> exists.
  let out = root.innerHTML;
  out = out.replace(/<p>(\s|&nbsp;|<br>)*<\/p>/g, '').replace(/\s*<br>\s*<\/p>/g, '</p>').trim();
  return out;
}

function walk(node) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.COMMENT_NODE) { child.remove(); continue; }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    if (DROP.has(child.tagName)) { child.remove(); continue; }
    walk(child);
    if (child.tagName === 'DIV' || child.tagName === 'H1' || child.tagName === 'H2' || child.tagName === 'H3' || child.tagName === 'H4') {
      const p = document.createElement('p');
      while (child.firstChild) p.appendChild(child.firstChild);
      child.replaceWith(p);
      continue;
    }
    if (child.tagName === 'SPAN' && child.style && (child.style.fontWeight === 'bold' || Number(child.style.fontWeight) >= 600)) {
      const b = document.createElement('b'); while (child.firstChild) b.appendChild(child.firstChild); child.replaceWith(b); continue;
    }
    if (!ALLOWED.has(child.tagName)) { unwrap(child); continue; }
    for (const attr of Array.from(child.attributes)) {
      if (child.tagName === 'A' && attr.name === 'href') {
        const href = attr.value.trim();
        if (!/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(href)) child.removeAttribute('href');
        continue;
      }
      child.removeAttribute(attr.name);
    }
    if (child.tagName === 'A' && /^https?:\/\//i.test(child.getAttribute('href') || '')) {
      child.setAttribute('target', '_blank'); child.setAttribute('rel', 'noopener');
    }
  }
}

function unwrap(el) {
  const parent = el.parentNode;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}
