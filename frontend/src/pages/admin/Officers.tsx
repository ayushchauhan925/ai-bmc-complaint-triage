import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as org from '../../services/org.service';
import * as adminService from '../../services/admin.service';
import { getErrorMessage, getErrorDetails } from '../../services/api';
import { PageHeader, QueryBoundary, CardSkeleton, Tabs } from '../../components/ui/kit';
import { Modal } from '../../components/ui/Modal';
import { CsvButton } from '../../components/ui/CsvButton';
import { EmptyState } from '../../components/common/EmptyState';

type Filter = 'all' | 'active' | 'inactive';

function StatusPill({ active }: { active: boolean }) {
  return (
    <span className={`badge border ${active ? 'border-green-200 bg-green-100 text-green-800' : 'border-slate-300 bg-slate-100 text-slate-600'}`}>
      <span aria-hidden="true" className="mr-1">{active ? '●' : '○'}</span>{active ? 'Active' : 'Inactive'}
    </span>
  );
}

export default function Officers() {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [departmentId, setDepartmentId] = useState(params.get('department_id') || '');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<org.OfficerOverview | null>(null);

  const q = useQuery({ queryKey: ['officers-overview'], queryFn: () => org.officerOverview() });
  const departments = useQuery({ queryKey: ['departments'], queryFn: adminService.listDepartments });
  const wards = useQuery({ queryKey: ['wards'], queryFn: adminService.listWards });
  const all = q.data ?? [];

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all
      .filter((o) => (filter === 'all' ? true : filter === 'active' ? o.isActive : !o.isActive))
      .filter((o) => !departmentId || String(o.departmentId) === departmentId)
      .filter((o) => !s || `${o.name} ${o.email} ${o.departmentName ?? ''} ${o.wardName ?? ''}`.toLowerCase().includes(s));
  }, [all, search, filter, departmentId]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['officers-overview'] });
    qc.invalidateQueries({ queryKey: ['departments-overview'] });
    qc.invalidateQueries({ queryKey: ['officers'] });
  };

  const activeCount = all.filter((o) => o.isActive).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Officer management"
        description="Officers belong to one department and, optionally, a ward. Workload figures count open complaints currently assigned to each officer."
        actions={
          <>
            <CsvButton
              filename="officers.csv"
              rows={rows}
              columns={[
                { header: 'Name', value: (o) => o.name }, { header: 'Email', value: (o) => o.email },
                { header: 'Department', value: (o) => o.departmentName }, { header: 'Ward', value: (o) => o.wardName },
                { header: 'Active assignments', value: (o) => o.activeAssignments }, { header: 'Critical', value: (o) => o.criticalAssignments },
                { header: 'SLA breaches', value: (o) => o.slaBreaches }, { header: 'Status', value: (o) => (o.isActive ? 'Active' : 'Inactive') },
              ]}
            />
            <button className="btn-primary !py-1.5 text-xs" onClick={() => setCreating(true)}>+ Add officer</button>
          </>
        }
      />

      <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Tabs<Filter>
            tabs={[{ id: 'all', label: 'All', badge: all.length }, { id: 'active', label: 'Active', badge: activeCount }, { id: 'inactive', label: 'Inactive', badge: all.length - activeCount }]}
            value={filter}
            onChange={setFilter}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Department" className="input w-auto max-w-[16rem]" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">All departments</option>
            {(departments.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input aria-label="Search officers" className="input w-full sm:w-56" placeholder="Search officers…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="mt-4">
        <QueryBoundary query={q} skeleton={<CardSkeleton lines={6} />}>
          {() =>
            rows.length === 0 ? (
              <EmptyState title="No officers match" description="Try a different filter, or add an officer." action={<button className="btn-primary" onClick={() => setCreating(true)}>Add officer</button>} />
            ) : (
              <>
                <div className="card hidden overflow-x-auto p-0 md:block">
                  <table className="data-table">
                    <caption className="sr-only">Officers with department, ward and workload</caption>
                    <thead><tr>{['Officer', 'Department', 'Ward', 'Active', 'Critical', 'SLA breaches', 'Status', ''].map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
                    <tbody>
                      {rows.map((o) => (
                        <tr key={o.id} className={o.criticalAssignments > 0 ? 'row-CRITICAL' : o.slaBreaches > 0 ? 'row-HIGH' : ''}>
                          <td><p className="font-medium text-slate-900">{o.name}</p><p className="text-xs text-slate-500">{o.email}</p></td>
                          <td>{o.departmentName ?? <span className="text-slate-400">—</span>}{o.departmentActive === false && <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">dept inactive</span>}</td>
                          <td>{o.wardName ?? <span className="text-slate-400">Any</span>}</td>
                          <td className="font-semibold">{o.activeAssignments}</td>
                          <td className={o.criticalAssignments ? 'font-semibold text-red-700' : ''}>{o.criticalAssignments}</td>
                          <td className={o.slaBreaches ? 'font-semibold text-red-700' : ''}>{o.slaBreaches}{o.slaBreaches > 0 && ' ⚠'}</td>
                          <td><StatusPill active={o.isActive} /></td>
                          <td><div className="flex justify-end"><button className="btn-secondary !px-2.5 !py-1 text-xs" onClick={() => setEditing(o)}>Edit</button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul className="space-y-3 md:hidden">
                  {rows.map((o) => (
                    <li key={o.id} className="card p-4">
                      <div className="flex items-start justify-between gap-2"><div><p className="font-semibold text-slate-900">{o.name}</p><p className="text-xs text-slate-500">{o.departmentName ?? '—'} · {o.wardName ?? 'Any ward'}</p></div><StatusPill active={o.isActive} /></div>
                      <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded-lg bg-slate-50 py-2"><dt className="text-slate-500">Active</dt><dd className="text-base font-semibold">{o.activeAssignments}</dd></div>
                        <div className="rounded-lg bg-slate-50 py-2"><dt className="text-slate-500">Critical</dt><dd className={`text-base font-semibold ${o.criticalAssignments ? 'text-red-700' : ''}`}>{o.criticalAssignments}</dd></div>
                        <div className="rounded-lg bg-slate-50 py-2"><dt className="text-slate-500">SLA breaches</dt><dd className={`text-base font-semibold ${o.slaBreaches ? 'text-red-700' : ''}`}>{o.slaBreaches}</dd></div>
                      </dl>
                      <button className="btn-secondary mt-3 w-full text-xs" onClick={() => setEditing(o)}>Edit officer</button>
                    </li>
                  ))}
                </ul>
              </>
            )
          }
        </QueryBoundary>
      </div>
      <p className="mt-3 text-xs text-slate-500">Need to assign a complaint? Open it and use <em>Recommend officer</em> - rankings consider the officer&apos;s ward, workload, critical load, SLA breaches and proximity. You always make the final assignment. <Link to="/admin/departments" className="font-medium text-brand-600 hover:underline">Departments →</Link></p>

      <OfficerForm open={creating} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); refresh(); }} departments={departments.data ?? []} wards={wards.data ?? []} defaultDepartmentId={departmentId} />
      <OfficerForm open={!!editing} officer={editing ?? undefined} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); refresh(); }} departments={departments.data ?? []} wards={wards.data ?? []} />
    </div>
  );
}

