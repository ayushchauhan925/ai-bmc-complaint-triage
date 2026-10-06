import React from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../common/Badge';
import { DataTable, useClientTable, type Column } from '../table';
import { ComplaintIdCell, DateCell } from '../table/Cells';
import type { ResolutionOverview, ResolutionRow, ResolutionView } from '../../services/admin.service';

export const RESOLUTION_COPY: Record<ResolutionView, { title: string; text: string }> = {
  'awaiting-approval': { title: 'Nothing waiting for approval', text: 'Fixes that have been submitted and are waiting for an admin decision appear here.' },
  'sent-back': { title: 'Nothing sent back', text: 'When an admin sends a submitted fix back for more work, it appears here with their note.' },
  approved: { title: 'No approved complaints yet', text: 'Complaints an admin has marked as Resolved appear here.' },
  confirmed: { title: 'No citizen confirmations yet', text: 'When a citizen confirms the fix worked, the complaint appears here.' },
  'awaiting-feedback': { title: 'Nothing waiting for the citizen', text: 'Every approved complaint has had a citizen response.' },
  'not-resolved': { title: 'No complaints reported as not resolved', text: 'When a citizen says a fix did not work and the complaint is reopened, it appears here with their reason.' },
};

function Stars({ n }: { n: number }) {
  return <span className="text-amber-500" aria-label={`${n} out of 5 stars`}>{'★'.repeat(n)}<span className="text-slate-300">{'★'.repeat(5 - n)}</span></span>;
}

type TableQuery = { data?: ResolutionOverview; isLoading: boolean; isFetching: boolean; error: unknown; refetch: () => unknown };

/** Shared by the admin Resolutions page and the officer Outcomes page. */
export function ResolutionTable({ tab, query, detailBase = '/complaints' }: { tab: ResolutionView; query: TableQuery; detailBase?: string }) {
  const rows = query.data?.view === tab ? query.data.rows : undefined;
  const whenOf = (r: ResolutionRow) => {
    const v = tab === 'not-resolved' ? r.reopen?.created_at : tab === 'awaiting-approval' || tab === 'sent-back' ? r.event?.at : r.resolved_at;
    return v ? new Date(String(v).replace(' ', 'T')).getTime() : null;
  };
  const table = useClientTable(rows ?? [], {
    complaint: (r) => r.complaint_number,
    citizen: (r) => r.citizen_name,
    department: (r) => r.department_name,
    when: whenOf,
  });

  const complaintCol: Column<ResolutionRow> = {
    id: 'complaint', header: 'Complaint', sortKey: 'complaint', locked: true, truncate: true,
    cell: (r) => (<><ComplaintIdCell id={r.id} number={r.complaint_number} /><span className="block max-w-xs truncate text-xs text-slate-500">{r.title}</span></>),
  };
  const citizenCol: Column<ResolutionRow> = { id: 'citizen', header: 'Citizen', sortKey: 'citizen', hideBelow: 'lg', cell: (r) => r.citizen_name };
  const deptCol: Column<ResolutionRow> = {
    id: 'department', header: 'Department / officer', sortKey: 'department', hideBelow: 'xl', truncate: true,
    cell: (r) => (<>{r.department_name ?? '—'}{r.officer_name && <span className="block text-xs text-slate-500">{r.officer_name}{r.officer_email ? ` (${r.officer_email})` : ''}</span>}</>),
  };
  const openCol: Column<ResolutionRow> = {
    id: 'actions', header: '', width: 'w-20', align: 'right', locked: true,
    cell: (r) => <Link to={`${detailBase}/${r.id}`} className="btn-secondary !px-2.5 !py-1 text-xs" aria-label={`Open ${r.complaint_number}`}>Open</Link>,
  };
  const statusCol: Column<ResolutionRow> = { id: 'status', header: 'Status now', width: 'w-32', cell: (r) => <StatusBadge status={r.status} /> };
  const responseCol: Column<ResolutionRow> = {
    id: 'response', header: 'Citizen response', width: 'w-56',
    cell: (r) => r.feedback
      ? (<>
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${r.feedback.resolved ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>{r.feedback.resolved ? '✓ Confirmed resolved' : 'Not resolved'}</span>
          {r.feedback.rating ? <span className="ml-1.5"><Stars n={r.feedback.rating} /></span> : null}
          {r.feedback.comment && <span className="mt-0.5 block max-w-[14rem] truncate text-xs italic text-slate-500" title={r.feedback.comment}>“{r.feedback.comment}”</span>}
        </>)
      : <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">Awaiting feedback</span>,
  };

  let columns: Column<ResolutionRow>[];
  if (tab === 'not-resolved') {
    columns = [
      complaintCol, citizenCol,
      { id: 'when', header: 'Reported not resolved', sortKey: 'when', firstSort: 'desc', width: 'w-44', cell: (r) => <DateCell value={r.reopen?.created_at} relative /> },
      { id: 'reason', header: 'Reason given', truncate: true, cell: (r) => <span title={r.reopen?.reason ?? ''}>{r.reopen?.reason || <span className="text-slate-400">No reason given</span>}</span> },
      statusCol, deptCol, openCol,
    ];
  } else if (tab === 'awaiting-approval') {
    columns = [
      complaintCol, citizenCol, deptCol,
      { id: 'when', header: 'Fix submitted', sortKey: 'when', firstSort: 'desc', width: 'w-40', cell: (r) => <DateCell value={r.event?.at} relative /> },
      { id: 'note', header: 'Officer note', truncate: true, cell: (r) => <span title={r.event?.note ?? ''}>{r.event?.note || <span className="text-slate-400">No note</span>}</span> },
      openCol,
    ];
  } else if (tab === 'sent-back') {
    columns = [
      complaintCol, citizenCol, deptCol,
      { id: 'when', header: 'Sent back', sortKey: 'when', firstSort: 'desc', width: 'w-40', cell: (r) => <DateCell value={r.event?.at} relative /> },
      { id: 'note', header: 'Admin note', truncate: true, cell: (r) => <span title={r.event?.note ?? ''}>{r.event?.note || <span className="text-slate-400">No note</span>}</span> },
      statusCol, openCol,
    ];
  } else {
    columns = [
      complaintCol, citizenCol, deptCol,
      { id: 'when', header: 'Approved on', sortKey: 'when', firstSort: 'desc', width: 'w-40', cell: (r) => <DateCell value={r.resolved_at} relative /> },
      responseCol, openCol,
    ];
  }

  const copy = RESOLUTION_COPY[tab];
  return (
    <DataTable<ResolutionRow>
      caption={copy.title}
      columns={columns}
      rows={rows ? table.rows : undefined}
      rowKey={(r) => (r.reopen ? `${r.id}-${r.reopen.created_at}` : String(r.id))}
      isLoading={query.isLoading || (!rows && !query.error)}
      isFetching={query.isFetching}
      error={query.error}
      errorTitle="Unable to load complaints"
      onRetry={() => query.refetch()}
      emptyTitle={copy.title}
      emptyDescription={copy.text}
      sort={table.sort}
      onSortChange={table.setSort}
      pagination={{ ...table.pagination, noun: 'complaints' }}
    />
  );
}
