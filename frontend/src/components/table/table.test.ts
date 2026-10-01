import { describe, expect, it } from 'vitest';
import { formatDecimal, formatHours, formatNumber, formatPercent, formatRelative, parseDate } from './format';
import { pageWindow } from './Pagination';

describe('pageWindow', () => {
  it('lists every page when there are few', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
  it('always keeps first, last and a window around the current page', () => {
    expect(pageWindow(1, 50)).toEqual([1, 2, '…', 50]);
    expect(pageWindow(6, 50)).toEqual([1, '…', 5, 6, 7, '…', 50]);
    expect(pageWindow(50, 50)).toEqual([1, '…', 49, 50]);
  });
  it('does not insert an ellipsis for a gap of nothing', () => {
    expect(pageWindow(3, 8)).toEqual([1, 2, 3, 4, '…', 8]);
    expect(pageWindow(6, 8)).toEqual([1, '…', 5, 6, 7, 8]);
  });
});

describe('number formatting', () => {
  it('groups digits and shows a dash for missing values instead of NaN or 0', () => {
    expect(formatNumber(1248)).toBe('1,248');
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber(undefined)).toBe('—');
    expect(formatNumber('abc')).toBe('—');
    expect(formatNumber(0)).toBe('0');
  });
  it('keeps a fixed number of decimals so a column never mixes 2 / 2.00 / 2.4', () => {
    expect(formatDecimal(2)).toBe('2.0');
    expect(formatDecimal(2.4)).toBe('2.4');
    expect(formatDecimal(12.04, 1)).toBe('12.0');
    expect(formatDecimal(null)).toBe('—');
  });
  it('formats percentages and durations', () => {
    expect(formatPercent(0.835)).toBe('84%');
    expect(formatPercent(null)).toBe('—');
    expect(formatHours(5.25)).toBe('5.3 h');
    expect(formatHours(72)).toBe('3.0 days');
    expect(formatHours(null)).toBe('—');
  });
});

describe('dates', () => {
  it('parses MySQL DATETIME strings and rejects garbage', () => {
    expect(parseDate('2026-10-01 14:32:00')?.getFullYear()).toBe(2026);
    expect(parseDate('not a date')).toBeNull();
    expect(parseDate(null)).toBeNull();
  });
  it('describes recent times relatively and old ones as dates', () => {
    const now = new Date('2026-10-01T12:00:00').getTime();
    expect(formatRelative('2026-10-01T11:59:40', now)).toBe('just now');
    expect(formatRelative('2026-10-01T11:25:00', now)).toBe('35 min ago');
    expect(formatRelative('2026-10-01T09:00:00', now)).toBe('3 h ago');
    expect(formatRelative('2026-09-29T12:00:00', now)).toBe('2 d ago');
    expect(formatRelative('2026-08-01T12:00:00', now)).toBe('01 Aug 2026');
    expect(formatRelative(null, now)).toBe('—');
  });
});
