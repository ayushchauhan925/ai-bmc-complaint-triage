import React, { useState } from 'react';
import * as officerService from '../../services/officer.service';
import { getErrorMessage } from '../../services/api';
import type { Complaint } from '../../utils/types';
import { useAuth } from '../../context/AuthContext';

export function OfficerActions({
  complaint,
  onUpdated,
}: {
  complaint: Complaint;
  onUpdated: (c: Complaint) => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [afterImage, setAfterImage] = useState<File | null>(null);
  const [notes, setNotes] = useState('');

  const isMine = complaint.officer_id === user?.id;
  const hasAfterImage = complaint.images?.some((i) => i.image_type === 'RESOLUTION');

  const run = async (fn: () => Promise<Complaint | void>) => {
    setBusy(true);
    setError('');
    try {
      const updated = await fn();
      if (updated) onUpdated(updated);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (complaint.status === 'ASSIGNED' && !complaint.officer_id) {
    return (
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-slate-800">Officer actions</h3>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <button
          disabled={busy}
          onClick={() => run(() => officerService.accept(complaint.id))}
          className="btn-primary mt-3 w-full"
        >
          Accept complaint
        </button>
      </div>
    );
  }

  if (!isMine) return null;

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-slate-800">Officer actions</h3>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {complaint.status === 'ASSIGNED' && (
        <button
          disabled={busy}
          onClick={() => run(() => officerService.start(complaint.id, notes))}
          className="btn-primary mt-3 w-full"
        >
          Start work
        </button>
      )}

      {complaint.status === 'IN_PROGRESS' && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="label">Upload after / resolution photo</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setAfterImage(e.target.files?.[0] || null)}
              className="text-sm"
            />
            {afterImage && (
              <button
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const updated = await officerService.uploadResolutionImage(complaint.id, afterImage);
                    setAfterImage(null);
                    return updated;
                  })
                }
                className="btn-secondary mt-2 text-xs"
              >
                Upload photo
              </button>
            )}
            {hasAfterImage && <p className="mt-1 text-xs text-green-600">Resolution photo uploaded.</p>}
          </div>
          <div>
            <label className="label">Work notes</label>
            <textarea rows={2} className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <button
            disabled={busy}
            onClick={() => run(async () => (await officerService.resolve(complaint.id, notes)).complaint)}
            className="btn-primary w-full"
          >
            Mark resolution submitted
          </button>
        </div>
      )}

      {complaint.status === 'RESOLUTION_SUBMITTED' && (
        <p className="mt-3 text-sm text-slate-500">Resolution submitted - waiting for admin approval.</p>
      )}
    </div>
  );
}
