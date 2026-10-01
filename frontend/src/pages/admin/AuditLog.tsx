import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as platform from '../../services/platform.service';
import type { AuditRow } from '../../services/platform.service';
import { PdfButton } from '../../components/ui/PdfButton';
import { CsvButton } from '../../components/ui/CsvButton';
import { Modal } from '../../components/ui/Modal';
import { auditReport } from '../../utils/pdf';
import { PageHeader } from '../../components/ui/kit';
import { Badge } from '../../components/common/Badge';
import { DataTable, FilterChips, FilterSelect, RowActions, SearchInput, useDebouncedValue, useTableQueryState, type Column, type FilterChip } from '../../components/table';
import { DateCell } from '../../components/table/Cells';

const ENTITY_TYPES = ['complaint', 'incident', 'sla_policy', 'escalation', 'department', 'user', 'system'];
const EMPTY = { search: '', entity_type: '', action: '', entity_id: '', date_from: '', date_to: '' };

function Diff({ prev, next }: { prev: unknown; next: unknown }) {
  if (!prev && !next) return <p className="text-sm text-slate-500">No before/after values were recorded for this entry.</p>;
  return (
    <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
      {prev !== null && prev !== undefined && <div><p className="font-medium text-slate-500">Before</p><pre className="mt-1 max-h-72 overflow-auto rounded bg-slate-50 p-2 text-slate-700">{JSON.stringify(prev, null, 2)}</pre></div>}
      {next !== null && next !== undefined && <div><p className="font-medium text-slate-500">After</p><pre className="mt-1 max-h-72 overflow-auto rounded bg-slate-50 p-2 text-slate-700">{JSON.stringify(next, null, 2)}</pre></div>}
    </div>
  );
}

const actorLabel = (r: AuditRow) => (r.actor_name ? r.actor_name : r.actor_role === 'SYSTEM' ? 'System' : 'Unknown');

