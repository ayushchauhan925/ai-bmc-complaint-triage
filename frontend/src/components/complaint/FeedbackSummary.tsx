import React from 'react';
import { fmtDate } from '../ui/kit';
import type { ComplaintFeedback } from '../../utils/types';

/** Read-only view of the feedback a citizen already gave. It is final: there is no way to edit it from here. */
export function FeedbackSummary({ feedback }: { feedback: ComplaintFeedback }) {
  return (
    <div className="card border border-emerald-200 bg-emerald-50 p-4" role="status">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-emerald-900">✓ Feedback submitted</h3>
        <span className="text-xs text-emerald-700">{fmtDate(feedback.created_at)}</span>
      </div>
      <p className="mt-1 text-sm text-emerald-900">
        You confirmed this issue was <strong>{feedback.resolved ? 'resolved' : 'not resolved'}</strong>.
        {feedback.rating ? <span className="ml-2 text-amber-500" aria-label={`${feedback.rating} out of 5 stars`}>{'★'.repeat(feedback.rating)}<span className="text-slate-300">{'★'.repeat(5 - feedback.rating)}</span></span> : null}
      </p>
      {feedback.comment && <p className="mt-1 text-sm italic text-slate-700">“{feedback.comment}”</p>}
      <p className="mt-2 text-xs text-emerald-700">Your feedback is final and can no longer be changed.</p>
    </div>
  );
}
