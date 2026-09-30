import React from 'react';
import { Link } from 'react-router-dom';
import { PriorityBadge, StatusBadge, CategoryBadge, SlaBadge } from '../common/Badge';
import { LocationIcon, ClockIcon } from '../common/Icons';
import { ProgressTracker } from './ProgressTracker';
import { fmtRemaining } from '../ui/kit';
import type { Complaint } from '../../utils/types';

const ACCENT: Record<string, string> = {
  CRITICAL: 'border-l-red-500',
  HIGH: 'border-l-orange-500',
  MEDIUM: 'border-l-amber-400',
  LOW: 'border-l-slate-300',
};

/**
 * Complaint summary card. `variant="citizen"` shows a plain-language progress tracker;
 * `variant="staff"` adds SLA state and time remaining instead.
 */
export function ComplaintCard({ complaint, variant = 'citizen' }: { complaint: Complaint; variant?: 'citizen' | 'staff' }) {
  const open = !['RESOLVED', 'REJECTED'].includes(complaint.status);
  const remaining = open && complaint.sla_deadline ? new Date(complaint.sla_deadline).getTime() - Date.now() : null;

  return (
    <Link
      to={`/complaints/${complaint.id}`}
      className={`card group block border-l-4 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${ACCENT[complaint.priority_level] ?? 'border-l-slate-300'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-slate-400">{complaint.complaint_number}</p>
          <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-800 group-hover:text-brand-700">
            {complaint.ai_title || complaint.description}
          </p>
        </div>
        <PriorityBadge level={complaint.priority_level} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CategoryBadge category={complaint.category} />
        <StatusBadge status={complaint.status} />
        {variant === 'staff' && open && <SlaBadge status={complaint.sla_status} />}
        {variant === 'staff' && complaint.review_required && (
          <span className="badge border border-pink-200 bg-pink-100 text-pink-800">Needs review</span>
        )}
        {complaint.department_name && variant === 'citizen' && <span className="text-xs text-slate-400">{complaint.department_name}</span>}
      </div>

      {variant === 'citizen' && (
        <div className="mt-4">
          <ProgressTracker status={complaint.status} compact />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400">
        <span className="flex shrink-0 items-center gap-1">
          <ClockIcon size={13} />
          {variant === 'staff' && remaining !== null ? (
            <span className={remaining < 0 ? 'font-medium text-red-600' : ''}>{fmtRemaining(remaining)}</span>
          ) : (
            new Date(complaint.created_at).toLocaleDateString()
          )}
        </span>
        {complaint.address && (
          <span className="flex min-w-0 items-center gap-1 truncate">
            <LocationIcon size={13} className="shrink-0" /> <span className="truncate">{complaint.address}</span>
          </span>
        )}
      </div>
    </Link>
  );
}
