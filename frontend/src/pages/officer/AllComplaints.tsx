import React, { useEffect, useState } from 'react';
import { listAssigned } from '../../services/officer.service';
import { ComplaintCard } from '../../components/complaint/ComplaintCard';
import { EmptyState } from '../../components/common/EmptyState';
import { PageLoader } from '../../components/common/Spinner';
import { COMPLAINT_STATUSES, formatStatus } from '../../utils/constants';
import type { Complaint } from '../../utils/types';

export default function OfficerAllComplaints() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  useEffect(() => {
    setLoading(true);
    listAssigned({ limit: 100, status: status || undefined })
      .then((res) => setComplaints(res.rows))
      .finally(() => setLoading(false));
  }, [status]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Department Complaints</h1>
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {COMPLAINT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatStatus(s)}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4">
        {loading ? (
          <PageLoader />
        ) : complaints.length === 0 ? (
          <EmptyState title="No complaints found" description="Try a different filter." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {complaints.map((c) => (
              <ComplaintCard key={c.id} complaint={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
