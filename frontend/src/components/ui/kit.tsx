import React from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { getErrorMessage } from '../../services/api';
import { RefreshIcon } from '../common/Icons';

/** Consistent page title block with optional actions on the right. */
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} aria-hidden="true" />;
}

export function CardSkeleton({ lines = 4, height = 'h-40' }: { lines?: number; height?: string }) {
  return (
    <div className="card p-4" role="status" aria-label="Loading">
      <Skeleton className="h-4 w-1/3" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={`h-3 ${i % 2 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
      <Skeleton className={`mt-4 ${height} w-full`} />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

export function ErrorPanel({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <p className="font-medium">We couldn't load this information.</p>
      <p className="mt-0.5 text-red-700">{getErrorMessage(error, 'Please check your connection and try again.')}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary mt-3 !py-1 text-xs">
          <RefreshIcon size={14} /> Try again
        </button>
      )}
    </div>
  );
}

/** Renders skeleton / error / children for a TanStack Query result, so every page handles all three states. */
export function QueryBoundary<T>({
  query,
  skeleton,
  children,
}: {
  query: UseQueryResult<T>;
  skeleton?: React.ReactNode;
  children: (data: T) => React.ReactNode;
}) {
  if (query.isLoading) return <>{skeleton ?? <CardSkeleton />}</>;
  if (query.isError) return <ErrorPanel error={query.error} onRetry={() => query.refetch()} />;
  if (query.data === undefined) return null;
  return <>{children(query.data)}</>;
}

/** Shown wherever the backend deliberately declines to produce a number (never fabricated). */
export function InsufficientData({ reason }: { reason?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
      <p className="text-sm font-medium text-slate-600">Insufficient data</p>
      {reason && <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">{reason}</p>}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string; badge?: number }[];
  value: T;
  onChange: (t: T) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
            value === t.id ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {t.label}
          {t.badge !== undefined && t.badge > 0 && (
            <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{t.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Horizontal meter with a text value - meaning never depends on colour alone. */
export function Meter({ value, max = 100, label, tone = 'brand' }: { value: number; max?: number; label?: string; tone?: 'brand' | 'good' | 'warn' | 'bad' }) {
  const p = Math.max(0, Math.min(100, (value / max) * 100));
  const colors = { brand: 'bg-brand-600', good: 'bg-green-600', warn: 'bg-amber-500', bad: 'bg-red-600' };
  return (
    <div>
      {label && (
        <div className="mb-1 flex justify-between text-xs text-slate-500">
          <span>{label}</span>
          <span className="font-medium text-slate-700">
            {Math.round(value)}/{max}
          </span>
        </div>
      )}
      <div className="h-1.5 rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={max}>
        <div className={`h-1.5 rounded-full ${colors[tone]}`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

export const pct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)}%`);
export const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export function fmtRemaining(ms: number | null) {
  if (ms === null) return '—';
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const txt = h >= 48 ? `${Math.floor(h / 24)}d ${h % 24}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  return ms < 0 ? `${txt} overdue` : `${txt} left`;
}
