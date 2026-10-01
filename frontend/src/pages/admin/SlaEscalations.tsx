import React, { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as platform from '../../services/platform.service';
import { getErrorMessage } from '../../services/api';
import { PageHeader, QueryBoundary, Tabs, PageSkeleton, CardSkeleton, fmtRemaining, pct } from '../../components/ui/kit';
import { PdfButton } from '../../components/ui/PdfButton';
import { CsvButton } from '../../components/ui/CsvButton';
import { slaReport } from '../../utils/pdf';
import { Badge, PriorityBadge, SeverityBadge, SlaBadge } from '../../components/common/Badge';
import { PRIORITY_LEVELS, formatCategory, formatStatus } from '../../utils/constants';
import { DataTable, RowActions, useClientTable, type Column } from '../../components/table';
import { DateCell } from '../../components/table/Cells';

type Tab = 'sla' | 'escalations' | 'policies';
const RULE_LABEL: Record<string, string> = {
  SLA_APPROACHING: 'SLA warning', SLA_BREACHED: 'SLA breached', HIGH_SEVERITY_UNASSIGNED: 'No officer assigned',
  REPEATED_COMPLAINTS: 'Recurring problem', MAJOR_INCIDENT: 'Major incident',
};
const ruleLabel = (r: string) => RULE_LABEL[r] ?? r.replace(/^SURGE_/, 'Surge: ').replace(/_/g, ' ').toLowerCase();
const SEV_CLS: Record<string, string> = { CRITICAL: 'border-red-200 bg-red-100 text-red-800', HIGH: 'border-orange-200 bg-orange-100 text-orange-800', MEDIUM: 'border-amber-200 bg-amber-100 text-amber-800' };

type AtRisk = Awaited<ReturnType<typeof platform.slaOverview>>['atRisk'][number];
type Escalation = Awaited<ReturnType<typeof platform.escalations>>['events'][number];
const RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function AtRiskTable({ s }: { s: Awaited<ReturnType<typeof platform.slaOverview>> }) {
  const rows = s.atRisk;
  // Default order (most urgent first) comes from the server's remaining time; column sort overrides it.
  const ordered = [...rows].sort((x, y) => (x.sla.remainingMs ?? 0) - (y.sla.remainingMs ?? 0));
  const table = useClientTable(ordered, {
    complaint: (c) => c.complaint_number, priority: (c) => RANK[c.priority_level], department: (c) => c.department_name,
    deadline: (c) => (c.sla_deadline ? new Date(c.sla_deadline.replace(' ', 'T')).getTime() : null), remaining: (c) => c.sla.remainingMs,
  });
  const columns: Column<AtRisk>[] = [
    { id: 'complaint', header: 'Complaint', sortKey: 'complaint', locked: true, cell: (c) => <><Link to={`/complaints/${c.id}`} className="font-mono text-xs font-medium text-brand-700 hover:underline">{c.complaint_number}</Link><span className="block text-xs text-slate-500">{formatCategory(c.category)}</span></> },
    { id: 'priority', header: 'Priority', sortKey: 'priority', width: 'w-24', cell: (c) => <PriorityBadge level={c.priority_level} /> },
    { id: 'department', header: 'Department', sortKey: 'department', hideBelow: 'md', truncate: true, cell: (c) => c.department_name || <span className="text-slate-400">Unassigned</span> },
    { id: 'deadline', header: 'Deadline', sortKey: 'deadline', hideBelow: 'lg', width: 'w-44', cell: (c) => <DateCell value={c.sla_deadline} /> },
    { id: 'remaining', header: 'Remaining', hint: 'Time left (or overdue) against the SLA deadline', sortKey: 'remaining', width: 'w-32', cell: (c) => <span className={`text-xs font-medium ${c.sla.breached ? 'text-red-700' : 'text-amber-700'}`}>{fmtRemaining(c.sla.remainingMs)}</span> },
    { id: 'sla', header: 'SLA', width: 'w-28', cell: (c) => <SlaBadge status={c.sla_status} /> },
    { id: 'actions', header: '', width: 'w-20', align: 'right', locked: true, cell: (c) => <RowActions label={c.complaint_number} primary={{ label: 'View', to: `/complaints/${c.id}` }} /> },
  ];
  return (
    <DataTable<AtRisk>
      caption="Complaints approaching or past their SLA"
      columns={columns}
      rows={table.rows}
      rowKey={(c) => c.id}
      rowClassName={(c) => `row-${c.priority_level}`}
      emptyTitle="Nothing at risk"
      emptyDescription="No open complaint is approaching or past its SLA."
      sort={table.sort}
      onSortChange={table.setSort}
      toolbar={<h2 className="text-sm font-semibold text-slate-800">Needs attention ({rows.length})</h2>}
      toolbarActions={
        <>
          <CsvButton filename={`sla-at-risk-${new Date().toISOString().slice(0, 10)}.csv`} rows={ordered} columns={[{ header: 'Complaint ID', value: (c: AtRisk) => c.complaint_number }, { header: 'Category', value: (c: AtRisk) => c.category }, { header: 'Priority', value: (c: AtRisk) => c.priority_level }, { header: 'Department', value: (c: AtRisk) => c.department_name }, { header: 'SLA status', value: (c: AtRisk) => c.sla_status }, { header: 'Deadline', value: (c: AtRisk) => c.sla_deadline }, { header: 'Minutes remaining', value: (c: AtRisk) => (c.sla.remainingMs === null ? '' : Math.round(c.sla.remainingMs / 60000)) }]} />
          <PdfButton label="Export PDF" build={() => slaReport(s)} />
        </>
      }
      mobileCard={(c) => (
        <Link to={`/complaints/${c.id}`} className="block px-4 py-3 hover:bg-slate-50">
          <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-brand-700">{c.complaint_number}</span><PriorityBadge level={c.priority_level} /></div>
          <p className="mt-1 text-xs text-slate-500">{formatCategory(c.category)} · {c.department_name || 'Unassigned'}</p>
          <p className={`mt-1 text-xs font-medium ${c.sla.breached ? 'text-red-700' : 'text-amber-700'}`}>{fmtRemaining(c.sla.remainingMs)}</p>
        </Link>
      )}
      pagination={{ ...table.pagination, noun: 'complaints' }}
    />
  );
}

function SlaTab() {
  const q = useQuery({ queryKey: ['sla'], queryFn: platform.slaOverview, refetchInterval: 60_000 });
  return (
    <QueryBoundary query={q} skeleton={<PageSkeleton />}>
      {(s) => (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([['On track', s.summary.ON_TRACK, 'text-green-700'], ['Warning', s.summary.APPROACHING, 'text-amber-700'], ['Breached', s.summary.BREACHED, 'text-red-700']] as const).map(([l, v, c]) => (
              <div key={l} className="card p-4"><p className="text-xs uppercase tracking-wide text-slate-400">{l}</p><p className={`mt-1 text-2xl font-semibold ${c}`}>{v}</p></div>
            ))}
            <div className="card p-4"><p className="text-xs uppercase tracking-wide text-slate-400">Met SLA (resolved)</p><p className="mt-1 text-2xl font-semibold text-slate-900">{s.resolved.compliance === null ? '—' : pct(s.resolved.compliance)}</p><p className="text-[11px] text-slate-400">{s.resolved.withinSla} on time · {s.resolved.afterSla} late</p></div>
          </div>
          <AtRiskTable s={s} />
        </div>
      )}
    </QueryBoundary>
  );
}

function EscalationsTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('OPEN');
  const q = useQuery({ queryKey: ['escalations', status], queryFn: () => platform.escalations(status || undefined), refetchInterval: 60_000 });
  const ack = useMutation({ mutationFn: platform.acknowledgeEscalation, onSuccess: () => { qc.invalidateQueries({ queryKey: ['escalations'] }); qc.invalidateQueries({ queryKey: ['overview'] }); } });
  const run = useMutation({ mutationFn: platform.runEscalations, onSuccess: () => qc.invalidateQueries({ queryKey: ['escalations'] }) });
  const events = useMemo(() => q.data?.events ?? [], [q.data]);
  const table = useClientTable(events, {
    severity: (e) => RANK[e.severity], rule: (e) => ruleLabel(e.rule_code), title: (e) => e.title, department: (e) => e.department_name,
    raised: (e) => new Date(e.created_at.replace(' ', 'T')).getTime(), status: (e) => e.status,
  });
  const columns: Column<Escalation>[] = [
    { id: 'severity', header: 'Severity', sortKey: 'severity', width: 'w-24', cell: (e) => <SeverityBadge level={e.severity} /> },
    { id: 'rule', header: 'Rule', sortKey: 'rule', hideBelow: 'md', width: 'w-44', cell: (e) => <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{ruleLabel(e.rule_code)}</span> },
    { id: 'title', header: 'Escalation', sortKey: 'title', locked: true, truncate: true, cell: (e) => e.title },
    { id: 'resource', header: 'Resource', hideBelow: 'lg', width: 'w-40', cell: (e) => (
      <span className="whitespace-nowrap text-xs">
        {e.complaint_id && <Link className="text-brand-700 hover:underline" to={`/complaints/${e.complaint_id}`}>{e.complaint_number}</Link>}
        {e.incident_id && <Link className="ml-2 text-brand-700 hover:underline" to={`/admin/incidents/${e.incident_id}`}>{e.incident_number}</Link>}
        {!e.complaint_id && !e.incident_id && <span className="text-slate-400">—</span>}
      </span>
    ) },
    { id: 'department', header: 'Department', sortKey: 'department', hideBelow: 'xl', width: 'w-44', truncate: true, cell: (e) => e.department_name || <span className="text-slate-400">—</span> },
    { id: 'raised', header: 'Raised', sortKey: 'raised', firstSort: 'desc', hideBelow: 'md', width: 'w-40', cell: (e) => <DateCell value={e.created_at} relative /> },
    { id: 'status', header: 'Status', sortKey: 'status', width: 'w-32', cell: (e) => <Badge>{formatStatus(e.status)}</Badge> },
    { id: 'actions', header: '', width: 'w-32', align: 'right', locked: true, cell: (e) => (e.status === 'OPEN' ? <RowActions label={e.title} primary={{ label: 'Acknowledge', onClick: () => ack.mutate(e.id), disabled: ack.isPending }} /> : null) },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5" role="group" aria-label="Filter by status">
          {[['OPEN', 'Open'], ['ACKNOWLEDGED', 'Acknowledged'], ['RESOLVED', 'Resolved'], ['', 'All']].map(([v, l]) => (
            <button key={v} aria-pressed={status === v} onClick={() => { setStatus(v); table.resetPage(); }} className={`rounded-full border px-3 py-1 text-xs font-medium ${status === v ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{l}</button>
          ))}
        </div>
        <button className="btn-secondary !py-1.5 text-xs" disabled={run.isPending} onClick={() => run.mutate()}>{run.isPending ? 'Evaluating…' : 'Evaluate rules now'}</button>
      </div>
      {run.isError && <p role="alert" className="text-xs text-red-600">{getErrorMessage(run.error)}</p>}
      <DataTable<Escalation>
        caption="Escalations"
        columns={columns}
        rows={q.data ? table.rows : undefined}
        rowKey={(e) => e.id}
        isLoading={q.isLoading}
        isFetching={q.isFetching}
        error={q.error}
        errorTitle="Unable to load escalations"
        onRetry={() => q.refetch()}
        emptyTitle="No escalations"
        emptyDescription="Rules run automatically every few minutes: SLA, unassigned high-severity, recurring problems, major incidents and demand surges."
        filtered={status !== 'OPEN' && events.length === 0}
        filteredTitle={`No ${status ? status.toLowerCase() : ''} escalations`}
        onClearFilters={() => setStatus('OPEN')}
        sort={table.sort}
        onSortChange={table.setSort}
        pagination={{ ...table.pagination, noun: 'escalations' }}
      />
    </div>
  );
}

function PoliciesTab() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['sla'], queryFn: platform.slaOverview });
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  const save = useMutation({
    mutationFn: (v: { priority_level: string; target_hours: number }) => platform.saveSlaPolicy(v),
    onSuccess: () => { setMsg('Saved. New complaints use this target; existing complaints keep the target they were assigned.'); qc.invalidateQueries({ queryKey: ['sla'] }); },
    onError: (e) => setMsg(getErrorMessage(e)),
  });
  return (
    <QueryBoundary query={q} skeleton={<CardSkeleton />}>
      {(s) => (
        <div className="card p-4">
          <h2 className="text-sm font-semibold text-slate-800">SLA targets by priority</h2>
          <p className="mt-0.5 text-xs text-slate-500">Application targets used for deadlines and warnings — configurable, and every change is written to the audit log.</p>
          <table className="data-table data-table-compact mt-3">
            <thead className="text-xs text-slate-500"><tr><th className="py-1.5 font-medium">Priority</th><th className="py-1.5 font-medium">Target (hours)</th><th className="py-1.5 font-medium">Warn at</th><th /></tr></thead>
            <tbody>
              {PRIORITY_LEVELS.map((p) => {
                const pol = s.policies.find((x) => x.priority_level === p && x.category_key === '*');
                const val = edit[p] ?? String(pol?.target_hours ?? '');
                const dirty = pol && Number(val) !== pol.target_hours;
                return (
                  <tr key={p} className="border-t border-slate-100">
                    <td className="py-2"><PriorityBadge level={p} /></td>
                    <td className="py-2"><label className="sr-only" htmlFor={`sla-${p}`}>{p} target hours</label><input id={`sla-${p}`} type="number" min={1} max={2160} className="input w-28" value={val} onChange={(e) => setEdit((x) => ({ ...x, [p]: e.target.value }))} /></td>
                    <td className="py-2 text-slate-500">{pol ? pct(Number(pol.warning_pct)) : '—'} of window</td>
                    <td className="py-2 text-right"><button className="btn-primary !py-1 text-xs" disabled={!dirty || !Number.isInteger(Number(val)) || Number(val) < 1 || save.isPending} onClick={() => save.mutate({ priority_level: p, target_hours: Number(val) })}>Save</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {msg && <p role="status" className="mt-3 text-xs text-slate-600">{msg}</p>}
        </div>
      )}
    </QueryBoundary>
  );
}

export default function SlaEscalations() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'sla';
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title="SLA & escalations" description="Deadlines, warnings and rule-based escalations. All rules are deterministic and auditable." />
      <div className="mt-4"><Tabs<Tab> tabs={[{ id: 'sla', label: 'SLA monitor' }, { id: 'escalations', label: 'Escalations' }, { id: 'policies', label: 'Targets' }]} value={tab} onChange={(t) => setParams({ tab: t })} /></div>
      <div className="mt-4">{tab === 'sla' && <SlaTab />}{tab === 'escalations' && <EscalationsTab />}{tab === 'policies' && <PoliciesTab />}</div>
    </div>
  );
}
