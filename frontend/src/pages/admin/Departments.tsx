import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as org from '../../services/org.service';
import { getErrorMessage } from '../../services/api';
import { PageHeader, Tabs } from '../../components/ui/kit';
import { Modal } from '../../components/ui/Modal';
import { CsvButton } from '../../components/ui/CsvButton';
import { ActiveBadge } from '../../components/common/Badge';
import { DataTable, RowActions, SearchInput, useClientTable, type Column } from '../../components/table';
import { formatCategory } from '../../utils/constants';

type Filter = 'all' | 'active' | 'inactive';

const chipCls = 'rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-600';

export default function Departments() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [details, setDetails] = useState<org.DepartmentOverview | null>(null);
  const [editing, setEditing] = useState<org.DepartmentOverview | null>(null);
  const [toggling, setToggling] = useState<org.DepartmentOverview | null>(null);

  const q = useQuery({ queryKey: ['departments-overview'], queryFn: () => org.departmentOverview() });
  const all = q.data ?? [];

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all
      .filter((d) => (filter === 'all' ? true : filter === 'active' ? d.isActive : !d.isActive))
      .filter((d) => !s || `${d.name} ${d.code} ${d.description ?? ''} ${d.primaryCategories.join(' ')}`.toLowerCase().includes(s));
  }, [all, search, filter]);

  const table = useClientTable(rows, {
    name: (d) => d.name, code: (d) => d.code, officers: (d) => d.activeOfficers, open: (d) => d.activeComplaints,
    critical: (d) => d.criticalComplaints, status: (d) => (d.isActive ? 1 : 0),
  });

  const columns: Column<org.DepartmentOverview>[] = [
    {
      id: 'department', header: 'Department', sortKey: 'name', width: 'min-w-[14rem]', locked: true,
      cell: (d) => (
        <>
          <p className="font-medium text-slate-900">{d.name}</p>
          <p className="text-xs text-slate-500"><span className="font-mono">{d.code}</span>{d.isFallback && <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">Routing fallback</span>}</p>
        </>
      ),
    },
    {
      id: 'handles', header: 'Handles', hint: 'Complaint categories routed here first', width: 'min-w-[16rem]', hideBelow: 'lg',
      cell: (d) => (
        <div className="flex flex-wrap gap-1">
          {d.primaryCategories.slice(0, 4).map((c) => <span key={c} className={chipCls}>{formatCategory(c)}</span>)}
          {d.primaryCategories.length > 4 && (
            <button onClick={() => setDetails(d)} className="rounded-md border border-brand-200 bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700 hover:bg-brand-100">+{d.primaryCategories.length - 4} more</button>
          )}
        </div>
      ),
    },
    { id: 'officers', header: 'Officers', hint: 'Active / total officers', sortKey: 'officers', firstSort: 'desc', width: 'w-24', align: 'right', cell: (d) => <><Link to={`/admin/officers?department_id=${d.id}`} className="font-medium text-brand-700 hover:underline">{d.activeOfficers}</Link><span className="text-xs text-slate-400"> / {d.totalOfficers}</span></> },
    { id: 'open', header: 'Open complaints', sortKey: 'open', firstSort: 'desc', width: 'w-44', align: 'right', cell: (d) => <>{d.activeComplaints}{d.criticalComplaints > 0 && <span className="ml-1.5 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">{d.criticalComplaints} critical</span>}</> },
    { id: 'status', header: 'Status', sortKey: 'status', width: 'w-28', cell: (d) => <ActiveBadge active={d.isActive} /> },
    {
      id: 'actions', header: '', width: 'w-36', align: 'right', locked: true,
      cell: (d) => (
        <RowActions
          label={d.name}
          primary={{ label: 'Details', onClick: () => setDetails(d) }}
          items={[
            { label: 'Edit', onClick: () => setEditing(d) },
            { label: d.isActive ? 'Deactivate' : 'Activate', danger: d.isActive, disabled: d.isFallback && d.isActive, title: d.isFallback ? 'The fallback department cannot be deactivated' : undefined, onClick: () => setToggling(d) },
          ]}
        />
      ),
    },
  ];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['departments-overview'] });
    qc.invalidateQueries({ queryKey: ['departments'] });
    qc.invalidateQueries({ queryKey: ['officers-overview'] });
  };

  const totals = {
    total: all.length,
    active: all.filter((d) => d.isActive).length,
    officers: all.reduce((s, d) => s + d.activeOfficers, 0),
    open: all.reduce((s, d) => s + d.activeComplaints, 0),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Departments"
        description="Who handles what. Complaints are routed to a department by category using fixed rules - never by the AI."
        actions={
          <CsvButton
            filename="departments.csv"
            rows={rows}
            columns={[
              { header: 'Code', value: (d) => d.code },
              { header: 'Department', value: (d) => d.name },
              { header: 'Status', value: (d) => (d.isActive ? 'Active' : 'Inactive') },
              { header: 'Handles (primary)', value: (d) => d.primaryCategories.join('; ') },
              { header: 'Also involved (secondary)', value: (d) => d.secondaryCategories.join('; ') },
              { header: 'Active officers', value: (d) => d.activeOfficers },
              { header: 'Open complaints', value: (d) => d.activeComplaints },
              { header: 'Critical open', value: (d) => d.criticalComplaints },
              { header: 'Contact email', value: (d) => d.contactEmail },
              { header: 'Contact phone', value: (d) => d.contactPhone },
            ]}
          />
        }
      />
      <p role="note" className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        This is the project&apos;s configurable <strong>demo department catalog</strong>, not a statement of the official BMC organisation. Names, contacts and the active flag can be managed here.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[['Departments', totals.total], ['Active', totals.active], ['Active officers', totals.officers], ['Open complaints', totals.open]].map(([l, v]) => (
          <div key={String(l)} className="card p-4"><p className="text-xs uppercase tracking-wide text-slate-400">{l}</p><p className="mt-1 text-2xl font-semibold text-slate-900">{v}</p></div>
        ))}
      </div>

      <div className="mt-5">
        <Tabs<Filter>
          tabs={[{ id: 'all', label: 'All', badge: all.length }, { id: 'active', label: 'Active', badge: totals.active }, { id: 'inactive', label: 'Inactive', badge: all.length - totals.active }]}
          value={filter}
          onChange={(f) => { setFilter(f); table.resetPage(); }}
        />
      </div>

      <div className="mt-4">
        <DataTable<org.DepartmentOverview>
          caption="Department catalog"
          columns={columns}
          rows={q.data ? table.rows : undefined}
          rowKey={(d) => d.id}
          isLoading={q.isLoading}
          isFetching={q.isFetching}
          error={q.error}
          errorTitle="Unable to load departments"
          onRetry={() => q.refetch()}
          emptyTitle="No departments yet"
          filtered={!!search || filter !== 'all'}
          filteredTitle="No departments match"
          onClearFilters={() => { setSearch(''); setFilter('all'); table.resetPage(); }}
          sort={table.sort}
          onSortChange={table.setSort}
          toolbar={<SearchInput label="Search departments" value={search} onChange={(v) => { setSearch(v); table.resetPage(); }} placeholder="Search name, code or category…" />}
          storageKey="admin-departments"
          columnMenu
          mobileCard={(d) => (
            <div className="p-4">
              <div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-slate-900">{d.name}</p><p className="font-mono text-xs text-slate-500">{d.code}</p></div><ActiveBadge active={d.isActive} /></div>
              <p className="mt-2 text-xs text-slate-600">{d.activeOfficers}/{d.totalOfficers} officers · {d.activeComplaints} open{d.criticalComplaints > 0 ? ` · ${d.criticalComplaints} critical` : ''}</p>
              <div className="mt-3 flex gap-2"><button className="btn-secondary flex-1 text-xs" onClick={() => setDetails(d)}>Details</button><button className="btn-secondary flex-1 text-xs" onClick={() => setEditing(d)}>Edit</button></div>
            </div>
          )}
          pagination={{ ...table.pagination, noun: 'departments' }}
        />
      </div>

      <DetailsModal dept={details} onClose={() => setDetails(null)} />
      <EditModal dept={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} />
      <ToggleModal dept={toggling} all={all} onClose={() => setToggling(null)} onDone={() => { setToggling(null); refresh(); }} />
    </div>
  );
}

