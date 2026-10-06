import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMyResolutions } from '../../services/officer.service';
import type { ResolutionView } from '../../services/admin.service';
import { PageHeader, Tabs } from '../../components/ui/kit';
import { ResolutionTable } from '../../components/resolution/ResolutionTable';

type Scope = 'mine' | 'department';

const TAB_HELP: Record<ResolutionView, string> = {
  'awaiting-approval': 'Fixes you submitted that are waiting for an admin to approve them.',
  'sent-back': 'An admin sent these back for more work. The admin note says what to fix.',
  approved: 'An admin approved these and marked them Resolved.',
  confirmed: 'Successfully solved: approved by an admin and confirmed as really fixed by the citizen.',
  'awaiting-feedback': 'Approved by an admin. The citizen has not yet said whether the problem is really gone.',
  'not-resolved': 'The citizen said the problem was not actually fixed, so the complaint was reopened.',
};

/** Where the officer's fixes ended up: approval status from the admin, and what the citizen said. */
export default function Outcomes() {
  const [tab, setTab] = useState<ResolutionView>('confirmed');
  const [scope, setScope] = useState<Scope>('mine');

  // Every response carries the counts for all the tab badges.
  const q = useQuery({ queryKey: ['officer-outcomes', scope, tab], queryFn: () => getMyResolutions(tab, scope), refetchInterval: 60_000 });
  const counts = q.data?.counts;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Outcomes"
        description="See which fixes the admin approved, which are still waiting or were sent back, and what citizens said: confirmed as solved, or reported as not resolved."
        actions={<button className="btn-secondary !py-1.5 text-xs" onClick={() => q.refetch()} disabled={q.isFetching}>{q.isFetching ? 'Refreshing…' : 'Refresh'}</button>}
      />

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Tabs<ResolutionView>
            tabs={[
              { id: 'confirmed', label: 'Solved (citizen confirmed)', badge: counts?.confirmed },
              { id: 'approved', label: 'Approved by admin', badge: counts?.approved },
              { id: 'awaiting-approval', label: 'Awaiting approval', badge: counts?.awaitingApproval },
              { id: 'sent-back', label: 'Sent back', badge: counts?.sentBack },
              { id: 'awaiting-feedback', label: 'Awaiting citizen', badge: counts?.awaitingFeedback },
              { id: 'not-resolved', label: 'Citizen: not resolved', badge: counts?.notResolved },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
        <div>
          <label className="label" htmlFor="outcomes-scope">Show</label>
          <select id="outcomes-scope" className="input w-auto" value={scope} onChange={(e) => setScope(e.target.value as Scope)}>
            <option value="mine">My complaints</option>
            <option value="department">Whole department</option>
          </select>
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-600">{TAB_HELP[tab]}</p>

      <div className="mt-3">
        <ResolutionTable tab={tab} query={q} />
      </div>
    </div>
  );
}
