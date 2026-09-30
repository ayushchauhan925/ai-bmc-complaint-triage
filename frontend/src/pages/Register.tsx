import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage, getErrorDetails } from '../services/api';
import { AuthShell } from '../components/auth/AuthShell';
import { useI18n } from '../i18n';
import { Spinner } from '../components/common/Spinner';
import { AlertIcon, CheckCircleIcon } from '../components/common/Icons';

const EyeIcon = ({ off }: { off: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="M3 3l18 18" />}
  </svg>
);

/** Advisory strength hint only - the server enforces the real rule (8+ characters). */
function strength(pw: string): { score: number; label: string; bar: string } {
  let score = 0;
  if (pw.length >= 8) score += 1;
  if (pw.length >= 12) score += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score += 1;
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  const bars = ['bg-slate-300', 'bg-red-500', 'bg-amber-500', 'bg-lime-500', 'bg-green-600'];
  const s = pw.length < 8 ? 0 : Math.max(score, 1);
  return { score: s, label: labels[s], bar: bars[s] };
}

export default function Register() {
  const { register } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', phone: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const pw = useMemo(() => strength(form.password), [form.password]);
  const mismatch = form.confirm.length > 0 && form.confirm !== form.password;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await register(form.name.trim(), form.email.trim(), form.password, form.phone.trim() || undefined);
      navigate('/');
    } catch (err) {
      const details = getErrorDetails(err);
      setError(details ? details.map((d) => d.message).join(' ') : getErrorMessage(err, 'Registration failed.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      mobileTitle="Create your account"
      mobileSubtitle="Report civic issues and track their resolution"
    >
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{t('auth.createAccount')}</h2>
      <p className="mt-1 text-sm text-slate-500">{t('auth.createSub')}</p>

      {error && (
        <div role="alert" className="mt-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
          <AlertIcon size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="reg-name" className="label">{t('auth.fullName')}</label>
          <input id="reg-name" required minLength={2} maxLength={150} autoComplete="name" autoFocus className="input h-11" value={form.name} onChange={set('name')} placeholder="Your name" />
        </div>

        <div>
          <label htmlFor="reg-email" className="label">{t('auth.email')}</label>
          <input id="reg-email" type="email" required autoComplete="email" className="input h-11" value={form.email} onChange={set('email')} placeholder="you@example.com" />
        </div>

        <div>
          <label htmlFor="reg-phone" className="label">
            {t('auth.phone')} <span className="font-normal text-slate-400">{t('auth.optional')}</span>
          </label>
          <input id="reg-phone" type="tel" inputMode="tel" minLength={7} maxLength={20} autoComplete="tel" className="input h-11" value={form.phone} onChange={set('phone')} placeholder="For status updates" />
        </div>

        <div>
          <label htmlFor="reg-password" className="label">{t('auth.password')}</label>
          <div className="relative">
            <input
              id="reg-password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              maxLength={100}
              autoComplete="new-password"
              className="input h-11 pr-11"
              value={form.password}
              onChange={set('password')}
              placeholder="At least 8 characters"
              aria-describedby="reg-pw-hint"
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
          <div id="reg-pw-hint" className="mt-2" aria-live="polite">
            <div className="flex gap-1" aria-hidden="true">
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${form.password && pw.score >= i ? pw.bar : 'bg-slate-200'}`} />
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {form.password ? <>Strength: <strong className="text-slate-700">{pw.label}</strong> · </> : null}
              Use 8+ characters; longer and mixed is stronger.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="reg-confirm" className="label">{t('auth.confirmPassword')}</label>
          <input
            id="reg-confirm"
            type={showPassword ? 'text' : 'password'}
            required
            autoComplete="new-password"
            className={`input h-11 ${mismatch ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}`}
            value={form.confirm}
            onChange={set('confirm')}
            placeholder="Re-enter your password"
            aria-invalid={mismatch}
            aria-describedby={mismatch ? 'reg-confirm-err' : undefined}
          />
          {mismatch && <p id="reg-confirm-err" className="mt-1 text-xs text-red-600">Passwords do not match.</p>}
          {!mismatch && form.confirm.length > 0 && (
            <p className="mt-1 flex items-center gap-1 text-xs text-green-700"><CheckCircleIcon size={13} /> Passwords match</p>
          )}
        </div>

        <button type="submit" disabled={loading || mismatch} className="btn-primary h-11 w-full text-base">
          {loading ? (<><Spinner size={18} /> <span className="text-white">Creating account…</span></>) : 'Create account'}
        </button>

        <p className="text-center text-xs text-slate-400">
          By creating an account you agree to use this service for genuine civic issues. Complaint data is used to route and resolve your report.
        </p>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        {t('auth.alreadyHave')}{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:underline">{t('auth.signIn')}</Link>
      </p>
    </AuthShell>
  );
}
