import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend } from 'recharts';
import { getPublicStatistics } from '../services/public.service';
import type { PublicStatistics } from '../services/public.service';
import { Footer } from '../components/layout/Footer';
import { ErrorPanel, PageSkeleton, InsufficientData, Meter, fmtDate } from '../components/ui/kit';
import { EmptyState } from '../components/common/EmptyState';
import { CHART_BRAND, CHART_GRID, CHART_AXIS_TEXT, STATUS_CHART_COLORS } from '../utils/chartColors';
import { formatCategory, formatStatus } from '../utils/constants';
import { ShieldIcon, CheckCircleIcon, ClockIcon, LayersIcon } from '../components/common/Icons';

const AXIS = { fontSize: 11, fill: CHART_AXIS_TEXT };

function Kpi({ label, value, hint, children }: { label: string; value: React.ReactNode; hint?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      {children}
      {hint && <p className="mt-2 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Delta({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined) return <span className="text-slate-400">no prior week to compare</span>;
  const up = pct > 0;
  return <span className={up ? 'text-amber-700' : pct < 0 ? 'text-green-700' : 'text-slate-500'}>{up ? '▲' : pct < 0 ? '▼' : '='} {Math.abs(pct)}% vs previous week</span>;
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Dashboard({ d }: { d: PublicStatistics }) {
  const statusTotal = (d.by_status ?? []).reduce((s, x) => s + x.count, 0);
  const statuses = [...(d.by_status ?? [])].sort((a, b) => b.count - a.count);
  const categories = d.by_category.slice(0, 10).map((c) => ({ category: formatCategory(c.category), Resolved: c.resolved ?? 0, Open: c.count - (c.resolved ?? 0) }));
  const departments = d.by_department ?? [];

  if (d.total_complaints === 0) return <EmptyState title="No complaints yet" description="Statistics will appear once complaints are reported." />;

  return (
    <div className="space-y-6">
      {/* Headline */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Resolved" value={d.resolution_rate_pct === null || d.resolution_rate_pct === undefined ? '—' : `${d.resolution_rate_pct}%`} hint={`${d.resolved.toLocaleString()} of ${d.total_complaints.toLocaleString()} complaints`}>
          <div className="mt-3"><Meter value={d.resolution_rate_pct ?? 0} max={100} tone="good" /></div>
        </Kpi>
        <Kpi label="Reported" value={d.total_complaints.toLocaleString()} hint={d.week_over_week ? <><strong className="text-slate-700">{d.week_over_week.this_week}</strong> this week · <Delta pct={d.week_over_week.change_pct} /></> : undefined} />
        <Kpi label="Avg. time to resolve" value={d.avg_resolution_hours === null ? '—' : d.avg_resolution_hours >= 48 ? `${(d.avg_resolution_hours / 24).toFixed(1)} days` : `${d.avg_resolution_hours} h`} hint={d.avg_resolution_hours === null ? 'Not enough resolved complaints yet' : 'Across resolved complaints'} />
        <Kpi label="Resolved within deadline" value={d.sla_compliance_pct === null ? '—' : `${d.sla_compliance_pct}%`} hint={d.sla_compliance_pct === null ? 'Not enough resolved complaints yet' : 'Share of resolved complaints that met their target'} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><ClockIcon size={18} /></span><div><p className="text-xl font-semibold leading-none">{d.pending_or_active.toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">Complaints being worked on</p></div></div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><LayersIcon size={18} /></span><div><p className="text-xl font-semibold leading-none">{(d.active_incidents ?? 0).toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">Active incidents (grouped reports)</p></div></div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600"><CheckCircleIcon size={18} /></span><div><p className="text-xl font-semibold leading-none">{d.duplicate_rate_pct}%</p><p className="mt-1 text-xs text-slate-500">Reports linked to a shared incident</p></div></div>
      </div>

      {/* Status breakdown */}
      {statusTotal > 0 && (
        <Card title="Where complaints stand" subtitle="Every complaint by its current stage.">
          <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Complaints by status">
            {statuses.map((s) => <span key={s.status} style={{ width: `${(s.count / statusTotal) * 100}%`, background: STATUS_CHART_COLORS[s.status] ?? '#94a3b8' }} title={`${formatStatus(s.status)}: ${s.count}`} />)}
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            {statuses.map((s) => (
              <li key={s.status} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: STATUS_CHART_COLORS[s.status] ?? '#94a3b8' }} aria-hidden="true" />{formatStatus(s.status)}</span>
                <span className="font-medium text-slate-900">{s.count.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Reports over the last 30 days" subtitle="New complaints per day.">
          <div className="h-60" role="img" aria-label="New complaints per day over the last 30 days">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.complaints_over_time.map((r) => ({ ...r, label: String(r.date).slice(5, 10) }))}>
                <defs><linearGradient id="pubColor" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={CHART_BRAND} stopOpacity={0.3} /><stop offset="95%" stopColor={CHART_BRAND} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="count" name="Complaints" stroke={CHART_BRAND} fill="url(#pubColor)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="What people report" subtitle="Top categories, split by resolved and still open.">
          {categories.length === 0 ? <InsufficientData reason="Categories with very few reports are not shown separately." /> : (
            <div className="h-60" role="img" aria-label="Complaints by category, resolved versus open">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categories} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
                  <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis dataKey="category" type="category" width={110} tick={AXIS} tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Resolved" stackId="a" fill="#16a34a" />
                  <Bar dataKey="Open" stackId="a" fill={CHART_BRAND} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Departments */}
      <Card title="Department performance" subtitle={`How each department is doing. Departments with fewer than ${d.min_group_size ?? 3} complaints are not shown.`}>
        {departments.length === 0 ? <InsufficientData reason="Not enough complaints per department yet." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Complaints handled and resolved by department</caption>
              <thead className="text-xs text-slate-500"><tr><th scope="col" className="py-2 pr-4 font-medium">Department</th><th scope="col" className="py-2 pr-4 font-medium">Complaints</th><th scope="col" className="w-1/3 py-2 pr-4 font-medium">Resolved</th><th scope="col" className="py-2 font-medium">Avg. time</th></tr></thead>
              <tbody>
                {departments.map((dep) => {
                  const rate = dep.total > 0 ? Math.round((dep.resolved / dep.total) * 100) : 0;
                  return (
                    <tr key={dep.department} className="border-t border-slate-100">
                      <td className="py-3 pr-4 font-medium text-slate-800">{dep.department}</td>
                      <td className="py-3 pr-4 text-slate-600">{dep.total.toLocaleString()}</td>
                      <td className="py-3 pr-4"><div className="flex items-center gap-3"><div className="h-2 flex-1 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-green-500" style={{ width: `${rate}%` }} /></div><span className="w-20 text-right text-xs text-slate-600">{rate}% · {dep.resolved}</span></div></td>
                      <td className="py-3 text-slate-600">{dep.avg_resolution_hours === null ? '—' : dep.avg_resolution_hours >= 48 ? `${(dep.avg_resolution_hours / 24).toFixed(1)} d` : `${dep.avg_resolution_hours} h`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Privacy */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5" aria-labelledby="priv-h">
        <h2 id="priv-h" className="flex items-center gap-2 text-sm font-semibold text-slate-900"><ShieldIcon size={16} className="text-brand-600" /> About this data</h2>
        <ul className="mt-3 grid gap-x-8 gap-y-2 text-sm text-slate-600 sm:grid-cols-2">
          <li>Only totals and rates are published - never names, phone numbers, emails or complaint text.</li>
          <li>No addresses or map coordinates are shown, so no individual report can be located.</li>
          <li>Very small groups are hidden to prevent identifying anyone from a count.</li>
          <li>Figures update live; where there is not enough data we show a dash instead of guessing.</li>
        </ul>
        <p className="mt-3 text-xs text-slate-500">{d.data_scope}</p>
      </section>
    </div>
  );
}

export default function PublicDashboard() {
  const q = useQuery({ queryKey: ['public-stats'], queryFn: getPublicStatistics, refetchInterval: 120_000 });

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-brand-900/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5 text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-sm font-bold text-brand-800">CC</span>
            <span className="font-semibold">Civic Connect</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login" className="rounded-lg px-3.5 py-2 text-sm font-medium text-white hover:bg-white/10">Sign in</Link>
            <Link to="/register" className="rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-brand-800 hover:bg-brand-50">Report an issue</Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-brand-900 text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)', backgroundSize: '48px 48px', maskImage: 'radial-gradient(ellipse at 20% 0%, black 15%, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at 20% 0%, black 15%, transparent 70%)' }} />
        <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-10 sm:px-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-brand-100 ring-1 ring-white/20"><ShieldIcon size={13} /> Public transparency dashboard</span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Civic complaints, in the open</h1>
          <p className="mt-3 max-w-2xl text-brand-100">How many issues are reported, how quickly they get resolved, and how each department is performing. Anonymous, aggregated and updated live.</p>
          {q.data?.generated_at && <p className="mt-4 text-xs text-brand-300">Updated {fmtDate(q.data.generated_at)}</p>}
        </div>
      </section>

      <main className="relative z-10 mx-auto -mt-6 w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">
        {q.isLoading ? <PageSkeleton /> : q.isError ? <ErrorPanel error={q.error} onRetry={() => q.refetch()} /> : q.data ? <Dashboard d={q.data} /> : null}

        <div className="mt-10 rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 p-8 text-center text-white">
          <h2 className="text-xl font-semibold">See something that needs fixing?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-brand-100">Report it in under a minute and follow it until it is resolved.</p>
          <Link to="/register" className="mt-5 inline-block rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-brand-800 hover:bg-brand-50">Report a problem</Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
