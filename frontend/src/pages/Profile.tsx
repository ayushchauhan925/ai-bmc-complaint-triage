import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageHeader } from '../components/ui/kit';
import { CheckCircleIcon } from '../components/common/Icons';

const ROLE_INFO: Record<string, { label: string; cls: string; can: string[] }> = {
  CITIZEN: {
    label: 'Citizen',
    cls: 'border-blue-200 bg-blue-50 text-blue-700',
    can: ['Report civic issues with photos and location', 'Track status, timeline and deadlines', 'Give feedback and reopen unresolved issues', 'Receive updates as your complaint progresses'],
  },
  OFFICER: {
    label: 'Department officer',
    cls: 'border-indigo-200 bg-indigo-50 text-indigo-700',
    can: ['Work your department\'s prioritised queue', 'See AI assessment, evidence and related complaints', 'Approve or correct AI decisions for your department', 'Submit resolutions with before/after photos'],
  },
  ADMIN: {
    label: 'Administrator',
    cls: 'border-purple-200 bg-purple-50 text-purple-700',
    can: ['Command center, GIS map, analytics and forecasts', 'Review, correct and assign any complaint', 'Manage SLA targets and escalations', 'AI performance, audit log and system health'],
  },
};

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const role = ROLE_INFO[user.role] ?? ROLE_INFO.CITIZEN;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <PageHeader title="Your profile" description="Account details and what your role can do." />

      <div className="card mt-5 overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-brand-700 to-brand-900" aria-hidden="true" />
        <div className="px-6 pb-6">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-3">
            <span className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-brand-100 text-3xl font-semibold text-brand-700 shadow-sm">
              {user.name.charAt(0).toUpperCase()}
            </span>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="btn-secondary !py-1.5 text-sm text-red-700"
            >
              Log out
            </button>
          </div>
          <h2 className="mt-3 text-xl font-semibold text-slate-900">{user.name}</h2>
          <span className={`badge mt-1 border ${role.cls}`}>{role.label}</span>

          <dl className="mt-6 grid gap-x-8 gap-y-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
            <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Email</dt><dd className="mt-1 break-all text-sm font-medium text-slate-900">{user.email}</dd></div>
            <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Phone</dt><dd className="mt-1 text-sm font-medium text-slate-900">{user.phone || 'Not provided'}</dd></div>
            <div><dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Member since</dt><dd className="mt-1 text-sm font-medium text-slate-900">{new Date(user.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}</dd></div>
          </dl>
        </div>
      </div>

      <div className="card mt-4 p-6">
        <h3 className="text-sm font-semibold text-slate-800">What you can do</h3>
        <ul className="mt-3 space-y-2.5">
          {role.can.map((c) => (
            <li key={c} className="flex gap-2.5 text-sm text-slate-600"><CheckCircleIcon size={17} className="mt-0.5 shrink-0 text-green-600" />{c}</li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-slate-400">Permissions are enforced by the server; this list only describes them.</p>
      </div>
    </div>
  );
}
