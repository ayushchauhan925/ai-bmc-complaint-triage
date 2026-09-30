import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend } from 'recharts';
import * as platform from '../../services/platform.service';
import * as adminService from '../../services/admin.service';
import { StatCard } from '../../components/dashboard/StatCard';
import { PriorityBadge, StatusBadge, SlaBadge } from '../../components/common/Badge';
import { ClipboardIcon, AlertIcon, ClockIcon, CheckCircleIcon, LayersIcon, FlameIcon, ActivityIcon, ShieldIcon, RefreshIcon } from '../../components/common/Icons';
import { PdfButton } from '../../components/ui/PdfButton';
import { commandCenterReport } from '../../utils/pdf';
import { PageHeader, QueryBoundary, PageSkeleton, InsufficientData, fmtDate, pct } from '../../components/ui/kit';
import { CHART_BRAND, CHART_GRID, CHART_AXIS_TEXT } from '../../utils/chartColors';
import { formatCategory } from '../../utils/constants';

const AXIS = { fontSize: 11, fill: CHART_AXIS_TEXT };

function KpiLink({ to, children }: { to: string; children: React.ReactNode }) {
  return <Link to={to} className="block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">{children}</Link>;
}

export default function CommandCenter() {
  const overview = useQuery({ queryKey: ['overview'], queryFn: platform.overview, refetchInterval: 60_000 });
  const stats = useQuery({ queryKey: ['admin-statistics'], queryFn: adminService.getStatistics, refetchInterval: 60_000 });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Command Center"
        description="Live civic situation: what needs attention, where, and how the response is performing."
        actions={
          <>
          <PdfButton label="Export PDF" disabled={!overview.data} build={async () => { if (overview.data) await commandCenterReport(overview.data); }} />
          <button className="btn-secondary !py-1.5 text-xs" onClick={() => { overview.refetch(); stats.refetch(); }} disabled={overview.isFetching}>
            <RefreshIcon size={14} className={overview.isFetching ? 'animate-spin' : ''} /> Refresh
          </button>
          </>
        }
      />

      <div className="mt-5">
        <QueryBoundary query={overview} skeleton={<PageSkeleton />}>
          {(o) => (
            <div className="space-y-4">
              {/* Headline metrics: each is a doorway to the detailed view. */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiLink to="/admin/complaints"><StatCard label="Total complaints" value={o.totals.total} icon={<ClipboardIcon size={16} />} /></KpiLink>
                <KpiLink to="/admin/complaints"><StatCard label="Open" value={o.totals.open} icon={<ClockIcon size={16} />} /></KpiLink>
                <KpiLink to="/admin/complaints"><StatCard label="Resolved" value={o.totals.resolved} icon={<CheckCircleIcon size={16} />} tone="success" /></KpiLink>
                <KpiLink to="/admin/complaints"><StatCard label="High priority (open)" value={o.totals.highPriorityOpen} icon={<AlertIcon size={16} />} tone={o.totals.highPriorityOpen ? 'critical' : 'default'} /></KpiLink>
                <KpiLink to="/admin/incidents"><StatCard label="Active incidents" value={o.totals.activeIncidents} icon={<LayersIcon size={16} />} /></KpiLink>
                <KpiLink to="/admin/sla"><StatCard label="SLA breaches" value={o.totals.slaBreaches} icon={<ClockIcon size={16} />} tone={o.totals.slaBreaches ? 'warning' : 'default'} /></KpiLink>
                <KpiLink to="/admin/sla"><StatCard label="Open escalations" value={o.totals.openEscalations} icon={<ShieldIcon size={16} />} tone={o.totals.openEscalations ? 'warning' : 'default'} /></KpiLink>
                <KpiLink to="/admin/operations"><StatCard label="Active anomalies" value={o.anomalies.sufficientData ? o.anomalies.total : 'n/a'} icon={<ActivityIcon size={16} />} tone={o.anomalies.total ? 'critical' : 'default'} /></KpiLink>
              </div>

              {o.totals.reviewQueue > 0 && (
                <Link to="/admin/review" className="flex items-center justify-between rounded-lg border border-pink-200 bg-pink-50 px-4 py-2.5 text-sm text-pink-900 hover:bg-pink-100">
                  <span><strong>{o.totals.reviewQueue}</strong> complaint{o.totals.reviewQueue === 1 ? '' : 's'} waiting for human review</span>
                  <span className="font-medium">Open review queue →</span>
                </Link>
              )}

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="card p-4 lg:col-span-2">
                  <h2 className="text-sm font-semibold text-slate-800">Is demand rising? <span className="font-normal text-slate-400">— complaints per day, last 14 days</span></h2>
                  <div className="mt-3 h-56" role="img" aria-label="Complaints per day over the last 14 days">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={o.trend}>
                        <defs><linearGradient id="cc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={CHART_BRAND} stopOpacity={0.25} /><stop offset="95%" stopColor={CHART_BRAND} stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                        <XAxis dataKey="date" tick={AXIS} tickFormatter={(d) => String(d).slice(5, 10)} tickLine={false} axisLine={false} />
                        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip />
                        <Area type="monotone" dataKey="count" name="Complaints" stroke={CHART_BRAND} fill="url(#cc)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="card p-4">
                  <h2 className="text-sm font-semibold text-slate-800">Are we on time? <span className="font-normal text-slate-400">— open complaints by SLA</span></h2>
                  <dl className="mt-4 space-y-3">
                    {([['ON_TRACK', 'On track', 'text-green-700'], ['APPROACHING', 'Warning', 'text-amber-700'], ['BREACHED', 'Breached', 'text-red-700']] as const).map(([k, label, cls]) => (
                      <div key={k} className="flex items-baseline justify-between border-b border-slate-100 pb-2">
                        <dt className="text-sm text-slate-600">{label}</dt>
                        <dd className={`text-xl font-semibold ${cls}`}>{o.sla[k]}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 text-xs text-slate-500">
                    Avg resolution: <strong className="text-slate-700">{o.resolution.avgResolutionHours === null ? 'insufficient data' : `${o.resolution.avgResolutionHours} h`}</strong>
                  </p>
                  <Link to="/admin/sla" className="mt-2 inline-block text-xs font-medium text-brand-600 hover:underline">SLA &amp; escalations →</Link>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="card p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><FlameIcon size={16} /> Where is it concentrated? <span className="font-normal text-slate-400">— open hotspots</span></h2>
                    <Link to="/admin/map" className="text-xs font-medium text-brand-600 hover:underline">Open map →</Link>
                  </div>
                  {o.hotspots.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-400">No hotspots in the last 14 days.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-slate-100">
                      {o.hotspots.map((h) => (
                        <li key={h.id}>
                          <Link to={`/admin/map?focus=${h.centroid.latitude},${h.centroid.longitude}&category=${h.category}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-slate-50">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-800">{h.label}</p>
                              <p className="text-xs text-slate-500">{h.complaintCount} complaints · {h.unresolvedCount} unresolved · {h.radiusMeters} m radius</p>
                            </div>
                            <PriorityBadge level={h.dominantPriority} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="card p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><ActivityIcon size={16} /> Anything unusual? <span className="font-normal text-slate-400">— last 24 h vs baseline</span></h2>
                    <Link to="/admin/operations" className="text-xs font-medium text-brand-600 hover:underline">Anomaly centre →</Link>
                  </div>
                  {!o.anomalies.sufficientData ? (
                    <div className="mt-3"><InsufficientData reason={o.anomalies.notes[0]} /></div>
                  ) : o.anomalies.items.length === 0 ? (
                    <p className="mt-4 text-sm text-green-700">✓ Nothing outside the normal range.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {o.anomalies.items.map((a, i) => (
                        <li key={i} className="rounded-lg border border-red-100 bg-red-50/60 px-3 py-2">
                          <p className="text-sm font-semibold text-red-900">{a.label}</p>
                          <p className="text-xs text-red-800">{a.explanation}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800">Which departments are stretched? <span className="font-normal text-slate-400">— pending vs overdue</span></h2>
                  <Link to="/admin/operations" className="text-xs font-medium text-brand-600 hover:underline">Workload detail →</Link>
                </div>
                <div className="mt-3 h-64" role="img" aria-label="Pending and overdue complaints per department">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={o.departmentWorkload.filter((d) => d.assigned > 0).map((d) => ({ name: d.department.replace(/ Department| Management/g, ''), Pending: d.pending - d.overdue, Overdue: d.overdue }))} layout="vertical" margin={{ left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
                      <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis dataKey="name" type="category" width={130} tick={AXIS} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Pending" stackId="a" fill={CHART_BRAND} name="Within SLA" />
                      <Bar dataKey="Overdue" stackId="a" fill="#dc2626" name="Overdue" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="card p-4 lg:col-span-2">
                  <h2 className="text-sm font-semibold text-slate-800">How confident is the AI? <span className="font-normal text-slate-400">— confidence distribution</span></h2>
                  {!o.aiConfidence || o.aiConfidence.analysed === 0 ? (
                    <div className="mt-3"><InsufficientData reason="No AI-analysed complaints yet." /></div>
                  ) : (
                    <>
                      <div className="mt-3 h-44" role="img" aria-label="Number of complaints per AI confidence band">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={o.aiConfidence.buckets}>
                            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                            <XAxis dataKey="range" tick={{ ...AXIS, fontSize: 10 }} tickLine={false} axisLine={false} />
                            <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="count" name="Complaints" fill={CHART_BRAND} radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">Average {pct(o.aiConfidence.avgConfidence)} · {o.aiConfidence.aiFailures} AI failure(s) handled by fallback · <Link to="/admin/ai" className="text-brand-600 hover:underline">AI performance</Link></p>
                    </>
                  )}
                </div>
                <div className="card p-4">
                  <h2 className="text-sm font-semibold text-slate-800">Duplicate rate</h2>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">{o.duplicateRate.total ? `${o.duplicateRate.percentage}%` : '—'}</p>
                  <p className="mt-1 text-xs text-slate-500">{o.duplicateRate.grouped} of {o.duplicateRate.total} complaints belong to a multi-report incident.</p>
                </div>
              </div>

              <StatsLists stats={stats.data} />
              <p className="text-xs text-slate-400">{o.dataScope}</p>
            </div>
          )}
        </QueryBoundary>
      </div>
    </div>
  );
}

// Existing lists (recent critical, SLA breaches) kept from the previous dashboard.
function StatsLists({ stats }: { stats: any }) {
  if (!stats) return null;
  const { recentCritical = [], slaBreaches = [] } = stats;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Critical, still open</h2>
        <div className="space-y-2">
          {recentCritical.length === 0 && <p className="text-sm text-slate-400">None right now.</p>}
          {recentCritical.map((c: any) => (
            <Link key={c.id} to={`/complaints/${c.id}`} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50">
              <div><p className="text-sm font-medium text-slate-800">{c.complaint_number} · {formatCategory(c.category)}</p><p className="text-xs text-slate-400">{c.department_name || 'Unassigned'} · {fmtDate(c.created_at)}</p></div>
              <PriorityBadge level={c.priority_level} />
            </Link>
          ))}
        </div>
      </div>
      <div className="card p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">SLA breaches</h2>
        <div className="space-y-2">
          {slaBreaches.length === 0 && <p className="text-sm text-slate-400">No SLA breaches.</p>}
          {slaBreaches.map((c: any) => (
            <Link key={c.id} to={`/complaints/${c.id}`} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50">
              <div><p className="text-sm font-medium text-slate-800">{c.complaint_number}</p><p className="text-xs text-slate-400">{c.department_name || 'Unassigned'}</p></div>
              <div className="flex gap-2"><StatusBadge status={c.status} /><SlaBadge status={c.sla_status} /></div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