function OfficerForm({
  open, officer, onClose, onSaved, departments, wards, defaultDepartmentId,
}: {
  open: boolean; officer?: org.OfficerOverview; onClose: () => void; onSaved: () => void;
  departments: { id: number; name: string; is_active?: boolean | number }[]; wards: { id: number; ward_name: string }[]; defaultDepartmentId?: string;
}) {
  const editing = !!officer;
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', department_id: '', ward_id: '', is_active: true });
  const [release, setRelease] = useState(false);
  const [needsRelease, setNeedsRelease] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError(''); setRelease(false); setNeedsRelease(0);
    setForm(officer
      ? { name: officer.name, email: officer.email, password: '', phone: officer.phone ?? '', department_id: String(officer.departmentId ?? ''), ward_id: officer.wardId ? String(officer.wardId) : '', is_active: officer.isActive }
      : { name: '', email: '', password: '', phone: '', department_id: defaultDepartmentId || '', ward_id: '', is_active: true });
  }, [open, officer, defaultDepartmentId]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const activeDepts = departments.filter((d) => d.is_active === undefined || Boolean(d.is_active) || String(d.id) === String(officer?.departmentId));

  const save = useMutation({
    mutationFn: async (): Promise<void> => {
      if (!editing) {
        await org.createOfficer({ name: form.name.trim(), email: form.email.trim(), password: form.password, phone: form.phone.trim() || undefined, department_id: Number(form.department_id), ward_id: form.ward_id ? Number(form.ward_id) : null });
        return;
      }
      await org.updateOfficer(officer!.id, {
        name: form.name.trim(), phone: form.phone.trim() || null, department_id: Number(form.department_id), ward_id: form.ward_id ? Number(form.ward_id) : null,
        is_active: form.is_active, release_assignments: release || undefined,
      });
    },
    onSuccess: onSaved,
    onError: (e) => {
      const d = org.errorDetails(e);
      if (d?.openAssignments) { setNeedsRelease(d.openAssignments); setError(getErrorMessage(e)); return; }
      const fields = getErrorDetails(e);
      setError(fields ? fields.map((f) => f.message).join(' ') : getErrorMessage(e));
    },
  });

  const valid = form.name.trim().length >= 2 && !!form.department_id && (editing || (/\S+@\S+\.\S+/.test(form.email) && form.password.length >= 8));

  return (
    <Modal
      open={open}
      title={editing ? `Edit ${officer!.name}` : 'Add officer'}
      onClose={onClose}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!valid || save.isPending || (needsRelease > 0 && !release)} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create officer'}</button></>}
    >
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate(); }}>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div><label className="label" htmlFor="of-name">Full name</label><input id="of-name" className="input" value={form.name} onChange={set('name')} required minLength={2} /></div>
        <div><label className="label" htmlFor="of-email">Email</label><input id="of-email" type="email" className="input" value={form.email} onChange={set('email')} disabled={editing} required /></div>
        {!editing && <div><label className="label" htmlFor="of-pass">Temporary password</label><input id="of-pass" type="password" className="input" value={form.password} onChange={set('password')} minLength={8} autoComplete="new-password" /><p className="mt-1 text-xs text-slate-500">At least 8 characters. Share it securely; the officer can change it via password reset.</p></div>}
        <div><label className="label" htmlFor="of-phone">Phone <span className="font-normal text-slate-400">(optional)</span></label><input id="of-phone" className="input" value={form.phone} onChange={set('phone')} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="label" htmlFor="of-dept">Department</label>
            <select id="of-dept" className="input" value={form.department_id} onChange={set('department_id')} required>
              <option value="">Select department…</option>
              {activeDepts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select></div>
          <div><label className="label" htmlFor="of-ward">Ward</label>
            <select id="of-ward" className="input" value={form.ward_id} onChange={set('ward_id')}>
              <option value="">Any ward</option>
              {wards.map((w) => <option key={w.id} value={w.id}>{w.ward_name}</option>)}
            </select></div>
        </div>
        {editing && (
          <div className="rounded-lg border border-slate-200 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-800"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} /> Active</label>
            <p className="mt-1 text-xs text-slate-500">Inactive officers cannot sign in and are never offered new assignments.</p>
            {needsRelease > 0 && (
              <label className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 p-2 text-sm text-amber-900"><input type="checkbox" className="mt-0.5" checked={release} onChange={(e) => setRelease(e.target.checked)} /> Release this officer&apos;s {needsRelease} open complaint(s) back to the department queue</label>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
}
