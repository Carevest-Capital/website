# CareVest website (site)

The public CareVest website, rendered from Nunjucks templates and the shared content model into plain
static HTML. The same templates and content produce both colour themes; only `THEME` differs.

```
site/
  build.js              renders every page into dist/
  content/content.json  the complete current website content (seed and offline fallback)
  templates/            layout.njk, _macros.njk and one template per page
  assets/               main.js, favicon, logos, img/ and themes/{cream,blue}.css
  static/               internal pages copied into dist as they are (welcome-series.html)
  scripts/verify.js     acceptance test against the original hand-written sites
  vercel.json           routing config (clean URLs, noindex header); also copied into dist/
../shared/content-schema.js   the content model shared with the admin dashboard
```

## Build locally

```sh
cd carevest-cms/site
npm install
npm run build            # blue theme, published content, into dist/
THEME=blue npm run build # blue theme
node build.js --theme=blue --state=draft --source=local --out=/tmp/preview
```

Serve `dist/` with any static server (for example `npx serve dist`). Pages are written as
`dist/<slug>.html`; `vercel.json` turns them into clean URLs such as `/core-mic`.

With no Supabase variables set, the build uses `content/content.json`. That file is also the fallback
for anything missing from the database, so the site always builds.

## Verify against the originals

```sh
npm run verify
```

Builds cream and blue into temporary folders from the local content and compares each of the nine
pages with `carevest-site` and `carevest-blue` (entities decoded, whitespace normalised). Prints
PASS or FAIL per page and exits non-zero on any difference. Run it after any template change.

## Environment variables

| Variable | Values | Purpose |
|---|---|---|
| `THEME` | `blue` (default) or `cream` | Which stylesheet is copied to `dist/assets/styles.css`. |
| `CONTENT_STATE` | `published` (default) or `draft` | Which column of the `content` table to render. |
| `SUPABASE_URL` | project URL | When set, content and current documents are fetched from Supabase. |
| `SUPABASE_ANON_KEY` | anon key | Used for `published` content. |
| `CONTENT_STATE` | `published` or `draft` | Reads the public `published_content` or `draft_content` view. No secret key is needed. |
| `OUT` | folder | Output folder, default `dist`. |

Flags `--theme`, `--state`, `--source=local|supabase` and `--out` override the environment.
`--source=local` ignores Supabase even when the variables are set.

Content is read from `${SUPABASE_URL}/rest/v1/content?select=key,draft,published` and
`${SUPABASE_URL}/rest/v1/documents?is_current=eq.true&select=slot,title,url,version_label,uploaded_at`.
Rows map onto the content object as `page:<slug>`, `collection:<name>`, `figures` and `globals`.
A missing or null row keeps the local value; a draft row that was never saved falls back to its
published value. Any network error logs a warning and the build continues with local content.

## Vercel projects

Two projects deploy from the same repository and the same folder:

| Project | THEME | CONTENT_STATE | Keys |
|---|---|---|---|
| `carevest-blue` | `blue` | `published` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |
| `carevest-preview` | `blue` | `draft` | `SUPABASE_URL`, `SUPABASE_ANON_KEY` |

Settings for each project:

- Framework Preset: Other
- Root Directory: `carevest-cms/site`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install` (default)
- Node.js version: 20 or newer
- Environment variables as in the table above

`site/vercel.json` is the project configuration (clean URLs, no trailing slash, `X-Robots-Tag:
noindex, nofollow` on every response). Every page also carries `<meta name="robots" content="noindex,
nofollow">`. Remove both when the site is ready to be indexed.

Publishing from the dashboard copies drafts to published and calls each project's Deploy Hook, which
re-runs this build. Create the hooks under Project Settings > Git > Deploy Hooks and store the URLs
where the Supabase publish trigger reads them.

## How the templates use the content

- Each page template receives `s` (that page's sections), `meta`, `g` (globals), `col` (collections),
  `fig` (figures), `doc` (documents) and `items('<section key>')`, which returns the collection a
  section renders, filtered by the section's `group` when it declares one.
- `heading` fields render through the `accent` filter: `[[word]]` becomes
  `<span class="accent-word">word</span>`.
- `stat` values that carry `figure` pull value, prefix, suffix and decimals from `figures` at render
  time (`resolve`, `fmt`). Animated numbers get the `data-count` attributes main.js expects; a stat with
  `count: false` renders as static text.
- `docurl('<slot>')` returns the current uploaded file for a document slot or the slot's fallback
  (the Offering Memorandum and Fact Sheet fall back to `/contact`).
- Richtext renders with `| safe` (or `| inlinep` inside an existing paragraph, `| accentlinks` where
  links take the accent colour). Everything else is autoescaped.

## Notes

- The income calculator reads its yield from the `yield` key figure at render time (a `data-yield`
  attribute on the slider that `assets/main.js` picks up), so one edit on the Key figures screen updates
  the displayed "Yield used", the initial amounts and the live slider maths together.
- `assets/img/` is copied into both themes; the original blue folder referenced the same images.
