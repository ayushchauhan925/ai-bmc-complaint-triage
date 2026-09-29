import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { aiSearch } from '../../services/intelligence.service';
import { getErrorMessage } from '../../services/api';
import { PriorityBadge, StatusBadge, CategoryBadge } from '../common/Badge';
import type { Complaint } from '../../utils/types';

const EXAMPLES = [
  'Show unresolved potholes near schools',
  'Drainage complaints that breached SLA',
  'Critical complaints with more than 5 related reports',
];

// Section 9: AI admin natural-language search. The AI only ever produces a constrained
// filter object (shown here as "Applied filters") - the actual database query is built
// entirely by the backend from an allowlist, never from AI-generated SQL.
export function AiSearchBar() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<Complaint[] | null>(null);
  const [appliedFilters, setAppliedFilters] = useState<Record<string, unknown> | null>(null);
  const [total, setTotal] = useState(0);

  const runSearch = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await aiSearch(q);
      if (!data.available) {
        setError(data.reason || 'AI search is temporarily unavailable.');
        setResults(null);
      } else {
        setResults(data.results || []);
        setAppliedFilters(data.appliedFilters || {});
        setTotal(data.total || 0);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-slate-800">Ask about your complaints</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(query);
        }}
        className="mt-2 flex gap-2"
      >
        <input
          className="input"
          placeholder='e.g. "Show unresolved potholes near schools"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" disabled={loading} className="btn-primary shrink-0 text-sm">
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setQuery(ex);
              runSearch(ex);
            }}
            className="badge border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
          >
            {ex}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-amber-600">{error}</p>}

      {results && (
        <div className="mt-4">
          {appliedFilters && Object.keys(appliedFilters).length > 0 && (
            <p className="mb-2 text-xs text-slate-400">
              Applied filters: <code className="text-slate-500">{JSON.stringify(appliedFilters)}</code>
            </p>
          )}
          <p className="mb-2 text-xs font-medium text-slate-600">{total} result{total === 1 ? '' : 's'}</p>
          {results.length === 0 ? (
            <p className="text-sm text-slate-400">No matching complaints found.</p>
          ) : (
            <div className="space-y-2">
              {results.slice(0, 10).map((c) => (
                <Link
                  key={c.id}
                  to={`/complaints/${c.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <span className="font-mono text-xs text-slate-400">{c.complaint_number}</span>
                  <div className="flex gap-2">
                    <CategoryBadge category={c.category} />
                    <PriorityBadge level={c.priority_level} />
                    <StatusBadge status={c.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
