// "approved" is the internal/moderation name for a live report; everywhere
// a status badge faces the public it should read "Active" instead, matching
// the language already used on Browse (Active/Resolved tabs and legend).
const STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Active',
  rejected: 'Rejected',
  resolved: 'Resolved',
  withdrawn: 'Withdrawn',
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}
