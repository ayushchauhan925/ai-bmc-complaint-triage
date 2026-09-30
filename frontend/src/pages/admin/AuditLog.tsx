import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as platform from '../../services/platform.service';
import { PdfButton } from '../../components/ui/PdfButton';
import { CsvButton } from '../../components/ui/CsvButton';
import { auditReport } from '../../utils/pdf';
import { PageHeader, QueryBoundary, CardSkeleton, fmtDate } from '../../components/ui/kit';
import { EmptyState } from '../../components/common/EmptyState';

const ENTITY_TYPES = ['complaint', 'incident', 'sla_policy', 'escalation', 'system'];

function Diff({ prev, next }: { prev: unknown; next: unknown }) {
  if (!prev && !next) return null;
  return (
    <div className="mt-2 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
      {prev !== null && prev !== undefined && <div><p className="font-medium text-slate-500">Before</p><pre className="mt-0.5 overflow-x-auto rounded bg-slate-50 p-2 text-slate-700">{JSON.stringify(prev, null, 1)}</pre></div>}
      {next !== null && next !== undefined && <div><p className="font-medium text-slate-500">After</p><pre className="mt-0.5 overflow-x-auto rounded bg-slate-50 p-2 text-slate-700">{JSON.stringify(next, null, 1)}</pre></div>}
    </div>
  );
}

export default function AuditLog() {
  const [filters, setFilters] = useState({ entity_type: '', action: '', entity_id: '' });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<number | null>(null);
  const q = useQuery({ queryKey: ['audit', filters, page], queryFn: () => platform.auditLogs({ ...filters, page, limit: 30 }), placeholderData: (p) => p });
  const set = (k: string, v: string) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Audit log"
        description="Who did what, when, and what changed. Secrets are never stored; values shown are sanitised."
        actions={<><CsvButton label="Export page (CSV)" filename={`audit-log-${new Date().toISOString().slice(0, 10)}.csv`} rows={q.data?.rows} columns={[{ header: 'When', value: (r) => r.created_at }, { header: 'Actor', value: (r) => r.actor_name ?? r.actor_role }, { header: 'Role', value: (r) => r.actor_role }, { header: 'Action', value: (r) => r.action }, { header: 'Entity', value: (r) => r.entity_type }, { header: 'Entity ID', value: (r) => r.entity_id }, { header: 'Before', value: (r) => (r.previous_value ? JSON.stringify(r.previous_value) : '') }, { header: 'After', value: (r) => (r.new_value ? JSON.stringify(r.new_value) : '') }]} /><PdfButton label="Export page (PDF)" disabled={!q.data?.rows.length} build={() => auditReport(`${q.data!.total} matching entries; showing page ${page}. Filters: ${Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(', ') || 'none'}.`, q.data!.rows)} /></>}
      />
      <div className="mt-4 flex flex-wrap gap-2">
        <select aria-label="Entity type" className="input w-auto" value={filters.entity_type} onChange={(e) => set('entity_type', e.target.value)}>
          <option value="">All entities</option>{ENTITY_TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
        </select>
        <input aria-label="Action" className="input w-48" placeholder="Action, e.g. STATUS_CHANGED" value={filters.action} onChange={(e) => set('action', e.target.value.toUpperCase())} />
        <input aria-label="Entity id" className="input w-32" placeholder="Entity ID" value={filters.entity_id} onChange={(e) => set('entity_id', e.target.value)} />
      </div>
      <div className="mt-4">
        <QueryBoundary query={q} skeleton={<CardSkeleton lines={6} />}>
          {(d) => d.rows.length === 0 ? <EmptyState title="No audit entries" description="Nothing matches these filters." /> : (
            <>
              <ul className="card divide-y divide-slate-100">
                {d.rows.map((r) => (
                  <li key={r.id} className="px-4 py-3">
                    <button className="flex w-full flex-wrap items-center justify-between gap-2 text-left" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>
                      <span className="text-sm"><span className="font-mono text-xs font-semibold text-slate-800">{r.action}</span><span className="ml-2 text-slate-500">{r.entity_type}{r.entity_id ? ` #${r.entity_id}` : ''}</span></span>
                      <span className="text-xs text-slate-400">{r.actor_name ? `${r.actor_name} (${r.actor_role})` : r.actor_role === 'SYSTEM' ? 'System' : 'Unknown'} · {fmtDate(r.created_at)}</span>
                    </button>
                    {open === r.id && <Diff prev={r.previous_value} next={r.new_value} />}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>{d.total} entries</span>
                <div className="flex gap-2"><button className="btn-secondary !py-1 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button><span className="self-center">Page {d.page}</span><button className="btn-secondary !py-1 text-xs" disabled={d.page * d.limit >= d.total} onClick={() => setPage((p) => p + 1)}>Next</button></div>
              </div>
            </>
          )}
        </QueryBoundary>
      </div>
    </div>
  );
}
