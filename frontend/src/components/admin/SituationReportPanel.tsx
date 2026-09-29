import React, { useState } from 'react';
import { generateSituationReport } from '../../services/intelligence.service';
import { getErrorMessage } from '../../services/api';
import type { SituationReport } from '../../services/intelligence.service';

// Section 11: AI daily situation report. Generated only on explicit admin action (never
// automatically) to avoid unnecessary OpenAI calls - the model is given only verified
// aggregated numbers, shown alongside so admins can see exactly what it was based on.
export function SituationReportPanel({ latest }: { latest: SituationReport | null }) {
  const [report, setReport] = useState<SituationReport | null>(latest);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await generateSituationReport();
      if (!data.available || !data.report) {
        setError(data.reason || 'Could not generate a situation report right now.');
      } else {
        setReport(data.report);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">AI Situation Report</h3>
        <button type="button" onClick={handleGenerate} disabled={loading} className="btn-secondary text-xs">
          {loading ? 'Generating...' : 'Generate report'}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-amber-600">{error}</p>}

      {report ? (
        <div className="mt-3">
          <p className="text-xs text-slate-400">
            Generated {new Date(report.created_at).toLocaleString()}
            {report.generated_by_name ? ` by ${report.generated_by_name}` : ''}
          </p>
          <p className="mt-2 text-sm text-slate-700">{report.summary.summary}</p>

          {report.summary.highlights.length > 0 && (
            <ul className="mt-2 space-y-1">
              {report.summary.highlights.map((h, i) => (
                <li key={i} className="text-sm text-slate-600">
                  • {h}
                </li>
              ))}
            </ul>
          )}

          {report.summary.recommended_focus_areas.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Recommended focus areas</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {report.summary.recommended_focus_areas.map((f, i) => (
                  <span key={i} className="badge border-brand-100 bg-brand-50 text-brand-700">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-400">
            Based only on verified aggregated statistics from this system at generation time - never invented figures.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-400">No report generated yet today.</p>
      )}
    </div>
  );
}
