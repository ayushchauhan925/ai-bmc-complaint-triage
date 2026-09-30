import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as incidentService from '../../services/incident.service';
import { PriorityBadge, CategoryBadge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { PageHeader, QueryBoundary, CardSkeleton, Tabs, fmtDate } from '../../components/ui/kit';
import { LayersIcon, LocationIcon } from '../../components/common/Icons';

type Tab = 'active' | 'resolved' | 'all';
const ACCENT: Record<string, string> = { CRITICAL: 'border-l-red-500', HIGH: 'border-l-orange-500', MEDIUM: 'border-l-amber-400', LOW: 'border-l-slate-300' };
const RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const isActive = (s: string) => s === 'OPEN' || s === 'IN_PROGRESS';

export default function AdminIncidents() {
  const q = useQuery({ queryKey: ['incidents-list'], queryFn: () => incidentService.listIncidents({ limit: 100 }) });
  const [tab, setTab] = useState<Tab>('active');
  const [search, setSearch] = useState('');

  const all = q.data?.rows ?? [];
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all
      .filter((i) => (tab === 'all' ? true : tab === 'active' ? isActive(i.status) : !isActive(i.status)))
      .filter((i) => !s || `${i.incident_number} ${i.title} ${i.category}`.toLowerCase().includes(s))
      .sort((a, b) => RANK[a.priority_level] - RANK[b.priority_level] || b.complaint_count - a.complaint_count);
  }, [all, tab, search]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title="Incidents" description="Reports of the same underlying problem, grouped so it is handled once. Sorted by severity, then size." />

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Tabs<Tab>
            tabs={[
              { id: 'active', label: 'Active', badge: all.filter((i) => isActive(i.status)).length },
              { id: 'resolved', label: 'Resolved / closed', badge: all.filter((i) => !isActive(i.status)).length },
              { id: 'all', label: 'All', badge: all.length },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
        <input aria-label="Search incidents" className="input w-full sm:w-56" placeholder="Search incidents…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="mt-4">
        <QueryBoundary query={q} skeleton={<div className="grid gap-3 md:grid-cols-2"><CardSkeleton lines={2} height="h-4" /><CardSkeleton lines={2} height="h-4" /></div>}>
          {() =>
            rows.length === 0 ? (
              <EmptyState title={all.length === 0 ? 'No incidents yet' : 'No incidents in this view'} description="Incidents form automatically when similar complaints are reported close together." />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {rows.map((inc) => (
                  <Link key={inc.id} to={`/admin/incidents/${inc.id}`} className={`card group flex gap-4 border-l-4 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${ACCENT[inc.priority_level] ?? 'border-l-slate-300'}`}>
                    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-50 text-slate-800">
                      <LayersIcon size={14} className="text-slate-400" />
                      <span className="text-lg font-semibold leading-none">{inc.complaint_count}</span>
                      <span className="text-[10px] uppercase tracking-wide text-slate-400">reports</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-mono text-xs text-slate-400">{inc.incident_number}</p>
                        <PriorityBadge level={inc.priority_level} />
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-800 group-hover:text-brand-700">{inc.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <CategoryBadge category={inc.category} />
                        <span className="badge border border-slate-200 bg-slate-100 text-slate-600">{inc.status.replace('_', ' ').toLowerCase()}</span>
                      </div>
                      <p className="mt-2 flex items-center gap-1 truncate text-xs text-slate-400">
                        <LocationIcon size={12} className="shrink-0" /> {inc.department_name || 'Unassigned'} · since {fmtDate(inc.created_at)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )
          }
        </QueryBoundary>
      </div>
    </div>
  );
}
