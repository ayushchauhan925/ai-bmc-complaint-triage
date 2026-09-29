import React from 'react';
import { PriorityBadge } from '../common/Badge';
import type { PriorityReason } from '../../utils/types';
import type { PriorityLevel } from '../../utils/constants';

export function PriorityReasons({
  level,
  score,
  reasons,
}: {
  level: PriorityLevel;
  score: number;
  reasons: PriorityReason[] | null;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Priority</h3>
        <PriorityBadge level={level} />
      </div>
      <p className="mt-1 text-xs text-slate-400">Score {score}/100 - computed deterministically, not by the AI.</p>
      {reasons && reasons.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {reasons.map((r, i) => (
            <li key={i} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-600">
                <CheckMark /> {r.label}
              </span>
              <span className="font-mono text-xs text-slate-400">+{r.points}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-400">Priority reasons will appear once AI analysis completes.</p>
      )}
    </div>
  );
}

function CheckMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-green-500 shrink-0">
      <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
