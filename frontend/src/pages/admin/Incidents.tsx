import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as incidentService from '../../services/incident.service';
import { PriorityBadge, CategoryBadge, StatusBadge } from '../../components/common/Badge';
import { PageHeader, Tabs } from '../../components/ui/kit';
import { CsvButton } from '../../components/ui/CsvButton';
import { DataTable, RowActions, SearchInput, useClientTable, formatNumber, type Column } from '../../components/table';
import { DateCell } from '../../components/table/Cells';
import type { Incident } from '../../utils/types';

type Tab = 'active' | 'resolved' | 'all';
const RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const isActive = (s: string) => s === 'OPEN' || s === 'IN_PROGRESS';
const FETCH_LIMIT = 100;

export default function AdminIncidents() {
  const q = useQuery({ queryKey: ['incidents-list'], queryFn: () => incidentService.listIncidents({ limit: FETCH_LIMIT }) });
  const [tab, setTab] = useState<Tab>('active');
  const [search, setSearch] = useState('');

  const all = q.data?.rows ?? [];
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all
      .filter((i) => (tab === 'all' ? true : tab === 'active' ? isActive(i.status) : !isActive(i.status)))
      .filter((i) => !s || `${i.incident_number} ${i.title} ${i.category} ${i.department_name ?? ''}`.toLowerCase().includes(s))
      // default order: severity, then number of reports
      .sort((a, b) => RANK[a.priority_level] - RANK[b.priority_level] || b.complaint_count - a.complaint_count);
  }, [all, tab, search]);

  const table = useClientTable(rows, {
    incident: (i) => i.incident_number, severity: (i) => RANK[i.priority_level], reports: (i) => i.complaint_count, status: (i) => i.status,
    department: (i) => i.department_name, started: (i) => new Date(i.created_at.replace(' ', 'T')).getTime(), updated: (i) => new Date(i.updated_at.replace(' ', 'T')).getTime(),
  });

  const columns: Column<Incident>[] = [
    { id: 'incident', header: 'Incident', sortKey: 'incident', locked: true, truncate: true, cell: (i) => <><Link to={`/admin/incidents/${i.id}`} className="font-mono text-xs text-brand-700 hover:underline">{i.incident_number}</Link><span className="ml-2 text-slate-800">{i.title}</span></>, tooltip: (i) => i.title },
    { id: 'severity', header: 'Severity', sortKey: 'severity', width: 'w-24', cell: (i) => <PriorityBadge level={i.priority_level} /> },
    { id: 'category', header: 'Category', hideBelow: 'lg', width: 'w-44', truncate: true, cell: (i) => <CategoryBadge category={i.category} /> },
    { id: 'department', header: 'Department', sortKey: 'department', hideBelow: 'xl', width: 'w-48', truncate: true, cell: (i) => i.department_name || <span className="text-slate-400">Unassigned</span> },
    { id: 'location', header: 'Location', hint: 'Cluster centre (latitude, longitude)', hideBelow: 'xl', defaultHidden: true, width: 'w-40', cell: (i) => <span className="font-mono text-xs">{Number(i.latitude).toFixed(4)}, {Number(i.longitude).toFixed(4)}</span> },
    { id: 'reports', header: 'Reports', hint: 'Complaints affected by this incident', sortKey: 'reports', firstSort: 'desc', width: 'w-24', align: 'right', cell: (i) => <span className="font-semibold">{formatNumber(i.complaint_count)}</span> },
    { id: 'status', header: 'Status', sortKey: 'status', width: 'w-32', cell: (i) => <StatusBadge status={i.status} /> },
    { id: 'started', header: 'Started', sortKey: 'started', firstSort: 'desc', hideBelow: 'md', width: 'w-40', cell: (i) => <DateCell value={i.created_at} relative /> },
    { id: 'updated', header: 'Last updated', sortKey: 'updated', firstSort: 'desc', hideBelow: 'xl', defaultHidden: true, width: 'w-40', cell: (i) => <DateCell value={i.updated_at} relative /> },
    { id: 'actions', header: '', width: 'w-20', align: 'right', locked: true, cell: (i) => <RowActions label={i.incident_number} primary={{ label: 'Open', to: `/admin/incidents/${i.id}` }} /> },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Incidents"
        description="Reports of the same underlying problem, grouped so it is handled once. Sorted by severity, then size."
        actions={<CsvButton filename="incidents.csv" rows={rows} columns={[{ header: 'Incident', value: (i: Incident) => i.incident_number }, { header: 'Title', value: (i: Incident) => i.title }, { header: 'Severity', value: (i: Incident) => i.priority_level }, { header: 'Category', value: (i: Incident) => i.category }, { header: 'Department', value: (i: Incident) => i.department_name }, { header: 'Reports', value: (i: Incident) => i.complaint_count }, { header: 'Status', value: (i: Incident) => i.status }, { header: 'Started', value: (i: Incident) => i.created_at }, { header: 'Updated', value: (i: Incident) => i.updated_at }]} />}
      />

      <div className="mt-5">
        <Tabs<Tab>
          tabs={[
            { id: 'active', label: 'Active', badge: all.filter((i) => isActive(i.status)).length },
            { id: 'resolved', label: 'Resolved / closed', badge: all.filter((i) => !isActive(i.status)).length },
            { id: 'all', label: 'All', badge: all.length },
          ]}
          value={tab}
          onChange={(t) => { setTab(t); table.resetPage(); }}
        />
      </div>

      <div className="mt-4">
        <DataTable<Incident>
          caption="Incidents"
          columns={columns}
          rows={q.data ? table.rows : undefined}
          rowKey={(i) => i.id}
          rowClassName={(i) => `row-${i.priority_level}`}
          isLoading={q.isLoading}
          isFetching={q.isFetching}
          error={q.error}
          errorTitle="Unable to load incidents"
          onRetry={() => q.refetch()}
          emptyTitle={all.length === 0 ? 'No incidents yet' : 'No incidents in this view'}
          emptyDescription="Incidents form automatically when similar complaints are reported close together."
          filtered={!!search}
          filteredTitle="No incidents match your search"
          onClearFilters={() => { setSearch(''); table.resetPage(); }}
          sort={table.sort}
          onSortChange={table.setSort}
          toolbar={<SearchInput label="Search incidents" value={search} onChange={(v) => { setSearch(v); table.resetPage(); }} placeholder="Search number, title, department…" />}
          storageKey="admin-incidents"
          columnMenu
          mobileCard={(i) => (
            <Link to={`/admin/incidents/${i.id}`} className="block px-4 py-3 hover:bg-slate-50">
              <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-slate-500">{i.incident_number}</span><PriorityBadge level={i.priority_level} /></div>
              <p className="mt-1 line-clamp-2 text-sm font-medium text-slate-800">{i.title}</p>
              <p className="mt-1 text-xs text-slate-500">{i.complaint_count} reports · {i.department_name || 'Unassigned'} · <DateCell value={i.created_at} relative /></p>
            </Link>
          )}
          pagination={{ ...table.pagination, noun: 'incidents' }}
          footer={q.data && q.data.total > FETCH_LIMIT ? <p className="border-t border-slate-100 px-4 py-2 text-xs text-amber-800">Showing the {FETCH_LIMIT} most recent of {formatNumber(q.data.total)} incidents.</p> : undefined}
        />
      </div>
    </div>
  );
}
