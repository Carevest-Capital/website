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
   **Set up custom SMTP** (Authentication, Emails, SMTP settings) before inviting anyone outside the Supabase
   organisation. Supabase's built-in mailer is a shared test sender (noreply@mail.app.supabase.io) limited to a
   few emails per hour; corporate mail filters such as Microsoft 365 routinely quarantine it, so invitations
   and password resets to @carevest.com addresses never arrive. Resend (free tier) or Postmark with a sending
   subdomain such as mail.carevest.com takes about 15 minutes including the DNS records.
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
| `RESEND_API_KEY` | yes | optional | Sends contact-form emails (resend.com). Without it messages are only stored. |
| `CONTACT_FROM` | yes | optional | Sender on a verified Resend domain, e.g. `CareVest Website <website@mail.carevest.com>` |

The anon key is enough for the build: it reads the public `published_content` and `draft_content` views.

**Contact form.** `site/api/contact.js` is a Vercel serverless function behind `/api/contact`. It stores every
message in the `contact_messages` table (visible under Messages in the dashboard) and emails it to the address
set on the Contact page for that kind of message (New Investor, Borrower, General Inquiries). Editors change
those addresses in the dashboard; no redeploy needed.

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
- **See before going live**: press Preview (top right, or Preview page / Preview on any section card). A new
  tab opens instantly with the page rendered from your unpublished drafts, scrolled to the section you
  picked. It is rendered in your browser with the website's own templates, so nothing has to be built. Click
  around inside it like the real site. "Get a shareable link" builds a copy on the preview website (about a
  minute) that you can send to a colleague.
- **Review before going live**: click the "unpublished changes" badge at the top (or Unpublished changes in the
  menu). Every change is listed with what is live now and what it becomes. Discard any single change, a whole
  area, or everything; then Publish the rest from the same screen.
- **Go live**: Publish (top right). It lists what changed. About a minute later the website is updated.
- **Add a team member, transaction, FAQ or event**: the matching screen under Shared content.
- **Read contact-form messages**: Messages. Every submission is kept there even if the email could not be sent.
- **Change where contact-form messages are emailed**: Contact page, Contact Form section.
- **Hide a section**: every section card has a Shown / Hidden switch. A hidden section disappears from the
  website after Publish but keeps its content, so it can be switched back on later. The opening section of a
  page cannot be hidden (Events is the exception: hide the Featured Event and the page shows a plain title).
- **Hide a whole page**: the Page shown / Page hidden switch at the top of a page. After Publish the page leaves
  the menu and footer and its address sends visitors to the home page, so nothing can break. Home cannot be
  hidden. Sections on other pages that point to a hidden page (for example the events card on Home) stay
  until you hide them too.

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
