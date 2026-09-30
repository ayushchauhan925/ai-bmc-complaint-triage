import React from 'react';
import { Link } from 'react-router-dom';

const YEAR = new Date().getFullYear();

const COLUMNS: { title: string; links: { to: string; label: string }[] }[] = [
  {
    title: 'Citizens',
    links: [
      { to: '/complaints/new', label: 'Report an issue' },
      { to: '/my-complaints', label: 'Track my complaints' },
      { to: '/public', label: 'Public dashboard' },
    ],
  },
  {
    title: 'Account',
    links: [
      { to: '/login', label: 'Sign in' },
      { to: '/register', label: 'Create an account' },
      { to: '/profile', label: 'Profile' },
    ],
  },
];

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">CC</span>
      <div>
        <p className="text-sm font-semibold text-slate-900">Civic Connect</p>
        <p className="text-xs text-slate-500">Civic AI Intelligence &amp; Response Platform</p>
      </div>
    </div>
  );
}

/**
 * Site footer. `full` (landing, public pages, auth) shows brand, link columns and the data
 * notice; `compact` is a single unobtrusive line for the in-app layouts.
 */
export function Footer({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  if (variant === 'compact') {
    return (
      <footer className="border-t border-slate-200 bg-white px-4 py-4 text-xs text-slate-500 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
          <p>© {YEAR} Civic Connect · AI proposes, people decide.</p>
          <p className="text-slate-400">Demo data is synthetic — not official municipal records.</p>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Brand />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-500">
            Report civic issues, understand how they are prioritised, and follow them from first report to resolution.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{col.title}</p>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-slate-600 transition-colors hover:text-brand-700 hover:underline">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 text-xs text-slate-500 sm:px-6">
          <p>© {YEAR} Civic Connect. Built for a civic-tech hackathon.</p>
          <p className="text-slate-400">
            Demo data, ward boundaries and SLA targets are synthetic — not official municipal records or policy.
          </p>
        </div>
      </div>
    </footer>
  );
}
