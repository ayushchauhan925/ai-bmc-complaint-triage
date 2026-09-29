import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getIntelligence } from '../../services/intelligence.service';
import type { IntelligenceData } from '../../services/intelligence.service';
import { StatCard } from '../../components/dashboard/StatCard';
import { HotspotList } from '../../components/admin/HotspotList';
import { AiSearchBar } from '../../components/admin/AiSearchBar';
import { SituationReportPanel } from '../../components/admin/SituationReportPanel';
import { PriorityBadge } from '../../components/common/Badge';
import { PageLoader } from '../../components/common/Spinner';
import { ClipboardIcon, AlertIcon, ClockIcon } from '../../components/common/Icons';

export default function IntelligenceCenter() {
  const [data, setData] = useState<IntelligenceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getIntelligence().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader />;
  if (!data) return null;

  const { summary } = data;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-slate-900">Civic Intelligence Center</h1>
      <p className="mt-1 text-sm text-slate-500">{data.dataScope}</p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Complaints" value={summary.total} icon={<ClipboardIcon size={16} />} />
        <StatCard label="Critical" value={summary.critical_count} icon={<AlertIcon size={16} />} tone="critical" />
        <StatCard label="SLA Risks" value={data.slaCheck.newEscalations} icon={<ClockIcon size={16} />} tone="warning" />
        <StatCard label="SLA Breaches" value={summary.sla_breaches} icon={<ClockIcon size={16} />} tone="warning" />
      </div>

      <div className="mt-6">
        <SituationReportPanel latest={data.latestSituationReport} />
      </div>

      <div className="mt-6">
        <AiSearchBar />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Emerging hotspots</h3>
          <HotspotList hotspots={data.hotspots} />
        </div>

        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Department workload</h3>
          <div className="space-y-1.5">
            {data.departmentWorkload.map((d) => (
              <div key={d.department} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{d.department || 'Unassigned'}</span>
                <span className="font-medium text-slate-800">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Ward statistics</h3>
          <div className="space-y-1.5">
            {data.wardStatistics.map((w) => (
              <div key={w.ward || 'none'} className="flex items-center justify-between text-sm">
                <span className="text-slate-600">{w.ward || 'Unassigned'}</span>
                <span className="font-medium text-slate-800">{w.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Recent incidents</h3>
          <div className="space-y-2">
            {data.recentIncidents.length === 0 && <p className="text-sm text-slate-400">No incidents yet.</p>}
            {data.recentIncidents.map((inc: any) => (
              <Link
                key={inc.id}
                to={`/admin/incidents/${inc.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{inc.title}</p>
                  <p className="text-xs text-slate-400">{inc.complaint_count} complaints</p>
                </div>
                <PriorityBadge level={inc.priority_level} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
