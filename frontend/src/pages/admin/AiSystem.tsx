import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import * as platform from '../../services/platform.service';
import { getErrorMessage } from '../../services/api';
import { PageHeader, QueryBoundary, Tabs, PageSkeleton, CardSkeleton, InsufficientData, Meter, fmtDate, pct } from '../../components/ui/kit';
import { CHART_BRAND, CHART_GRID, CHART_AXIS_TEXT } from '../../utils/chartColors';

type Tab = 'quality' | 'cost' | 'system';
const AXIS = { fontSize: 11, fill: CHART_AXIS_TEXT };
const Metric = ({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) => (
  <div className="card p-4"><p className="text-xs uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>{hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}</div>
);

function Quality() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['ai-performance'], queryFn: platform.aiPerformance });
  const [last, setLast] = useState<platform.EvalResult | null>(null);
  const run = useMutation({ mutationFn: platform.runEvaluation, onSuccess: (r) => { setLast(r); qc.invalidateQueries({ queryKey: ['ai-performance'] }); } });
  return (
    <QueryBoundary query={q} skeleton={<PageSkeleton />}>
      {({ feedback: f, evaluations }) => (
        <div className="space-y-4">
          <section aria-labelledby="hf">
            <h2 id="hf" className="text-sm font-semibold text-slate-800">AI vs. staff decisions <span className="font-normal text-slate-400">— last {f.windowDays} days</span></h2>
            {!f.sufficientData ? (
              <div className="mt-2"><InsufficientData reason={`Only ${f.reviewedDecisions} staff-reviewed decision(s); at least ${f.minSample} are needed for meaningful rates. Approve or correct complaints from the review queue to build this up.`} /></div>
            ) : null}
            <div className="mt-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric label="Category accuracy" value={pct(f.classificationAccuracy)} hint={`${f.reviewedDecisions} reviewed`} />
              <Metric label="Priority agreement" value={pct(f.priorityAgreement)} />
              <Metric label="Routing agreement" value={pct(f.departmentRoutingAgreement)} />
              <Metric label="Correction rate" value={pct(f.correctionRate)} hint={`${f.falsePositives} false positive(s)`} />
              <Metric label="Duplicate precision" value={pct(f.duplicate.precision)} hint={`${f.duplicate.confirmed} confirmed · ${f.duplicate.rejected} rejected · ${f.duplicate.pendingSuggestions} pending`} />
              <Metric label="Avg confidence when right" value={pct(f.calibration.avgConfidenceWhenCorrect)} hint={`${f.calibration.samples} samples`} />
              <Metric label="Avg confidence when corrected" value={pct(f.calibration.avgConfidenceWhenCorrected)} />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">{f.note}</p>
          </section>

          <section className="card p-4" aria-labelledby="ev">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h2 id="ev" className="text-sm font-semibold text-slate-800">Evaluation suite</h2><p className="text-xs text-slate-500">Labelled cases run against routing, priority, duplicates, injection defence, output validation and image metrics.</p></div>
              <div className="flex gap-2">
                <button className="btn-primary !py-1.5 text-xs" disabled={run.isPending} onClick={() => run.mutate('deterministic')}>{run.isPending ? 'Running…' : 'Run offline suite'}</button>
                <button className="btn-secondary !py-1.5 text-xs" disabled={run.isPending} title="Calls the live model for classification and summaries (small cost)" onClick={() => { if (window.confirm('Run the live suite? This makes ~15 real AI calls.')) run.mutate('live'); }}>Run live suite</button>
              </div>
            </div>
            {run.isError && <p role="alert" className="mt-2 text-xs text-red-600">{getErrorMessage(run.error)}</p>}
            {last && (
              <table className="data-table data-table-compact mt-3">
                <thead className="text-xs text-slate-500"><tr><th className="py-1 font-medium">Task</th><th className="py-1 font-medium">Agreement</th><th className="py-1 font-medium w-1/3">Score</th></tr></thead>
                <tbody>{last.summary.map((s) => (
                  <tr key={s.task} className="border-t border-slate-100"><td className="py-1.5 capitalize">{s.task}</td>
                    <td className="py-1.5">{s.status === 'skipped' ? <span className="text-slate-400">skipped — {s.reason}</span> : `${s.agreed}/${s.total}`}</td>
                    <td className="py-1.5">{s.accuracy !== null && <Meter value={s.accuracy * 100} tone={s.accuracy >= 0.9 ? 'good' : s.accuracy >= 0.7 ? 'warn' : 'bad'} />}</td></tr>))}</tbody>
              </table>
            )}
            {evaluations.length > 0 && (
              <details className="mt-3 text-xs"><summary className="cursor-pointer text-slate-500">Previous runs ({evaluations.length})</summary>
                <ul className="mt-2 space-y-1">{evaluations.map((r) => <li key={r.runId} className="text-slate-600">{fmtDate(r.at)} · {r.mode} · {r.agreed}/{r.cases} agreed</li>)}</ul>
              </details>
            )}
          </section>

          <section className="card p-4">
            <h2 className="text-sm font-semibold text-slate-800">Confidence distribution of reviewed decisions</h2>
            {f.confidenceDistribution.length === 0 ? <div className="mt-2"><InsufficientData /></div> : (
              <div className="mt-3 h-44" role="img" aria-label="AI confidence distribution"><ResponsiveContainer width="100%" height="100%"><BarChart data={f.confidenceDistribution}><CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} /><XAxis dataKey="range" tick={AXIS} tickLine={false} axisLine={false} /><YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill={CHART_BRAND} radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
            )}
          </section>
        </div>
      )}
    </QueryBoundary>
  );
}

