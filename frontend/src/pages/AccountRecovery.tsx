import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as authService from '../services/auth.service';
import { getErrorMessage } from '../services/api';
import { AuthShell } from '../components/auth/AuthShell';
import { Spinner } from '../components/common/Spinner';
import { AlertIcon, CheckCircleIcon } from '../components/common/Icons';

function Notice({ tone, children }: { tone: 'error' | 'success' | 'info'; children: React.ReactNode }) {
  const cls = tone === 'error' ? 'border-red-200 bg-red-50 text-red-800' : tone === 'success' ? 'border-green-200 bg-green-50 text-green-800' : 'border-slate-200 bg-slate-50 text-slate-700';
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`mt-5 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${cls}`}>
      {tone === 'success' ? <CheckCircleIcon size={16} className="mt-0.5 shrink-0" /> : <AlertIcon size={16} className="mt-0.5 shrink-0" />}
      <span>{children}</span>
    </div>
  );
}

/* ---------------------------------------------------------- forgot password */
export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const config = useQuery({ queryKey: ['auth-config'], queryFn: authService.getAuthConfig, staleTime: 5 * 60_000 });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setDone(await authService.forgotPassword(email.trim()));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const emailOff = config.data && !config.data.emailEnabled;

  return (
    <AuthShell mobileTitle="Reset your password" mobileSubtitle="We will email you a secure link">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Forgot your password?</h2>
      <p className="mt-1 text-sm text-slate-500">Enter the email you registered with and we will send a link to choose a new one.</p>

      {emailOff && <Notice tone="info">Password reset by email is not enabled on this server yet. Please contact the system administrator.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      {done ? (
        <Notice tone="success">{done} The link is valid for one hour and works once.</Notice>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="fp-email" className="label">Email</label>
            <input id="fp-email" type="email" required autoFocus autoComplete="email" className="input h-11" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <button type="submit" disabled={busy || !!emailOff} className="btn-primary h-11 w-full text-base">
            {busy ? (<><Spinner size={18} /> <span className="text-white">Sending…</span></>) : 'Send reset link'}
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link to="/login" className="font-medium text-brand-600 hover:underline">Back to sign in</Link>
      </p>
    </AuthShell>
  );
}

/* ----------------------------------------------------------- reset password */
export function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== password;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError('The two passwords do not match.');
    setBusy(true);
    setError('');
    try {
      await authService.resetPassword(token, password);
      setDone(true);
      window.setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not reset your password.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell mobileTitle="Choose a new password" mobileSubtitle="Make it at least 8 characters">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Choose a new password</h2>
      {!token ? (
        <Notice tone="error">This reset link is incomplete. Request a new one from the sign-in page.</Notice>
      ) : done ? (
        <Notice tone="success">Your password has been updated. Redirecting you to sign in…</Notice>
      ) : (
        <>
          {error && <Notice tone="error">{error}</Notice>}
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="rp-pass" className="label">New password</label>
              <input id="rp-pass" type="password" required minLength={8} maxLength={100} autoFocus autoComplete="new-password" className="input h-11" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
            </div>
            <div>
              <label htmlFor="rp-confirm" className="label">Confirm new password</label>
              <input id="rp-confirm" type="password" required autoComplete="new-password" aria-invalid={mismatch} className={`input h-11 ${mismatch ? 'border-red-400' : ''}`} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              {mismatch && <p className="mt-1 text-xs text-red-600">Passwords do not match.</p>}
            </div>
            <button type="submit" disabled={busy || mismatch} className="btn-primary h-11 w-full text-base">
              {busy ? (<><Spinner size={18} /> <span className="text-white">Saving…</span></>) : 'Update password'}
            </button>
          </form>
        </>
      )}
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link to="/login" className="font-medium text-brand-600 hover:underline">Back to sign in</Link>
      </p>
    </AuthShell>
  );
}

/* ------------------------------------------------------------- verify email */
export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState<'working' | 'ok' | 'error'>('working');
  const [message, setMessage] = useState('');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode runs effects twice; the token is single-use
    started.current = true;
    if (!token) {
      setState('error');
      setMessage('This verification link is incomplete.');
      return;
    }
    authService
      .verifyEmail(token)
      .then((m) => { setState('ok'); setMessage(m); })
      .catch((err) => { setState('error'); setMessage(getErrorMessage(err, 'This link is invalid or has expired.')); });
  }, [token]);

  return (
    <AuthShell mobileTitle="Verify your email" mobileSubtitle="One quick step">
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Email verification</h2>
      {state === 'working' && <div className="mt-6 flex items-center gap-3 text-sm text-slate-600"><Spinner size={18} /> Verifying…</div>}
      {state === 'ok' && <Notice tone="success">{message}</Notice>}
      {state === 'error' && <Notice tone="error">{message} You can request a new link from your profile after signing in.</Notice>}
      <p className="mt-6 text-center text-sm text-slate-500">
        <Link to="/" className="font-medium text-brand-600 hover:underline">Continue to Civic Connect</Link>
      </p>
    </AuthShell>
  );
}
