import React from 'react';
import { tr } from '../../i18n';

const STAGE_KEYS = ['progress.received', 'progress.assigned', 'progress.inProgress', 'progress.resolved'];

// Maps the detailed internal status onto four citizen-friendly stages.
export function stageFor(status: string): { index: number; label: string; closed: boolean } {
  switch (status) {
    case 'SUBMITTED':
    case 'AI_ANALYZED':
      return { index: 0, label: 'Received', closed: false };
    case 'NEEDS_REVIEW':
      return { index: 0, label: 'Under review', closed: false };
    case 'ASSIGNED':
      return { index: 1, label: 'Assigned to department', closed: false };
    case 'IN_PROGRESS':
    case 'RESOLUTION_SUBMITTED':
      return { index: 2, label: 'Work in progress', closed: false };
    case 'REOPENED':
      return { index: 1, label: 'Reopened', closed: false };
    case 'RESOLVED':
      return { index: 3, label: 'Resolved', closed: false };
    case 'REJECTED':
      return { index: -1, label: 'Closed', closed: true };
    default:
      return { index: 0, label: status, closed: false };
  }
}

/** Four-step progress indicator. Text labels carry the meaning; colour is reinforcement only. */
export function ProgressTracker({ status, compact = false }: { status: string; compact?: boolean }) {
  const stage = stageFor(status);
  if (stage.closed) {
    return <p className="text-xs text-slate-500">{tr('progress.closed')}</p>;
  }
  const STAGES = STAGE_KEYS.map((k) => tr(k));
  return (
    <div>
      <ol className="flex items-center gap-1" aria-label={`Progress: ${stage.label}`}>
        {STAGES.map((s, i) => {
          const done = i <= stage.index;
          return (
            <li key={s} className="flex flex-1 items-center gap-1" aria-current={i === stage.index ? 'step' : undefined}>
              <span className={`h-1.5 flex-1 rounded-full ${done ? (stage.index === 3 ? 'bg-green-500' : 'bg-brand-500') : 'bg-slate-200'}`} />
            </li>
          );
        })}
      </ol>
      <div className={`mt-1.5 flex justify-between text-[11px] ${compact ? 'hidden sm:flex' : 'flex'}`}>
        {STAGES.map((s, i) => (
          <span key={s} className={i === stage.index ? 'font-semibold text-slate-700' : 'text-slate-400'}>{s}</span>
        ))}
      </div>
      {compact && <p className="mt-1 text-xs font-medium text-slate-600 sm:hidden">{stage.label}</p>}
    </div>
  );
}
