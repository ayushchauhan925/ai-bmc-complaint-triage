/** One place for how tables show dates and numbers, so the whole product reads the same. */

const NUM = new Intl.NumberFormat('en-IN');

export const formatNumber = (n: number | string | null | undefined): string => {
  if (n === null || n === undefined || n === '') return '—';
  const v = Number(n);
  return Number.isFinite(v) ? NUM.format(v) : '—';
};

/** Fixed decimals so a column never mixes "2", "2.00" and "2.4". */
export const formatDecimal = (n: number | string | null | undefined, digits = 1): string => {
  if (n === null || n === undefined || n === '') return '—';
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
};

export const formatPercent = (ratio: number | null | undefined, digits = 0): string =>
  ratio === null || ratio === undefined || !Number.isFinite(ratio) ? '—' : `${(ratio * 100).toFixed(digits)}%`;

export const formatHours = (h: number | null | undefined): string => {
  if (h === null || h === undefined || !Number.isFinite(h)) return '—';
  return h >= 48 ? `${formatDecimal(h / 24, 1)} days` : `${formatDecimal(h, 1)} h`;
};

/** MySQL DATETIME strings arrive as "YYYY-MM-DD HH:mm:ss" (dateStrings: true); make them parseable. */
export const parseDate = (d: string | Date | null | undefined): Date | null => {
  if (!d) return null;
  if (d instanceof Date) return Number.isNaN(d.getTime()) ? null : d;
  const parsed = new Date(/^\d{4}-\d{2}-\d{2} \d/.test(d) ? d.replace(' ', 'T') : d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const DATE = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const TIME = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
const FULL = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'medium' });

export const formatDate = (d: string | Date | null | undefined): string => {
  const p = parseDate(d);
  return p ? DATE.format(p) : '—';
};
export const formatTime = (d: string | Date | null | undefined): string => {
  const p = parseDate(d);
  return p ? TIME.format(p) : '';
};
export const formatExact = (d: string | Date | null | undefined): string => {
  const p = parseDate(d);
  return p ? FULL.format(p) : '';
};

/** "just now", "5 min ago", "3 h ago", "2 d ago"; falls back to a date beyond a week. */
export const formatRelative = (d: string | Date | null | undefined, now = Date.now()): string => {
  const p = parseDate(d);
  if (!p) return '—';
  const diff = now - p.getTime();
  if (diff < 0) return formatDate(p);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.floor(h / 24);
  return days < 7 ? `${days} d ago` : formatDate(p);
};
