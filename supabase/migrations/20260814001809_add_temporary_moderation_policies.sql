-- Temporary: lets the app's passcode-gated moderation screen see and update
-- pending items using the public key, same trust level as the current prototype.
-- Replace with real Supabase Auth policies when you add moderator login.
create policy "app can read all suggestions for moderation"
  on suggestions for select
  using (true);

create policy "app can update suggestion status"
  on suggestions for update
  using (true);
