# CareVest CMS: shared specification

This file is the contract between the three parts of the system. All three must agree on it.

1. `site/`   the public website: Nunjucks templates + a build script that renders static HTML into `dist/`.
2. `admin/`  the editing dashboard (Vite + React) the CareVest team uses. Reads and writes the same content model.
3. `supabase/` the database schema, storage buckets, policies and publish trigger.

## Why this shape

- The CareVest team has no technical staff. They need to edit text, headlines, section content, statistics and
  documents without touching code. The dashboard therefore mirrors the website one to one: Pages > Sections > Fields.
- The site stays fully static (fast, cheap, no runtime to break). Publishing re-renders it on Vercel in about a minute.
- Supabase holds the content, the files and the user accounts (the team's own recommendation).
- Two colour themes (cream and blue) render from the SAME templates and content. Only `THEME` differs.

## Content model

Everything the team can edit is described in ONE JavaScript module, `shared/content-schema.js` (plain ESM, no deps,
importable from both `site/build.js` and `admin/`). The dashboard renders its forms from it, the templates read
content shaped by it, and the seed/verify scripts use it. Never hard-code a field in the admin or templates that
is not in the schema.

```js
export const fieldTypes = ['text','heading','richtext','number','stat','image','document','link','list','select','boolean','date','url'];

export const pages = [
  {
    slug: 'index',            // file name without .html; 'index' renders to /
    path: '/',
    title: 'Home',            // shown in the dashboard
    meta: { title: 'text', description: 'text' },   // every page has these two meta fields, stored under content.pages[slug]._meta
    sections: [
      {
        key: 'hero',           // unique within the page
        label: 'Hero',         // dashboard label (human, Title Case)
        hint: 'The large opening panel with the photo.',   // optional one-line explanation for editors
        fields: [
          { key: 'eyebrow', type: 'text', label: 'Small label above the headline' },
          { key: 'headline', type: 'heading', label: 'Headline', hint: 'Wrap one word in [[double brackets]] to highlight it.' },
          { key: 'sub', type: 'text', label: 'Supporting sentence' },
          { key: 'primary_cta', type: 'link', label: 'Main button' },
          { key: 'stats', type: 'list', label: 'Three key figures', of: [ { key: 'stat', type: 'stat' } ], max: 3 },
          ...
        ]
      }
    ]
  }
];

export const collections = {
  team:         { label: 'Team', singular: 'Team member', fields: [ { key:'name', type:'text' }, { key:'title', type:'text' }, { key:'group', type:'select', options:['Leadership','Team','Board'] }, { key:'photo', type:'image' }, { key:'bio', type:'richtext' } ] },
  transactions: { label: 'Representative transactions', singular: 'Transaction', fields: [ { key:'category', type:'text' }, { key:'title', type:'text' }, { key:'image', type:'image' } ] },
  faqs:         { label: 'Investor FAQ', singular: 'Question', fields: [ { key:'question', type:'text' }, { key:'answer', type:'richtext' }, { key:'group', type:'text' } ] },
  events:       { label: 'Events', singular: 'Event', fields: [ ... ] },
  // add others if a page needs a repeatable set that is also used elsewhere (e.g. industry_links, timeline)
};

export const figures = {
  // Key numbers that appear in several places. The dashboard has a dedicated "Key figures" screen for these.
  label: 'Key figures',
  items: [
    { key: 'yield',  label: 'Historical compound annual yield', fields: { value: 'number', prefix: 'text', suffix: 'text', decimals: 'number', as_of: 'text', note: 'richtext' } },
    { key: 'funded', label: 'Total loans funded' , ... },
    { key: 'aua', ... }, { key: 'ltv', ... }, { key: 'first_mortgages', ... }, { key: 'gross_weighted_average', ... }, ...
  ]
};

export const documents = {
  // Named document slots. The team uploads a new file into a slot; the site always links the current one.
  label: 'Documents',
  slots: [
    { key: 'offering_memorandum', label: 'Offering Memorandum' },
    { key: 'fact_sheet', label: 'Fund Fact Sheet' },
    { key: 'privacy_policy', label: 'Privacy Policy' },
    { key: 'relationship_disclosure', label: 'Relationship Disclosure Information' },
    ... (one per PDF the site links to, including shareholder administration forms)
  ]
};

export const globals = {
  label: 'Site-wide',
  fields: [
    { key: 'phone_investor_relations', type: 'text' }, { key: 'offices', type: 'list', of: [...] },
    { key: 'disclaimer', type: 'richtext' }, { key: 'footer_tagline', type: 'text' }, { key: 'nav', type:'list', ... }, ...
  ]
};
```

### Field value shapes (what is stored in JSON)

| type | value |
|---|---|
| text | string (plain, real Unicode characters, no HTML entities) |
| heading | string; `[[word]]` marks the accent word, rendered as `<span class="accent-word">word</span>` by the `accent` template filter |
| richtext | string of limited HTML: `<p> <b> <strong> <i> <em> <a href> <br> <ul> <ol> <li>` only |
| number | number |
| stat | `{ value:number, prefix:string, suffix:string, decimals:number, label:string, note:string, figure?:string }` (`figure` = key into figures; when set, the value/prefix/suffix/decimals come from that figure at render time) |
| image | `{ src:string, alt:string }`  (src is a `/assets/img/...` path or a full Supabase Storage URL) |
| document | string = a document slot key |
| link | `{ label:string, href:string }` |
| list | array of objects whose keys are the `of` field keys; each item also gets an `id` string |
| select | string |
| boolean | boolean |
| date | 'YYYY-MM-DD' string |
| url | string |

### Content JSON shape (one object, same in the local file and in the database)

```json
{
  "pages":       { "index": { "_meta": { "title": "...", "description": "..." }, "hero": { ...field values... }, "trustbar": {...} }, "core-mic": {...} },
  "collections": { "team": [ {...} ], "transactions": [ ... ], "faqs": [ ... ], "events": [ ... ] },
  "figures":     { "yield": { "value": 7.75, "prefix": "", "suffix": "%+", "decimals": 2, "as_of": "January 31, 2026", "note": "<p>...</p>" } },
  "documents":   { "fact_sheet": { "title": "...", "url": "...", "version_label": "June 2026", "uploaded_at": "2026-09-01T..." } },
  "globals":     { ... }
}
```

`site/content/content.json` is the complete seed: the current website, verbatim, in this shape. It is also the
offline fallback so the site always builds even if Supabase is unreachable.

## Database mapping (Supabase)

One row per top-level unit in table `public.content`:

| key | value |
|---|---|
| `page:index` | the whole `pages.index` object (all sections + `_meta`) |
| `collection:team` | the array |
| `figures` | the figures object |
| `globals` | the globals object |

Each row has `draft jsonb` and `published jsonb`. Saving in the dashboard writes `draft`. Publishing copies
`draft` into `published` for every row (RPC `publish_all()`), logs it, and a trigger calls the Vercel deploy hooks.
Documents live in table `public.documents` (one row per upload; `is_current` marks the live file per slot) and in
Storage bucket `documents`. Images uploaded from the dashboard go to bucket `media`.

The build script reads `published` (production) or `draft` (preview project) and assembles the Content JSON
above, falling back to `site/content/content.json` for anything missing.

## Rendering rules (templates)

- Nunjucks, autoescape ON. `richtext`, `note`, and `disclaimer` values render with `| safe`.
- Structure, classes, icons, arrows, asterisks that link to footnotes, `data-count` attributes, form markup and
  scripts stay in the templates. Only the words, numbers, images and links the team may change live in content.
- A `stat` with `figure` set pulls value/prefix/suffix/decimals from `figures[figure]` so one change updates every place.
- Lists render in stored order. Empty optional items are skipped.
- Theme: build copies `assets/themes/{cream|blue}.css` to `dist/assets/styles.css`.

## Environment variables

Site (Vercel projects `carevest-wireframe` = cream, `carevest-blue` = blue, `carevest-preview` = cream + drafts):
`THEME=cream|blue`, `CONTENT_STATE=published|draft`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` (published) or
`SUPABASE_SERVICE_ROLE_KEY` (draft, preview project only). With no Supabase vars the build uses the local JSON.

Admin (Vercel project `carevest-admin`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_PREVIEW_URL`,
`VITE_SITE_URL`. With no Supabase vars the admin runs in DEMO mode against the bundled `content.json` in memory.
