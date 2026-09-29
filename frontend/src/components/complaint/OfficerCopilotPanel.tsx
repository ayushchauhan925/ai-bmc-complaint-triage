import React, { useState } from 'react';
import { getAiAssistance } from '../../services/officer.service';
import { getErrorMessage } from '../../services/api';
import type { OfficerChecklist } from '../../utils/types';

// Section 12: Officer AI Copilot - advisory suggestions only, never official instructions.
export function OfficerCopilotPanel({ complaintId }: { complaintId: number }) {
  const [loading, setLoading] = useState(false);
  const [checklist, setChecklist] = useState<OfficerChecklist | null>(null);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const handleLoad = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAiAssistance(complaintId);
      if (data.unavailable) {
        setError('AI assistance is temporarily unavailable.');
      } else {
        setChecklist(data.checklist);
      }
      setLoaded(true);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (!loaded) {
    return (
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-slate-800">AI Work Assistant</h3>
        <p className="mt-1 text-xs text-slate-400">
          Get an advisory inspection and evidence checklist for this complaint - not an official BMC instruction.
        </p>
        <button type="button" onClick={handleLoad} disabled={loading} className="btn-secondary mt-3 text-xs">
          {loading ? 'Generating...' : 'Get AI suggestions'}
        </button>
        {error && <p className="mt-2 text-xs text-amber-600">{error}</p>}
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-slate-800">AI Work Assistant</h3>
        <p className="mt-2 text-xs text-amber-600">{error || 'No suggestions available.'}</p>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">AI Work Assistant</h3>
        <span className="badge border-slate-200 bg-slate-100 text-slate-500">Advisory only</span>
      </div>

      <ChecklistSection title="Inspection checklist" items={checklist.inspection_checklist} />
      <ChecklistSection title="Evidence to collect" items={checklist.evidence_to_collect} />
      <ChecklistSection title="Before marking resolved" items={checklist.resolution_checklist} />
    </div>
  );
}

function ChecklistSection({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{title}</p>
      <ul className="mt-1 space-y-1">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
            <span className="mt-0.5 text-slate-300">□</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
