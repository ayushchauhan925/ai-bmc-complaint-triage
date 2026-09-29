import React from 'react';
import { formatStatus } from '../../utils/constants';
import type { ComplaintHistoryEntry } from '../../utils/types';

export function StatusTimeline({ history }: { history: ComplaintHistoryEntry[] }) {
  if (!history?.length) return <p className="text-sm text-slate-400">No history yet.</p>;

  return (
    <ol className="relative border-l border-slate-200 pl-5">
      {history.map((entry, idx) => (
        <li key={entry.id} className="mb-6 last:mb-0">
          <span
            className={`absolute -left-[7px] flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white ${
              idx === history.length - 1 ? 'bg-brand-600' : 'bg-slate-300'
            }`}
          />
          <p className="text-sm font-medium text-slate-800">{formatStatus(entry.new_status)}</p>
          {entry.notes && <p className="mt-0.5 text-sm text-slate-500">{entry.notes}</p>}
          <p className="mt-0.5 text-xs text-slate-400">
            {new Date(entry.created_at).toLocaleString()}
            {entry.actor_name ? ` · ${entry.actor_name} (${entry.actor_role})` : ' · System (AI/automation)'}
          </p>
        </li>
      ))}
    </ol>
  );
}
