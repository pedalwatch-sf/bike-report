// Human-readable labels for private.activity_log rows, shared between
// Moderate's Activity tab (get_activity_log, all actors) and a public
// profile's staff-only activity section (get_user_activity_log, one actor).
export const ACTIVITY_LABELS = {
  report_submitted: 'submitted a report',
  report_status_changed: "changed a report's status",
  report_edited: 'edited a report',
  report_deleted: 'deleted a report',
  report_image_added: 'added a photo to a report',
  report_image_removed: 'removed a photo from a report',
  change_suggestion_submitted: 'suggested a change',
  change_suggestion_reviewed: 'reviewed a suggested change',
  timeline_event_posted: 'posted a progress update',
  timeline_event_edited: 'edited a progress update',
  timeline_event_deleted: 'deleted a progress update',
  user_banned: 'banned an account',
  user_unbanned: 'unbanned an account',
  role_changed: "changed an account's role",
  display_name_changed_by_moderator: "changed an account's display name",
  moderator_request_approved: 'approved a moderator request',
  moderator_request_denied: 'denied a moderator request',
  moderator_access_requested: 'requested moderator access',
};
