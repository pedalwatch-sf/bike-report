import { describe, it, expect } from 'vitest';
import { filterReports, matchesSearch } from '../searchReports';

const report = {
  title: 'Missing lane on 5th & Oak',
  description: 'No bike lane here',
  category: 'New bike lane needed',
};

describe('matchesSearch', () => {
  it('matches on title, case-insensitively', () => {
    expect(matchesSearch(report, 'oak')).toBe(true);
    expect(matchesSearch(report, 'OAK')).toBe(true);
  });

  it('matches on description', () => {
    expect(matchesSearch(report, 'bike lane here')).toBe(true);
  });

  it('matches on category', () => {
    expect(matchesSearch(report, 'new bike lane')).toBe(true);
  });

  it('treats an empty or blank query as matching everything', () => {
    expect(matchesSearch(report, '')).toBe(true);
    expect(matchesSearch(report, '   ')).toBe(true);
  });

  it('returns false when nothing matches', () => {
    expect(matchesSearch(report, 'pothole')).toBe(false);
  });
});

describe('filterReports', () => {
  const reports = [
    report,
    {
      title: 'Pothole on Market',
      description: 'Deep pothole near the curb',
      category: 'Road repair',
    },
  ];

  it('applies search and category filters together', () => {
    expect(filterReports(reports, 'market', ['Road repair'])).toEqual([reports[1]]);
    expect(filterReports(reports, 'oak', ['Road repair'])).toEqual([]);
  });

  it('searches the complete list when all categories are selected', () => {
    expect(filterReports(reports, 'pothole', ['all'])).toEqual([reports[1]]);
  });
});
