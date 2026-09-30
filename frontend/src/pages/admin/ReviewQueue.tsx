import React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as adminService from '../../services/admin.service';
import * as platform from '../../services/platform.service';
import { getErrorMessage } from '../../services/api';
import { PriorityBadge, CategoryBadge, StatusBadge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { PageHeader, QueryBoundary, CardSkeleton, fmtDate } from '../../components/ui/kit';

export default function AdminReviewQueue() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['review-queue'],
    queryFn: () => adminService.listComplaints({ limit: 100, review_required: true }),
    refetchInterval: 60_000,
  });
  const approve = useMutation({
    mutationFn: (id: number) => platform.review(id, { action: 'APPROVE' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['review-queue'] }); qc.invalidateQueries({ queryKey: ['overview'] }); },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Review queue"
        description="Complaints the system was not confident about: low AI confidence, weak evidence on high priority, image mismatch, suspected spam or instruction-like text, or AI unavailable. Your decision is recorded and used to measure AI quality."
      />
      {approve.isError && <p role="alert" className="mt-3 text-sm text-red-600">{getErrorMessage(approve.error)}</p>}
      <div className="mt-4">
        <QueryBoundary query={q} skeleton={<CardSkeleton lines={5} />}>
          {(res) => res.rows.length === 0 ? (
            <EmptyState title="Nothing to review" description="Every complaint passed automated checks." />
          ) : (
            <ul className="space-y-3">
              {res.rows.map((c) => (
                <li key={c.id} className="card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs"><Link to={`/complaints/${c.id}`} className="font-mono font-medium text-brand-600 hover:underline">{c.complaint_number}</Link><span className="ml-2 text-slate-400">{fmtDate(c.created_at)}</span></p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-800">{c.description}</p>
                    </div>
                    <div className="flex gap-1.5"><PriorityBadge level={c.priority_level} /><StatusBadge status={c.status} /></div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2"><CategoryBadge category={c.category} />
                    {c.ai_confidence !== null && <span className="badge border border-slate-200 bg-slate-100 text-slate-600">{Math.round(Number(c.ai_confidence) * 100)}% confidence</span>}
                  </div>
                  {c.review_reason && <p className="mt-2 rounded-md bg-pink-50 px-3 py-2 text-xs text-pink-900"><strong>Why flagged:</strong> {c.review_reason}</p>}
                  <div className="mt-3 flex gap-2">
                    <Link to={`/complaints/${c.id}`} className="btn-primary !py-1.5 text-xs">Inspect &amp; decide</Link>
                    {!c.ai_analysis_failed && <button className="btn-secondary !py-1.5 text-xs" disabled={approve.isPending} onClick={() => approve.mutate(c.id)}>Approve as is</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </QueryBoundary>
      </div>
    </div>
  );
}
