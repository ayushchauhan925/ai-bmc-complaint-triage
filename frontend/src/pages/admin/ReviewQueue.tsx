import React, { useEffect, useState } from 'react';
import * as adminService from '../../services/admin.service';
import { ComplaintCard } from '../../components/complaint/ComplaintCard';
import { PageLoader } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import type { Complaint } from '../../utils/types';

export default function AdminReviewQueue() {
  const [rows, setRows] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminService
      .listComplaints({ limit: 100, review_required: true })
      .then((res) => setRows(res.rows))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-slate-900">Flagged for Review</h1>
      <p className="mt-1 text-sm text-slate-500">
        Complaints where the AI flagged low confidence, a possible image mismatch, or suspected spam.
      </p>

      <div className="mt-4">
        {loading ? (
          <PageLoader />
        ) : rows.length === 0 ? (
          <EmptyState title="Nothing to review" description="All complaints have passed automated checks." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {rows.map((c) => (
              <ComplaintCard key={c.id} complaint={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
