import React from 'react';
import { Link } from 'react-router-dom';
import { formatDate, formatExact, formatRelative, formatTime, parseDate } from './format';
import { SlaBadge } from '../common/Badge';
import { fmtRemaining } from '../ui/kit';

/** Date + time, with the exact timestamp in a tooltip. `relative` shows "3 h ago" for recent items. */
export function DateCell({ value, relative = false }: { value: string | null | undefined; relative?: boolean }) {
  const d = parseDate(value);
  if (!d) return <span className="text-slate-400">—</span>;
  const recent = relative && Date.now() - d.getTime() < 7 * 86400000;
  return (
    <time dateTime={d.toISOString()} title={formatExact(d)} className="whitespace-nowrap">
      {recent ? formatRelative(d) : <>{formatDate(d)} <span className="text-slate-400">{formatTime(d)}</span></>}
    </time>
  );
}

export const Dash = () => <span className="text-slate-300" aria-label="None">—</span>;

/** Complaint number as a link, plus a text "Review" tag when it needs human review. */
export function ComplaintIdCell({ id, number, review }: { id: number; number: string; review?: boolean | number }) {
  return (
    <span className="whitespace-nowrap">
      <Link to={`/complaints/${id}`} className="font-mono text-xs text-brand-700 hover:underline">{number}</Link>
      {!!review && <span className="ml-1.5 rounded bg-pink-100 px-1.5 py-0.5 text-[10px] font-medium text-pink-800">Review</span>}
    </span>
  );
}

/** SLA state badge plus time remaining/overdue for open work (never invented for resolved items). */
export function SlaCell({ status, deadline, open = true }: { status: string; deadline?: string | null; open?: boolean }) {
  const d = parseDate(deadline);
  const ms = d && open ? d.getTime() - Date.now() : null;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 whitespace-nowrap">
      <SlaBadge status={status} />
      {ms !== null && <span className={`text-[11px] ${ms < 0 ? 'font-medium text-red-700' : 'text-slate-500'}`} title={formatExact(d)}>{fmtRemaining(ms)}</span>}
    </span>
  );
}
