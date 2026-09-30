import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';
import { Logo } from '../components/common/Logo';
import { EasterEggOverlay, useEasterEgg } from '../components/common/EasterEgg';
import { Spinner } from '../components/common/Spinner';
import { ShieldIcon, MapIcon, BoltIcon, ClockIcon, AlertIcon } from '../components/common/Icons';

// Hidden: typing one of these into the email field triggers a themed reaction. Never blocks login.
const SECRET_WORDS: Record<string, string> = {
  pothole: 'You found it! Pothole filled in 0.3 seconds. 🕳️➡️🛣️',
  ayush: 'Built with ❤️ by Ayush. Hi! 👋',
  mumbai: 'Aamchi Mumbai! Vada pav is on the house. 🥪',
  bmc: 'Brihanmumbai Municipal Corporation, reporting for duty. 🏛️',
  chai: 'Cutting chai break approved. ☕ SLA paused.',
};

// Seeded demo accounts (see README > Setup). Synthetic data - fill-in helpers only.
const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@civicconnect.demo' },
  { label: 'Officer', email: 'officer.roads@civicconnect.demo' },
  { label: 'Citizen', email: 'aarav.sharma@example.demo' },
];
const DEMO_PASSWORD = 'Password123!';

const HIGHLIGHTS = [
  { icon: <BoltIcon size={18} />, title: 'AI-assisted triage', text: 'Reports in English, Hindi, Hinglish or Marathi are understood, classified and routed to the right department.' },
  { icon: <ShieldIcon size={18} />, title: 'Explainable decisions', text: 'Every priority shows the evidence and factors behind it, and staff can review or correct it.' },
  { icon: <MapIcon size={18} />, title: 'Geographic intelligence', text: 'Duplicate reports are grouped into incidents; hotspots and unusual surges are surfaced early.' },
  { icon: <ClockIcon size={18} />, title: 'Accountable response', text: 'Clear deadlines, escalation rules and a transparent timeline from report to resolution.' },
];

const EyeIcon = ({ off }: { off: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M3 3l18 18" />}
  </svg>
);

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const egg = useEasterEgg();

  const from = (location.state as { from?: string })?.from;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      if (from) navigate(from);
      else if (user.role === 'ADMIN') navigate('/admin');
      else if (user.role === 'OFFICER') navigate('/officer');
      else navigate('/');
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid email or password.'));
    } finally {
      setLoading(false);
    }
  };

  const onEmailChange = (v: string) => {
    setEmail(v);
    const hit = SECRET_WORDS[v.trim().toLowerCase()];
    if (hit) egg.fire(hit);
  };

  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <EasterEggOverlay active={egg.active} message={egg.message} />

      {/* Brand panel */}
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
          <button
            type="button"
            onClick={egg.onLogoClick}
            aria-label="Civic Connect logo"
            className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-base font-bold text-brand-800">CC</span>
          </button>
          <div>
            <p className="text-lg font-semibold leading-tight">Civic Connect</p>
            <p className="text-xs text-brand-200">Civic AI Intelligence &amp; Response Platform</p>
          </div>
        </div>

        <div className="relative max-w-lg">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            From a citizen&apos;s report to a resolved issue — faster, clearer, accountable.
          </h2>
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

        <p className="relative text-xs text-brand-300">Municipal complaint triage · AI proposes, deterministic rules decide.</p>
      </aside>

      {/* Form panel */}
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 sm:px-8 lg:min-h-0 lg:bg-white">
        <div className="w-full max-w-md">
          {/* Compact brand header for small screens */}
          <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
            <button
              type="button"
              onClick={egg.onLogoClick}
              aria-label="Civic Connect logo"
              className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <Logo size={48} />
            </button>
            <div className="text-center">
              <h1 className="text-xl font-semibold text-slate-900">Civic Connect</h1>
              <p className="text-sm text-slate-500">Report civic issues. Track them to resolution.</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:border-0 lg:p-0 lg:shadow-none">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h2>
            <p className="mt-1 text-sm text-slate-500">Sign in to report, track or manage civic complaints.</p>

            {error && (
              <div role="alert" className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
                <AlertIcon size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate={false}>
              <div>
                <label htmlFor="login-email" className="label">Email</label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="username"
                  autoFocus
                  className="input h-11"
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="label">Password</label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    className="input h-11 pr-11"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    <EyeIcon off={showPassword} />
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary h-11 w-full text-base">
                {loading ? (<><Spinner size={18} /> <span className="text-white">Signing in…</span></>) : 'Sign in'}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-slate-500">
              New here?{' '}
              <Link to="/register" className="font-medium text-brand-600 hover:underline">Create a citizen account</Link>
            </p>

            <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Try a demo account</p>
              <p className="mt-0.5 text-xs text-slate-500">Fills the form with synthetic demo credentials.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.email}
                    type="button"
                    onClick={() => { setEmail(a.email); setPassword(DEMO_PASSWORD); setError(''); }}
                    className="rounded-full border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            <p className="mt-6 text-center text-xs text-slate-400">
              <Link to="/public" className="hover:text-slate-600 hover:underline">View the public transparency dashboard</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
