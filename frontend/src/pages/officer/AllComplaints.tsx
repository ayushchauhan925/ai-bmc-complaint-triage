import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAssigned } from '../../services/officer.service';
import { ComplaintCard } from '../../components/complaint/ComplaintCard';
import { PageHeader } from '../../components/ui/kit';
import { CsvButton } from '../../components/ui/CsvButton';
import { PriorityBadge, StatusBadge, CategoryBadge } from '../../components/common/Badge';
import { COMPLAINT_STATUSES, PRIORITY_LEVELS, formatStatus } from '../../utils/constants';
import type { Complaint } from '../../utils/types';
import { DataTable, FilterChips, FilterSelect, RowActions, SearchInput, useDebouncedValue, useTableQueryState, type Column, type FilterChip } from '../../components/table';
import { ComplaintIdCell, DateCell, SlaCell } from '../../components/table/Cells';

export default function OfficerAllComplaints() {
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const t = useTableQueryState({ pageSize: 25 });
  const debounced = useDebouncedValue(search);

  const q = useQuery({
    queryKey: ['officer-all', status, priority, debounced, t.page, t.pageSize, t.sort],
    queryFn: () => listAssigned({ page: t.page, limit: t.pageSize, status: status || undefined, priority_level: priority || undefined, search: debounced || undefined, sort: t.sort?.key, order: t.sort?.order }),
    placeholderData: (p) => p,
  });

  const clear = () => { setStatus(''); setPriority(''); setSearch(''); t.resetPage(); };
  const chips: FilterChip[] = [
    ...(status ? [{ key: 'status', label: formatStatus(status), onRemove: () => { setStatus(''); t.resetPage(); } }] : []),
    ...(priority ? [{ key: 'priority', label: `${formatStatus(priority)} priority`, onRemove: () => { setPriority(''); t.resetPage(); } }] : []),
  ];

  const columns: Column<Complaint>[] = [
    { id: 'complaint', header: 'Complaint', sortKey: 'complaint_number', locked: true, truncate: true, cell: (c) => (<><ComplaintIdCell id={c.id} number={c.complaint_number} review={c.review_required} /><span className="block max-w-xs truncate text-xs text-slate-500">{c.ai_title || c.description}</span></>) },
    { id: 'category', header: 'Category', sortKey: 'category', hideBelow: 'lg', width: 'w-44', cell: (c) => <CategoryBadge category={c.category} /> },
    { id: 'priority', header: 'Priority', sortKey: 'priority', firstSort: 'desc', width: 'w-24', cell: (c) => <PriorityBadge level={c.priority_level} /> },
    { id: 'status', header: 'Status', sortKey: 'status', width: 'w-32', cell: (c) => <StatusBadge status={c.status} /> },
    { id: 'sla', header: 'SLA', sortKey: 'sla_deadline', width: 'w-44', cell: (c) => <SlaCell status={c.sla_status} deadline={c.sla_deadline} open={!['RESOLVED', 'REJECTED', 'CLOSED'].includes(c.status)} /> },
    { id: 'location', header: 'Location', hideBelow: 'xl', truncate: true, defaultHidden: true, cell: (c) => c.address || '—' },
    { id: 'reported', header: 'Reported', sortKey: 'created_at', firstSort: 'desc', hideBelow: 'md', width: 'w-40', cell: (c) => <DateCell value={c.created_at} relative /> },
    { id: 'actions', header: '', width: 'w-20', align: 'right', locked: true, cell: (c) => <RowActions label={c.complaint_number} primary={{ label: 'Open', to: `/complaints/${c.id}` }} /> },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Department complaints"
        description="Everything routed to your department, including resolved and closed items."
        actions={<CsvButton label="Export page (CSV)" filename="department-complaints.csv" rows={q.data?.rows} columns={[{ header: 'Complaint ID', value: (c: Complaint) => c.complaint_number }, { header: 'Category', value: (c: Complaint) => c.category }, { header: 'Priority', value: (c: Complaint) => c.priority_level }, { header: 'Status', value: (c: Complaint) => c.status }, { header: 'SLA', value: (c: Complaint) => c.sla_status }, { header: 'SLA deadline', value: (c: Complaint) => c.sla_deadline }, { header: 'Address', value: (c: Complaint) => c.address }, { header: 'Reported', value: (c: Complaint) => c.created_at }]} />}
      />

      <div className="mt-5">
        <DataTable<Complaint>
          caption="Department complaints"
          columns={columns}
          rows={q.data?.rows}
          rowKey={(c) => c.id}
          rowClassName={(c) => `row-${c.priority_level}`}
          isLoading={q.isLoading}
          isFetching={q.isFetching}
          error={q.error}
          errorTitle="Unable to load complaints"
          onRetry={() => q.refetch()}
          emptyTitle="No complaints for your department yet"
          emptyDescription="New complaints routed to your department will appear here."
          filtered={chips.length > 0 || !!search}
          filteredTitle="No complaints match your filters"
          onClearFilters={clear}
          sort={t.sort}
          onSortChange={t.setSort}
          toolbar={
            <>
              <SearchInput label="Search" value={search} onChange={(v) => { setSearch(v); t.resetPage(); }} placeholder="Search ID, text, location…" />
              <FilterSelect label="Status" allLabel="All statuses" value={status} onChange={(v) => { setStatus(v); t.resetPage(); }} options={COMPLAINT_STATUSES.map((s) => ({ value: s, label: formatStatus(s) }))} />
              <FilterSelect label="Priority" allLabel="All priorities" value={priority} onChange={(v) => { setPriority(v); t.resetPage(); }} options={PRIORITY_LEVELS.map((p) => ({ value: p, label: formatStatus(p) }))} />
            </>
          }
          filterBar={<FilterChips chips={chips} onClearAll={clear} />}
          storageKey="officer-complaints"
          columnMenu
          mobileCard={(c) => <ComplaintCard complaint={c} variant="staff" />}
          pagination={{ page: t.page, pageSize: t.pageSize, total: q.data?.total ?? 0, onPage: t.setPage, onPageSize: t.setPageSize, noun: 'complaints' }}
        />
      </div>
    </div>
  );
}
