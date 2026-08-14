# Route Report

Your bike infrastructure tracker, now backed by a real database (Supabase)
instead of the browser-only prototype. This folder is a complete, working
website — it just needs to be put on GitHub and connected to Vercel to go
live at a real URL.

## What's already done for you

- The database (tables, image storage, security rules) is live in your
  Supabase project called **bike-report**.
- This code is already wired to that database's public URL and key —
  nothing to configure there.
- Browse, Submit (with photo + map pin), and Moderate (with edit, approve,
  reject) are all built and working.

## What you still need to do (about 10 minutes)

### 1. Get your two secret values

These stay out of the code and get typed into Vercel directly, so they're
never visible to site visitors.

- Go to your Supabase project → **Settings → API**
- Scroll to **Project API keys** and copy the one labeled **`service_role`**
  (it's marked "secret" — that's the one you want, not the public one)
- Also just pick any passcode you'd like to use to unlock the Moderate tab
  (e.g. `route-2026`) — write it down, you'll type it in twice

### 2. Put this code on GitHub

- Go to [github.com/new](https://github.com/new), name the repository
  (e.g. `route-report`), keep it **Private** if you'd rather people not
  browse your source, and click **Create repository**
- On the next page, click **uploading an existing file**
- Drag this entire folder's contents into the browser window (Chrome
  supports dragging a whole folder in) and click **Commit changes**

### 3. Connect it to Vercel

- Go to [vercel.com/new](https://vercel.com/new) and sign in with your
  GitHub account
- Select the `route-report` repository and click **Import**
- Before clicking Deploy, open **Environment Variables** and add:
  - `SUPABASE_SERVICE_ROLE_KEY` → the secret key you copied in step 1
  - `MODERATOR_PASSCODE` → the passcode you chose in step 1
- Click **Deploy**

That's it — after a minute or two, Vercel gives you a live URL
(something like `route-report.vercel.app`) that anyone can visit. Every
future change you want (new features, tweaks) just needs the files updated
and pushed to GitHub — Vercel automatically redeploys.

## Trying it locally first (optional)

If you want to see it running on your own computer before deploying:

1. Install [Node.js](https://nodejs.org) if you don't have it
2. Copy `.env.local.example` to a new file named `.env.local` and fill in
   your two values from step 1 above
3. In this folder, run `npm install` then `npm run dev`
4. Open `http://localhost:3000`
