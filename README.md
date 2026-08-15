# Route Report

Your bike infrastructure tracker for SF. People flag bike lanes, crossings,
racks, and signage that need attention; you and your moderators review and
track them through to resolution. Backed by Supabase for the database,
image storage, and user accounts.

## How access works

Accounts have a role, ranked low to high: **user → moderator → admin →
owner**. Each level can manage accounts strictly below it (edit their
display name, ban them) -- nobody can touch an account at or above their
own level, including their own.

- **Anyone**, signed in or not, can browse approved and resolved reports,
  search them, and view a report's photos, location, and progress
  timeline.
- **Signed-in users** can submit a report (title, category, location pin,
  optional photo), and suggest changes to any active report (a note, plus
  optional photos) for a moderator to review. Each account also gets a
  public profile page (`/profile/[id]`) listing their approved/resolved
  reports and an optional display name -- their email is never shown
  publicly.
- **Moderators** review pending submissions from the Moderate page: edit
  any field (including dragging the location pin on a map), add or remove
  photos, approve/reject/resolve/reopen, delete reports outright, and post
  or edit the progress-timeline entries visitors see on a report. They also
  review suggested changes (including pulling a suggested photo onto the
  report with one click) and can edit/ban accounts below their level.
- **Admins** additionally approve moderator requests and can promote or
  demote anyone below admin level.
- **Owner** (that's you) sits above admin -- it can manage admin accounts
  too, which regular admins can't do to each other. It's not a role
  anyone can grant through the UI; see "Making yourself the owner" below.

Permissions are enforced by Supabase Row Level Security directly on the
database, based on who's signed in and their role -- there's no shared
passcode and nothing secret sitting in the code.

A banned account can still sign in and browse, but can't submit new
reports or suggested changes.

## What's on each page

- **Browse** (`/`) -- map centered on SF, a search box, and separated
  Active / Resolved sections.
- **Submit** (`/submit`) -- title, category, photo, and a click-to-pin
  map. Warns you before submitting if there's already a similar report
  near that pin.
- **Report detail** (`/report/[id]`) -- full photo gallery, location,
  progress timeline, who reported it (links to their profile), and a
  "suggest a change" box for signed-in users.
- **Moderate** (`/moderate`) -- Reports / Suggested changes / User
  accounts tabs, gated by role.
- **Account** (`/account`) -- set your display name, request moderator
  access, sign out.
- **Profile** (`/profile/[id]`) -- anyone's public reporting history.

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
all -- it redirects to a blank page with a photo on it. Harmless, just
there.

## Cleaning up (optional)

The `/api/moderate/list` and `/api/moderate/update` routes from an
earlier passcode-based version have been removed -- moderation goes
through Supabase Auth and RLS now. If you still have
SUPABASE_SERVICE_ROLE_KEY or MODERATOR_PASSCODE set in Vercel from
that version, they're no longer read by any code path; you can remove
them from Project Settings -> Environment Variables.
