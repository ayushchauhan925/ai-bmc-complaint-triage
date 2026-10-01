import React from 'react';
import { PRIORITY_COLORS, STATUS_COLORS, SLA_STATUS_COLORS, formatStatus, formatCategory } from '../../utils/constants';
import type { PriorityLevel } from '../../utils/constants';
import { trEnum } from '../../i18n';

/**
 * Every badge carries readable text; colour only reinforces it. Use these (never ad-hoc spans) in tables.
 */
export function Badge({ className, children, title }: { className?: string; children: React.ReactNode; title?: string }) {
  return <span title={title} className={`badge whitespace-nowrap border ${className || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{children}</span>;
}

export function PriorityBadge({ level }: { level: PriorityLevel | string }) {
  return <Badge className={PRIORITY_COLORS[level as PriorityLevel]}>{trEnum('priority', level) ?? level}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge className={STATUS_COLORS[status]}>{formatStatus(status)}</Badge>;
}

export function SlaBadge({ status }: { status: string }) {
  return <Badge className={SLA_STATUS_COLORS[status]}>{formatStatus(status)}</Badge>;
}

export function CategoryBadge({ category }: { category: string }) {
  return <Badge className="bg-brand-50 text-brand-700 border-brand-100">{formatCategory(category)}</Badge>;
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-800 border-red-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  MEDIUM: 'bg-amber-100 text-amber-800 border-amber-200',
  LOW: 'bg-slate-100 text-slate-700 border-slate-200',
};
/** Incident / anomaly severity. Same scale as priority, different noun. */
export function SeverityBadge({ level }: { level: string }) {
  return <Badge className={SEVERITY_COLORS[String(level).toUpperCase()]}>{formatStatus(String(level))}</Badge>;
}

export function DepartmentBadge({ name }: { name?: string | null }) {
  return name ? <Badge className="bg-slate-50 text-slate-700 border-slate-200">{name}</Badge> : <span className="text-slate-400">Unassigned</span>;
}

/** Active / Inactive for accounts and departments - the word is always shown. */
export function ActiveBadge({ active }: { active: boolean | number | undefined | null }) {
  const on = active === undefined || active === null ? true : !!Number(active);
  return <Badge className={on ? 'bg-green-50 text-green-800 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200'}>{on ? '● Active' : '○ Inactive'}</Badge>;
}