function DetailsModal({ dept, onClose }: { dept: org.DepartmentOverview | null; onClose: () => void }) {
  return (
    <Modal open={!!dept} title={dept?.name ?? ''} onClose={onClose} wide>
      {dept && (
        <div className="space-y-5 text-sm">
          <p className="text-slate-600">{dept.description}</p>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div><dt className="text-xs text-slate-500">Code</dt><dd className="font-mono font-medium">{dept.code}</dd></div>
            <div><dt className="text-xs text-slate-500">Status</dt><dd><ActiveBadge active={dept.isActive} /></dd></div>
            <div><dt className="text-xs text-slate-500">Active officers</dt><dd className="font-medium">{dept.activeOfficers} of {dept.totalOfficers}</dd></div>
            <div><dt className="text-xs text-slate-500">Open complaints</dt><dd className="font-medium">{dept.activeComplaints} ({dept.criticalComplaints} critical)</dd></div>
          </dl>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Handles - routed here first</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">{dept.primaryCategories.map((c) => <span key={c} className={chipCls}>{formatCategory(c)}</span>)}</div>
          </div>
          {dept.secondaryCategories.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Also involved - recorded as a secondary department</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">{dept.secondaryCategories.map((c) => <span key={c} className={chipCls}>{formatCategory(c)}</span>)}</div>
            </div>
          )}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</h3>
            <p className="mt-1 text-slate-700">{dept.contactEmail || 'No email set'} · {dept.contactPhone || 'No phone set'}</p>
          </div>
          <div className="flex gap-3 text-xs">
            <Link className="font-medium text-brand-600 hover:underline" to={`/admin/officers?department_id=${dept.id}`}>View officers →</Link>
            <Link className="font-medium text-brand-600 hover:underline" to={`/admin/complaints?department_id=${dept.id}`}>View complaints →</Link>
          </div>
        </div>
      )}
    </Modal>
  );
}

