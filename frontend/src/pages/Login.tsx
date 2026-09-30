import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../services/api';
import { Logo } from '../components/common/Logo';
import { EasterEggOverlay, useEasterEgg } from '../components/common/EasterEgg';

// Hidden: typing one of these into the email field triggers a themed reaction. Never blocks login.
const SECRET_WORDS: Record<string, string> = {
  pothole: 'You found it! Pothole filled in 0.3 seconds. 🕳️➡️🛣️',
  ayush: 'Built with ❤️ by Ayush. Hi! 👋',
  mumbai: 'Aamchi Mumbai! Vada pav is on the house. 🥪',
  bmc: 'Brihanmumbai Municipal Corporation, reporting for duty. 🏛️',
  chai: 'Cutting chai break approved. ☕ SLA paused.',
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const egg = useEasterEgg();

  const from = (location.state as { from?: string })?.from;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <EasterEggOverlay active={egg.active} message={egg.message} />
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3">
          <button type="button" onClick={egg.onLogoClick} aria-label="Civic Connect logo" className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
            <Logo size={48} />
          </button>
          <h1 className="text-xl font-semibold text-slate-900">Civic Connect</h1>
          <p className="text-sm text-slate-500">AI-powered civic complaint triage</p>
        </div>

        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Sign in</h2>
          {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                required
                className="input"
                value={email}
                onChange={(e) => {
                  const v = e.target.value;
                  setEmail(v);
                  const hit = SECRET_WORDS[v.trim().toLowerCase()];
                  if (hit) egg.fire(hit);
                }}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                required
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-500">
            New here?{' '}
            <Link to="/register" className="font-medium text-brand-600 hover:underline">
              Create an account
            </Link>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Demo accounts (password: Password123!): admin@civicconnect.demo · officer.roads@civicconnect.demo
        </p>
      </div>
    </div>
  );
}
