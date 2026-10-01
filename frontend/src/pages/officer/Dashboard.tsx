import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { listAssigned } from '../../services/officer.service';
import { ComplaintCard } from '../../components/complaint/ComplaintCard';
import { StatCard } from '../../components/dashboard/StatCard';
import { EmptyState } from '../../components/common/EmptyState';
import { CsvButton } from '../../components/ui/CsvButton';
import { PageHeader, QueryBoundary, PageSkeleton, fmtRemaining, fmtDate } from '../../components/ui/kit';
import { PriorityBadge, StatusBadge, CategoryBadge } from '../../components/common/Badge';
import { DataTable, RowActions, useClientTable, type Column } from '../../components/table';
import { ComplaintIdCell, DateCell, SlaCell } from '../../components/table/Cells';
import { ClipboardIcon, AlertIcon, ClockIcon, ShieldIcon, RefreshIcon } from '../../components/common/Icons';
import type { Complaint } from '../../utils/types';

type Filter = 'all' | 'urgent' | 'at-risk' | 'review';
const CLOSED = ['RESOLVED', 'REJECTED'];
const remainingMs = (c: Complaint) => (c.sla_deadline ? new Date(c.sla_deadline).getTime() - Date.now() : Number.POSITIVE_INFINITY);

export default function OfficerDashboard() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['officer-queue'], queryFn: () => listAssigned({ limit: 100 }), refetchInterval: 60_000 });
  const [filter, setFilter] = useState<Filter>('all');

  const open = useMemo(
    () => (q.data?.rows ?? []).filter((c) => !CLOSED.includes(c.status)).sort((a, b) => b.priority_score - a.priority_score || remainingMs(a) - remainingMs(b)),
    [q.data]
  );
  const urgent = open.filter((c) => c.priority_level === 'CRITICAL' || c.priority_level === 'HIGH');
  const atRisk = open.filter((c) => c.sla_status === 'APPROACHING' || c.sla_status === 'BREACHED');
  const review = open.filter((c) => c.review_required);
  const visible = filter === 'urgent' ? urgent : filter === 'at-risk' ? atRisk : filter === 'review' ? review : open;
  const next = open[0];

  const RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const table = useClientTable(visible, {
    complaint: (c) => c.complaint_number, category: (c) => c.category, priority: (c) => RANK[c.priority_level], status: (c) => c.status,
    sla: (c) => (Number.isFinite(remainingMs(c)) ? remainingMs(c) : null), reported: (c) => new Date(c.created_at.replace(' ', 'T')).getTime(),
  });
  const columns: Column<Complaint>[] = [
    { id: 'complaint', header: 'Complaint', sortKey: 'complaint', locked: true, truncate: true, cell: (c) => (<><ComplaintIdCell id={c.id} number={c.complaint_number} review={c.review_required} /><span className="block max-w-xs truncate text-xs text-slate-500">{c.ai_title || c.description}</span></>) },
    { id: 'category', header: 'Category', sortKey: 'category', hideBelow: 'lg', width: 'w-44', cell: (c) => <CategoryBadge category={c.category} /> },
    { id: 'priority', header: 'Priority', sortKey: 'priority', width: 'w-24', cell: (c) => <PriorityBadge level={c.priority_level} /> },
    { id: 'status', header: 'Status', sortKey: 'status', width: 'w-32', cell: (c) => <StatusBadge status={c.status} /> },
    { id: 'sla', header: 'SLA', hint: 'Time left against the service-level deadline', sortKey: 'sla', width: 'w-44', cell: (c) => <SlaCell status={c.sla_status} deadline={c.sla_deadline} /> },
    { id: 'reported', header: 'Reported', sortKey: 'reported', firstSort: 'desc', hideBelow: 'xl', width: 'w-40', cell: (c) => <DateCell value={c.created_at} relative /> },
    { id: 'actions', header: '', width: 'w-20', align: 'right', locked: true, cell: (c) => <RowActions label={c.complaint_number} primary={{ label: 'Open', to: `/complaints/${c.id}` }} /> },
  ];

  const chip = (id: Filter, label: string, n: number) => (
    <button
      key={id}
      aria-pressed={filter === id}
      onClick={() => { setFilter(id); table.resetPage(); }}
      className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${filter === id ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
    >
      {label} <span className="ml-1 text-slate-400">{n}</span>
    </button>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader
        title={`Work queue${user ? ` · ${user.name.split(' ')[0]}` : ''}`}
        description="Complaints routed to your department, most urgent first."
        actions={<><CsvButton label="Export queue (CSV)" filename={`work-queue-${new Date().toISOString().slice(0, 10)}.csv`} rows={open} columns={[{ header: 'Complaint ID', value: (c) => c.complaint_number }, { header: 'Category', value: (c) => c.category }, { header: 'Priority', value: (c) => c.priority_level }, { header: 'Status', value: (c) => c.status }, { header: 'SLA', value: (c) => c.sla_status }, { header: 'SLA deadline', value: (c) => c.sla_deadline }, { header: 'Address', value: (c) => c.address }, { header: 'Reported', value: (c) => c.created_at }]} /><button className="btn-secondary !py-1.5 text-xs" onClick={() => q.refetch()} disabled={q.isFetching}><RefreshIcon size={14} className={q.isFetching ? 'animate-spin' : ''} /> Refresh</button></>}
      />

      <div className="mt-5">
        <QueryBoundary query={q} skeleton={<PageSkeleton />}>
          {() => (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <StatCard label="Open" value={open.length} icon={<ClipboardIcon size={16} />} />
                <StatCard label="Critical / high" value={urgent.length} icon={<AlertIcon size={16} />} tone={urgent.length ? 'critical' : 'default'} />
                <StatCard label="SLA at risk" value={atRisk.length} icon={<ClockIcon size={16} />} tone={atRisk.length ? 'warning' : 'default'} />
                <StatCard label="Needs review" value={review.length} icon={<ShieldIcon size={16} />} tone={review.length ? 'warning' : 'default'} />
              </div>

              {next && (
                <Link to={`/complaints/${next.id}`} className="group flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 hover:bg-brand-100/60">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">Next up</p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">{next.ai_title || next.description}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{next.complaint_number}{next.address ? ` · ${next.address}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <PriorityBadge level={next.priority_level} />
                    <span className={`text-xs font-medium ${remainingMs(next) < 0 ? 'text-red-700' : 'text-slate-600'}`}>{fmtRemaining(Number.isFinite(remainingMs(next)) ? remainingMs(next) : null)}</span>
                    <span className="text-sm font-medium text-brand-700 group-hover:underline">Open →</span>
                  </div>
                </Link>
              )}

              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter queue">
                {chip('all', 'All open', open.length)}
                {chip('urgent', 'Critical & high', urgent.length)}
                {chip('at-risk', 'SLA at risk', atRisk.length)}
                {chip('review', 'Needs review', review.length)}
              </div>

              <DataTable<Complaint>
                caption="Department work queue"
                columns={columns}
                rows={table.rows}
                rowKey={(c) => c.id}
                rowClassName={(c) => `row-${c.priority_level}`}
                emptyTitle={open.length === 0 ? 'Nothing assigned yet' : 'Nothing in this view'}
                emptyDescription={open.length === 0 ? 'New complaints for your department will appear here.' : 'Try another filter.'}
                sort={table.sort}
                onSortChange={table.setSort}
                mobileCard={(c) => <ComplaintCard complaint={c} variant="staff" />}
                pagination={{ ...table.pagination, noun: 'complaints' }}
              />
            </div>
          )}
        </QueryBoundary>
      </div>
    </div>
  );
}
