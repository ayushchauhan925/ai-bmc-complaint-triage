import React, { useState } from 'react';
import { getErrorMessage } from '../../services/api';
import { Spinner } from '../common/Spinner';

const PdfIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3" />
  </svg>
);

/**
 * Button that builds a PDF on click. Shows progress, and reports a failure inline instead of
 * failing silently. `build` may fetch extra data before generating.
 */
export function PdfButton({ label = 'Download PDF', build, disabled, className = '' }: { label?: string; build: () => Promise<void>; disabled?: boolean; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      await build();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not create the PDF. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-start">
      <button type="button" onClick={run} disabled={busy || disabled} className={`btn-secondary !py-1.5 text-xs ${className}`}>
        {busy ? <Spinner size={14} /> : <PdfIcon />}
        {busy ? 'Preparing…' : label}
      </button>
      {error && <span role="alert" className="mt-1 text-[11px] text-red-600">{error}</span>}
    </span>
  );
}
