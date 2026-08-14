# Route Report

Your bike infrastructure tracker, backed by Supabase for the database,
image storage, and now real user accounts.

## How access works now

- **Anyone** can browse approved reports.
- **Signed-in users** can submit a report (with an optional photo) and see
  their own submissions.
- **Moderators** can review pending submissions, edit them, and
  approve/reject.
- **Admin** (that's you) approves who becomes a moderator, from a queue on
  the Moderate page.

There's no more shared passcode. Permissions are enforced by Supabase's
Row Level Security rules directly on the database, based on who's signed
in -- so there's nothing secret sitting in the code anymore.

## Deploying an update

Since this is already on GitHub and connected to Vercel: update the file(s)
on GitHub (via the pencil-edit icon, or by uploading a replacement file)
and commit. Vercel redeploys automatically within a minute or two.

## Two one-time setup steps

### 1. Point Supabase at your live URL

Auth emails (like signup confirmations) need to know where your site
actually lives:

- Supabase dashboard -> Authentication -> URL Configuration
- Set Site URL to your Vercel URL (e.g. https://route-report.vercel.app)

### 2. Make yourself the admin

There's intentionally no self-serve way to become admin -- someone has to
be the first one, manually:

1. Go to your live site and create an account (Sign in -> Create account)
   using the email you want to administer with
2. Tell Claude that email address, and it'll grant that account admin
   rights directly in the database

After that, your Moderate tab will show a queue of anyone who requests
moderator access, with Approve/Deny buttons.

## Cleaning up (optional)

The SUPABASE_SERVICE_ROLE_KEY and MODERATOR_PASSCODE environment
variables in Vercel are no longer used by the app. They're harmless to
leave, but you can remove them from Vercel's Project Settings ->
Environment Variables if you'd like to tidy up.
