import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as adminService from '../../services/admin.service';
import * as platform from '../../services/platform.service';
import { PriorityBadge, StatusBadge, CategoryBadge, SlaBadge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { PageHeader, QueryBoundary, CardSkeleton, fmtRemaining } from '../../components/ui/kit';
import { CATEGORIES, COMPLAINT_STATUSES, PRIORITY_LEVELS, SLA_STATUSES, formatStatus, formatCategory } from '../../utils/constants';
import type { Complaint } from '../../utils/types';

const PAGE_SIZE = 20;

function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function Row({ c }: { c: Complaint }) {
  const remaining = c.sla_deadline && !['RESOLVED', 'REJECTED'].includes(c.status) ? new Date(c.sla_deadline).getTime() - Date.now() : null;
  return (
    <tr className="border-b border-slate-50 hover:bg-slate-50">
      <td className="px-4 py-3">
        <Link to={`/complaints/${c.id}`} className="font-mono text-xs text-brand-600 hover:underline">{c.complaint_number}</Link>
        {c.review_required && <span className="ml-2 rounded bg-pink-100 px-1.5 py-0.5 text-[10px] font-medium text-pink-800">Review</span>}
      </td>
      <td className="px-4 py-3"><CategoryBadge category={c.category} /></td>
      <td className="px-4 py-3"><PriorityBadge level={c.priority_level} /></td>
      <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
      <td className="px-4 py-3">{c.incident_id ? <Link className="text-xs text-violet-700 hover:underline" to={`/admin/incidents/${c.incident_id}`}>Incident #{c.incident_id}</Link> : <span className="text-slate-300">—</span>}</td>
      <td className="px-4 py-3"><SlaBadge status={c.sla_status} />{remaining !== null && <span className="ml-1 text-[11px] text-slate-400">{fmtRemaining(remaining)}</span>}</td>
      <td className="px-4 py-3 text-slate-500">{c.department_name || '-'}</td>
      <td className="px-4 py-3 text-slate-400">{new Date(c.created_at).toLocaleDateString()}</td>
    </tr>
  );
}

function Card({ c }: { c: Complaint }) {
  return (
    <li>
      <Link to={`/complaints/${c.id}`} className="block px-4 py-3 hover:bg-slate-50">
        <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-brand-600">{c.complaint_number}</span><PriorityBadge level={c.priority_level} /></div>
        <p className="mt-1 text-sm font-medium text-slate-800">{formatCategory(c.category)}</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5"><StatusBadge status={c.status} /><SlaBadge status={c.sla_status} /></div>
        <p className="mt-1 text-xs text-slate-400">{c.department_name || 'Unassigned'} · {new Date(c.created_at).toLocaleDateString()}</p>
      </Link>
    </li>
  );
}

export default function AdminComplaints() {
  const [params] = useSearchParams();
  const [page, setPage] = useState(1);
  const [semantic, setSemantic] = useState(false);
  const [filters, setFilters] = useState({
    search: '', status: '', category: params.get('category') || '', priority_level: '', sla_status: '',
    department_id: params.get('department_id') || '', incident_id: '', citizen: '', date_from: '', date_to: '',
  });
  const debounced = useDebounced(filters);
  const departments = useQuery({ queryKey: ['departments'], queryFn: adminService.listDepartments });

  const list = useQuery({
    queryKey: ['admin-complaints', debounced, page],
    queryFn: () => adminService.listComplaints({ page, limit: PAGE_SIZE, ...Object.fromEntries(Object.entries(debounced).filter(([, v]) => v !== '')) } as any),
    enabled: !semantic,
    placeholderData: (p) => p,
  });
  const sem = useQuery({
    queryKey: ['semantic-search', debounced.search],
    queryFn: () => platform.semanticSearch(debounced.search),
    enabled: semantic && debounced.search.trim().length >= 3,
  });

  const set = (k: string, v: string) => { setPage(1); setFilters((f) => ({ ...f, [k]: v })); };
  const clear = () => { setPage(1); setFilters({ search: '', status: '', category: '', priority_level: '', sla_status: '', department_id: '', incident_id: '', citizen: '', date_from: '', date_to: '' }); };
  const active = Object.values(filters).some(Boolean);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <PageHeader title="Complaints" description="Search by text, ID, location, citizen, incident, department, status, SLA or date." />

      <div className="mt-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <input aria-label="Search" className="input w-full sm:w-72" placeholder={semantic ? 'Describe what you are looking for…' : 'Search text, address or complaint ID…'} value={filters.search} onChange={(e) => set('search', e.target.value)} />
          <label className="flex items-center gap-1.5 text-xs text-slate-600" title="Match by meaning instead of exact words (uses AI embeddings)">
            <input type="checkbox" checked={semantic} onChange={(e) => setSemantic(e.target.checked)} /> Semantic search
          </label>
        </div>
        {!semantic && (
          <div className="flex flex-wrap gap-2">
            <select aria-label="Status" className="input w-auto" value={filters.status} onChange={(e) => set('status', e.target.value)}><option value="">All statuses</option>{COMPLAINT_STATUSES.map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}</select>
            <select aria-label="Category" className="input w-auto" value={filters.category} onChange={(e) => set('category', e.target.value)}><option value="">All categories</option>{CATEGORIES.map((c) => <option key={c} value={c}>{formatCategory(c)}</option>)}</select>
            <select aria-label="Priority" className="input w-auto" value={filters.priority_level} onChange={(e) => set('priority_level', e.target.value)}><option value="">All priorities</option>{PRIORITY_LEVELS.map((p) => <option key={p}>{p}</option>)}</select>
            <select aria-label="SLA" className="input w-auto" value={filters.sla_status} onChange={(e) => set('sla_status', e.target.value)}><option value="">Any SLA state</option>{SLA_STATUSES.map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}</select>
            <select aria-label="Department" className="input w-auto" value={filters.department_id} onChange={(e) => set('department_id', e.target.value)}><option value="">All departments</option>{(departments.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
            <input aria-label="Citizen" className="input w-40" placeholder="Citizen name/email" value={filters.citizen} onChange={(e) => set('citizen', e.target.value)} />
            <input aria-label="Incident ID" className="input w-28" type="number" placeholder="Incident ID" value={filters.incident_id} onChange={(e) => set('incident_id', e.target.value)} />
            <label className="flex items-center gap-1 text-xs text-slate-500">From <input type="date" className="input w-auto" value={filters.date_from} onChange={(e) => set('date_from', e.target.value)} /></label>
            <label className="flex items-center gap-1 text-xs text-slate-500">To <input type="date" className="input w-auto" value={filters.date_to} onChange={(e) => set('date_to', e.target.value)} /></label>
            {active && <button className="btn-secondary !py-1.5 text-xs" onClick={clear}>Clear filters</button>}
          </div>
        )}
      </div>

      <div className="mt-4">
        {semantic ? (
          debounced.search.trim().length < 3 ? <EmptyState title="Type at least 3 characters" description="Semantic search finds complaints that mean the same thing, even with different wording." /> : (
            <QueryBoundary query={sem} skeleton={<CardSkeleton lines={4} />}>
              {(r) => (
                <div className="card">
                  {r.mode === 'keyword' && <p role="note" className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-800">AI search is unavailable right now — showing keyword matches instead.</p>}
                  {r.results.length === 0 ? <div className="p-6"><EmptyState title="No matches" /></div> : (
                    <ul className="divide-y divide-slate-100">
                      {r.results.map((c) => (
                        <li key={c.id}><Link to={`/complaints/${c.id}`} className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                          <div className="min-w-0"><p className="text-sm"><span className="font-mono text-xs text-brand-600">{c.complaint_number}</span> <span className="ml-1 font-medium text-slate-800">{c.ai_title || formatCategory(c.category)}</span></p><p className="line-clamp-2 text-xs text-slate-500">{c.description}</p></div>
                          <div className="flex shrink-0 flex-col items-end gap-1"><PriorityBadge level={c.priority_level} />{c.similarity !== null && <span className="text-[11px] text-slate-400">{Math.round(c.similarity * 100)}% match</span>}</div>
                        </Link></li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </QueryBoundary>
          )
        ) : (
          <QueryBoundary query={list} skeleton={<CardSkeleton lines={6} />}>
            {(res) => {
              const totalPages = Math.max(1, Math.ceil(res.total / PAGE_SIZE));
              return (
                <>
                  <div className="card overflow-hidden">
                    {res.rows.length === 0 ? <div className="p-6"><EmptyState title="No complaints match your filters" action={active ? <button className="btn-secondary text-xs" onClick={clear}>Clear filters</button> : undefined} /></div> : (
                      <>
                        <div className="hidden overflow-x-auto md:block">
                          <table className="w-full text-left text-sm">
                            <thead className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400"><tr>{['ID', 'Category', 'Priority', 'Status', 'Incident', 'SLA', 'Department', 'Date'].map((h) => <th key={h} scope="col" className="px-4 py-3">{h}</th>)}</tr></thead>
                            <tbody>{res.rows.map((c) => <Row key={c.id} c={c} />)}</tbody>
                          </table>
                        </div>
                        <ul className="divide-y divide-slate-100 md:hidden">{res.rows.map((c) => <Card key={c.id} c={c} />)}</ul>
                      </>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span aria-live="polite">{res.total} complaint{res.total === 1 ? '' : 's'}</span>
                    {totalPages > 1 && <div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary !py-1 text-xs">Previous</button><span>Page {page} of {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="btn-secondary !py-1 text-xs">Next</button></div>}
                  </div>
                </>
              );
            }}
          </QueryBoundary>
        )}
      </div>
    </div>
  );
}
