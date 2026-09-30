import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAssigned } from '../../services/officer.service';
import { ComplaintCard } from '../../components/complaint/ComplaintCard';
import { EmptyState } from '../../components/common/EmptyState';
import { PageHeader, QueryBoundary, CardSkeleton } from '../../components/ui/kit';
import { COMPLAINT_STATUSES, PRIORITY_LEVELS, formatStatus, formatCategory } from '../../utils/constants';

export default function OfficerAllComplaints() {
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const q = useQuery({
    queryKey: ['officer-all', status],
    queryFn: () => listAssigned({ limit: 100, status: status || undefined }),
    placeholderData: (p) => p,
  });

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data?.rows ?? [])
      .filter((c) => !priority || c.priority_level === priority)
      .filter((c) => !s || `${c.complaint_number} ${c.description} ${c.ai_title ?? ''} ${formatCategory(c.category)} ${c.address ?? ''}`.toLowerCase().includes(s));
  }, [q.data, priority, search]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title="Department complaints" description="Everything routed to your department, including resolved and closed items." />

      <div className="mt-5 flex flex-wrap gap-2">
        <input aria-label="Search" className="input w-full sm:w-64" placeholder="Search ID, text, location…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select aria-label="Status" className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {COMPLAINT_STATUSES.map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}
        </select>
        <select aria-label="Priority" className="input w-auto" value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">All priorities</option>
          {PRIORITY_LEVELS.map((p) => <option key={p}>{p}</option>)}
        </select>
        {(status || priority || search) && (
          <button className="btn-secondary !py-1.5 text-xs" onClick={() => { setStatus(''); setPriority(''); setSearch(''); }}>Clear</button>
        )}
      </div>

      <div className="mt-4">
        <QueryBoundary query={q} skeleton={<div className="grid gap-3 md:grid-cols-2"><CardSkeleton lines={2} height="h-4" /><CardSkeleton lines={2} height="h-4" /></div>}>
          {() =>
            rows.length === 0 ? (
              <EmptyState title="No complaints found" description="Try a different filter." />
            ) : (
              <>
                <p className="mb-2 text-xs text-slate-500" aria-live="polite">{rows.length} complaint{rows.length === 1 ? '' : 's'}</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {rows.map((c) => <ComplaintCard key={c.id} complaint={c} variant="staff" />)}
                </div>
              </>
            )
          }
        </QueryBoundary>
      </div>
    </div>
  );
}
