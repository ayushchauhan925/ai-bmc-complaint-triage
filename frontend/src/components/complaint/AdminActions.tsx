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
  const [success, setSuccess] = useState('');
  const [recommendations, setRecommendations] = useState<OfficerRecommendation[] | null>(null);
  const [recommending, setRecommending] = useState(false);

  useEffect(() => {
    adminService.listDepartments().then(setDepartments).catch(() => {});
    adminService.listOfficers().then(setOfficers).catch(() => {});
  }, []);

  // Only ACTIVE officers of the selected department can receive the complaint (the server enforces this too).
  const availableOfficers = officers.filter((o) => o.department_id === departmentId && o.is_active !== 0 && o.is_active !== false);
  const statusOptions = NEXT_STATUS_OPTIONS[complaint.status] || [];

  const runReassign = async () => {
    if (!departmentId) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const updated = await adminService.assignComplaint(complaint.id, Number(departmentId), officerId ? Number(officerId) : undefined);
      onUpdated(updated);
      const officer = officerId ? officers.find((o) => o.id === Number(officerId)) : undefined;
      const department = departments.find((d) => d.id === Number(departmentId));
      setSuccess(
        officer
          ? `Complaint successfully assigned to ${officer.name} (${officer.email}).`
          : `Complaint successfully assigned to ${department?.name ?? 'the department'} (no officer selected, it stays in the department queue).`
      );
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
    setSuccess('');
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
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

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
          onChange={(e) => { setDepartmentId(e.target.value ? Number(e.target.value) : ''); setOfficerId(''); setRecommendations(null); }}
        >
          <option value="">Select department</option>
          {departments.map((d) => {
            const inactive = d.is_active === 0 || d.is_active === false;
            return (
              <option key={d.id} value={d.id} disabled={inactive}>
                {d.name}{inactive ? ' (inactive)' : ''}
              </option>
            );
          })}
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
              {o.name} ({o.email})
            </option>
          ))}
        </select>
        {recommendations && recommendations.length === 0 && (
          <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-800">No active officers in this department yet. <a className="font-medium underline" href="/admin/officers">Add an officer</a> or leave the complaint in the department queue.</p>
        )}
        {recommendations && recommendations.length > 0 && (
          <div className="mt-2 space-y-1.5" role="list" aria-label="Recommended officers">
            <p className="text-[11px] text-slate-500">Ranked by ward match, workload, critical load, SLA breaches and proximity. The final choice is yours.</p>
            {recommendations.slice(0, 4).map((r, i) => (
              <button
                key={r.officerId}
                type="button"
                role="listitem"
                onClick={() => setOfficerId(r.officerId)}
                aria-pressed={officerId === r.officerId}
                className={`w-full rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${officerId === r.officerId ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-800">
                    <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">{r.rank ?? i + 1}</span>
                    {i === 0 && <span className="mr-1 text-green-600" title="Top recommendation">★</span>}
                    {r.name} <span className="font-normal text-slate-500">({r.email})</span>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    {r.wardMatch && <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-800">Same ward</span>}
                    {r.wardName && !r.wardMatch && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">{r.wardName}</span>}
                  </span>
                </span>
                <span className="mt-0.5 block text-slate-500">{r.reasons && r.reasons.length > 0 ? r.reasons.join(' · ') : `${r.workload} active · ${r.criticalCount} critical`}{r.avgDistanceMeters !== null ? ` · ~${Math.round(r.avgDistanceMeters)} m from their current work` : ''}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <button disabled={busy || !departmentId} onClick={runReassign} className="btn-secondary w-full">
        Save assignment
      </button>
      {success && <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">✓ {success}</p>}

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
