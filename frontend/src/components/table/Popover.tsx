import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * A small anchored popover rendered in a portal with fixed positioning, so it is never clipped by a
 * table's scroll container. Closes on Escape, outside click, scroll and resize; Escape returns focus to the trigger.
 */
export function Popover({
  trigger,
  triggerLabel,
  triggerClassName = 'btn-secondary !px-2.5 !py-1.5 text-xs',
  role = 'menu',
  align = 'right',
  children,
}: {
  trigger: React.ReactNode;
  triggerLabel: string;
  triggerClassName?: string;
  role?: 'menu' | 'dialog';
  align?: 'left' | 'right';
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; flip: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const close = useCallback((refocus = false) => {
    setOpen(false);
    if (refocus) btn.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const r = btn.current.getBoundingClientRect();
    const h = panel.current?.offsetHeight ?? 200;
    const w = panel.current?.offsetWidth ?? 200;
    const flip = r.bottom + h + 8 > window.innerHeight && r.top > h + 8;
    const left = align === 'right' ? Math.max(8, r.right - w) : Math.min(r.left, window.innerWidth - w - 8);
    setPos({ top: flip ? r.top - h - 4 : r.bottom + 4, left, flip });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(true); }
    };
    const onMove = (e: Event) => { if (!panel.current?.contains(e.target as Node)) close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open, close]);

  // Move focus into the panel when it opens (first focusable item).
  useEffect(() => {
    if (!open || !pos) return;
    const first = panel.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled]), input, button');
    first?.focus();
  }, [open, pos]);

  const onPanelKey = (e: React.KeyboardEvent) => {
    if (role !== 'menu') return;
    const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? []);
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
    if (e.key === 'Tab') close();
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={triggerClassName}
        aria-label={triggerLabel}
        aria-haspopup={role}
        aria-expanded={open}
        onClick={() => { setPos(null); setOpen((o) => !o); }}
      >
        {trigger}
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            role={role}
            aria-label={triggerLabel}
            onKeyDown={onPanelKey}
            style={{ position: 'fixed', top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden', zIndex: 60 }}
            className="min-w-[10rem] rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg"
          >
            {children(() => close(true))}
          </div>,
          document.body
        )}
    </>
  );
}
