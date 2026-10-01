import React from 'react';
import { Link } from 'react-router-dom';
import { Popover } from './Popover';

export interface RowActionItem {
  label: string;
  onClick?: () => void;
  to?: string;
  danger?: boolean;
  disabled?: boolean;
  title?: string;
}

const itemClass = (danger?: boolean) =>
  `block w-full px-3 py-1.5 text-left text-sm focus:outline-none focus-visible:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 ${
    danger ? 'text-red-700 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'
  }`;

/** One primary action plus an overflow menu, instead of a row of buttons. */
export function RowActions({
  primary,
  items = [],
  label,
}: {
  primary?: RowActionItem;
  items?: RowActionItem[];
  /** Names the row for screen readers, e.g. "CC-2026-0042". */
  label: string;
}) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      {primary &&
        (primary.to ? (
          <Link to={primary.to} className="btn-secondary !px-2.5 !py-1 text-xs" aria-label={`${primary.label} ${label}`}>{primary.label}</Link>
        ) : (
          <button type="button" className="btn-secondary !px-2.5 !py-1 text-xs" disabled={primary.disabled} title={primary.title} onClick={primary.onClick} aria-label={`${primary.label} ${label}`}>
            {primary.label}
          </button>
        ))}
      {items.length > 0 && (
        <Popover
          triggerLabel={`More actions for ${label}`}
          triggerClassName="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          trigger={<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" /></svg>}
        >
          {(close) => (
            <>
              {items.map((it) =>
                it.to ? (
                  <Link key={it.label} to={it.to} role="menuitem" className={itemClass(it.danger)} onClick={close}>{it.label}</Link>
                ) : (
                  <button
                    key={it.label}
                    type="button"
                    role="menuitem"
                    disabled={it.disabled}
                    title={it.title}
                    className={itemClass(it.danger)}
                    onClick={() => { close(); it.onClick?.(); }}
                  >
                    {it.label}
                  </button>
                )
              )}
            </>
          )}
        </Popover>
      )}
    </div>
  );
}
