# Route Report

Your bike infrastructure tracker for SF. People flag bike lanes, crossings,
racks, and signage that need attention; you and your moderators review and
track them through to resolution. Backed by Supabase for the database,
image storage, and user accounts, and deployed on Vercel.

## Tech stack

- **Next.js 14** (App Router) with React 18, all client components (`'use client'`)
- **Supabase** for Postgres, Auth, and Storage -- no separate backend server
- **Leaflet** (loaded via CDN stylesheet + npm package) for every map: Browse,
  Submit, and the location editor in Moderate
- Plain CSS in `app/globals.css` (no CSS framework), dark theme, custom
  properties for color/radius/shadow tokens
- No environment variables for Supabase: the project URL and anon key are
  hardcoded in `lib/supabaseClient.js` (see "Security model" below for why
  that's fine)

## Project structure

```
app/                  Next.js App Router pages (one folder per route)
  page.js               Browse ("/")
  submit/               Submit a report
  report/[id]/           Report detail + suggest-a-change
  moderate/              Reports / Suggested changes / User accounts tabs
  account/               Your own account settings
  my-reports/            Everything you've submitted
  my-interests/           Everything you're following
  profile/[id]/           Anyone's public reporting history
  login/, signup/         Auth forms
  kitten/                 The easter egg (see below)
components/            Shared UI: Header, Nav, ReportCard, ImageGallery,
                        InterestButton
lib/                   supabaseClient, useUser/useProfile hooks, small
                        helpers (search matching, image upload, role
                        levels, SF map center)
supabase/migrations/   Full schema history, see "Database schema" below
```

## How access works

Accounts have a role, ranked low to high: **user → moderator → admin →
owner**. Each level can manage accounts strictly below it (edit their
display name, ban them) -- nobody can touch an account at or above their
own level, including their own.

- **Anyone**, signed in or not, can browse approved and resolved reports,
  search them, and view a report's photo gallery, location, and progress
  timeline.
- **Signed-in users** can submit a report (title, category, location pin,
  optional photo), suggest changes to any active report (a note, plus
  optional photos) for a moderator to review, and follow reports by
  tapping "I'm interested" to track them on their own `/my-interests`
  page. They can also withdraw their own submission at any time from
  `/my-reports` -- this doesn't delete it, it just moves it to a
  `withdrawn` status moderators can still see. Each account also gets a
  public profile page (`/profile/[id]`) listing their approved/resolved
  reports and an optional display name -- their email is never shown
  publicly.
- **Moderators** review pending submissions from the Moderate page: edit
  any field (including dragging the location pin on a map), add or remove
  photos, approve/reject/resolve/reopen, delete reports outright, and post
  or edit the progress-timeline entries visitors see on a report. They can
  also see who's interested in a report (email list, resolved from either
  an account or a legacy anonymous signup). They review suggested changes
  (including pulling a suggested photo onto the report with one click)
  and can edit/ban accounts below their level.
- **Admins** additionally approve moderator requests and can promote or
  demote anyone below admin level.
