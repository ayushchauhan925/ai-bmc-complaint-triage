import React from 'react';
import type { ResolutionVerification } from '../../utils/types';

const STATUS_STYLES: Record<string, string> = {
  SUPPORTED: 'border-green-200 bg-green-50 text-green-800',
  UNCERTAIN: 'border-amber-200 bg-amber-50 text-amber-800',
  NOT_SUPPORTED: 'border-red-200 bg-red-50 text-red-800',
};

// Section 18/21: resolution quality verification, advisory only - admin can always override
// (see the admin status controls elsewhere on this page).
export function ResolutionVerificationCard({ verification }: { verification: ResolutionVerification | null }) {
  if (!verification) return null;

  return (
    <div className={`card border p-4 ${STATUS_STYLES[verification.status] || ''}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">AI Resolution Check: {verification.status.replace(/_/g, ' ')}</h3>
        <span className="text-xs opacity-75">{Math.round(verification.confidence * 100)}% confidence</span>
      </div>
      <p className="mt-1 text-sm">{verification.summary}</p>
      <p className="mt-2 text-xs opacity-75">
        This is an AI-assisted check, not a final decision - an admin always reviews and can override it.
      </p>
    </div>
  );
}
