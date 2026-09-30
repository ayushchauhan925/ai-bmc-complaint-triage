import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ReferenceLine } from 'recharts';
import * as platform from '../../services/platform.service';
import { PageHeader, QueryBoundary, Tabs, PageSkeleton, InsufficientData, fmtDate } from '../../components/ui/kit';
import { CsvButton } from '../../components/ui/CsvButton';
import { EmptyState } from '../../components/common/EmptyState';
import { CHART_GRID, CHART_AXIS_TEXT } from '../../utils/chartColors';
import { formatCategory } from '../../utils/constants';

type Tab = 'recurring' | 'impact';
const AXIS = { fontSize: 11, fill: CHART_AXIS_TEXT };

function RecurringTab() {
  const [days, setDays] = useState(180);
  const q = useQuery({ queryKey: ['recurring', days], queryFn: () => platform.recurring(days) });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-slate-500">Places where the same kind of complaint was <strong>fixed and then reported again</strong> within ~{q.data?.radiusMeters ?? 150} m. These are candidates for a lasting repair rather than another patch.</p>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500">Look back <select className="input ml-1 inline-block w-auto !py-1" value={days} onChange={(e) => setDays(Number(e.target.value))}><option value={90}>90 days</option><option value={180}>6 months</option><option value={365}>1 year</option></select></label>
          <CsvButton filename="recurring-problems.csv" rows={q.data?.problems} columns={[{ header: 'Category', value: (p) => p.category }, { header: 'Landmark', value: (p) => p.landmark }, { header: 'Latitude', value: (p) => p.location.latitude }, { header: 'Longitude', value: (p) => p.location.longitude }, { header: 'Reports', value: (p) => p.reports }, { header: 'Interventions (resolved)', value: (p) => p.interventions }, { header: 'Reported again after fix', value: (p) => p.recurredAfterResolution }, { header: 'Reopenings', value: (p) => p.reopenings }, { header: 'Open now', value: (p) => p.openNow }, { header: 'Status', value: (p) => p.status }]} />
        </div>
      </div>
      <QueryBoundary query={q} skeleton={<PageSkeleton />}>
        {({ problems }) => problems.length === 0 ? (
          <EmptyState title="No recurring problems found" description="Nothing has been resolved and then reported again at the same place in this period - or there is not enough history yet." />
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="data-table">
              <caption className="sr-only">Recurring problems</caption>
              <thead><tr>{['Problem', 'Reports', 'Incidents', 'Fixes', 'Back after fix', 'Open now', 'Status', ''].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
              <tbody>
                {problems.map((p) => (
                  <tr key={p.id} className={p.status === 'ACTIVE' ? 'row-HIGH' : 'row-LOW'}>
                    <td>
                      <p className="font-medium text-slate-900">{formatCategory(p.category)}</p>
                      <p className="text-xs text-slate-500">{p.landmark || `${p.location.latitude.toFixed(4)}, ${p.location.longitude.toFixed(4)}`} · ~{p.location.radiusMeters} m</p>
                      <p className="text-[11px] text-slate-400">{fmtDate(p.firstReportedAt)} → {fmtDate(p.latestReportedAt)}</p>
                    </td>
                    <td className="font-semibold">{p.reports}</td>
                    <td>{p.incidents}</td>
                    <td>{p.interventions}</td>
                    <td className="font-semibold text-amber-700">{p.recurredAfterResolution}{p.reopenings > 0 && <span className="ml-1 text-[11px] font-normal text-slate-400">({p.reopenings} reopened)</span>}</td>
                    <td>{p.openNow}</td>
                    <td><span className={`badge border ${p.status === 'ACTIVE' ? 'border-orange-200 bg-orange-100 text-orange-800' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>{p.status === 'ACTIVE' ? 'Active' : 'Quiet'}</span></td>
                    <td><Link className="text-xs font-medium text-brand-600 hover:underline" to={`/admin/map?focus=${p.location.latitude},${p.location.longitude}&category=${p.category}`}>Map →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}

function ImpactTab() {
  const [win, setWin] = useState(30);
  const q = useQuery({ queryKey: ['effectiveness', win], queryFn: () => platform.effectiveness(win) });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-slate-500">For each place that was fixed: complaints of the same kind in the <strong>{win} days before</strong> the fix versus the <strong>{win} days after</strong>.</p>
        <label className="text-xs text-slate-500">Window <select className="input ml-1 inline-block w-auto !py-1" value={win} onChange={(e) => setWin(Number(e.target.value))}><option value={14}>14 days</option><option value={30}>30 days</option><option value={60}>60 days</option></select></label>
      </div>
      <QueryBoundary query={q} skeleton={<PageSkeleton />}>
        {(d) => (
          <>
            <div role="note" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900"><strong>Observed comparison only.</strong> {d.caveat}</div>
            {d.locationsEvaluated === 0 ? (
              <InsufficientData reason={`Needs resolved locations with at least ${d.minBefore} earlier reports and a full ${win}-day follow-up period. None qualify yet.`} />
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {[['Locations compared', d.locationsEvaluated], ['Fewer complaints after', d.summary.reducedCount], ['No change', d.summary.unchangedCount], ['More complaints after', d.summary.increasedCount]].map(([l, v]) => (
                    <div key={String(l)} className="card p-4"><p className="text-xs uppercase tracking-wide text-slate-400">{l}</p><p className="mt-1 text-2xl font-semibold text-slate-900">{v}</p></div>
                  ))}
                </div>
                <p className="text-sm text-slate-600">Median change: <strong>{d.summary.medianChangePct === null ? '-' : `${d.summary.medianChangePct > 0 ? '+' : ''}${d.summary.medianChangePct}%`}</strong> in complaints per location.</p>

                <div className="card p-4">
                  <h3 className="text-sm font-semibold text-slate-800">Change per location <span className="font-normal text-slate-400">(negative = fewer complaints after the fix)</span></h3>
                  <div className="mt-3 h-64" role="img" aria-label="Percentage change in complaints after resolution, per location">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={d.results.slice(0, 15).map((r) => ({ name: `${formatCategory(r.category)} ${r.location.latitude.toFixed(3)}`, change: r.changePct }))} layout="vertical" margin={{ left: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
                        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} unit="%" />
                        <YAxis dataKey="name" type="category" width={150} tick={AXIS} tickLine={false} axisLine={false} />
                        <Tooltip formatter={(v) => `${v}%`} />
                        <ReferenceLine x={0} stroke="#94a3b8" />
                        <Bar dataKey="change" name="Change">
                          {d.results.slice(0, 15).map((r) => <Cell key={r.id} fill={r.changePct <= 0 ? '#16a34a' : '#ea580c'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card overflow-x-auto p-0">
                  <table className="data-table">
                    <caption className="sr-only">Before and after comparison per location</caption>
                    <thead><tr>{['Location', 'Fixed on', 'Before', 'After', 'Observed change', ''].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
                    <tbody>
                      {d.results.map((r) => (
                        <tr key={r.id}>
                          <td><p className="font-medium text-slate-900">{formatCategory(r.category)}</p><p className="text-xs text-slate-500">{r.location.latitude.toFixed(4)}, {r.location.longitude.toFixed(4)} · {r.resolvedComplaints} resolved</p></td>
                          <td>{fmtDate(r.resolvedAt)}</td>
                          <td>{r.before}</td>
                          <td>{r.after}</td>
                          <td className={`font-semibold ${r.changePct < 0 ? 'text-green-700' : r.changePct > 0 ? 'text-orange-700' : 'text-slate-600'}`}>{r.changePct > 0 ? '▲ +' : r.changePct < 0 ? '▼ ' : '= '}{r.changePct}%</td>
                          <td><Link className="text-xs font-medium text-brand-600 hover:underline" to={`/admin/map?focus=${r.location.latitude},${r.location.longitude}&category=${r.category}`}>Map →</Link></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </QueryBoundary>
    </div>
  );
}

export default function Recurring() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'recurring';
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader title="Recurring problems & resolution impact" description="Which problems keep coming back, and what happened to complaint volumes after a fix." />
      <div className="mt-4"><Tabs<Tab> tabs={[{ id: 'recurring', label: 'Recurring problems' }, { id: 'impact', label: 'Resolution impact' }]} value={tab} onChange={(t) => setParams({ tab: t })} /></div>
      <div className="mt-4">{tab === 'recurring' ? <RecurringTab /> : <ImpactTab />}</div>
    </div>
  );
}
