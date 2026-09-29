import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as incidentService from '../../services/incident.service';
import { PriorityBadge } from '../../components/common/Badge';
import { PageLoader } from '../../components/common/Spinner';
import { EmptyState } from '../../components/common/EmptyState';
import { formatCategory } from '../../utils/constants';
import type { Incident } from '../../utils/types';

export default function AdminIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    incidentService.listIncidents({ limit: 100 }).then((res) => setIncidents(res.rows)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-slate-900">Incidents</h1>
      <p className="mt-1 text-sm text-slate-500">Multiple complaints about the same underlying civic issue, grouped automatically.</p>

      <div className="mt-4">
        {loading ? (
          <PageLoader />
        ) : incidents.length === 0 ? (
          <EmptyState title="No incidents yet" description="Incidents form automatically when 2+ similar complaints are reported nearby." />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {incidents.map((inc) => (
              <Link key={inc.id} to={`/admin/incidents/${inc.id}`} className="card block p-4 hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-slate-400">{inc.incident_number}</p>
                    <p className="mt-1 text-sm font-medium text-slate-800">{inc.title}</p>
                  </div>
                  <PriorityBadge level={inc.priority_level} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="badge border-brand-100 bg-brand-50 text-brand-700">{formatCategory(inc.category)}</span>
                  <span>{inc.complaint_count} complaint{inc.complaint_count === 1 ? '' : 's'}</span>
                  <span>·</span>
                  <span>{inc.department_name || 'Unassigned'}</span>
                  <span>·</span>
                  <span className="badge border-slate-200 bg-slate-100 text-slate-600">{inc.status}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
