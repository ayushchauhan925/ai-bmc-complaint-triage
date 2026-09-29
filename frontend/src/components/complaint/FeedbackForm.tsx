import React, { useState } from 'react';
import { submitFeedback } from '../../services/complaint.service';
import { getErrorMessage } from '../../services/api';

export function FeedbackForm({
  complaintId,
  onDone,
}: {
  complaintId: number;
  onDone: () => void;
}) {
  const [resolved, setResolved] = useState<boolean | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (resolved === null) {
      setError('Please let us know whether the issue was resolved.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await submitFeedback(complaintId, { resolved, rating: resolved ? rating : undefined, comment });
      onDone();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-slate-800">Was this issue resolved?</h3>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setResolved(true)}
          className={resolved === true ? 'btn-primary' : 'btn-secondary'}
        >
          Yes, resolved
        </button>
        <button
          type="button"
          onClick={() => setResolved(false)}
          className={resolved === false ? 'btn-danger' : 'btn-secondary'}
        >
          Not resolved
        </button>
      </div>

      {resolved === true && (
        <div className="mt-3">
          <label className="label">Rate the resolution</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                className={`h-8 w-8 rounded-md text-sm font-semibold ${
                  n <= rating ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {resolved !== null && (
        <div className="mt-3">
          <label className="label">Comments (optional)</label>
          <textarea
            rows={2}
            className="input"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={resolved ? 'Thanks, this was fixed quickly!' : 'The issue is still there because...'}
          />
        </div>
      )}

      {resolved !== null && (
        <button onClick={handleSubmit} disabled={submitting} className="btn-primary mt-4 w-full">
          {submitting ? 'Submitting...' : 'Submit feedback'}
        </button>
      )}
    </div>
  );
}
