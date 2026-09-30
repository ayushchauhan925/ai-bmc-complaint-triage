import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as platform from '../../services/platform.service';
import { getErrorMessage } from '../../services/api';
import { PageHeader, QueryBoundary, Tabs, PageSkeleton, CardSkeleton, InsufficientData, fmtDate, fmtRemaining, pct } from '../../components/ui/kit';
import { PriorityBadge, SlaBadge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { PRIORITY_LEVELS, formatCategory } from '../../utils/constants';

type Tab = 'sla' | 'escalations' | 'policies';
const RULE_LABEL: Record<string, string> = {
  SLA_APPROACHING: 'SLA warning', SLA_BREACHED: 'SLA breached', HIGH_SEVERITY_UNASSIGNED: 'No officer assigned',
  REPEATED_COMPLAINTS: 'Recurring problem', MAJOR_INCIDENT: 'Major incident',
};
const ruleLabel = (r: string) => RULE_LABEL[r] ?? r.replace(/^SURGE_/, 'Surge: ').replace(/_/g, ' ').toLowerCase();
const SEV_CLS: Record<string, string> = { CRITICAL: 'border-red-200 bg-red-100 text-red-800', HIGH: 'border-orange-200 bg-orange-100 text-orange-800', MEDIUM: 'border-amber-200 bg-amber-100 text-amber-800' };

function SlaTab() {
  const q = useQuery({ queryKey: ['sla'], queryFn: platform.slaOverview, refetchInterval: 60_000 });
  const [sort, setSort] = useState<'deadline' | 'priority'>('deadline');
  return (
    <QueryBoundary query={q} skeleton={<PageSkeleton />}>
      {(s) => {
        const rank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        const rows = [...s.atRisk].sort((a, b) => sort === 'priority' ? rank[a.priority_level] - rank[b.priority_level] : (a.sla.remainingMs ?? 0) - (b.sla.remainingMs ?? 0));
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([['On track', s.summary.ON_TRACK, 'text-green-700'], ['Warning', s.summary.APPROACHING, 'text-amber-700'], ['Breached', s.summary.BREACHED, 'text-red-700']] as const).map(([l, v, c]) => (
                <div key={l} className="card p-4"><p className="text-xs uppercase tracking-wide text-slate-400">{l}</p><p className={`mt-1 text-2xl font-semibold ${c}`}>{v}</p></div>
              ))}
              <div className="card p-4"><p className="text-xs uppercase tracking-wide text-slate-400">Met SLA (resolved)</p><p className="mt-1 text-2xl font-semibold text-slate-900">{s.resolved.compliance === null ? '—' : pct(s.resolved.compliance)}</p><p className="text-[11px] text-slate-400">{s.resolved.withinSla} on time · {s.resolved.afterSla} late</p></div>
            </div>
            <div className="card overflow-x-auto p-0">
              <div className="flex items-center justify-between px-4 py-3">
                <h2 className="text-sm font-semibold text-slate-800">Needs attention ({rows.length})</h2>
                <label className="text-xs text-slate-500">Sort <select className="input ml-1 inline-block w-auto !py-1" value={sort} onChange={(e) => setSort(e.target.value as 'deadline' | 'priority')}><option value="deadline">Time remaining</option><option value="priority">Priority</option></select></label>
              </div>
              {rows.length === 0 ? <div className="p-6"><EmptyState title="Nothing at risk" description="No open complaint is approaching or past its SLA." /></div> : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Complaint', 'Priority', 'Department', 'Deadline', 'Time', 'SLA'].map((h) => <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                  <tbody>{rows.map((c) => (
                    <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2"><Link to={`/complaints/${c.id}`} className="font-mono text-xs font-medium text-brand-600 hover:underline">{c.complaint_number}</Link><span className="block text-xs text-slate-500">{formatCategory(c.category)}</span></td>
                      <td className="px-3 py-2"><PriorityBadge level={c.priority_level} /></td>
                      <td className="px-3 py-2 text-slate-600">{c.department_name || 'Unassigned'}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{fmtDate(c.sla_deadline)}</td>
                      <td className={`px-3 py-2 text-xs font-medium ${c.sla.breached ? 'text-red-700' : 'text-amber-700'}`}>{fmtRemaining(c.sla.remainingMs)}</td>
                      <td className="px-3 py-2"><SlaBadge status={c.sla_status} /></td>
                    </tr>))}</tbody>
                </table>
              )}
            </div>
          </div>
        );
      }}
    </QueryBoundary>
  );
}

function EscalationsTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState('OPEN');
  const q = useQuery({ queryKey: ['escalations', status], queryFn: () => platform.escalations(status || undefined), refetchInterval: 60_000 });
  const ack = useMutation({ mutationFn: platform.acknowledgeEscalation, onSuccess: () => { qc.invalidateQueries({ queryKey: ['escalations'] }); qc.invalidateQueries({ queryKey: ['overview'] }); } });
  const run = useMutation({ mutationFn: platform.runEscalations, onSuccess: () => qc.invalidateQueries({ queryKey: ['escalations'] }) });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5" role="group" aria-label="Filter by status">
          {[['OPEN', 'Open'], ['ACKNOWLEDGED', 'Acknowledged'], ['RESOLVED', 'Resolved'], ['', 'All']].map(([v, l]) => (
            <button key={v} aria-pressed={status === v} onClick={() => setStatus(v)} className={`rounded-full border px-3 py-1 text-xs font-medium ${status === v ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>{l}</button>
          ))}
        </div>
        <button className="btn-secondary !py-1.5 text-xs" disabled={run.isPending} onClick={() => run.mutate()}>{run.isPending ? 'Evaluating…' : 'Evaluate rules now'}</button>
      </div>
      {run.isError && <p role="alert" className="text-xs text-red-600">{getErrorMessage(run.error)}</p>}
      <QueryBoundary query={q} skeleton={<CardSkeleton lines={4} />}>
        {({ events }) => events.length === 0 ? <EmptyState title="No escalations" description="Rules run automatically every few minutes: SLA, unassigned high-severity, recurring problems, major incidents and demand surges." /> : (
          <ul className="space-y-2">
            {events.map((e) => (
              <li key={e.id} className="card flex flex-wrap items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`badge border ${SEV_CLS[e.severity] ?? 'border-slate-200 bg-slate-100 text-slate-700'}`}>{e.severity}</span>
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{ruleLabel(e.rule_code)}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-800">{e.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {fmtDate(e.created_at)}{e.department_name ? ` · ${e.department_name}` : ''}
                    {e.complaint_id && <> · <Link className="text-brand-600 hover:underline" to={`/complaints/${e.complaint_id}`}>{e.complaint_number}</Link></>}
                    {e.incident_id && <> · <Link className="text-brand-600 hover:underline" to={`/admin/incidents/${e.incident_id}`}>{e.incident_number}</Link></>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge border border-slate-200 bg-slate-100 text-slate-600">{e.status.toLowerCase()}</span>
                  {e.status === 'OPEN' && <button className="btn-secondary !py-1 text-xs" disabled={ack.isPending} onClick={() => ack.mutate(e.id)}>Acknowledge</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </QueryBoundary>
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
          <table className="mt-3 w-full text-left text-sm">
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
