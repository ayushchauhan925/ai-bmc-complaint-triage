import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as adminService from '../../services/admin.service';
import { PriorityBadge, StatusBadge, CategoryBadge } from '../../components/common/Badge';
import { PageLoader } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { CATEGORIES, COMPLAINT_STATUSES, PRIORITY_LEVELS, formatStatus } from '../../utils/constants';
import type { Complaint } from '../../utils/types';

const PAGE_SIZE = 20;

export default function AdminComplaints() {
  const [rows, setRows] = useState<Complaint[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', category: '', priority_level: '', search: '' });

  useEffect(() => {
    setLoading(true);
    adminService
      .listComplaints({ page, limit: PAGE_SIZE, ...filters })
      .then((res) => {
        setRows(res.rows);
        setTotal(res.total);
      })
      .finally(() => setLoading(false));
  }, [page, filters]);

  const updateFilter = (key: string, value: string) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-slate-900">Complaints</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          className="input w-56"
          placeholder="Search by description or ID..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
        />
        <select className="input w-auto" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
          <option value="">All statuses</option>
          {COMPLAINT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatStatus(s)}
            </option>
          ))}
        </select>
        <select className="input w-auto" value={filters.category} onChange={(e) => updateFilter('category', e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={filters.priority_level}
          onChange={(e) => updateFilter('priority_level', e.target.value)}
        >
          <option value="">All priorities</option>
          {PRIORITY_LEVELS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <div className="card mt-4 overflow-x-auto">
        {loading ? (
          <PageLoader />
        ) : rows.length === 0 ? (
          <EmptyState title="No complaints match your filters" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Citizen</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/complaints/${c.id}`} className="font-mono text-xs text-brand-600 hover:underline">
                      {c.complaint_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <CategoryBadge category={c.category} />
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge level={c.priority_level} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.department_name || '-'}</td>
                  <td className="px-4 py-3 text-slate-500">{c.citizen_name || '-'}</td>
                  <td className="px-4 py-3 text-slate-400">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary text-xs">
            Previous
          </button>
          <span className="text-xs text-slate-500">
            Page {page} of {totalPages}
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn-secondary text-xs">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
