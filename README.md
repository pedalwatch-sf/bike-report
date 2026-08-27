# Project PedalWatch

A bike infrastructure tracker for San Francisco. People flag bike lanes, crossings,
racks, and signage that need attention; moderators review and track reports through
to resolution. Backed by Supabase for the database, image storage, and user accounts,
and deployed on Vercel.

## Tech stack

- **Next.js 16.3.3** (App Router) with **React 19.2.8**, with the app UI implemented as client components (`'use client'`)
- **Supabase** for Postgres, Auth, and Storage -- no separate backend server
- **Leaflet** (loaded via CDN stylesheet + npm package) for every map: Browse,
  Submit, report detail, and the location editor in Moderate
- **Vitest** plus **Testing Library** for helper/component regression tests (`npm test`), run
  automatically on every push/PR via GitHub Actions (`.github/workflows/ci.yml`),
  alongside `npm run lint`, `npm run build`, and `npm audit --audit-level=high`
  on Node 22
- Plain CSS in `app/globals.css` (no CSS framework), dark theme, custom
  properties for color/radius/shadow tokens. The two accent colors are
  `--yellow` (`#f3af49`) and `--teal` (`#5982c0`, a complementary blue
  despite the variable name), used for status/selection highlights
  throughout the UI.
- No environment variables for Supabase: the project URL and anon key are
  hardcoded in `lib/supabaseClient.js` (see "Security model" below for why
  that's fine)

## Project structure

```
app/                  Next.js App Router pages (one folder per route)
  page.js               Browse ("/")
  submit/               Submit a report
  report/[id]/           Report detail + suggest-a-change
  moderate/              Reports / Suggested changes / User accounts / Activity
  account/               Your own account settings
  my-reports/            Everything you've submitted
  profile/[id]/           Anyone's public reporting history
  login/, signup/         Auth forms
  reset-password/         Set a new password from an emailed reset link
  kitten/                 The easter egg (see below)
components/            Shared UI: Header, Nav (shows a red dot on the
                        Moderate tab when something needs attention --
                        see "How access works"), Footer, ReportCard,
                        ImageGallery, InterestButton, LoadMoreButton,
                        SiteChrome (renders Header + Nav once from the
                        root layout, hidden on /kitten, instead of each
                        page rendering its own copy -- keeps the logo
                        from flashing on every client-side navigation)
  __tests__/             Component regression tests
lib/                   supabaseClient, useUser/useProfile hooks, and
                        small helpers -- category list, search matching,
                        image upload, role levels, SF map center,
                        haversine distance/duplicate radius, HTML
                        escaping, the colored map-pin icon factory,
                        status label text, batched reporter-name lookup,
                        activity-log action labels, the persisted
                        pill/tab filter hooks shared by Browse and
                        Moderate, and usePagination (client-side "Load
                        more" pagination, used everywhere a list can
                        grow -- Browse, all four Moderate tabs, My
                        submissions, a profile's reports/activity, and a
                        report's progress timeline)
  __tests__/             Vitest unit tests for pure helpers
public/                Static assets -- logo.png (header mark + browser
                        favicon) and logosolid.png
supabase/migrations/   Full schema history, see "Database schema" below
.github/workflows/     CI -- lint + build + test + high-severity dependency audit
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
  tapping "I'm interested" to track them on Browse's Following pill.
  They can also withdraw their own submission at any time from
  `/my-reports` -- this doesn't delete it, it just moves it to a
  `withdrawn` status moderators can still see. Each account also gets a
  public profile page (`/profile/[id]`) listing their approved/resolved
  reports and their display name (required and unique since sign-up now
  collects one -- accounts created before that don't necessarily have
  one) -- their email is never shown publicly.
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

Moderators and above see a small red dot on the Nav bar's Moderate tab,
from any page, whenever something needs attention -- pending reports,
pending change suggestions, and (admins only, since only admins can act
on them) pending moderator-access requests. It's backed by a single
cheap `get_moderation_pending_count()` count query rather than Moderate's
full row data, refetched on every navigation so it clears shortly after
you resolve whatever it was flagging. Inside Moderate itself, the
Reports and User accounts section tabs carry their own matching dots
(Suggested changes already shows a count instead).
- **Owner** sits above admin -- it can manage admin accounts too, which
  regular admins can't do to each other. It's not a role anyone can grant
  through the UI; see "Make yourself the owner" below.

Permissions are enforced by a combination of Supabase table grants and Row Level
Security, narrowly authorized `SECURITY DEFINER` RPCs, and a PostgREST pre-request
hook that enforces MFA and network rate limits before Data API requests reach the
underlying table/function. There is no shared moderation passcode and no private
server key shipped to the browser.

A banned account can still sign in and browse, but can't submit new
reports, suggest changes, or register interest.

## What's on each page

- **Browse** (`/`) -- map centered on SF with a colored dot per report
  (blue for active, yellow for resolved -- matching those status
  badges' colors elsewhere); tapping a marker's popup links straight to
  that report. A search box, then one pill row for Active / Resolved /
  Following plus a Category toggle at the end of the same row; tapping
  Category drops down a multi-select pill panel below (same pattern as
  Moderate's account filters) instead of stacking a second permanent
  pill row. All of it filters the same page in place and combines
  together. Following lists every report you've
  registered interest in, any status, with an "Updated" badge on ones
  whose status changed or got a new progress-timeline entry since you
  last opened them, and a small dot on the Following pill itself so you
  notice without opening it first -- each clears individually once you
  actually open that report, not all at once. Each report card shows
  its photo, category, who reported it (links to their profile),
  interest count, and an "I'm interested" toggle that asks for
  confirmation before unfollowing. Cards load 20 at a time with a "Load
  more" button, same as every list of unbounded size in this app (see
  `usePagination` under `lib/` above).
- **Submit** (`/submit`) -- title, category, photo, and a click-to-pin
  map. The map also shows every existing approved report as a blue dot
  for context (its popup links to that report, opening in a new tab so
  your in-progress draft isn't lost), alongside your own pin in yellow
  once you place one. Warns you before submitting if there's already an
  approved report within ~125m, in case it's a duplicate -- a card with
  links to the nearby report(s) and "Submit anyway" / "Cancel" buttons,
  not a native browser popup. A synchronous lock stops a double-click or
  slow tap from creating two rows. Submitting a report titled exactly
  "kitten" is a hidden shortcut -- see the easter egg section.
- **Report detail** (`/report/[id]`) -- full photo gallery (horizontal
  scroll for multiple photos, tap any photo for a fullscreen lightbox
  with next/prev), location, progress timeline (each entry shows the
  poster's display name where available -- their email stays
  moderator-only), who reported it (links to their profile), an
  interest-follow toggle, and a "suggest a change" box for signed-in
  users on active reports.
- **Impact** (`/impact`) -- public stat tiles (reports submitted, in
  review, active, resolved) pulled from a `get_public_stats()` RPC that
  returns aggregate counts only, so it can include pending/rejected
  reports in the total without exposing their content to anonymous
  visitors.
- **Moderate** (`/moderate`) -- gated to moderator role and above, four
  tabs:
  - *Reports* -- search by title/description/category, plus a
    collapsible Filters panel with a status pill row (pending/approved/
    rejected/resolved/withdrawn, single-choice -- same as before) and a
    category pill row (multi-select, same categories as Submit),
    combining with each other and with search (same panel pattern as
    User accounts' filters). Each card shows who reported it (links to
    their profile); edit any field
    including the location map and photos; approve/reject/resolve/
    reopen/delete; manage the progress timeline; view the interested-email
    list for a report. Flags a pending report with a warning when
    another pending or approved report is within ~125m, so likely
    duplicates are easy to spot and consolidate. Pending reports also
    show how many days they've been waiting, flagged in coral past a
    week. An "Export to CSV" button downloads the currently filtered
    list.
  - *Suggested changes* -- review user-submitted change notes and photos
    alongside the original report, pull a suggested photo onto the
    report with one click.
  - *User accounts* -- pending moderator-access requests (admin+ only),
    and every account you're allowed to manage: edit display name, ban/
    unban, and (admin+ only) change role via a dropdown. A search box
    filters by email or display name; a collapsible Filters panel adds
    two multi-select pill rows on top of that -- status (unconfirmed /
    banned / requested moderator) and role -- where selecting more than
    one pill in a row is an OR (e.g. unconfirmed pill + banned pill
    shows accounts matching either), the two rows combine as an AND with
    each other and with the search box, and each row defaults to "all".
  - *Activity* -- a chronological audit log of every suggestion and
    moderation action by anyone (who did what, and to which report or
    account), newest first. See "Full audit log for staff activity" in
    the Security model section below for what's recorded and how it's
    locked down.
- **Account** (`/account`) -- change your display name (still unique,
  same as sign-up), request moderator access, links to your public
  profile / submissions, sign out, and turn two-factor authentication on
  or off.
- **My submissions** (`/my-reports`) -- everything you've submitted, any
  status, with a Withdraw button on each.
- **Profile** (`/profile/[id]`) -- anyone's public reporting history
  (approved/resolved reports only, plus their display name). When
  viewed by a moderator or above, an additional Activity section shows
  that account's own suggestion/moderation activity from the audit log
  (see "Full audit log for staff activity" below) -- invisible to the
  profile's owner and to plain-user viewers.
- **Sign in / Create account** (`/login`, `/signup`) -- standard Supabase
  Auth email/password forms. Sign-up also requires a display name --
  availability is checked as soon as you leave the field (not just on
  submit), and enforced again at the database level either way -- see
  "Unique display names" under Security model. If the confirmation
  email never shows up, both sign-up (right after creating the account)
  and sign-in (if it fails because the email isn't confirmed yet) offer
  a CAPTCHA-protected "Resend confirmation email" button, via Supabase
  Auth's `resend()`. Sign in also has a "Forgot password?" link that
  emails a reset link (CAPTCHA-protected, same as sign in/up) through
  Supabase Auth's own email delivery; the link lands on `/reset-password`
  to set a new one. See "Password reset setup" under one-time setup
  steps -- the redirect target needs to be allow-listed in Supabase or
  the emailed link won't land where it should.

Every page except the `/kitten` easter egg also shows a small footer
with a contact email and Instagram link.

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
Operations that need to check something beyond simple row ownership (role
hierarchy, masking a column for some viewers, looking up another user by id)
go through narrow `SECURITY DEFINER` Postgres functions that perform their own
authorization checks. API execution grants are also explicit: privileged RPCs
are authenticated-only, intentionally public read-only RPCs are available to
`anon`/`authenticated`, and internal trigger/audit helpers have no API-role
execute grant. MFA is enforced before authenticated PostgREST requests by
`public.check_request()`, so these RPCs do not create an MFA bypass.

`is_admin`, `is_moderator_or_admin`, `is_banned`, `is_owner`, `role_level`
(internal helpers) · `admin_set_user_role`, `admin_review_moderator_request`,
`request_moderator_access`, `moderator_set_display_name`,
`moderator_set_banned`, `get_users_for_moderation` (account management --
the last one also surfaces each account's email confirmation status
from `auth.users`, which Moderate flags with an "Unconfirmed" badge)
· `set_display_name`, `get_public_profile`, `get_public_profiles` (your
own profile / anyone's public profile, single or batched -- the batched
form resolves reporter display names for a whole page of report cards
in one round trip, used on Browse and Moderate) · `get_timeline_updates`, `get_all_timeline_updates_for_moderation`
(progress timeline; author email stays masked for non-moderators, but
display name -- resolved from `updates.created_by`, defaulting to
`auth.uid()` -- is shown to everyone) ·
`withdraw_own_report` (self-service withdraw) · `register_interest`,
`unregister_interest`, `get_my_subscriptions`, `get_report_subscribers`,
`mark_subscription_seen` (the interest-follow feature, plus the in-app
"updated" indicator -- `subscriber_identities.last_seen_status` and
`last_seen_at` track the status and time each follower last checked a
report, cleared one report at a time as you actually open it rather
than all at once; a report counts as updated if its status changed or
a new timeline entry was posted since) ·
`handle_new_user` (creates a profile row on signup, now requiring and
validating the display name passed in through `signUp`'s `options.data`)
· `is_display_name_taken` (anon-callable availability pre-check used by
sign-up, before the uniqueness check that actually matters -- the
database-level unique index -- ever runs) · `get_public_stats`
(aggregate-only counts for `/impact`; intentionally has no
authorization check since it never returns row content) ·
`log_activity`, `get_activity_log`, `get_user_activity_log` (the audit
log behind Moderate's Activity tab and a moderator-only section on
public profiles -- see "Full audit log for staff activity" under
Security model).

## Database schema

`supabase/migrations/` holds every schema change (tables, RLS policies,
functions) applied to the live database, in order, each as a plain SQL
file named `<timestamp>_<name>.sql`. It's kept in sync with Supabase's
own migration history rather than being the source of truth Supabase
reads from -- when a new database change is made, the SQL gets applied
directly to the live project and the matching file gets added here
afterward, so the repo always shows what's actually running.

## Security model

- **Unique display names.** Sign-up now requires one and rejects a
  duplicate (case- and whitespace-insensitive) before creating the
  account -- previously optional and unenforced, which made "who
  reported it" attribution ambiguous. The real enforcement is a partial
  unique index on `profiles (lower(trim(display_name)))` that skips
  nulls, so it doesn't touch any pre-existing account that has no
  display name; every future rename (self-service `set_display_name` or
  moderator-driven `moderator_set_display_name`) is bound by the same
  index and rejected the same way if it would collide. `is_display_name_taken`
  is an anon-callable pre-check the sign-up form calls before submitting,
  purely for a fast, clear error message -- the index is what actually
  prevents a race between two simultaneous sign-ups with the same name.
- **RLS is a primary security boundary, not the API key.** `lib/supabaseClient.js`
  hardcodes the project URL and anon key client-side on purpose -- Supabase's
  anon key is meant to be public; what it can do is constrained by table grants,
  RLS policies, explicit RPC execute grants, and authorization inside privileged
  functions.
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
  itself. Internal trigger/audit helpers are explicitly revoked from API roles,
  while privileged user-facing RPCs are executable only by `authenticated`.
- **Role hierarchy checks are relative, not hardcoded.** Authorization
  checks compare `role_level(caller) vs role_level(target)` rather than
  matching literal role strings, so adding the `owner` role above `admin`
  didn't require touching most of the authorization logic.
- **Optional TOTP two-factor authentication**, enforced across the Data API,
  not just the login screen. Any account can turn on 2FA from `/account`
  (Supabase's built-in TOTP MFA -- scan a QR code with an authenticator app
  or Apple Passwords). `public.check_request()` runs as PostgREST's pre-request
  hook and rejects an authenticated request when the account has a verified MFA
  factor but the JWT assurance level is not `aal2`. That happens before direct
  table access or `SECURITY DEFINER` RPC execution, closing the earlier RPC
  bypass. Restrictive RLS policies still require `aal2` on tables as
  defense-in-depth. `user_has_verified_mfa` can only reveal enrollment for the
  current authenticated user; API roles are not granted direct access to
  `auth.mfa_factors`, which contains the TOTP factor data.
- **Abuse protection on submissions and uploads.** The `submission-images`
  storage bucket only accepts uploads from signed-in, non-banned accounts
  (`to authenticated`, checked against `is_banned`), capped at 10MB and
  image MIME types only -- it was previously open to anyone, signed in or
  not, with no size or type limit at all. `suggestions` and
  `change_suggestions` each have a `BEFORE INSERT` trigger capping a
  single account to 10 inserts per rolling hour, to blunt scripted spam
  without affecting a real person submitting several genuine reports.
  A per-account limit alone is easy to route around by creating more
  accounts, so there's also a per-IP limit (20/hour on the same two
  write paths) in the same PostgREST pre-request function used for MFA
  (`public.check_request`, registered on the `authenticator` role) --
  the IP comes from `X-Forwarded-For`, which Supabase's edge proxy sets
  itself from the real connection, not something a client can spoof by
  sending a fake header. Both the per-account and per-IP checks exempt
  the `owner` role (via `is_owner()`, matching how every other privileged
  check in this app is relative to role rather than a specific account)
  so normal use/testing never trips them.
  Sign-in and sign-up also render a Cloudflare Turnstile CAPTCHA widget
  (`lib/constants.js` -> `TURNSTILE_SITE_KEY`), wired to a real sitekey
  registered to the production domain. It only starts blocking anything
  once the matching secret key is entered in Supabase's dashboard (see
  "CAPTCHA setup" below) -- that step hasn't been independently verified.
- **Full audit log for staff activity.** Every suggestion submission,
  status change, edit, deletion, photo add/remove, change-suggestion
  review, timeline post, and account-management action (ban/unban, role
  change, display name change, moderator request decision) is recorded
  in `private.activity_log` -- a table with zero PostgREST grants, so
  it's reachable only through `get_activity_log()`, which is
  moderator-and-above only and resolves the actor's email/display name
  regardless of the caller's normal profile-visibility limits. Table
  writes go through triggers (for direct-table-write actions like
  suggestions and timeline posts) or an inline call from the relevant
  `SECURITY DEFINER` function (for account-management RPCs). Only
  activity from when this feature shipped onward is recorded -- there's
  no backfill of prior history. A second RPC, `get_user_activity_log`,
  applies the same moderator-and-above gate but filters to one account,
  and backs the Activity section moderators see on a public profile.

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

The repository is connected to Vercel. Changes merged to `main` trigger the
connected deployment automatically; application code does not need a separate
manual upload step.

## One-time setup steps

### 1. Point Supabase at your live URL

Auth emails (like signup confirmations) need to know where your site
actually lives:

- Supabase dashboard -> Authentication -> URL Configuration
- Set Site URL to your Vercel URL (e.g. https://bike-report-omega.vercel.app)

### 2. Make yourself the owner

There's intentionally no self-serve way to become a moderator, admin, or
owner -- someone has to be the first one, manually:

1. Go to your live site and create an account (Sign in -> Create account)
   using the email you want to administer with
2. Use trusted database/admin tooling to set that account's profile role to
   `owner` directly in the database

After that, your Moderate tab's User accounts section will show a queue
of anyone who requests moderator access, with Approve/Deny buttons, and
you'll be able to promote/demote/ban anyone below owner level, including
other admins.

### 3. CAPTCHA setup

Sign-in and sign-up already render a Turnstile widget pointed at a real
sitekey registered to `bike-report-omega.vercel.app` (steps 1 and 2
below are done), but it's not confirmed that Supabase is actually
requiring the token yet (step 3) -- until that's verified, treat CAPTCHA
as not yet protective:

1. Done: created a site at [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile),
   registered to `bike-report-omega.vercel.app` (add `localhost` too if
   you want the widget to work in local dev) -- Turnstile only validates
   for hostnames a site is registered under, so if the app's domain ever
   changes, update it here too, not just in Supabase's Site URL (see
   step 1 in the section above)
2. Done: copied the **Sitekey** into `TURNSTILE_SITE_KEY` in
   `lib/constants.js` -- this is the public half, safe to commit, it's
   what tells the browser which Turnstile site to render
3. Not yet confirmed: copy the **Secret key** and paste it into Supabase dashboard ->
   Authentication -> Bot and Abuse Protection -> enable CAPTCHA
   protection, select Turnstile -- this is the private half, it's what
   lets Supabase's server verify a token is real; it never goes in the
   repo or any file, only into that one dashboard field

### 4. Password reset setup

`/login`'s "Forgot password?" link calls `supabase.auth.resetPasswordForEmail`
with `redirectTo` pointed at `/reset-password` on whatever domain the
site is running on. Supabase only honors a `redirectTo` that matches an
entry in its Redirect URLs allow list -- anything else silently falls
back to the bare Site URL from step 1, landing the emailed link on the
homepage instead of the reset form.

- Supabase dashboard -> Authentication -> URL Configuration -> Redirect URLs
- Add `https://bike-report-omega.vercel.app/reset-password` (and
  `http://localhost:3000/reset-password` too, for local dev)
- Same hostname-dependency as step 1 and the CAPTCHA setup above --
  update this if the app's domain ever changes

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