import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as adminService from '../../services/admin.service';
import * as platform from '../../services/platform.service';
import { PriorityBadge, StatusBadge, CategoryBadge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { PdfButton } from '../../components/ui/PdfButton';
import { CsvButton } from '../../components/ui/CsvButton';
import { complaintListReport } from '../../utils/pdf';
import { PageHeader, QueryBoundary, CardSkeleton } from '../../components/ui/kit';
import { CATEGORIES, COMPLAINT_STATUSES, PRIORITY_LEVELS, SLA_STATUSES, formatStatus, formatCategory } from '../../utils/constants';
import type { Complaint } from '../../utils/types';
import {
  DataTable, FilterChips, FilterSelect, RowActions, SearchInput, useDebouncedValue, useTableQueryState,
  type Column, type FilterChip,
} from '../../components/table';
import { ComplaintIdCell, DateCell, Dash, SlaCell } from '../../components/table/Cells';

const EMPTY = { search: '', status: '', category: '', priority_level: '', sla_status: '', department_id: '', incident_id: '', citizen: '', date_from: '', date_to: '' };
type Filters = typeof EMPTY;

const csvColumns = [
  { header: 'Complaint ID', value: (c: Complaint) => c.complaint_number },
  { header: 'Category', value: (c: Complaint) => c.category },
  { header: 'Priority', value: (c: Complaint) => c.priority_level },
  { header: 'Status', value: (c: Complaint) => c.status },
  { header: 'SLA', value: (c: Complaint) => c.sla_status },
  { header: 'SLA deadline', value: (c: Complaint) => c.sla_deadline },
  { header: 'Department', value: (c: Complaint) => c.department_name },
  { header: 'Ward', value: (c: Complaint) => c.ward_name },
  { header: 'Incident', value: (c: Complaint) => c.incident_id },
  { header: 'Address', value: (c: Complaint) => c.address },
  { header: 'Reported', value: (c: Complaint) => c.created_at },
  { header: 'Resolved', value: (c: Complaint) => c.resolved_at },
];

function MobileCard({ c }: { c: Complaint }) {
  return (
    <Link to={`/complaints/${c.id}`} className="block px-4 py-3 hover:bg-slate-50">
      <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-brand-700">{c.complaint_number}</span><PriorityBadge level={c.priority_level} /></div>
      <p className="mt-1 text-sm font-medium text-slate-800">{formatCategory(c.category)}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5"><StatusBadge status={c.status} /><SlaCell status={c.sla_status} deadline={c.sla_deadline} open={!['RESOLVED', 'REJECTED', 'CLOSED'].includes(c.status)} /></div>
      <p className="mt-1 text-xs text-slate-500">{c.department_name || 'Unassigned'} · <DateCell value={c.created_at} relative /></p>
    </Link>
  );
}

export default function AdminComplaints() {
  const [params] = useSearchParams();
  const t = useTableQueryState({ pageSize: 25 });
  const [semantic, setSemantic] = useState(false);
  const [filters, setFilters] = useState<Filters>({ ...EMPTY, category: params.get('category') || '', department_id: params.get('department_id') || '' });
  const [selected, setSelected] = useState<Map<string | number, Complaint>>(new Map());
  const search = useDebouncedValue(filters.search);
  const departments = useQuery({ queryKey: ['departments'], queryFn: adminService.listDepartments });

  // Only the search box is debounced; dropdowns and dates apply immediately.
  const applied = useMemo(() => ({ ...filters, search }), [filters, search]);
  const requestFilters = Object.fromEntries(Object.entries(applied).filter(([, v]) => v !== ''));

  const list = useQuery({
    queryKey: ['admin-complaints', applied, t.page, t.pageSize, t.sort],
    queryFn: () => adminService.listComplaints({ page: t.page, limit: t.pageSize, sort: t.sort?.key, order: t.sort?.order, ...requestFilters } as any),
    enabled: !semantic,
    placeholderData: (p) => p,
  });
  const sem = useQuery({
    queryKey: ['semantic-search', search],
    queryFn: () => platform.semanticSearch(search),
    enabled: semantic && search.trim().length >= 3,
  });

  const set = (k: keyof Filters, v: string) => { t.resetPage(); setFilters((f) => ({ ...f, [k]: v })); };
  const clear = () => { t.resetPage(); setFilters(EMPTY); };
  const deptName = (id: string) => departments.data?.find((d) => String(d.id) === id)?.name ?? `Department ${id}`;

  const chips: FilterChip[] = ([
    ['status', filters.status && formatStatus(filters.status)],
    ['category', filters.category && formatCategory(filters.category)],
    ['priority_level', filters.priority_level && `${formatStatus(filters.priority_level)} priority`],
    ['sla_status', filters.sla_status && `SLA: ${formatStatus(filters.sla_status)}`],
    ['department_id', filters.department_id && deptName(filters.department_id)],
    ['citizen', filters.citizen && `Citizen: ${filters.citizen}`],
    ['incident_id', filters.incident_id && `Incident #${filters.incident_id}`],
    ['date_from', filters.date_from && `From ${filters.date_from}`],
    ['date_to', filters.date_to && `To ${filters.date_to}`],
  ] as [keyof Filters, string | ''][]).filter(([, label]) => label).map(([k, label]) => ({ key: k, label, onRemove: () => set(k, '') }));
  const anyActive = chips.length > 0 || !!filters.search;
  const secondaryActive = !!(filters.citizen || filters.incident_id || filters.date_from || filters.date_to);
  const [moreOpen, setMoreOpen] = useState(false);
  const showMore = moreOpen || secondaryActive;

  const columns: Column<Complaint>[] = [
    { id: 'id', header: 'Complaint', sortKey: 'complaint_number', width: 'w-40', locked: true, cell: (c) => <ComplaintIdCell id={c.id} number={c.complaint_number} review={c.review_required} /> },
    { id: 'category', header: 'Category', sortKey: 'category', truncate: true, maxWidth: 'max-w-[11rem]', cell: (c) => <CategoryBadge category={c.category} />, tooltip: (c) => formatCategory(c.category) },
    { id: 'priority', header: 'Priority', sortKey: 'priority', firstSort: 'desc', width: 'w-24', cell: (c) => <PriorityBadge level={c.priority_level} /> },
    { id: 'status', header: 'Status', sortKey: 'status', width: 'w-32', cell: (c) => <StatusBadge status={c.status} /> },
    { id: 'sla', header: 'SLA', hint: 'Service-level agreement: time left to resolve', sortKey: 'sla_deadline', width: 'w-44', cell: (c) => <SlaCell status={c.sla_status} deadline={c.sla_deadline} open={!['RESOLVED', 'REJECTED', 'CLOSED'].includes(c.status)} /> },
    { id: 'department', header: 'Department', sortKey: 'department', hideBelow: 'lg', truncate: true, maxWidth: 'max-w-[12rem]', cell: (c) => c.department_name || <span className="text-slate-400">Unassigned</span> },
    { id: 'ward', header: 'Ward', hideBelow: 'xl', defaultHidden: true, cell: (c) => c.ward_name || <Dash /> },
    { id: 'location', header: 'Location', hideBelow: 'xl', defaultHidden: true, truncate: true, cell: (c) => c.address || '—' },
    { id: 'incident', header: 'Incident', hint: 'Linked incident cluster, if any', hideBelow: '2xl', width: 'w-28', cell: (c) => (c.incident_id ? <Link className="text-xs text-violet-700 hover:underline" to={`/admin/incidents/${c.incident_id}`}>#{c.incident_id}</Link> : <Dash />) },
    { id: 'created', header: 'Reported', sortKey: 'created_at', firstSort: 'desc', width: 'w-32', hideBelow: 'md', cell: (c) => <DateCell value={c.created_at} relative /> },
    { id: 'updated', header: 'Updated', sortKey: 'updated_at', firstSort: 'desc', width: 'w-40', hideBelow: 'xl', defaultHidden: true, cell: (c) => <DateCell value={c.updated_at} relative /> },
    {
      id: 'actions', header: 'Actions', width: 'w-32', align: 'right', locked: true,
      cell: (c) => (
        <RowActions
          label={c.complaint_number}
          primary={{ label: 'View', to: `/complaints/${c.id}` }}
          items={[
            { label: 'Assign or change status', to: `/complaints/${c.id}` },
            ...(c.incident_id ? [{ label: `Open incident #${c.incident_id}`, to: `/admin/incidents/${c.incident_id}` }] : []),
            { label: 'Copy complaint ID', onClick: () => { void navigator.clipboard?.writeText(c.complaint_number); } },
          ]}
        />
      ),
    },
  ];

  const filterBar = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect label="Status" allLabel="All statuses" value={filters.status} onChange={(v) => set('status', v)} options={COMPLAINT_STATUSES.map((s) => ({ value: s, label: formatStatus(s) }))} />
        <FilterSelect label="Category" allLabel="All categories" value={filters.category} onChange={(v) => set('category', v)} options={CATEGORIES.map((c) => ({ value: c, label: formatCategory(c) }))} />
        <FilterSelect label="Priority" allLabel="All priorities" value={filters.priority_level} onChange={(v) => set('priority_level', v)} options={PRIORITY_LEVELS.map((p) => ({ value: p, label: formatStatus(p) }))} />
        <FilterSelect label="SLA" allLabel="Any SLA state" value={filters.sla_status} onChange={(v) => set('sla_status', v)} options={SLA_STATUSES.map((s) => ({ value: s, label: formatStatus(s) }))} />
        <FilterSelect label="Department" allLabel="All departments" value={filters.department_id} onChange={(v) => set('department_id', v)} options={(departments.data ?? []).map((d) => ({ value: String(d.id), label: d.name }))} />
        <button type="button" className="text-xs font-medium text-brand-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" aria-expanded={showMore} onClick={() => setMoreOpen((o) => !o)}>{showMore ? 'Fewer filters' : 'More filters'}</button>
      </div>
      {showMore && (
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Citizen" className="input !w-40 !py-1.5 text-xs" placeholder="Citizen name/email" value={filters.citizen} onChange={(e) => set('citizen', e.target.value)} />
        <input aria-label="Incident ID" className="input !w-28 !py-1.5 text-xs" type="number" min={1} placeholder="Incident ID" value={filters.incident_id} onChange={(e) => set('incident_id', e.target.value)} />
        <label className="flex items-center gap-1 text-xs text-slate-500">From <input type="date" aria-label="From date" className="input !w-auto !py-1.5 text-xs" value={filters.date_from} onChange={(e) => set('date_from', e.target.value)} /></label>
        <label className="flex items-center gap-1 text-xs text-slate-500">To <input type="date" aria-label="To date" className="input !w-auto !py-1.5 text-xs" value={filters.date_to} onChange={(e) => set('date_to', e.target.value)} /></label>
      </div>
      )}
      <FilterChips chips={chips} onClearAll={clear} />
    </>
  );

  const searchBox = (
    <>
      <SearchInput label="Search" value={filters.search} onChange={(v) => set('search', v)} placeholder={semantic ? 'Describe what you are looking for…' : 'Search ID, text or address…'} />
      <label className="flex items-center gap-1.5 text-xs text-slate-600" title="Match by meaning instead of exact words (uses AI embeddings)">
        <input type="checkbox" checked={semantic} onChange={(e) => setSemantic(e.target.checked)} /> Semantic search
      </label>
    </>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Complaints"
        description="Search by text, ID, location, citizen, incident, department, status, SLA or date."
        actions={!semantic && (
          <>
            <CsvButton label="Export page (CSV)" filename={`complaints-${new Date().toISOString().slice(0, 10)}.csv`} rows={list.data?.rows} columns={csvColumns} />
            <PdfButton label="Export page (PDF)" disabled={!list.data?.rows.length} build={() => complaintListReport('Complaints', `${list.data!.total} matching complaint(s); showing page ${t.page}. Filters: ${chips.map((c) => c.label).join(', ') || 'none'}.`, list.data!.rows)} />
          </>
        )}
      />

      <div className="mt-4">
        {semantic ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">{searchBox}</div>
            {search.trim().length < 3 ? <EmptyState title="Type at least 3 characters" description="Semantic search finds complaints that mean the same thing, even with different wording." /> : (
              <QueryBoundary query={sem} skeleton={<CardSkeleton lines={4} />}>
                {(r) => (
                  <div className="card">
                    {r.mode === 'keyword' && <p role="note" className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">AI search is unavailable right now — showing keyword matches instead.</p>}
                    {r.results.length === 0 ? <div className="p-6"><EmptyState title="No matches" /></div> : (
                      <ul className="divide-y divide-slate-100">
                        {r.results.map((c) => (
                          <li key={c.id}><Link to={`/complaints/${c.id}`} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                            <div className="min-w-0"><p className="text-sm"><span className="font-mono text-xs text-brand-700">{c.complaint_number}</span> <span className="ml-1 font-medium text-slate-800">{c.ai_title || formatCategory(c.category)}</span></p><p className="line-clamp-2 text-xs text-slate-500">{c.description}</p></div>
                            <div className="flex shrink-0 flex-col items-end gap-1"><PriorityBadge level={c.priority_level} />{c.similarity !== null && <span className="text-[11px] text-slate-400">{Math.round(c.similarity * 100)}% match</span>}</div>
                          </Link></li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </QueryBoundary>
            )}
          </>
        ) : (
          <DataTable<Complaint>
            caption="Complaints"
            columns={columns}
            rows={list.data?.rows}
            rowKey={(c) => c.id}
            rowClassName={(c) => `row-${c.priority_level}`}
            isLoading={list.isLoading}
            isFetching={list.isFetching}
            error={list.error}
            errorTitle="Unable to load complaints"
            onRetry={() => list.refetch()}
            emptyTitle="No complaints yet"
            emptyDescription="Complaints submitted by citizens will appear here."
            filtered={anyActive}
            filteredTitle="No complaints match your current filters"
            onClearFilters={clear}
            sort={t.sort}
            onSortChange={t.setSort}
            selection={selected}
            onSelectionChange={setSelected}
            bulkActions={(rows) => (
              <CsvButton label={`Export ${rows.length} selected (CSV)`} filename={`complaints-selected-${new Date().toISOString().slice(0, 10)}.csv`} rows={rows} columns={csvColumns} />
            )}
            toolbar={searchBox}
            filterBar={filterBar}
            storageKey="admin-complaints"
            columnMenu
            densityToggle
            mobileCard={(c) => <MobileCard c={c} />}
            pagination={{ page: t.page, pageSize: t.pageSize, total: list.data?.total ?? 0, onPage: t.setPage, onPageSize: t.setPageSize, noun: 'complaints' }}
          />
        )}
      </div>
    </div>
  );
}
