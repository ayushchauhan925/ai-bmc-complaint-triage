import React, { useEffect, useState } from 'react';
import { listAssigned } from '../../services/officer.service';
import { ComplaintCard } from '../../components/complaint/ComplaintCard';
import { StatCard } from '../../components/dashboard/StatCard';
import { EmptyState } from '../../components/common/EmptyState';
import { PageLoader } from '../../components/common/Spinner';
import { ClipboardIcon, AlertIcon, ClockIcon } from '../../components/common/Icons';
import type { Complaint } from '../../utils/types';

export default function OfficerDashboard() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listAssigned({ limit: 100 })
      .then((res) => setComplaints(res.rows))
      .finally(() => setLoading(false));
  }, []);

  const mine = complaints.filter((c) => !['RESOLVED', 'REJECTED'].includes(c.status));
  const critical = mine.filter((c) => c.priority_level === 'CRITICAL');
  const breached = mine.filter((c) => c.sla_status === 'BREACHED');

  const sorted = [...mine].sort((a, b) => b.priority_score - a.priority_score);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-slate-900">Your Department's Queue</h1>
      <p className="mt-1 text-sm text-slate-500">Complaints routed to your department, sorted by priority.</p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <StatCard label="Open" value={mine.length} icon={<ClipboardIcon size={16} />} />
        <StatCard label="Critical" value={critical.length} icon={<AlertIcon size={16} />} tone="critical" />
        <StatCard label="SLA Breached" value={breached.length} icon={<ClockIcon size={16} />} tone="warning" />
      </div>

      <div className="mt-6">
        {loading ? (
          <PageLoader />
        ) : sorted.length === 0 ? (
          <EmptyState title="Nothing assigned yet" description="New complaints for your department will appear here." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {sorted.map((c) => (
              <ComplaintCard key={c.id} complaint={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
