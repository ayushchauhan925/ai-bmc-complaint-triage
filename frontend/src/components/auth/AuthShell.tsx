import React from 'react';
import { Logo } from '../common/Logo';
import { Footer } from '../layout/Footer';
import { ShieldIcon, MapIcon, BoltIcon, ClockIcon } from '../common/Icons';

const HIGHLIGHTS = [
  { icon: <BoltIcon size={18} />, title: 'AI-assisted triage', text: 'Reports in English, Hindi, Hinglish or Marathi are understood, classified and routed to the right department.' },
  { icon: <ShieldIcon size={18} />, title: 'Explainable decisions', text: 'Every priority shows the evidence and factors behind it, and staff can review or correct it.' },
  { icon: <MapIcon size={18} />, title: 'Geographic intelligence', text: 'Duplicate reports are grouped into incidents; hotspots and unusual surges are surfaced early.' },
  { icon: <ClockIcon size={18} />, title: 'Accountable response', text: 'Clear deadlines, escalation rules and a transparent timeline from report to resolution.' },
];

/**
 * Shared layout for the sign-in and registration pages: brand panel (desktop), form panel,
 * and footer. `onLogoClick` lets the login page hang its easter egg on the logo.
 */
export function AuthShell({
  children,
  mobileTitle,
  mobileSubtitle,
  headline = "From a citizen's report to a resolved issue — faster, clearer, accountable.",
  onLogoClick,
  overlay,
}: {
  children: React.ReactNode;
  mobileTitle: string;
  mobileSubtitle: string;
  headline?: string;
  onLogoClick?: () => void;
  overlay?: React.ReactNode;
}) {
  const logoButton = (child: React.ReactNode, ring: string) => (
    <button
      type="button"
      onClick={onLogoClick}
      aria-label="Civic Connect logo"
      className={`rounded-xl focus:outline-none focus-visible:ring-2 ${ring} ${onLogoClick ? '' : 'cursor-default'}`}
      tabIndex={onLogoClick ? 0 : -1}
    >
      {child}
    </button>
  );

  return (
    <div className="flex min-h-screen flex-col">
      {overlay}
      <div className="flex flex-1 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <aside className="relative hidden overflow-hidden bg-brand-900 text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
              maskImage: 'radial-gradient(ellipse at 30% 20%, black 20%, transparent 75%)',
              WebkitMaskImage: 'radial-gradient(ellipse at 30% 20%, black 20%, transparent 75%)',
            }}
          />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-brand-600/40 blur-3xl" />

          <div className="relative flex items-center gap-3">
            {logoButton(
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-base font-bold text-brand-800">CC</span>,
              'focus-visible:ring-white/70'
            )}
            <div>
              <p className="text-lg font-semibold leading-tight">Civic Connect</p>
              <p className="text-xs text-brand-200">Civic AI Intelligence &amp; Response Platform</p>
            </div>
          </div>

          <div className="relative max-w-lg">
            <h2 className="text-3xl font-semibold leading-tight tracking-tight">{headline}</h2>
            <ul className="mt-9 space-y-5">
              {HIGHLIGHTS.map((h) => (
                <li key={h.title} className="flex gap-4">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-brand-100 ring-1 ring-white/15">{h.icon}</span>
                  <div>
                    <p className="text-sm font-semibold">{h.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-brand-200">{h.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-brand-300">AI proposes, deterministic rules decide.</p>
        </aside>

        <main className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-10 sm:px-8 lg:bg-white">
          <div className="w-full max-w-md">
            <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
              {logoButton(<Logo size={48} />, 'focus-visible:ring-brand-400')}
              <div className="text-center">
                <h1 className="text-xl font-semibold text-slate-900">{mobileTitle}</h1>
                <p className="text-sm text-slate-500">{mobileSubtitle}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:border-0 lg:p-0 lg:shadow-none">{children}</div>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
