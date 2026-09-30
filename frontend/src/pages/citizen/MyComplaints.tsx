import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listComplaints } from '../../services/complaint.service';
import { ComplaintCard } from '../../components/complaint/ComplaintCard';
import { EmptyState } from '../../components/common/EmptyState';
import { PageHeader, QueryBoundary, CardSkeleton, Tabs } from '../../components/ui/kit';
import { PlusCircleIcon } from '../../components/common/Icons';
import { formatCategory } from '../../utils/constants';

type Tab = 'all' | 'active' | 'resolved';
const CLOSED = ['RESOLVED', 'REJECTED'];

export default function MyComplaints() {
  const q = useQuery({ queryKey: ['my-complaints', 'all'], queryFn: () => listComplaints({ limit: 100 }) });
  const [tab, setTab] = useState<Tab>('active');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');

  const rows = useMemo(() => {
    const all = q.data?.rows ?? [];
    const s = search.trim().toLowerCase();
    return all
      .filter((c) => (tab === 'all' ? true : tab === 'active' ? !CLOSED.includes(c.status) : c.status === 'RESOLVED'))
      .filter((c) => !s || `${c.complaint_number} ${c.description} ${c.ai_title ?? ''} ${formatCategory(c.category)} ${c.address ?? ''}`.toLowerCase().includes(s))
      .sort((a, b) => (sort === 'newest' ? 1 : -1) * (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  }, [q.data, tab, search, sort]);

  const all = q.data?.rows ?? [];
  const counts = {
    all: all.length,
    active: all.filter((c) => !CLOSED.includes(c.status)).length,
    resolved: all.filter((c) => c.status === 'RESOLVED').length,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader
        title="My complaints"
        description="Every issue you have reported, and where it stands."
        actions={<Link to="/complaints/new" className="btn-primary"><PlusCircleIcon size={16} /> Report a problem</Link>}
      />

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Tabs<Tab>
            tabs={[
              { id: 'active', label: 'Active', badge: counts.active },
              { id: 'resolved', label: 'Resolved', badge: counts.resolved },
              { id: 'all', label: 'All', badge: counts.all },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
        <div className="flex gap-2">
          <input aria-label="Search my complaints" className="input w-44 sm:w-56" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select aria-label="Sort" className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as 'newest' | 'oldest')}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
      </div>

      <div className="mt-4">
        <QueryBoundary query={q} skeleton={<div className="grid gap-3 md:grid-cols-2"><CardSkeleton lines={2} height="h-6" /><CardSkeleton lines={2} height="h-6" /></div>}>
          {() =>
            rows.length === 0 ? (
              <EmptyState
                title={all.length === 0 ? 'No complaints yet' : 'No complaints match'}
                description={all.length === 0 ? 'Report your first civic issue - it is triaged automatically.' : 'Try a different tab or search.'}
                action={<Link to="/complaints/new" className="btn-primary">Report a problem</Link>}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {rows.map((c) => <ComplaintCard key={c.id} complaint={c} />)}
              </div>
            )
          }
        </QueryBoundary>
      </div>
    </div>
  );
}
