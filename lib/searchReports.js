export function matchesSearch(report, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    report.title?.toLowerCase().includes(q) ||
    report.description?.toLowerCase().includes(q) ||
    report.category?.toLowerCase().includes(q)
  );
}