function Cost() {
  const [days, setDays] = useState(30);
  const q = useQuery({ queryKey: ['ai-usage', days], queryFn: () => platform.aiUsage(days) });
  return (
    <div className="space-y-4">
      <label className="text-xs text-slate-500">Window <select className="input ml-1 inline-block w-auto !py-1" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label>
      <QueryBoundary query={q} skeleton={<PageSkeleton />}>
        {(u) => u.totals.requests === 0 ? <InsufficientData reason="No AI calls recorded in this window." /> : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric label="AI requests" value={u.totals.requests} />
              <Metric label="Failure rate" value={pct(u.totals.failureRate)} hint={`${u.totals.failures} failed`} />
              <Metric label="Tokens" value={u.totals.totalTokens.toLocaleString()} />
              <Metric label="Estimated cost" value={`$${u.totals.estimatedCostUsd.toFixed(4)}`} hint="estimate, not billing" />
            </div>
            <div className="card overflow-x-auto p-0">
              <table className="data-table"><caption className="sr-only">AI usage by use case</caption>
                <thead className="bg-slate-50 text-xs text-slate-500"><tr>{['Use case', 'Requests', 'Failures', 'Tokens', 'Est. cost', 'Avg latency'].map((h) => <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody>{u.byUseCase.map((r, i) => (
                  <tr key={r.useCase} className="border-t border-slate-100"><td className="px-3 py-2 font-medium">{r.useCase.replace(/_/g, ' ')}{i === 0 && u.byUseCase.length > 1 && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">most expensive</span>}</td><td className="px-3 py-2">{r.requests}</td><td className="px-3 py-2">{r.failures} ({pct(r.failureRate)})</td><td className="px-3 py-2">{r.totalTokens.toLocaleString()}</td><td className="px-3 py-2">${r.estimatedCostUsd.toFixed(4)}</td><td className="px-3 py-2">{r.avgLatencyMs} ms</td></tr>))}</tbody>
              </table>
            </div>
            <div className="card p-4"><h3 className="text-sm font-semibold text-slate-800">Daily estimated cost</h3>
              <div className="mt-3 h-44" role="img" aria-label="Daily estimated AI cost"><ResponsiveContainer width="100%" height="100%"><BarChart data={u.daily.map((d) => ({ ...d, date: String(d.date).slice(5, 10) }))}><CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} /><XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} /><YAxis tick={AXIS} tickLine={false} axisLine={false} /><Tooltip /><Bar dataKey="estimatedCostUsd" name="Est. cost ($)" fill={CHART_BRAND} radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
            </div>
            <p className="text-[11px] text-slate-500">{u.costNote}</p>
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

function System() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['observability'], queryFn: platform.observability, refetchInterval: 30_000 });
  const job = useMutation({ mutationFn: platform.runJob, onSuccess: () => qc.invalidateQueries({ queryKey: ['observability'] }) });
  return (
    <QueryBoundary query={q} skeleton={<PageSkeleton />}>
      {(o) => {
        const routes = Object.entries(o.metrics.latency).filter(([k]) => k.startsWith('http ')).sort((a, b) => (b[1].p95Ms ?? 0) - (a[1].p95Ms ?? 0)).slice(0, 8);
        const errors = Object.entries(o.metrics.counters).filter(([k]) => k.startsWith('errors.'));
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric label="Database" value={<span className={o.database.ok ? 'text-green-700' : 'text-red-700'}>{o.database.ok ? '● Healthy' : '● Down'}</span>} hint={`${o.database.roundTripMs} ms round trip`} />
              <Metric label="AI service" value={o.ai.configured ? 'Configured' : 'Not configured'} hint={o.ai.last7Days ? `${o.ai.last7Days.requests} calls / 7 d · ${pct(o.ai.last7Days.failureRate)} failed` : undefined} />
              <Metric label="Uptime" value={`${Math.floor(o.metrics.uptimeSeconds / 3600)}h ${Math.floor((o.metrics.uptimeSeconds % 3600) / 60)}m`} hint="since last restart" />
              <Metric label="Notification channels" value={o.notifications.channels.join(', ')} />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="card overflow-x-auto p-0"><h3 className="px-4 pt-4 text-sm font-semibold text-slate-800">Slowest endpoints (p95)</h3>
                {routes.length === 0 ? <p className="p-4 text-sm text-slate-400">No traffic recorded yet.</p> : (
                  <table className="data-table data-table-compact mt-2"><thead className="text-slate-500"><tr><th className="px-4 py-1 font-medium">Route</th><th className="px-2 py-1 font-medium">Calls</th><th className="px-2 py-1 font-medium">p50</th><th className="px-2 py-1 font-medium">p95</th></tr></thead>
                    <tbody>{routes.map(([k, v]) => <tr key={k} className="border-t border-slate-100"><td className="max-w-[16rem] truncate px-4 py-1.5 font-mono" title={k}>{k.replace('http ', '')}</td><td className="px-2 py-1.5">{v.count}</td><td className="px-2 py-1.5">{v.p50Ms} ms</td><td className="px-2 py-1.5">{v.p95Ms} ms</td></tr>)}</tbody></table>
                )}
              </div>
              <div className="card p-4"><h3 className="text-sm font-semibold text-slate-800">Errors since restart</h3>
                {errors.length === 0 ? <p className="mt-2 text-sm text-green-700">✓ None recorded.</p> : <ul className="mt-2 text-sm">{errors.map(([k, v]) => <li key={k} className="flex justify-between border-b border-slate-100 py-1"><span>{k.replace('errors.', '')}</span><span className="font-medium">{v}</span></li>)}</ul>}
                {o.metrics.recentErrors.length > 0 && <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-500">{o.metrics.recentErrors.slice(0, 8).map((e, i) => <li key={i}><span className="font-medium text-slate-700">[{e.kind}]</span> {e.message} <span className="text-slate-400">{fmtDate(e.at)}</span></li>)}</ul>}
              </div>
            </div>

            <div className="card p-4">
              <h3 className="text-sm font-semibold text-slate-800">Background jobs {!o.jobs.enabled && <span className="ml-2 text-xs font-normal text-amber-700">(scheduler disabled on this instance)</span>}</h3>
              <ul className="mt-3 divide-y divide-slate-100">
                {o.jobs.definitions.map((d) => {
                  const lastRun = o.jobs.recentRuns.find((r) => r.job_name === d.name);
                  return (
                    <li key={d.name} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                      <div><span className="font-medium">{d.name.replace(/_/g, ' ')}</span><span className="ml-2 text-xs text-slate-400">every {d.everyMinutes} min</span>
                        <p className="text-xs text-slate-500">{lastRun ? <>Last run {fmtDate(lastRun.started_at)} · {lastRun.status === 'SUCCESS' ? '✓ success' : `✕ failed: ${lastRun.error_message}`} · {lastRun.duration_ms} ms</> : 'No runs recorded yet'}</p></div>
                      <button className="btn-secondary !py-1 text-xs" disabled={job.isPending || d.running} onClick={() => job.mutate(d.name)}>{d.running ? 'Running…' : 'Run now'}</button>
                    </li>
                  );
                })}
              </ul>
            </div>
            <p className="text-[11px] text-slate-500">{o.note}</p>
          </div>
        );
      }}
    </QueryBoundary>
  );
}

export default function AiSystem() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'quality';
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title="AI performance & system health" description="How accurate, how expensive and how reliable the intelligence layer is." />
      <div className="mt-4"><Tabs<Tab> tabs={[{ id: 'quality', label: 'AI quality' }, { id: 'cost', label: 'Usage & cost' }, { id: 'system', label: 'System health' }]} value={tab} onChange={(t) => setParams({ tab: t })} /></div>
      <div className="mt-4">{tab === 'quality' && <Quality />}{tab === 'cost' && <Cost />}{tab === 'system' && <System />}</div>
    </div>
  );
}
