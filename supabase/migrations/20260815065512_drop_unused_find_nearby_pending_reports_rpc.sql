
-- No longer needed: pending-report proximity is now a moderator-facing
-- signal (moderators already see all pending reports directly via RLS),
-- not a submit-time check for the submitting user.
drop function public.find_nearby_pending_reports(float8, float8, text, float8);
