import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { listComplaints } from '../../services/complaint.service';
import { StatCard } from '../../components/dashboard/StatCard';
import { ComplaintCard } from '../../components/complaint/ComplaintCard';
import { EmptyState } from '../../components/common/EmptyState';
import { PageLoader } from '../../components/common/Spinner';
import { ClipboardIcon, CheckCircleIcon, ClockIcon, PlusCircleIcon } from '../../components/common/Icons';
import type { Complaint } from '../../utils/types';

export default function CitizenHome() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listComplaints({ limit: 50 })
      .then((res) => setComplaints(res.rows))
      .finally(() => setLoading(false));
  }, []);

  const active = complaints.filter((c) => !['RESOLVED', 'REJECTED'].includes(c.status));
  const resolved = complaints.filter((c) => c.status === 'RESOLVED');
  const pending = complaints.filter((c) => c.status === 'SUBMITTED' || c.status === 'AI_ANALYZED');

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Welcome back, {user?.name.split(' ')[0]}</h1>
          <p className="text-sm text-slate-500">Here's what's happening with your civic reports.</p>
        </div>
        <Link to="/complaints/new" className="btn-primary">
          <PlusCircleIcon size={16} /> Report a Civic Problem
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total" value={complaints.length} icon={<ClipboardIcon size={16} />} />
        <StatCard label="Active" value={active.length} icon={<ClockIcon size={16} />} tone="warning" />
        <StatCard label="Pending" value={pending.length} icon={<ClockIcon size={16} />} />
        <StatCard label="Resolved" value={resolved.length} icon={<CheckCircleIcon size={16} />} tone="success" />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Recent complaints</h2>
        <Link to="/my-complaints" className="text-sm font-medium text-brand-600 hover:underline">
          View all
        </Link>
      </div>

      <div className="mt-3">
        {loading ? (
          <PageLoader />
        ) : complaints.length === 0 ? (
          <EmptyState
            title="No complaints yet"
            description="Report your first civic issue and our AI will triage it instantly."
            action={
              <Link to="/complaints/new" className="btn-primary">
                Report a Civic Problem
              </Link>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {complaints.slice(0, 6).map((c) => (
              <ComplaintCard key={c.id} complaint={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
