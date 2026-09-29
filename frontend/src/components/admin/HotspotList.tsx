import React from 'react';
import { PriorityBadge } from '../common/Badge';
import { formatCategory } from '../../utils/constants';
import type { Hotspot } from '../../utils/types';

// Section 7: AI hotspot detection. Deterministic geo/time/category clustering, not a claim
// of official BMC analysis - see the data-scope note on the intelligence page.
export function HotspotList({ hotspots }: { hotspots: Hotspot[] }) {
  if (hotspots.length === 0) {
    return <p className="text-sm text-slate-400">No emerging hotspots detected in the last 12 hours.</p>;
  }

  return (
    <div className="space-y-2">
      {hotspots.map((h, i) => (
        <div key={i} className="rounded-lg border border-slate-100 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-800">
              {h.complaintCount} {formatCategory(h.category)} complaints
            </p>
            <PriorityBadge level={h.dominantPriority} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            within {h.radiusMeters}m, {new Date(h.timeRange.from).toLocaleTimeString()} -{' '}
            {new Date(h.timeRange.to).toLocaleTimeString()}
          </p>
        </div>
      ))}
    </div>
  );
}
