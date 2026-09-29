import React, { useEffect, useState } from 'react';
import * as adminService from '../../services/admin.service';
import * as complaintService from '../../services/complaint.service';
import { recommendOfficer } from '../../services/intelligence.service';
import type { OfficerRecommendation } from '../../services/intelligence.service';
import { getErrorMessage } from '../../services/api';
import type { Complaint, Department, User } from '../../utils/types';

const NEXT_STATUS_OPTIONS: Record<string, string[]> = {
  SUBMITTED: ['NEEDS_REVIEW', 'REJECTED'],
  AI_ANALYZED: ['ASSIGNED', 'NEEDS_REVIEW'],
  ASSIGNED: ['IN_PROGRESS', 'NEEDS_REVIEW', 'REJECTED'],
  IN_PROGRESS: ['RESOLUTION_SUBMITTED', 'NEEDS_REVIEW'],
  RESOLUTION_SUBMITTED: ['RESOLVED', 'IN_PROGRESS'],
  RESOLVED: ['REOPENED'],
  REOPENED: ['ASSIGNED', 'IN_PROGRESS'],
  NEEDS_REVIEW: ['AI_ANALYZED', 'ASSIGNED', 'REJECTED', 'SUBMITTED'],
  REJECTED: ['SUBMITTED'],
};

export function AdminActions({
  complaint,
  onUpdated,
}: {
  complaint: Complaint;
  onUpdated: (c: Complaint) => void;
}) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [officers, setOfficers] = useState<User[]>([]);
  const [departmentId, setDepartmentId] = useState<number | ''>(complaint.department_id || '');
  const [officerId, setOfficerId] = useState<number | ''>(complaint.officer_id || '');
  const [nextStatus, setNextStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recommendations, setRecommendations] = useState<OfficerRecommendation[] | null>(null);
  const [recommending, setRecommending] = useState(false);

  useEffect(() => {
    adminService.listDepartments().then(setDepartments).catch(() => {});
    adminService.listOfficers().then(setOfficers).catch(() => {});
  }, []);

  const availableOfficers = officers.filter((o) => o.department_id === departmentId);
  const statusOptions = NEXT_STATUS_OPTIONS[complaint.status] || [];

  const runReassign = async () => {
    if (!departmentId) return;
    setBusy(true);
    setError('');
    try {
      const updated = await adminService.assignComplaint(complaint.id, Number(departmentId), officerId ? Number(officerId) : undefined);
      onUpdated(updated);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const runStatusChange = async () => {
    if (!nextStatus) return;
    setBusy(true);
    setError('');
    try {
      const updated = await complaintService.updateComplaintStatus(complaint.id, nextStatus, notes);
      onUpdated(updated);
      setNextStatus('');
      setNotes('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const runReanalyze = async () => {
    setBusy(true);
    setError('');
    try {
      const updated = await complaintService.reanalyzeComplaint(complaint.id);
      onUpdated(updated);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const getRecommendations = async () => {
    setRecommending(true);
    setError('');
    try {
      const recs = await recommendOfficer(complaint.id);
      setRecommendations(recs);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setRecommending(false);
    }
  };

  const clearReview = async () => {
    setBusy(true);
    setError('');
    try {
      const updated = await complaintService.updateComplaint(complaint.id, { review_required: false });
      onUpdated(updated);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-4 p-4">
      <h3 className="text-sm font-semibold text-slate-800">Admin actions</h3>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {complaint.review_required && (
        <div className="rounded-lg border border-pink-200 bg-pink-50 p-3">
          <p className="text-sm font-medium text-pink-700">Flagged for review</p>
          <p className="mt-0.5 text-xs text-pink-600">{complaint.review_reason || 'No reason provided.'}</p>
          <div className="mt-2 flex gap-2">
            <button disabled={busy} onClick={clearReview} className="btn-secondary text-xs">
              Clear flag
            </button>
            {(complaint.ai_analysis_failed || true) && (
              <button disabled={busy} onClick={runReanalyze} className="btn-secondary text-xs">
                Re-run AI analysis
              </button>
            )}
          </div>
        </div>
      )}

      <div>
        <label className="label">Department</label>
        <select
          className="input"
          value={departmentId}
          onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">Select department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className="label">Officer (optional)</label>
          <button type="button" onClick={getRecommendations} disabled={recommending || !departmentId} className="text-xs font-medium text-brand-600 hover:underline disabled:opacity-50">
            {recommending ? 'Checking workload...' : 'Recommend officer'}
          </button>
        </div>
        <select className="input" value={officerId} onChange={(e) => setOfficerId(e.target.value ? Number(e.target.value) : '')}>
          <option value="">Unassigned</option>
          {availableOfficers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        {recommendations && recommendations.length > 0 && (
          <div className="mt-2 space-y-1">
            {recommendations.slice(0, 3).map((r, i) => (
              <button
                key={r.officerId}
                type="button"
                onClick={() => setOfficerId(r.officerId)}
                className="flex w-full items-center justify-between rounded-md border border-slate-100 px-2 py-1.5 text-left text-xs hover:bg-slate-50"
              >
                <span>
                  {i === 0 && <span className="mr-1 text-green-600">★</span>}
                  {r.name}
                </span>
                <span className="text-slate-400">
                  {r.workload} active · {r.criticalCount} critical
                  {r.avgDistanceMeters !== null ? ` · ${Math.round(r.avgDistanceMeters)}m avg` : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button disabled={busy || !departmentId} onClick={runReassign} className="btn-secondary w-full">
        Save assignment
      </button>

      {statusOptions.length > 0 && (
        <div className="border-t border-slate-100 pt-4">
          <label className="label">Change status</label>
          <select className="input" value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
            <option value="">Select new status</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <textarea
            rows={2}
            className="input mt-2"
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <button disabled={busy || !nextStatus} onClick={runStatusChange} className="btn-primary mt-2 w-full">
            Apply status change
          </button>
        </div>
      )}
    </div>
  );
}
