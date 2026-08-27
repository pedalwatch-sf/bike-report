export default function LoadMoreButton({ hasMore, remaining, onClick, loading = false }) {
  if (!hasMore) return null;
  return (
    <button
      type="button"
      className="btn outline"
      style={{ width: '100%', marginTop: 8 }}
      onClick={onClick}
      disabled={loading}
    >
      {loading ? 'Loading…' : remaining == null ? 'Load more' : `Load more (${remaining} more)`}
    </button>
  );
}
