import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext';
import * as authService from '../../services/auth.service';
import { getErrorMessage } from '../../services/api';

/**
 * Nudges users to verify their email - but only when this server can actually send email,
 * so it never offers a flow that cannot complete. Verification is never required to use the app.
 */
export function VerifyEmailBanner() {
  const { user, refreshUser } = useAuth();
  const config = useQuery({ queryKey: ['auth-config'], queryFn: authService.getAuthConfig, staleTime: 10 * 60_000, enabled: !!user });
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');
  const [hidden, setHidden] = useState(() => sessionStorage.getItem('verify-banner-hidden') === '1');

  if (!user || user.email_verified_at || !config.data?.emailEnabled || hidden) return null;

  const resend = async () => {
    setState('sending');
    setError('');
    try {
      const r = await authService.resendVerification();
      setState(r.data?.sent ? 'sent' : 'error');
      if (!r.data?.sent) setError('We could not send the email right now.');
    } catch (err) {
      setState('error');
      setError(getErrorMessage(err));
    }
  };

  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 sm:px-6">
      <span>
        {state === 'sent' ? <>Verification email sent to <strong>{user.email}</strong>. Open the link, then </> : <>Please verify your email address so we can send you complaint updates. </>}
        {state === 'sent' && <button onClick={() => refreshUser()} className="font-medium underline">refresh</button>}
        {state === 'error' && <span className="ml-1 text-red-700">{error}</span>}
      </span>
      <span className="flex items-center gap-3">
        {state !== 'sent' && (
          <button onClick={resend} disabled={state === 'sending'} className="font-medium underline disabled:opacity-60">
            {state === 'sending' ? 'Sending…' : 'Send verification email'}
          </button>
        )}
        <button
          onClick={() => { sessionStorage.setItem('verify-banner-hidden', '1'); setHidden(true); }}
          aria-label="Dismiss"
          className="text-lg leading-none text-amber-700 hover:text-amber-900"
        >
          ×
        </button>
      </span>
    </div>
  );
}
