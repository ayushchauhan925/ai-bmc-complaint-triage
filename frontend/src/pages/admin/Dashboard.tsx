import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';
import * as adminService from '../../services/admin.service';
import { StatCard } from '../../components/dashboard/StatCard';
import { PageLoader } from '../../components/common/Spinner';
import { PriorityBadge, StatusBadge, SlaBadge } from '../../components/common/Badge';
import { ClipboardIcon, AlertIcon, ClockIcon, CheckCircleIcon } from '../../components/common/Icons';
import { CHART_BRAND, CHART_GRID, CHART_AXIS_TEXT } from '../../utils/chartColors';
import { formatCategory } from '../../utils/constants';

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService.getStatistics().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;
  if (!data) return null;

  const { summary, overTime, byCategory, recentCritical, slaBreaches } = data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-slate-900">Admin Dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">City-wide civic complaint overview.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Complaints" value={summary.total} icon={<ClipboardIcon size={16} />} />
        <StatCard label="Critical" value={summary.critical_count} icon={<AlertIcon size={16} />} tone="critical" />
        <StatCard label="High Priority" value={summary.high_priority_count} icon={<AlertIcon size={16} />} tone="warning" />
        <StatCard label="SLA Breaches" value={summary.sla_breaches} icon={<ClockIcon size={16} />} tone="warning" />
        <StatCard label="In Progress" value={summary.in_progress} icon={<ClockIcon size={16} />} />
        <StatCard label="Resolved" value={summary.resolved} icon={<CheckCircleIcon size={16} />} tone="success" />
        <StatCard label="Needs Review" value={summary.needs_review} icon={<AlertIcon size={16} />} tone="warning" />
        <StatCard label="Active" value={summary.pending_or_active} icon={<ClipboardIcon size={16} />} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-800">Complaints over time (30 days)</h3>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overTime}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_BRAND} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_BRAND} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART_AXIS_TEXT }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: CHART_AXIS_TEXT }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke={CHART_BRAND} fill="url(#colorCount)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-800">Complaints by category</h3>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCategory.map((c: any) => ({ ...c, category: formatCategory(c.category) }))} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: CHART_AXIS_TEXT }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis dataKey="category" type="category" width={110} tick={{ fontSize: 11, fill: CHART_AXIS_TEXT }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Bar dataKey="count" fill={CHART_BRAND} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Recent critical complaints</h3>
          <div className="space-y-2">
            {recentCritical.length === 0 && <p className="text-sm text-slate-400">None right now.</p>}
            {recentCritical.map((c: any) => (
              <Link
                key={c.id}
                to={`/complaints/${c.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{c.complaint_number}</p>
                  <p className="text-xs text-slate-400">{c.department_name || 'Unassigned'}</p>
                </div>
                <PriorityBadge level={c.priority_level} />
              </Link>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">SLA breaches</h3>
          <div className="space-y-2">
            {slaBreaches.length === 0 && <p className="text-sm text-slate-400">No SLA breaches. Great job!</p>}
            {slaBreaches.map((c: any) => (
              <Link
                key={c.id}
                to={`/complaints/${c.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{c.complaint_number}</p>
                  <p className="text-xs text-slate-400">{c.department_name || 'Unassigned'}</p>
                </div>
                <div className="flex gap-2">
                  <StatusBadge status={c.status} />
                  <SlaBadge status={c.sla_status} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
