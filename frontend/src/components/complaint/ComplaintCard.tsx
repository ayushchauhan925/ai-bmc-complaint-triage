import React from 'react';
import { Link } from 'react-router-dom';
import { PriorityBadge, StatusBadge, CategoryBadge } from '../common/Badge';
import { LocationIcon, ClockIcon } from '../common/Icons';
import type { Complaint } from '../../utils/types';

export function ComplaintCard({ complaint }: { complaint: Complaint }) {
  return (
    <Link
      to={`/complaints/${complaint.id}`}
      className="card block p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-mono text-slate-400">{complaint.complaint_number}</p>
          <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-800">{complaint.description}</p>
        </div>
        <PriorityBadge level={complaint.priority_level} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CategoryBadge category={complaint.category} />
        <StatusBadge status={complaint.status} />
        {complaint.department_name && (
          <span className="text-xs text-slate-400">{complaint.department_name}</span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <ClockIcon size={13} /> {new Date(complaint.created_at).toLocaleDateString()}
        </span>
        {complaint.address && (
          <span className="flex max-w-[60%] items-center gap-1 truncate">
            <LocationIcon size={13} /> {complaint.address}
          </span>
        )}
      </div>
    </Link>
  );
}
