import React, { useEffect, useState } from 'react';
import { Footer } from '../components/layout/Footer';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from 'recharts';
import { getPublicStatistics } from '../services/public.service';
import type { PublicStatistics } from '../services/public.service';
import { PageLoader } from '../components/common/Spinner';
import { Logo } from '../components/common/Logo';
import { CHART_BRAND, CHART_GRID, CHART_AXIS_TEXT } from '../utils/chartColors';
import { formatCategory } from '../utils/constants';

// Section 20: public transparency dashboard - no auth, aggregate counts only, no citizen PII.
export default function PublicDashboard() {
  const [data, setData] = useState<PublicStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPublicStatistics().then(setData).finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <Logo size={32} />
            <span className="font-semibold text-slate-900">Civic Connect</span>
          </Link>
          <Link to="/login" className="btn-secondary text-sm">
            Sign in
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-xl font-semibold text-slate-900">Public Transparency Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Aggregated, anonymized civic complaint statistics. No citizen names, contact details or precise addresses
          are shown here.
        </p>

        {loading ? (
          <PageLoader />
        ) : data ? (
          <>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatTile label="Total Complaints" value={data.total_complaints} />
              <StatTile label="Resolved" value={data.resolved} />
              <StatTile label="In Progress" value={data.in_progress} />
              <StatTile
                label="Avg. Resolution"
                value={data.avg_resolution_hours !== null ? `${data.avg_resolution_hours}h` : '-'}
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <StatTile
                label="SLA Compliance"
                value={data.sla_compliance_pct !== null ? `${data.sla_compliance_pct}%` : '-'}
              />
              <StatTile label="Duplicate Rate" value={`${data.duplicate_rate_pct}%`} />
              <StatTile label="Active" value={data.pending_or_active} />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-slate-800">Complaints over time (30 days)</h3>
                <div className="mt-3 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.complaints_over_time}>
                      <defs>
                        <linearGradient id="pubColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_BRAND} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={CHART_BRAND} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: CHART_AXIS_TEXT }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: CHART_AXIS_TEXT }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="count" stroke={CHART_BRAND} fill="url(#pubColor)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card p-4">
                <h3 className="text-sm font-semibold text-slate-800">Complaints by category</h3>
                <div className="mt-3 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.by_category.map((c) => ({ ...c, category: formatCategory(c.category) }))} layout="vertical" margin={{ left: 10 }}>
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

            <p className="mt-6 text-xs text-slate-400">{data.data_scope}</p>
          </>
        ) : (
          <p className="mt-6 text-sm text-red-600">Could not load public statistics right now.</p>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      <Footer />
    </div>
  );
}