function EditModal({ dept, onClose, onSaved }: { dept: org.DepartmentOverview | null; onClose: () => void; onSaved: () => void }) {
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  React.useEffect(() => {
    if (dept) { setDescription(dept.description ?? ''); setEmail(dept.contactEmail ?? ''); setPhone(dept.contactPhone ?? ''); setError(''); }
  }, [dept]);

  const save = useMutation({
    mutationFn: () => org.updateDepartment(dept!.id, { description: description.trim() || undefined, contact_email: email.trim() || null, contact_phone: phone.trim() || null }),
    onSuccess: onSaved,
    onError: (e) => setError(getErrorMessage(e)),
  });

  return (
    <Modal
      open={!!dept}
      title={`Edit ${dept?.name ?? ''}`}
      onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save'}</button></>}
    >
      <div className="space-y-4">
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div><label className="label" htmlFor="dep-desc">Description</label><textarea id="dep-desc" rows={3} className="input" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div><label className="label" htmlFor="dep-email">Contact email</label><input id="dep-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="department@city.example" /></div>
        <div><label className="label" htmlFor="dep-phone">Contact phone</label><input id="dep-phone" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="022-0000000" /></div>
        <p className="text-xs text-slate-500">The code and the categories handled are fixed by the routing configuration.</p>
      </div>
    </Modal>
  );
}

function ToggleModal({ dept, all, onClose, onDone }: { dept: org.DepartmentOverview | null; all: org.DepartmentOverview[]; onClose: () => void; onDone: () => void }) {
  const [target, setTarget] = useState<number | ''>('');
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  React.useEffect(() => { setTarget(''); setError(''); setResult(''); }, [dept]);

  const activating = !!dept && !dept.isActive;
  const needsReassign = !!dept && dept.isActive && dept.activeComplaints > 0;
  const targets = all.filter((d) => dept && d.id !== dept.id && d.isActive);

  const run = useMutation({
    mutationFn: () => org.updateDepartment(dept!.id, { is_active: activating, reassign_to_department_id: needsReassign ? Number(target) : undefined }),
    onSuccess: (r) => { if (r.reassigned > 0) setResult(`${r.reassigned} complaint(s) moved.`); onDone(); },
    onError: (e) => setError(getErrorMessage(e)),
  });

  return (
    <Modal
      open={!!dept}
      title={activating ? `Activate ${dept?.name}` : `Deactivate ${dept?.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className={activating ? 'btn-primary' : 'btn-danger'} disabled={run.isPending || (needsReassign && !target)} onClick={() => run.mutate()}>
            {run.isPending ? 'Working…' : activating ? 'Activate' : needsReassign ? 'Reassign and deactivate' : 'Deactivate'}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{error}</p>}
        {result && <p role="status" className="text-green-700">{result}</p>}
        {activating ? (
          <p className="text-slate-600">Complaints in this department&apos;s categories will be routed here again.</p>
        ) : (
          <>
            <p className="text-slate-600">New complaints for this department&apos;s categories will be routed to a secondary department, or to General Civic Services. Its officers cannot be assigned new work.</p>
            {needsReassign ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="font-medium text-amber-900">{dept!.activeComplaints} open complaint{dept!.activeComplaints === 1 ? '' : 's'} must move first.</p>
                <p className="mt-1 text-xs text-amber-800">They are reassigned to the department you choose and returned to its queue (officer assignments are cleared). Closed complaints keep their history.</p>
                <label className="label mt-3" htmlFor="reassign-to">Reassign open complaints to</label>
                <select id="reassign-to" className="input" value={target} onChange={(e) => setTarget(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Choose a department…</option>
                  {targets.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            ) : (
              <p className="text-slate-600">There are no open complaints in this department, so it can be deactivated directly.</p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
