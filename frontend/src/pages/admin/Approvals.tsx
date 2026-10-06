import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as adminService from '../../services/admin.service';
import * as complaintService from '../../services/complaint.service';
import { getErrorMessage } from '../../services/api';
import { PriorityBadge, CategoryBadge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { ImageGallery } from '../../components/complaint/ImageGallery';
import { ResolutionVerificationCard } from '../../components/complaint/ResolutionVerificationCard';
import { PageHeader, QueryBoundary, CardSkeleton, Tabs, fmtDate } from '../../components/ui/kit';
import { StatusBadge } from '../../components/common/Badge';
import { DataTable, useClientTable, type Column } from '../../components/table';
import { ComplaintIdCell, DateCell } from '../../components/table/Cells';
import type { Complaint } from '../../utils/types';

type Tab = 'awaiting' | adminService.ResolutionView;

/**
 * Everything that happens around a resolution:
 *  - Awaiting approval: fixes submitted by officers (approve = Resolved, send back = In progress).
 *  - Approved: complaints an admin marked Resolved.
 *  - Citizen: resolved: ... where the citizen said it is really fixed.
 *  - Awaiting feedback: ... where the citizen has not answered yet.
 *  - Citizen: not resolved: every time a citizen said the fix did not work (the complaint was reopened), with their reason.
 */
export default function Approvals() {
  const qc = useQueryClient();
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Tab>('awaiting');

  const awaiting = useQuery({
    queryKey: ['approvals'],
    queryFn: () => adminService.listComplaints({ limit: 100, status: 'RESOLUTION_SUBMITTED', sort: 'updated_at', order: 'asc' }),
    refetchInterval: 60_000,
  });
  // Every overview response carries the counts for all the tab badges.
  const view: adminService.ResolutionView = tab === 'awaiting' ? 'approved' : tab;
  const overview = useQuery({ queryKey: ['resolutions', view], queryFn: () => adminService.getResolutions(view), refetchInterval: 60_000 });
  const counts = overview.data?.counts;

  const done = (message: string) => {
    setNotice(message);
    qc.invalidateQueries({ queryKey: ['approvals'] });
    qc.invalidateQueries({ queryKey: ['resolutions'] });
    qc.invalidateQueries({ queryKey: ['overview'] });
    qc.invalidateQueries({ queryKey: ['officer-queue'] });
  };

  const refreshing = awaiting.isFetching || overview.isFetching;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Resolutions"
        description="Approve fixes submitted by officers, then follow what the citizen says: confirmed as resolved, still waiting for feedback, or reported as not resolved (reopened). The AI check is advice only; the decision is yours."
        actions={<button className="btn-secondary !py-1.5 text-xs" onClick={() => { awaiting.refetch(); overview.refetch(); }} disabled={refreshing}>{refreshing ? 'Refreshing…' : 'Refresh'}</button>}
      />
      {notice && <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">✓ {notice}</p>}

      <div className="mt-5">
        <Tabs<Tab>
          tabs={[
            { id: 'awaiting', label: 'Awaiting approval', badge: awaiting.data?.rows.length },
            { id: 'approved', label: 'Approved', badge: counts?.approved },
            { id: 'confirmed', label: 'Citizen: resolved', badge: counts?.confirmed },
            { id: 'awaiting-feedback', label: 'Awaiting feedback', badge: counts?.awaitingFeedback },
            { id: 'not-resolved', label: 'Citizen: not resolved', badge: counts?.notResolved },
          ]}
          value={tab}
          onChange={(next) => { setTab(next); setNotice(''); }}
        />
      </div>

      <div className="mt-4">
        {tab === 'awaiting' ? (
          <QueryBoundary query={awaiting} skeleton={<CardSkeleton lines={6} />}>
            {(res) => res.rows.length === 0 ? (
              <EmptyState title="No resolutions waiting" description="When an officer submits a fix, it appears here for your approval." />
            ) : (
              <ul className="space-y-4">
                {res.rows.map((c) => <ApprovalCard key={c.id} complaint={c} onDone={done} />)}
              </ul>
            )}
          </QueryBoundary>
        ) : (
          <ResolutionTable tab={tab} query={overview} />
        )}
      </div>
    </div>
  );
}

const TAB_COPY: Record<adminService.ResolutionView, { title: string; text: string }> = {
  approved: { title: 'No approved complaints yet', text: 'Complaints you mark as Resolved appear here.' },
  confirmed: { title: 'No citizen confirmations yet', text: 'When a citizen confirms the fix worked, the complaint appears here.' },
  'awaiting-feedback': { title: 'Nothing waiting for the citizen', text: 'Every approved complaint has had a citizen response.' },
  'not-resolved': { title: 'No complaints reported as not resolved', text: 'When a citizen says a fix did not work and the complaint is reopened, it appears here with their reason.' },
};

function Stars({ n }: { n: number }) {
  return <span className="text-amber-500" aria-label={`${n} out of 5 stars`}>{'★'.repeat(n)}<span className="text-slate-300">{'★'.repeat(5 - n)}</span></span>;
}

type TableQuery = { data?: adminService.ResolutionOverview; isLoading: boolean; isFetching: boolean; error: unknown; refetch: () => unknown };

function ResolutionTable({ tab, query }: { tab: adminService.ResolutionView; query: TableQuery }) {
  const rows = query.data?.view === tab ? query.data.rows : undefined;
  const table = useClientTable(rows ?? [], {
    complaint: (r) => r.complaint_number,
    citizen: (r) => r.citizen_name,
    department: (r) => r.department_name,
    when: (r) => new Date(String(tab === 'not-resolved' ? r.reopen?.created_at : r.resolved_at).replace(' ', 'T')).getTime(),
  });

  const complaintCol: Column<adminService.ResolutionRow> = {
    id: 'complaint', header: 'Complaint', sortKey: 'complaint', locked: true, truncate: true,
    cell: (r) => (<><ComplaintIdCell id={r.id} number={r.complaint_number} /><span className="block max-w-xs truncate text-xs text-slate-500">{r.title}</span></>),
  };
  const citizenCol: Column<adminService.ResolutionRow> = { id: 'citizen', header: 'Citizen', sortKey: 'citizen', hideBelow: 'lg', cell: (r) => r.citizen_name };
  const deptCol: Column<adminService.ResolutionRow> = {
    id: 'department', header: 'Department / officer', sortKey: 'department', hideBelow: 'xl', truncate: true,
    cell: (r) => (<>{r.department_name ?? '—'}{r.officer_name && <span className="block text-xs text-slate-500">{r.officer_name}{r.officer_email ? ` (${r.officer_email})` : ''}</span>}</>),
  };
  const openCol: Column<adminService.ResolutionRow> = {
    id: 'actions', header: '', width: 'w-20', align: 'right', locked: true,
    cell: (r) => <Link to={`/complaints/${r.id}`} className="btn-secondary !px-2.5 !py-1 text-xs" aria-label={`Open ${r.complaint_number}`}>Open</Link>,
  };

  const columns: Column<adminService.ResolutionRow>[] = tab === 'not-resolved'
    ? [
        complaintCol, citizenCol,
        { id: 'when', header: 'Reported not resolved', sortKey: 'when', firstSort: 'desc', width: 'w-44', cell: (r) => <DateCell value={r.reopen?.created_at} relative /> },
        { id: 'reason', header: 'Reason given', truncate: true, cell: (r) => <span title={r.reopen?.reason ?? ''}>{r.reopen?.reason || <span className="text-slate-400">No reason given</span>}</span> },
        { id: 'status', header: 'Status now', width: 'w-32', cell: (r) => <StatusBadge status={r.status} /> },
        deptCol, openCol,
      ]
    : [
        complaintCol, citizenCol, deptCol,
        { id: 'when', header: 'Approved on', sortKey: 'when', firstSort: 'desc', width: 'w-40', cell: (r) => <DateCell value={r.resolved_at} relative /> },
        {
          id: 'response', header: 'Citizen response', width: 'w-56',
          cell: (r) => r.feedback
            ? (<>
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${r.feedback.resolved ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{r.feedback.resolved ? '✓ Confirmed resolved' : 'Not resolved'}</span>
                {r.feedback.rating ? <span className="ml-1.5"><Stars n={r.feedback.rating} /></span> : null}
                {r.feedback.comment && <span className="mt-0.5 block max-w-[14rem] truncate text-xs italic text-slate-500" title={r.feedback.comment}>“{r.feedback.comment}”</span>}
              </>)
            : <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">Awaiting feedback</span>,
        },
        openCol,
      ];

  const copy = TAB_COPY[tab];
  return (
    <DataTable<adminService.ResolutionRow>
      caption={tab === 'not-resolved' ? 'Complaints a citizen reported as not resolved' : 'Resolved complaints and the citizen response'}
      columns={columns}
      rows={rows ? table.rows : undefined}
      rowKey={(r) => (r.reopen ? `${r.id}-${r.reopen.created_at}` : String(r.id))}
      isLoading={query.isLoading || (!rows && !query.error)}
      isFetching={query.isFetching}
      error={query.error}
      errorTitle="Unable to load resolutions"
      onRetry={() => query.refetch()}
      emptyTitle={copy.title}
      emptyDescription={copy.text}
      sort={table.sort}
      onSortChange={table.setSort}
      pagination={{ ...table.pagination, noun: 'complaints' }}
    />
  );
}

function ApprovalCard({ complaint, onDone }: { complaint: Complaint; onDone: (message: string) => void }) {
  const detail = useQuery({ queryKey: ['approval-detail', complaint.id], queryFn: () => complaintService.getComplaint(complaint.id) });
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const submitted = detail.data?.history?.filter((h) => h.new_status === 'RESOLUTION_SUBMITTED').slice(-1)[0];

  const decide = useMutation({
    mutationFn: (v: { status: 'RESOLVED' | 'IN_PROGRESS'; notes: string }) => complaintService.updateComplaintStatus(complaint.id, v.status, v.notes || undefined),
    onSuccess: (_data, v) => onDone(v.status === 'RESOLVED'
      ? `${complaint.complaint_number} approved and marked Resolved. The citizen can now give feedback.`
      : `${complaint.complaint_number} sent back to the officer (In progress).`),
    onError: (e) => setError(getErrorMessage(e)),
  });

  const approve = () => { setError(''); decide.mutate({ status: 'RESOLVED', notes: note.trim() }); };
  const sendBack = () => {
    if (note.trim().length < 3) { setError('Please write a short reason so the officer knows what to fix.'); return; }
    setError('');
    decide.mutate({ status: 'IN_PROGRESS', notes: note.trim() });
  };

  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs"><Link to={`/complaints/${complaint.id}`} className="font-mono font-medium text-brand-600 hover:underline">{complaint.complaint_number}</Link><span className="ml-2 text-slate-400">Reported {fmtDate(complaint.created_at)}</span></p>
          <p className="mt-1 text-sm font-medium text-slate-900">{complaint.ai_title || complaint.description}</p>
          {complaint.address && <p className="mt-0.5 text-xs text-slate-500">{complaint.address}</p>}
        </div>
        <div className="flex gap-1.5"><PriorityBadge level={complaint.priority_level} /><CategoryBadge category={complaint.category} /></div>
      </div>

      {submitted && (
        <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <strong>Officer {submitted.actor_name ?? ''}</strong> submitted this resolution on {fmtDate(submitted.created_at)}.
          {submitted.notes && <> Note: <em>{submitted.notes}</em></>}
        </p>
      )}

      <div className="mt-4">
        {detail.isLoading && <p className="text-sm text-slate-400">Loading photos…</p>}
        {detail.isError && <p role="alert" className="text-sm text-red-600">{getErrorMessage(detail.error)}</p>}
        {detail.data && (
          <div className="space-y-3">
            <ImageGallery images={detail.data.images ?? []} />
            <ResolutionVerificationCard verification={detail.data.resolution_verification} />
            {!detail.data.resolution_verification && <p className="text-xs text-slate-400">No AI before/after check is available for this resolution.</p>}
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <label className="label" htmlFor={`note-${complaint.id}`}>Note <span className="font-normal text-slate-400">(optional for approval, required to send back)</span></label>
        <textarea id={`note-${complaint.id}`} rows={2} className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Verified from photos, or: the drain grate is still blocked on the left side." />
        {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-primary" disabled={decide.isPending} onClick={approve}>{decide.isPending ? 'Saving…' : 'Approve resolution'}</button>
          <button className="btn-secondary" disabled={decide.isPending} onClick={sendBack}>Send back to officer</button>
          <Link to={`/complaints/${complaint.id}`} className="btn-secondary">Open full complaint</Link>
        </div>
      </div>
    </li>
  );
}
