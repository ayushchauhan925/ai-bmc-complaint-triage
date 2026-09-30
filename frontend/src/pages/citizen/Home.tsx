import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import { listComplaints } from '../../services/complaint.service';
import { useNotifications } from '../../hooks/useNotifications';
import { ComplaintCard } from '../../components/complaint/ComplaintCard';
import { EmptyState } from '../../components/common/EmptyState';
import { PageHeader, QueryBoundary, CardSkeleton, fmtDate } from '../../components/ui/kit';
import { PlusCircleIcon, ClipboardIcon, CheckCircleIcon, ClockIcon, BellIcon, CameraIcon, LocationIcon, MapIcon } from '../../components/common/Icons';

const TIPS = [
  { icon: <CameraIcon size={16} />, text: 'Add a clear photo - it helps confirm the issue and speeds up routing.' },
  { icon: <LocationIcon size={16} />, text: 'Pin the exact spot and mention a landmark so crews can find it.' },
  { icon: <ClockIcon size={16} />, text: 'Say how long it has been a problem and who it affects.' },
];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>{icon}</span>
      <div>
        <p className="text-2xl font-semibold leading-none text-slate-900">{value}</p>
        <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      </div>
    </div>
  );
}

export default function CitizenHome() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ['my-complaints', 'home'], queryFn: () => listComplaints({ limit: 50 }) });
  const { notifications, markRead } = useNotifications(60000);
  const updates = notifications.slice(0, 4);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white sm:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="text-sm text-brand-200">{greeting()},</p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight sm:text-3xl">{user?.name.split(' ')[0]}</h1>
            <p className="mt-2 max-w-md text-sm text-brand-100">See something that needs fixing? Report it in under a minute and follow it until it is resolved.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/complaints/new" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-brand-800 shadow-sm hover:bg-brand-50">
              <PlusCircleIcon size={18} /> Report a problem
            </Link>
            <Link to="/public" className="inline-flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white ring-1 ring-inset ring-white/40 hover:bg-white/10">
              <MapIcon size={16} /> City dashboard
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-6">
        <QueryBoundary query={q} skeleton={<CardSkeleton lines={3} />}>
          {(res) => {
            const all = res.rows;
            const active = all.filter((c) => !['RESOLVED', 'REJECTED'].includes(c.status));
            const resolved = all.filter((c) => c.status === 'RESOLVED');
            const inProgress = all.filter((c) => c.status === 'IN_PROGRESS' || c.status === 'RESOLUTION_SUBMITTED');
            return (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <Metric icon={<ClipboardIcon size={18} />} label="Reported" value={all.length} tone="bg-brand-50 text-brand-600" />
                  <Metric icon={<ClockIcon size={18} />} label="Active" value={active.length} tone="bg-amber-50 text-amber-600" />
                  <Metric icon={<CheckCircleIcon size={18} />} label="In progress" value={inProgress.length} tone="bg-indigo-50 text-indigo-600" />
                  <Metric icon={<CheckCircleIcon size={18} />} label="Resolved" value={resolved.length} tone="bg-green-50 text-green-600" />
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                  <section aria-labelledby="active-h">
                    <div className="flex items-center justify-between">
                      <h2 id="active-h" className="text-sm font-semibold text-slate-800">Your active complaints</h2>
                      <Link to="/my-complaints" className="text-sm font-medium text-brand-600 hover:underline">View all</Link>
                    </div>
                    <div className="mt-3">
                      {all.length === 0 ? (
                        <EmptyState
                          title="No complaints yet"
                          description="Report your first civic issue - it is triaged and routed automatically."
                          action={<Link to="/complaints/new" className="btn-primary">Report a problem</Link>}
                        />
                      ) : active.length === 0 ? (
                        <EmptyState title="Nothing pending" description="All your complaints are resolved. Thank you for helping improve the city." />
                      ) : (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {active.slice(0, 6).map((c) => <ComplaintCard key={c.id} complaint={c} />)}
                        </div>
                      )}
                    </div>
                  </section>

                  <aside className="space-y-6">
                    <section className="card p-4" aria-labelledby="upd-h">
                      <h2 id="upd-h" className="flex items-center gap-2 text-sm font-semibold text-slate-800"><BellIcon size={16} /> Latest updates</h2>
                      {updates.length === 0 ? (
                        <p className="mt-3 text-sm text-slate-400">No updates yet. We will notify you when something changes.</p>
                      ) : (
                        <ul className="mt-3 divide-y divide-slate-100">
                          {updates.map((n) => (
                            <li key={n.id}>
                              <Link
                                to={n.related_complaint_id ? `/complaints/${n.related_complaint_id}` : '/my-complaints'}
                                onClick={() => markRead(n.id)}
                                className="block py-2.5 hover:bg-slate-50"
                              >
                                <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                                  {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-brand-600" aria-label="Unread" />}
                                  {n.title}
                                </p>
                                <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{n.message}</p>
                                <p className="mt-0.5 text-[11px] text-slate-400">{fmtDate(n.created_at)}</p>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>

                    <section className="card p-4" aria-labelledby="tips-h">
                      <h2 id="tips-h" className="text-sm font-semibold text-slate-800">Get faster resolution</h2>
                      <ul className="mt-3 space-y-3">
                        {TIPS.map((t) => (
                          <li key={t.text} className="flex gap-2.5 text-sm text-slate-600">
                            <span className="mt-0.5 shrink-0 text-brand-600">{t.icon}</span>
                            {t.text}
                          </li>
                        ))}
                      </ul>
                    </section>
                  </aside>
                </div>
              </div>
            );
          }}
        </QueryBoundary>
      </div>
    </div>
  );
}
