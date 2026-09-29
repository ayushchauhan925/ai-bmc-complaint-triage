import React from 'react';
import type { EvidenceAnalysis } from '../../utils/types';

const CHECKS: { key: keyof EvidenceAnalysis; label: string; positiveIsGood: boolean }[] = [
  { key: 'issue_visible', label: 'Issue visible', positiveIsGood: true },
  { key: 'image_supports_claim', label: 'Image supports complaint', positiveIsGood: true },
  { key: 'image_quality_sufficient', label: 'Image quality sufficient', positiveIsGood: true },
  { key: 'is_blurry', label: 'Image appears blurry', positiveIsGood: false },
  { key: 'likely_irrelevant', label: 'May be unrelated', positiveIsGood: false },
  { key: 'possible_duplicate_image', label: 'Possible duplicate image', positiveIsGood: false },
  { key: 'manipulated_or_suspicious', label: 'Signs of manipulation', positiveIsGood: false },
];

// Section 3: Evidence Intelligence. Shows the per-image quality/relevance/authenticity
// assessment as a confidence score + plain checklist - never used to auto-reject, only to
// flag for review (see review_required / review_reason shown elsewhere on the page).
export function EvidenceIntelligence({ evidence, confidence }: { evidence: EvidenceAnalysis | null; confidence: number | null }) {
  if (!evidence) return null;

  const relevantChecks = CHECKS.filter((c) => {
    // Only show "bad" signals when true, and "good" signals always (so the panel stays
    // compact rather than a wall of green checkmarks + irrelevant negatives).
    const value = evidence[c.key];
    return c.positiveIsGood || value === true;
  });

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Evidence Intelligence</h3>
        {confidence !== null && (
          <span className="badge border-slate-200 bg-slate-100 text-slate-600">
            Evidence confidence: {Math.round(confidence * 100)}%
          </span>
        )}
      </div>

      <ul className="mt-3 space-y-1.5">
        {relevantChecks.map((c) => {
          const value = evidence[c.key] as boolean;
          const isGood = c.positiveIsGood ? value : !value;
          return (
            <li key={c.key} className="flex items-center gap-2 text-sm text-slate-600">
              <span className={isGood ? 'text-green-500' : 'text-amber-500'}>{isGood ? '✓' : '⚠'}</span>
              {c.label}
            </li>
          );
        })}
      </ul>

      {evidence.issue_type && (
        <p className="mt-2 text-xs text-slate-500">Detected: {evidence.issue_type}</p>
      )}
      {evidence.contextual_notes && (
        <p className="mt-1 text-xs text-slate-400">{evidence.contextual_notes}</p>
      )}
    </div>
  );
}
