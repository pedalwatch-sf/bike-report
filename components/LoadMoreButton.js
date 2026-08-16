export default function LoadMoreButton({ hasMore, remaining, onClick }) {
  if (!hasMore) return null;
  return (
    <button className="btn outline" style={{ width: '100%', marginTop: 8 }} onClick={onClick}>
      Load more ({remaining} more)
    </button>
  );
}
