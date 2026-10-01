import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend } from 'recharts';
import * as platform from '../../services/platform.service';
import { PageHeader, QueryBoundary, Tabs, InsufficientData, CardSkeleton, PageSkeleton, fmtDate, pct } from '../../components/ui/kit';
import { CHART_BRAND, CHART_GRID, CHART_AXIS_TEXT } from '../../utils/chartColors';
import { formatCategory } from '../../utils/constants';
import { RefreshIcon } from '../../components/common/Icons';
import { DataTable, RowActions, useClientTable, formatDecimal, formatNumber, type Column } from '../../components/table';

const AXIS = { fontSize: 11, fill: CHART_AXIS_TEXT };
type Tab = 'anomalies' | 'forecast' | 'workload';

/* ------------------------------------------------------------ Anomalies */
function AnomalyCenter() {
  const q = useQuery({ queryKey: ['anomalies'], queryFn: () => platform.anomalies(), refetchInterval: 120_000 });
  return (
    <QueryBoundary query={q} skeleton={<CardSkeleton lines={5} />}>
      {(r) => !r.sufficientData ? (
        <InsufficientData reason={r.notes[0]} />
      ) : r.anomalies.length === 0 ? (
        <div className="card p-6 text-center"><p className="text-sm font-medium text-green-700">✓ No anomalies detected</p><p className="mt-1 text-xs text-slate-500">Complaint activity over the last 24 h is within the normal range of the previous {r.baselineDaysAvailable} days.</p></div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Compared with the previous {r.baselineDaysAvailable} days using a robust statistical baseline. Scores ≥ 3 with a meaningful absolute count are flagged. Generated {fmtDate(r.generatedAt)}.</p>
          {r.anomalies.map((a, i) => {
            const base = a.baseline.median;
            const change = base > 0 ? `+${Math.round(((a.observed - base) / base) * 100)}%` : 'new';
            return (
              <article key={i} className="card border-l-4 border-l-red-500 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold tracking-wide text-red-900">{a.label}</h3>
                    <p className="mt-0.5 text-sm text-slate-600">{a.subject}</p>
                  </div>
                  <div className="text-right"><p className="text-2xl font-semibold text-red-700">{change}</p><p className="text-[11px] text-slate-400">vs typical day</p></div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
                  <div><dt className="text-xs text-slate-500">Baseline (median)</dt><dd className="font-medium">{a.baseline.median}{a.dimension === 'resolution_time' ? ' h' : '/day'}</dd></div>
                  <div><dt className="text-xs text-slate-500">Observed (24 h)</dt><dd className="font-medium">{a.observed}{a.dimension === 'resolution_time' ? ' h' : ''}</dd></div>
                  <div><dt className="text-xs text-slate-500">Anomaly score</dt><dd className="font-medium">{a.score}</dd></div>
                  <div><dt className="text-xs text-slate-500">Baseline window</dt><dd className="font-medium">{a.baseline.days} days</dd></div>
                </dl>
                <p className="mt-2 text-xs text-slate-500">{a.explanation}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  {a.location && <Link className="font-medium text-brand-600 hover:underline" to={`/admin/map?focus=${a.location.latitude},${a.location.longitude}`}>Show on map →</Link>}
                  {a.category && <Link className="font-medium text-brand-600 hover:underline" to={`/admin/complaints?category=${a.category}`}>Supporting complaints →</Link>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </QueryBoundary>
  );
}

/* ------------------------------------------------------------- Forecast */
function ForecastChart({ m, title }: { m: platform.ForecastModel; title: string }) {
  if (!m.available) return <div className="card p-4"><h3 className="text-sm font-semibold text-slate-800">{title}</h3><div className="mt-3"><InsufficientData reason={m.reason} /></div></div>;
  const hist = m.history.slice(-30).map((h) => ({ date: h.date.slice(5, 10), actual: h.value } as Record<string, number | string | [number, number] | undefined>));
  const fut = (m.forecast ?? []).map((f) => {
    const d = new Date(); d.setDate(d.getDate() + f.step);
    return { date: d.toISOString().slice(5, 10), forecast: f.value, band: [f.lower, f.upper] as [number, number] };
  });
  const data = [...hist, ...fut];
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <div className="mt-3 h-52" role="img" aria-label={`${title}: recent history and ${m.horizonDays}-day forecast`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip />
            <Area dataKey="band" name="Likely range (~80%)" stroke="none" fill={CHART_BRAND} fillOpacity={0.15} />
            <Line dataKey="actual" name="Actual" stroke={CHART_BRAND} strokeWidth={2} dot={false} />
            <Line dataKey="forecast" name="Forecast" stroke="#7c3aed" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 2 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        {m.method} · {m.historyDays} days of history.
        {m.backtest ? ` Backtest: model error ${m.backtest.maeModel} vs naive ${m.backtest.maeNaive} per day${m.backtest.beatsNaive ? '' : ' (no better than a simple average — treat with caution)'}.` : ' Not enough history for a backtest.'}
      </p>
    </div>
  );
}

function ForecastCenter() {
  const q = useQuery({ queryKey: ['forecast'], queryFn: platform.forecast });
  return (
    <QueryBoundary query={q} skeleton={<PageSkeleton />}>
      {(f) => {
        // Resource intelligence: expected volume over the horizon vs the recent equivalent period.
        const demand = f.categories.filter((c) => c.available && c.forecast).map((c) => {
          const next = c.forecast!.reduce((s, x) => s + x.value, 0);
          const recent = c.history.slice(-(f.horizonDays)).reduce((s, x) => s + x.value, 0);
          return { category: c.category, next: Math.round(next), recent, change: recent > 0 ? (next - recent) / recent : null };
        }).sort((a, b) => b.next - a.next);
        return (
          <div className="space-y-4">
            <p className="text-xs text-slate-500">{f.note}</p>
            <ForecastChart m={f.overall} title="Daily complaint volume" />
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-slate-800">Expected demand — next {f.horizonDays} days</h3>
              {demand.length === 0 ? <div className="mt-3"><InsufficientData reason="No category has enough history to forecast." /></div> : (
                <div className="mt-3"><DemandTable demand={demand} days={f.horizonDays} /></div>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ForecastChart m={f.unresolved} title="Unresolved backlog" />
              {f.categories.slice(0, 2).map((c) => <ForecastChart key={c.category} m={c} title={`${formatCategory(c.category)} complaints`} />)}
              {f.departments.slice(0, 2).map((d) => <ForecastChart key={d.departmentId} m={d} title={`${d.department} — incoming`} />)}
            </div>
          </div>
        );
      }}
    </QueryBoundary>
  );
}

type Demand = { category: string; next: number; recent: number; change: number | null };
function DemandTable({ demand, days }: { demand: Demand[]; days: number }) {
  const table = useClientTable(demand, { category: (d) => formatCategory(d.category), next: (d) => d.next, recent: (d) => d.recent, change: (d) => d.change });
  const columns: Column<Demand>[] = [
    { id: 'category', header: 'Category', sortKey: 'category', locked: true, cell: (d) => formatCategory(d.category) },
    { id: 'next', header: 'Expected', hint: `Forecast complaints over the next ${days} days`, sortKey: 'next', firstSort: 'desc', width: 'w-28', align: 'right', cell: (d) => <span className="font-medium">{formatNumber(d.next)}</span> },
    { id: 'recent', header: `Previous ${days} days`, sortKey: 'recent', firstSort: 'desc', width: 'w-36', align: 'right', cell: (d) => <span className="text-slate-500">{formatNumber(d.recent)}</span> },
    { id: 'change', header: 'Change', sortKey: 'change', firstSort: 'desc', width: 'w-28', align: 'right', cell: (d) => (d.change === null ? '—' : `${d.change > 0 ? '▲' : d.change < 0 ? '▼' : '='} ${Math.abs(Math.round(d.change * 100))}%`) },
  ];
  return <DataTable<Demand> bare caption="Expected demand by category" columns={columns} rows={table.rows} rowKey={(d) => d.category} emptyTitle="No forecast" sort={table.sort} onSortChange={table.setSort} pagination={{ ...table.pagination, noun: 'categories' }} />;
}

type Dept = Awaited<ReturnType<typeof platform.departmentWorkload>>['departments'][number];
function WorkloadTable({ departments, dept, setDept }: { departments: Dept[]; dept: number | undefined; setDept: (id: number | undefined) => void }) {
  const rows = departments.filter((d) => d.assigned > 0);
  const arrow = { UP: '▲ Up', DOWN: '▼ Down', FLAT: '= Flat', NEW: '▲ New' } as const;
  const table = useClientTable(rows, {
    department: (d) => d.department, pending: (d) => d.pending, overdue: (d) => d.overdue, high: (d) => d.pendingHighPriority, resolved: (d) => d.resolved,
    avg: (d) => d.avgResolutionHours, sla: (d) => d.slaCompliance, incoming: (d) => d.incoming7d,
  });
  const columns: Column<Dept>[] = [
    { id: 'department', header: 'Department', sortKey: 'department', locked: true, truncate: true, cell: (d) => <span className="font-medium text-slate-800">{d.department}</span> },
    { id: 'pending', header: 'Pending', sortKey: 'pending', firstSort: 'desc', width: 'w-24', align: 'right', cell: (d) => formatNumber(d.pending) },
    { id: 'overdue', header: 'Overdue', sortKey: 'overdue', firstSort: 'desc', width: 'w-24', align: 'right', cell: (d) => <span className={d.overdue ? 'font-semibold text-red-700' : ''}>{formatNumber(d.overdue)}{d.overdue ? ' ⚠' : ''}</span> },
    { id: 'high', header: 'High priority', hint: 'Pending complaints with high or critical priority', sortKey: 'high', firstSort: 'desc', hideBelow: 'md', width: 'w-32', align: 'right', cell: (d) => formatNumber(d.pendingHighPriority) },
    { id: 'resolved', header: 'Resolved', sortKey: 'resolved', firstSort: 'desc', hideBelow: 'md', width: 'w-24', align: 'right', cell: (d) => formatNumber(d.resolved) },
    { id: 'avg', header: 'Avg resolution', sortKey: 'avg', hideBelow: 'lg', width: 'w-36', align: 'right', cell: (d) => (d.avgResolutionHours === null ? '—' : `${formatDecimal(d.avgResolutionHours, 1)} h`) },
    { id: 'sla', header: 'SLA compliance', hint: 'Share of judged complaints resolved within SLA', sortKey: 'sla', firstSort: 'desc', hideBelow: 'lg', width: 'w-36', align: 'right', cell: (d) => (d.slaCompliance === null ? <span className="text-slate-400">no data</span> : pct(d.slaCompliance)) },
    { id: 'incoming', header: 'Incoming 7d', sortKey: 'incoming', firstSort: 'desc', hideBelow: 'xl', width: 'w-32', align: 'right', cell: (d) => <>{formatNumber(d.incoming7d)} <span className="text-xs text-slate-400">{arrow[d.incomingTrend]}</span></> },
    { id: 'actions', header: '', width: 'w-32', align: 'right', locked: true, cell: (d) => <RowActions label={d.department} primary={{ label: dept === d.departmentId ? 'Hide trend' : 'View trend', onClick: () => setDept(dept === d.departmentId ? undefined : d.departmentId) }} /> },
  ];
  return (
    <DataTable<Dept>
      caption="Department workload"
      columns={columns}
      rows={table.rows}
      rowKey={(d) => d.departmentId}
      rowClassName={(d) => (dept === d.departmentId ? 'row-selected' : undefined)}
      emptyTitle="No department has assigned complaints yet"
      sort={table.sort}
      onSortChange={table.setSort}
      pagination={{ ...table.pagination, noun: 'departments' }}
    />
  );
}

/* ------------------------------------------------------------- Workload */
function WorkloadCenter() {
  const [dept, setDept] = useState<number | undefined>();
  const q = useQuery({ queryKey: ['workload', dept], queryFn: () => platform.departmentWorkload(dept) });
  const arrow = { UP: '▲ Up', DOWN: '▼ Down', FLAT: '= Flat', NEW: '▲ New' } as const;
  return (
    <QueryBoundary query={q} skeleton={<PageSkeleton />}>
      {({ departments, trend }) => (
        <div className="space-y-4">
          <WorkloadTable departments={departments} dept={dept} setDept={setDept} />
          <p className="text-xs text-slate-500">SLA compliance counts complaints already judged (resolved on time / late, or currently overdue). Select a department to drill down.</p>

          {dept && (() => {
            const d = departments.find((x) => x.departmentId === dept);
            if (!d) return null;
            const days = new Map<string, { date: string; Incoming: number; Resolved: number }>();
            trend?.incoming.forEach((r) => days.set(String(r.date).slice(0, 10), { date: String(r.date).slice(5, 10), Incoming: Number(r.count), Resolved: 0 }));
            trend?.resolved.forEach((r) => { const k = String(r.date).slice(0, 10); const e = days.get(k) ?? { date: String(r.date).slice(5, 10), Incoming: 0, Resolved: 0 }; e.Resolved = Number(r.count); days.set(k, e); });
            const series = [...days.entries()].sort().map(([, v]) => v);
            return (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="card p-4">
                  <h3 className="text-sm font-semibold text-slate-800">{d.department}: incoming vs resolved (30 days)</h3>
                  <div className="mt-3 h-52" role="img" aria-label="Daily incoming and resolved complaints">
                    <ResponsiveContainer width="100%" height="100%"><BarChart data={series}><CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} /><XAxis dataKey="date" tick={AXIS} tickLine={false} axisLine={false} /><YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} /><Tooltip /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="Incoming" fill={CHART_BRAND} /><Bar dataKey="Resolved" fill="#16a34a" /></BarChart></ResponsiveContainer>
                  </div>
                </div>
                <div className="card p-4">
                  <h3 className="text-sm font-semibold text-slate-800">Category mix</h3>
                  <ul className="mt-3 space-y-1.5 text-sm">
                    {d.categoryDistribution.slice(0, 8).map((c) => (
                      <li key={c.category} className="flex items-center justify-between"><span>{formatCategory(c.category)}</span><span className="font-medium">{c.count}</span></li>
                    ))}
                  </ul>
                  <Link to={`/admin/complaints?department_id=${d.departmentId}`} className="mt-3 inline-block text-xs font-medium text-brand-600 hover:underline">View complaints →</Link>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </QueryBoundary>
  );
}

export default function Operations() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'anomalies';
  const anomalies = useQuery({ queryKey: ['anomalies'], queryFn: () => platform.anomalies() });
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Trends, anomalies & workload"
        description="Statistical monitoring of demand, short-term forecasts, and departmental capacity. Numbers appear only when there is enough history to support them."
        actions={tab === 'anomalies' && <button className="btn-secondary !py-1.5 text-xs" onClick={() => anomalies.refetch()}><RefreshIcon size={14} /> Re-scan</button>}
      />
      <div className="mt-4">
        <Tabs<Tab>
          tabs={[{ id: 'anomalies', label: 'Anomalies', badge: anomalies.data?.anomalies.length }, { id: 'forecast', label: 'Forecast & demand' }, { id: 'workload', label: 'Department workload' }]}
          value={tab}
          onChange={(t) => setParams({ tab: t })}
        />
      </div>
      <div className="mt-4">
        {tab === 'anomalies' && <AnomalyCenter />}
        {tab === 'forecast' && <ForecastCenter />}
        {tab === 'workload' && <WorkloadCenter />}
      </div>
    </div>
  );
}
