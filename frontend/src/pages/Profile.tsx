import React from 'react';
import { useAuth } from '../context/AuthContext';
import { formatCategory } from '../utils/constants';

export default function Profile() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-slate-900">Profile</h1>
      <div className="card mt-4 p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-semibold text-brand-700">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="text-lg font-semibold text-slate-900">{user.name}</p>
            <p className="text-sm text-slate-500">{formatCategory(user.role)}</p>
          </div>
        </div>

        <dl className="mt-6 divide-y divide-slate-100 border-t border-slate-100">
          <div className="flex justify-between py-3 text-sm">
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium text-slate-900">{user.email}</dd>
          </div>
          <div className="flex justify-between py-3 text-sm">
            <dt className="text-slate-500">Phone</dt>
            <dd className="font-medium text-slate-900">{user.phone || 'Not provided'}</dd>
          </div>
          <div className="flex justify-between py-3 text-sm">
            <dt className="text-slate-500">Role</dt>
            <dd className="font-medium text-slate-900">{user.role}</dd>
          </div>
          <div className="flex justify-between py-3 text-sm">
            <dt className="text-slate-500">Member since</dt>
            <dd className="font-medium text-slate-900">{new Date(user.created_at).toLocaleDateString()}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
