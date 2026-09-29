import React, { useState } from 'react';
import { reopenComplaint } from '../../services/complaint.service';
import { getErrorMessage } from '../../services/api';
import type { Complaint } from '../../utils/types';

// Section 17: citizen reopens a resolved complaint with a reason + optional evidence photo.
export function ReopenDialog({
  complaintId,
  onReopened,
}: {
  complaintId: number;
  onReopened: (c: Complaint) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary text-sm">
        Report issue not actually resolved
      </button>
    );
  }

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const updated = await reopenComplaint(complaintId, reason, image);
      onReopened(updated);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-slate-800">Report that this issue is not resolved</h3>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <textarea
        rows={2}
        className="input mt-3"
        placeholder="What's still wrong?"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="mt-2">
        <label className="label">Photo (optional)</label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setImage(e.target.files?.[0] || null)}
          className="text-sm"
        />
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={handleSubmit} disabled={submitting} className="btn-danger text-sm">
          {submitting ? 'Submitting...' : 'Reopen complaint'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}
