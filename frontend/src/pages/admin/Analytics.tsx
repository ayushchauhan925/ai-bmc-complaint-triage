import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import * as adminService from '../../services/admin.service';
import { StatCard } from '../../components/dashboard/StatCard';
import { PageLoader } from '../../components/common/Spinner';
import { CHART_BRAND, CHART_GRID, CHART_AXIS_TEXT, PRIORITY_CHART_COLORS, STATUS_CHART_COLORS } from '../../utils/chartColors';
import { formatStatus } from '../../utils/constants';

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <div className="mt-3 h-56">{children}</div>
    </div>
  );
}

export default function AdminAnalytics() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getAnalytics().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;
  if (!data) return null;

  const { byDepartment, byPriority, byWard, byStatus, resolution, duplicates, reopened, satisfaction } = data;

  const avgHours = resolution.avg_resolution_hours ? Math.round(Number(resolution.avg_resolution_hours)) : null;
  const slaCompliancePct =
    resolution.within_sla !== null && resolution.resolved_count > 0
      ? Math.round((Number(resolution.within_sla) / resolution.resolved_count) * 100)
      : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-slate-900">Analytics</h1>
      <p className="mt-1 text-sm text-slate-500">Deeper breakdown of complaint patterns and performance.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Avg. Resolution Time" value={avgHours !== null ? `${avgHours}h` : '-'} />
        <StatCard label="SLA Compliance" value={slaCompliancePct !== null ? `${slaCompliancePct}%` : '-'} />
        <StatCard label="Duplicate Rate" value={`${duplicates.percentage}%`} />
        <StatCard label="Reopened" value={reopened} />
        <StatCard
          label="Citizen Satisfaction"
          value={satisfaction.avg_rating ? `${Number(satisfaction.avg_rating).toFixed(1)}/5` : '-'}
        />
        <StatCard label="Feedback Count" value={satisfaction.total_feedback} />
        <StatCard label="Resolved (confirmed)" value={satisfaction.confirmed_resolved || 0} />
        <StatCard label="Disputed" value={satisfaction.disputed || 0} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="Complaints by department">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byDepartment} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: CHART_AXIS_TEXT }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis dataKey="department" type="category" width={130} tick={{ fontSize: 11, fill: CHART_AXIS_TEXT }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="count" fill={CHART_BRAND} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Complaints by priority">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byPriority}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
              <XAxis dataKey="priority_level" tick={{ fontSize: 11, fill: CHART_AXIS_TEXT }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: CHART_AXIS_TEXT }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {byPriority.map((entry: any) => (
                  <Cell key={entry.priority_level} fill={PRIORITY_CHART_COLORS[entry.priority_level] || CHART_BRAND} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Complaints by ward">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byWard} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: CHART_AXIS_TEXT }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis dataKey="ward" type="category" width={110} tick={{ fontSize: 11, fill: CHART_AXIS_TEXT }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="count" fill={CHART_BRAND} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Complaints by status">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byStatus.map((s: any) => ({ ...s, label: formatStatus(s.status) }))} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: CHART_AXIS_TEXT }} tickLine={false} axisLine={false} allowDecimals={false} />
              <YAxis dataKey="label" type="category" width={130} tick={{ fontSize: 11, fill: CHART_AXIS_TEXT }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {byStatus.map((entry: any) => (
                  <Cell key={entry.status} fill={STATUS_CHART_COLORS[entry.status] || CHART_BRAND} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Note: ward and SLA figures reflect demo/synthetic data seeded for this hackathon build, not verified official
        municipal records.
      </p>
    </div>
  );
}
