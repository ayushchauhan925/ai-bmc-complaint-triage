import React from 'react';
import { PriorityBadge, SlaBadge } from '../common/Badge';
import { formatCategory } from '../../utils/constants';
import { fmtDate } from '../ui/kit';
import type { IncidentIntelligence } from '../../services/platform.service';

const TREND: Record<string, { label: string; cls: string; arrow: string }> = {
  RISING: { label: 'Rising', cls: 'text-red-700', arrow: '↑' },
  STABLE: { label: 'Stable', cls: 'text-slate-700', arrow: '→' },
  FALLING: { label: 'Falling', cls: 'text-green-700', arrow: '↓' },
  INSUFFICIENT_DATA: { label: 'Not enough reports to judge a trend', cls: 'text-slate-500', arrow: '' },
};

/** Incident command summary - every value is derived from stored complaints/escalations. */
export function IncidentIntel({ intel }: { intel: IncidentIntelligence }) {
  const trend = TREND[intel.trend.label];
  return (
    <div className="card mt-4 p-4">
      <h2 className="text-sm font-semibold text-slate-800">Incident intelligence</h2>
      <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div><dt className="text-xs text-slate-500">Complaints</dt><dd className="mt-0.5 text-lg font-semibold text-slate-900">{intel.complaintCount}<span className="ml-1 text-xs font-normal text-slate-400">{intel.openComplaintCount} open</span></dd></div>
        <div><dt className="text-xs text-slate-500">Severity</dt><dd className="mt-0.5"><PriorityBadge level={intel.severity} /></dd></div>
        <div>
          <dt className="text-xs text-slate-500">Trend</dt>
          <dd className={`mt-0.5 text-sm font-medium ${trend.cls}`}>{trend.arrow} {trend.label}
            {intel.trend.last24h !== null && <span className="block text-xs font-normal text-slate-400">{intel.trend.last24h} in last 24 h vs {intel.trend.previous24h} before</span>}
          </dd>
        </div>
        <div><dt className="text-xs text-slate-500">Affected area</dt><dd className="mt-0.5 text-sm font-medium text-slate-800">{intel.extent ? `~${intel.extent.radiusMeters} m radius` : '—'}</dd></div>
        <div><dt className="text-xs text-slate-500">First reported</dt><dd className="mt-0.5 text-sm text-slate-700">{fmtDate(intel.firstReportedAt)}</dd></div>
        <div><dt className="text-xs text-slate-500">Latest report</dt><dd className="mt-0.5 text-sm text-slate-700">{fmtDate(intel.latestReportedAt)}</dd></div>
        <div><dt className="text-xs text-slate-500">Worst SLA state</dt><dd className="mt-0.5"><SlaBadge status={intel.sla.worstStatus} /><span className="block text-xs text-slate-400">{intel.sla.breachedCount} breached</span></dd></div>
        <div><dt className="text-xs text-slate-500">Next deadline</dt><dd className="mt-0.5 text-sm text-slate-700">{fmtDate(intel.sla.nextDeadline)}</dd></div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {intel.categories.map((c) => <span key={c.category} className="badge border border-brand-100 bg-brand-50 text-brand-700">{formatCategory(c.category)} · {c.count}</span>)}
      </div>

      {intel.escalation.events.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="text-xs font-medium text-slate-500">Escalations ({intel.escalation.openCount} open)</p>
          <ul className="mt-1 space-y-1 text-sm">
            {intel.escalation.events.slice(0, 5).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2"><span className="text-slate-700">{e.title}</span><span className="badge border border-slate-200 bg-slate-100 text-slate-600">{e.status.toLowerCase()}</span></li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
