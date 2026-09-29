import React, { useState } from 'react';
import { checkDuplicates } from '../../services/complaint.service';
import { getErrorMessage } from '../../services/api';
import { formatCategory } from '../../utils/constants';
import type { DuplicateMatch } from '../../utils/types';

// Section 16: pre-submission duplicate warning. Manual trigger (not auto-fired on every
// keystroke) to avoid unnecessary OpenAI calls - shown as an opt-in check. Never blocks
// submission either way.
export function DuplicateWarning({
  description,
  location,
}: {
  description: string;
  location: { lat: number; lng: number } | null;
}) {
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState('');
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);

  const canCheck = description.trim().length >= 5 && !!location;

  const handleCheck = async () => {
    if (!location) return;
    setLoading(true);
    setError('');
    try {
      const results = await checkDuplicates(description, location.lat, location.lng);
      setDuplicates(results);
      setChecked(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not check for similar complaints right now.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button type="button" onClick={handleCheck} disabled={!canCheck || loading} className="btn-secondary text-xs">
        {loading ? 'Checking...' : 'Check for similar complaints nearby'}
      </button>
      {!canCheck && (
        <p className="mt-1 text-xs text-slate-400">Add a description and a location first.</p>
      )}
      {error && <p className="mt-2 text-xs text-amber-600">{error}</p>}

      {checked && duplicates.length === 0 && (
        <p className="mt-2 text-xs text-green-600">No similar complaints found nearby.</p>
      )}

      {checked && duplicates.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-800">
            {duplicates.length} similar complaint{duplicates.length === 1 ? '' : 's'} found within 300m.
          </p>
          <ul className="mt-2 space-y-1.5">
            {duplicates.slice(0, 5).map((d) => (
              <li key={d.complaint_id} className="flex items-center justify-between text-xs text-amber-700">
                <span>
                  {formatCategory(d.category)} - {d.distance_meters}m away - {new Date(d.created_at).toLocaleDateString()}
                </span>
                <span className="font-medium">{d.incident_id ? 'Part of an incident' : d.status.replace(/_/g, ' ')}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-600">
            You can still submit your own report - it helps confirm the issue and speeds up resolution.
          </p>
        </div>
      )}
    </div>
  );
}
