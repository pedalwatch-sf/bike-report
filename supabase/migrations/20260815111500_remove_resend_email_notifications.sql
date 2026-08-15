-- Resend emailing is removed. The Resend sandbox domain only delivers to
-- the account's own address, so every notification to a real subscriber
-- was failing outright (403 from Resend). Rather than verify a custom
-- domain, the in-app "Updated" indicator (subscriber_identities and
-- get_my_subscriptions/mark_subscriptions_seen, added in
-- 20260815090345_in_app_status_change_notifications.sql) remains as the
-- sole notification mechanism.
drop trigger if exists trg_notify_report_status_change on public.suggestions;
drop function if exists public.notify_report_status_change();
drop function if exists public.get_notification_secrets();
drop extension if exists pg_net;
