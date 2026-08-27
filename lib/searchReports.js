export function matchesSearch(report, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    report.title?.toLowerCase().includes(q) ||
    report.description?.toLowerCase().includes(q) ||
    report.category?.toLowerCase().includes(q)
  );
}

export function filterReports(reports, query, categoryFilters) {
  return reports.filter(
    (report) =>
      matchesSearch(report, query) &&
      (categoryFilters.includes('all') || categoryFilters.includes(report.category))
  );
}