export default function AuditLog() {
  const [filters, setFilters] = useState(EMPTY);
  const t = useTableQueryState({ pageSize: 50 });
  const [viewing, setViewing] = useState<AuditRow | null>(null);
  const search = useDebouncedValue(filters.search);
  const applied = { ...filters, search };
  const order = t.sort?.order ?? 'desc';

  const q = useQuery({
    queryKey: ['audit', applied, t.page, t.pageSize, order],
    queryFn: () => platform.auditLogs({ ...Object.fromEntries(Object.entries(applied).filter(([, v]) => v)), order, page: t.page, limit: t.pageSize }),
    placeholderData: (p) => p,
  });
  const set = (k: keyof typeof EMPTY, v: string) => { setFilters((f) => ({ ...f, [k]: v })); t.resetPage(); };
  const clear = () => { setFilters(EMPTY); t.resetPage(); };

  const chips: FilterChip[] = ([
    ['entity_type', filters.entity_type && `Resource: ${filters.entity_type.replace('_', ' ')}`],
    ['action', filters.action && `Action: ${filters.action}`],
    ['entity_id', filters.entity_id && `ID: ${filters.entity_id}`],
    ['date_from', filters.date_from && `From ${filters.date_from}`],
    ['date_to', filters.date_to && `To ${filters.date_to}`],
  ] as [keyof typeof EMPTY, string | ''][]).filter(([, l]) => l).map(([k, label]) => ({ key: k, label, onRemove: () => set(k, '') }));

  const columns: Column<AuditRow>[] = [
    { id: 'when', header: 'Timestamp', sortKey: 'created_at', firstSort: 'asc', width: 'w-44', locked: true, cell: (r) => <DateCell value={r.created_at} /> },
    { id: 'actor', header: 'Actor', width: 'w-48', truncate: true, cell: (r) => <>{actorLabel(r)} {r.actor_role && r.actor_role !== 'SYSTEM' && <span className="text-xs text-slate-400">({r.actor_role})</span>}</> },
    { id: 'action', header: 'Action', cell: (r) => <span className="font-mono text-xs font-semibold text-slate-800">{r.action}</span> },
    { id: 'resource', header: 'Resource', hideBelow: 'md', width: 'w-40', cell: (r) => <span className="text-slate-600">{r.entity_type}{r.entity_id ? <span className="text-slate-400"> #{r.entity_id}</span> : ''}</span> },
    { id: 'changes', header: 'Changes', hint: 'Whether before/after values were recorded', hideBelow: 'lg', width: 'w-28', cell: (r) => (r.previous_value || r.new_value ? <Badge className="bg-slate-50 text-slate-700 border-slate-200">Recorded</Badge> : <span className="text-slate-400">—</span>) },
    { id: 'actions', header: '', width: 'w-24', align: 'right', locked: true, cell: (r) => <RowActions label={`${r.action} entry ${r.id}`} primary={{ label: 'Details', onClick: () => setViewing(r) }} /> },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Audit log"
        description="Who did what, when, and what changed. Secrets are never stored; values shown are sanitised."
        actions={
          <>
            <CsvButton label="Export page (CSV)" filename={`audit-log-${new Date().toISOString().slice(0, 10)}.csv`} rows={q.data?.rows} columns={[{ header: 'When', value: (r) => r.created_at }, { header: 'Actor', value: (r) => r.actor_name ?? r.actor_role }, { header: 'Role', value: (r) => r.actor_role }, { header: 'Action', value: (r) => r.action }, { header: 'Entity', value: (r) => r.entity_type }, { header: 'Entity ID', value: (r) => r.entity_id }, { header: 'Before', value: (r) => (r.previous_value ? JSON.stringify(r.previous_value) : '') }, { header: 'After', value: (r) => (r.new_value ? JSON.stringify(r.new_value) : '') }]} />
            <PdfButton label="Export page (PDF)" disabled={!q.data?.rows.length} build={() => auditReport(`${q.data!.total} matching entries; showing page ${t.page}. Filters: ${chips.map((c) => c.label).join(', ') || 'none'}.`, q.data!.rows)} />
          </>
        }
      />
      <div className="mt-4">
        <DataTable<AuditRow>
          caption="Audit log"
          columns={columns}
          rows={q.data?.rows}
          rowKey={(r) => r.id}
          isLoading={q.isLoading}
          isFetching={q.isFetching}
          error={q.error}
          errorTitle="Unable to load the audit log"
          onRetry={() => q.refetch()}
          emptyTitle="No audit entries yet"
          emptyDescription="Administrative and system actions are recorded here."
          filtered={chips.length > 0 || !!filters.search}
          filteredTitle="No audit entries match your filters"
          onClearFilters={clear}
          sort={t.sort}
          onSortChange={t.setSort}
          toolbar={<SearchInput label="Search audit log" value={filters.search} onChange={(v) => set('search', v)} placeholder="Search actor, action or resource…" />}
          filterBar={
            <>
              <div className="flex flex-wrap items-center gap-2">
                <FilterSelect label="Entity type" allLabel="All resources" value={filters.entity_type} onChange={(v) => set('entity_type', v)} options={ENTITY_TYPES.map((x) => ({ value: x, label: x.replace('_', ' ') }))} />
                <input aria-label="Action" className="input !w-52 !py-1.5 text-xs" placeholder="Action, e.g. STATUS_CHANGED" value={filters.action} onChange={(e) => set('action', e.target.value.toUpperCase())} />
                <input aria-label="Entity id" className="input !w-28 !py-1.5 text-xs" placeholder="Entity ID" value={filters.entity_id} onChange={(e) => set('entity_id', e.target.value)} />
                <label className="flex items-center gap-1 text-xs text-slate-500">From <input type="date" aria-label="From date" className="input !w-auto !py-1.5 text-xs" value={filters.date_from} onChange={(e) => set('date_from', e.target.value)} /></label>
                <label className="flex items-center gap-1 text-xs text-slate-500">To <input type="date" aria-label="To date" className="input !w-auto !py-1.5 text-xs" value={filters.date_to} onChange={(e) => set('date_to', e.target.value)} /></label>
              </div>
              <FilterChips chips={chips} onClearAll={clear} />
            </>
          }
          mobileCard={(r) => (
            <button type="button" className="block w-full px-4 py-3 text-left hover:bg-slate-50" onClick={() => setViewing(r)}>
              <p className="font-mono text-xs font-semibold text-slate-800">{r.action}</p>
              <p className="mt-0.5 text-xs text-slate-500">{r.entity_type}{r.entity_id ? ` #${r.entity_id}` : ''} · {actorLabel(r)}</p>
              <p className="mt-0.5 text-xs text-slate-400"><DateCell value={r.created_at} /></p>
            </button>
          )}
          pagination={{ page: t.page, pageSize: t.pageSize, total: q.data?.total ?? 0, onPage: t.setPage, onPageSize: t.setPageSize, noun: 'entries' }}
        />
      </div>

      <Modal open={!!viewing} title={viewing ? `${viewing.action} · ${viewing.entity_type}${viewing.entity_id ? ` #${viewing.entity_id}` : ''}` : ''} onClose={() => setViewing(null)} wide>
        {viewing && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-600">{actorLabel(viewing)}{viewing.actor_role ? ` (${viewing.actor_role})` : ''} · <DateCell value={viewing.created_at} /></p>
            <Diff prev={viewing.previous_value} next={viewing.new_value} />
          </div>
        )}
      </Modal>
    </div>
  );
}
