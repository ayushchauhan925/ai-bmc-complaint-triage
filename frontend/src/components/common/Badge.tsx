import React from 'react';
import { PRIORITY_COLORS, STATUS_COLORS, SLA_STATUS_COLORS, formatStatus, formatCategory } from '../../utils/constants';
import type { PriorityLevel } from '../../utils/constants';

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={`badge border ${className || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{children}</span>;
}

export function PriorityBadge({ level }: { level: PriorityLevel | string }) {
  return <Badge className={PRIORITY_COLORS[level as PriorityLevel]}>{level}</Badge>;
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
