import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';
import { AuthShell } from '../components/auth/AuthShell';
import { EasterEggOverlay, useEasterEgg } from '../components/common/EasterEgg';
import { Spinner } from '../components/common/Spinner';
import { AlertIcon } from '../components/common/Icons';

// Hidden: typing one of these into the email field triggers a themed reaction. Never blocks login.
const SECRET_WORDS: Record<string, string> = {
  pothole: 'You found it! Pothole filled in 0.3 seconds. 🕳️➡️🛣️',
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
    <AuthShell
      mobileTitle="Civic Connect"
      mobileSubtitle="Report civic issues. Track them to resolution."
      onLogoClick={egg.onLogoClick}
      overlay={<EasterEggOverlay active={egg.active} message={egg.message} />}
    >
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
    </AuthShell>
  );
}