- **Owner** (that's you) sits above admin -- it can manage admin accounts
  too, which regular admins can't do to each other. It's not a role
  anyone can grant through the UI; see "Making yourself the owner" below.

Permissions are enforced by Supabase Row Level Security directly on the
database, based on who's signed in and their role -- there's no shared
passcode and nothing secret sitting in the code.

A banned account can still sign in and browse, but can't submit new
reports, suggest changes, or register interest.

## What's on each page

- **Browse** (`/`) -- map centered on SF with a colored dot per report
  (teal for active, yellow for resolved -- matching those status
  badges' colors elsewhere), a search box, and Active / Resolved pill
  tabs. Each report card shows its photo, category, interest count,
  and an "I'm interested" toggle.
- **Submit** (`/submit`) -- title, category, photo, and a click-to-pin
  map. The map also shows every existing approved report as a teal dot
  for context, alongside your own pin in yellow once you place one.
  Warns you before submitting if there's already an approved report
  within ~125m, in case it's a duplicate; you can still submit anyway.
  A synchronous lock stops a double-click or slow tap from creating
  two rows. Submitting a report titled exactly "kitten" is a hidden
  shortcut -- see the easter egg section.
- **Report detail** (`/report/[id]`) -- full photo gallery (horizontal
  scroll for multiple photos, tap any photo for a fullscreen lightbox
  with next/prev), location, progress timeline, who reported it (links
  to their profile), an interest-follow toggle, and a "suggest a change"
  box for signed-in users on active reports.
- **Moderate** (`/moderate`) -- gated to moderator role and above, three
  tabs:
  - *Reports* -- filter by status (pending/approved/rejected/resolved/
    withdrawn) or search by title/description/category; edit any field
    including the location map and photos; approve/reject/resolve/
    reopen/delete; manage the progress timeline; view the interested-email
    list for a report. Flags a pending report with a warning when
    another pending or approved report is within ~125m, so likely
    duplicates are easy to spot and consolidate.
  - *Suggested changes* -- review user-submitted change notes and photos
    alongside the original report, pull a suggested photo onto the
    report with one click.
  - *User accounts* -- pending moderator-access requests (admin+ only),
    and every account you're allowed to manage: edit display name, ban/
    unban, and (admin+ only) change role via a dropdown.
- **Account** (`/account`) -- set your display name, request moderator
  access, links to your public profile / submissions / follows, sign out,
  and turn two-factor authentication on or off.
- **My submissions** (`/my-reports`) -- everything you've submitted, any
  status, with a Withdraw button on each.
- **My interests** (`/my-interests`) -- every report you're following,
  with the same toggle to unfollow.
- **Profile** (`/profile/[id]`) -- anyone's public reporting history
  (approved/resolved reports only, plus an optional display name).
- **Sign in / Create account** (`/login`, `/signup`) -- standard Supabase
  Auth email/password forms.

## Data model

Seven tables in the `public` schema, all with Row Level Security enabled:

| Table | Purpose |
|---|---|
| `suggestions` | The reports themselves -- title, description, category, location, status, who submitted it |
| `report_images` | One or more photos per report |
| `updates` | Moderator-posted progress-timeline entries per report |
| `change_suggestions` | User-submitted change proposals awaiting moderator review |
| `profiles` | One row per account -- role, ban status, display name |
| `subscribers` | Public-safe "who's interested" rows -- just an id, which report, and when (see "Security model") |
| `subscriber_identities` | The actual email/account behind each `subscribers` row -- fully locked down, moderator-only access via a function |

Most reads and writes go through direct table queries governed by RLS.
A handful of operations that need to check something beyond simple
row ownership (role hierarchy, masking a column for some viewers,
looking up another user by id) go through `SECURITY DEFINER` Postgres
functions instead, each doing its own authorization check internally:

`is_admin`, `is_moderator_or_admin`, `is_banned`, `role_level` (internal
helpers) · `admin_set_user_role`, `admin_review_moderator_request`,
`request_moderator_access`, `moderator_set_display_name`,
`moderator_set_banned` (account management)
· `set_display_name`, `get_public_profile` (your own profile / anyone's
public profile) · `get_timeline_updates`, `get_all_timeline_updates_for_moderation`
(progress timeline, with author email masked for non-moderators) ·
`withdraw_own_report` (self-service withdraw) · `register_interest`,
`unregister_interest`, `get_my_subscriptions`, `get_report_subscribers`
(the interest-follow feature) · `handle_new_user` (creates a profile row
on signup).

## Database schema

`supabase/migrations/` holds every schema change (tables, RLS policies,
functions) applied to the live database, in order, each as a plain SQL
file named `<timestamp>_<name>.sql`. It's kept in sync with Supabase's
own migration history rather than being the source of truth Supabase
reads from -- when a new database change is made, the SQL gets applied
directly to the live project and the matching file gets added here
afterward, so the repo always shows what's actually running.

## Security model

- **RLS is the real security boundary**, not the API key. `lib/supabaseClient.js`
  hardcodes the project URL and anon key client-side on purpose -- Supabase's
  anon key is meant to be public; what it's allowed to do is entirely
  controlled by RLS policies and table grants on the database side.
- **Column-level grants** hide specific sensitive columns from otherwise-public
  tables where a plain row policy can't (Postgres RLS filters rows, not
  columns). `subscribers` is deliberately split from `subscriber_identities`
  for this reason: PostgREST's embedded `count()` aggregate needs full-row
  access to the table it's counting, so the table it counts (`subscribers`)
  only ever holds non-identifying columns, and the actual email/account
  link lives in a second table with zero direct grants at all.
- **Narrow `SECURITY DEFINER` functions**, not broad self-service UPDATE
  policies, for anything privileged. A generic "users can update their own
  profile" policy would (thanks to legacy broad table grants) let a user
  rewrite their own `role` column, not just their display name -- so
  display name, ban status, and role changes each go through a function
  that touches only that one column and checks the caller's authorization
  itself.
- **Role hierarchy checks are relative, not hardcoded.** Authorization
  checks compare `role_level(caller) vs role_level(target)` rather than
  matching literal role strings, so adding the `owner` role above `admin`
  didn't require touching most of the authorization logic.
- **Optional TOTP two-factor authentication**, enforced at the database,
  not just the login screen. Any account can turn on 2FA from `/account`
  (Supabase's built-in TOTP MFA -- scan a QR code with an authenticator
  app or Apple Passwords). A restrictive RLS policy on every table
  requires an `aal2` session (i.e. the login's second factor was actually
  verified) for any account that has a verified factor enrolled, via a
  `SECURITY DEFINER` helper (`user_has_verified_mfa`) rather than
  granting the `authenticated` role direct access to `auth.mfa_factors`,
  which holds the actual TOTP secrets. Accounts that haven't enrolled are
  completely unaffected. This only covers RLS-governed direct table
  access -- the privileged `SECURITY DEFINER` RPCs listed above bypass
  RLS by design (same as everywhere else in this app) and don't
  currently re-check `aal` themselves.

## Running it locally

```
npm install
npm run dev
```

Opens on `http://localhost:3000`. Since the Supabase URL and anon key are
hardcoded in `lib/supabaseClient.js`, a local dev server talks to the
same live database as production -- there's no separate local/staging
Supabase project. `npm run build && npm run start` runs a production
build locally the same way.

## Deploying an update

Since this is already on GitHub and connected to Vercel: update the file(s)
on GitHub (via the pencil-edit icon, or by uploading a replacement file)
and commit. Vercel redeploys automatically within a minute or two.

## Two one-time setup steps

### 1. Point Supabase at your live URL

Auth emails (like signup confirmations) need to know where your site
actually lives:

- Supabase dashboard -> Authentication -> URL Configuration
- Set Site URL to your Vercel URL (e.g. https://bike-report-ten.vercel.app)

### 2. Make yourself the owner

There's intentionally no self-serve way to become a moderator, admin, or
owner -- someone has to be the first one, manually:

1. Go to your live site and create an account (Sign in -> Create account)
   using the email you want to administer with
2. Tell Claude that email address, and it'll grant that account the
   `owner` role directly in the database

After that, your Moderate tab's User accounts section will show a queue
of anyone who requests moderator access, with Approve/Deny buttons, and
you'll be able to promote/demote/ban anyone below owner level, including
other admins.

## A small easter egg

Submitting a report titled exactly "kitten" doesn't create a report at
all -- it redirects to a blank page (`/kitten`) with a photo on it.
Harmless, just there.

## Cleaning up (optional)

The `/api/moderate/list` and `/api/moderate/update` routes from an
earlier passcode-based version have been removed -- moderation goes
through Supabase Auth and RLS now. If you still have
SUPABASE_SERVICE_ROLE_KEY or MODERATOR_PASSCODE set in Vercel from
that version, they're no longer read by any code path; you can remove
them from Project Settings -> Environment Variables.

## License

MIT -- see [LICENSE](./LICENSE).
