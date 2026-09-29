import React, { useState } from 'react';
import { getGuidedAssist } from '../../services/complaint.service';
import { getErrorMessage } from '../../services/api';
import { formatCategory } from '../../utils/constants';

// Section 1: guided complaint assistant. One-shot, not a chatbot - the citizen clicks once,
// sees follow-up questions to consider and an optional clearer rewrite, then keeps typing
// normally. It never auto-fires and never decides the final category.
export function GuidedAssistant({
  draft,
  onAcceptSuggestion,
}: {
  draft: string;
  onAcceptSuggestion: (text: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    likely_category?: string;
    follow_up_questions?: string[];
    suggested_description?: string | null;
  } | null>(null);

  const handleAssist = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await getGuidedAssist(draft);
      if (!data.available) {
        setError('AI suggestions are temporarily unavailable - you can still submit as-is.');
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not get AI suggestions right now.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleAssist}
        disabled={loading || draft.trim().length < 3}
        className="btn-secondary text-xs"
      >
        {loading ? 'Thinking...' : 'Get AI suggestions'}
      </button>

      {error && <p className="mt-2 text-xs text-amber-600">{error}</p>}

      {result && (
        <div className="mt-3 rounded-lg border border-brand-100 bg-brand-50/60 p-3">
          {result.likely_category && (
            <p className="text-xs text-brand-700">
              Looks like: <strong>{formatCategory(result.likely_category)}</strong>
            </p>
          )}
          {result.follow_up_questions && result.follow_up_questions.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-medium text-slate-600">Consider adding:</p>
              <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-slate-600">
                {result.follow_up_questions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
          {result.suggested_description && (
            <div className="mt-3 flex items-start justify-between gap-2 rounded-md bg-white p-2">
              <p className="text-xs text-slate-600">{result.suggested_description}</p>
              <button
                type="button"
                onClick={() => onAcceptSuggestion(result.suggested_description!)}
                className="shrink-0 text-xs font-medium text-brand-600 hover:underline"
              >
                Use this
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
