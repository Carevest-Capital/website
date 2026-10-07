# CareVest Website Manager

A content management system for carevest.com built for a team with no technical staff.
The team edits text, headlines, section content, key figures and documents in a dashboard that mirrors
the website page by page, then presses Publish. The website rebuilds itself in about a minute.

```
carevest-cms/
  SPEC.md            the contract between the three parts (content model, storage, rendering)
  shared/            content-schema.js: the single description of everything editable
  site/              the public website: templates + build script + assets (deployed to Vercel: production and preview)
  admin/             the dashboard the team uses (Vite + React, deployed to Vercel)
  supabase/          database schema, policies, publish trigger, one-time seed script
```

## How it fits together

```
 Team member                    Supabase                           Vercel
 ───────────                    ────────                           ──────
 Dashboard (admin/)  ── saves ─▶ content.draft                      
   "Publish"         ── RPC ───▶ publish_all(): draft → published ─▶ deploy hook ─▶ site/build.js renders
                                 documents + storage                 dist/ for carevest-blue (production)
                                 auth users + roles
   "Update preview"  ── RPC ───▶ request_preview() ─────────────────▶ carevest-preview builds from drafts
```

- The website stays fully static. No server, nothing to patch, nothing that can go down at 2 a.m.
- Supabase holds the content (JSON per page), uploaded files (two public buckets) and the accounts.
- The dashboard runs in **demo mode** (in-memory, nothing saved) until the two Supabase environment
  variables are set. That lets the team try it before anything is connected.

## One-time setup (about 30 minutes)

### 1. Supabase project
1. Create a project at supabase.com (Organization: CareVest; region: Canada Central). Note the Project URL,
   the `anon` key and the `service_role` key from Settings, API.
2. Database, SQL Editor, New query: paste the whole of `supabase/schema.sql` and run it. It creates the tables,
   the publish functions, the two storage buckets and all access rules. Safe to run again later.
3. Authentication, Providers: keep Email enabled, turn **off** "Allow new users to sign up" (users are invited).
   Authentication, URL configuration: set Site URL to the dashboard address and add
   `https://<dashboard>/set-password` to Redirect URLs.
4. Import the current website content (already done for the CareVest project; only needed for a fresh database):
   ```bash
   cd carevest-cms
   SUPABASE_URL=https://xxxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=eyJ... node supabase/seed.mjs
   ```
5. Authentication, Users, Invite user: invite the first person. The first account created becomes the
   Administrator automatically; everyone after is an Editor until an administrator changes it.

### 2. Website projects on Vercel
The GitHub repository `Carevest-Capital/website` holds this folder at its root. Two Vercel projects build
from it: `carevest-blue` (production) and `carevest-preview` (drafts). Both:
- Root Directory `site`; Build Command `npm run build`; Output Directory `dist`; "Include source files
  outside of the Root Directory" ON (the build imports `../shared`).
- Environment variables:

| Variable | production | preview |
|---|---|---|
| `THEME` | `blue` | `blue` |
| `CONTENT_STATE` | `published` | `draft` |
| `SUPABASE_URL` | yes | yes |
| `SUPABASE_ANON_KEY` | yes | yes |

The anon key is enough for both: the build reads the public `published_content` and `draft_content` views.

- Settings, Git, Deploy Hooks: create a hook named "CMS publish" per project and copy its address.

### 3. Dashboard on Vercel
Project `carevest-admin`: Root Directory `admin`, framework Vite, same "outside the Root Directory" switch ON.
Environment variables:
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL` (the live website), `VITE_PREVIEW_URL`.

### 4. Connect publishing
Already done for the CareVest project: the deploy hooks of `carevest-blue` (Production) and `carevest-preview`
(Preview) are registered. Administrators can see or change them under **Publishing setup** in the dashboard.

## Day to day (for the CareVest team)

- **Edit a page**: pick it in the left menu, change the text in its sections, it saves by itself.
- **Change a number** such as the yield or AUA: Key figures. One edit updates every place it appears.
  Update the "as of" date and the footnote with it.
- **Upload a newer document**: Documents, Upload newer version. Older versions stay in the history.
- **See before going live**: Update preview, then Open preview.
- **Go live**: Publish (top right). It lists what changed. About a minute later the website is updated.
- **Add a team member, transaction, FAQ or event**: the matching screen under Shared content.

Deleting is rare and deliberate: nothing in the dashboard deletes anything from the live website until Publish.

## Local development

```bash
cd carevest-cms/site  && npm install && npm run build        # renders dist/ from content.json (blue theme)
node scripts/verify.js                                         # proves templates reproduce the original pages
cd ../admin && npm install && npm run dev                      # dashboard in demo mode on http://localhost:5190
```

Create `admin/.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to run the dashboard against the real project.

## Changing what is editable
Add or move a field in `shared/content-schema.js`, give it a value in `site/content/content.json`, and render it
in the matching template under `site/templates/`. The dashboard picks it up with no further work.
