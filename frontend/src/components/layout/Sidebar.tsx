import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';

export interface SidebarLink {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}

const linkClass = (isActive: boolean, padding: string) =>
  `flex items-center gap-3 rounded-lg px-3 ${padding} text-sm font-medium transition-colors ${
    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
  }`;

const STORAGE_KEY = 'sidebar-collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

const Chevron = ({ flip }: { flip: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={flip ? 'rotate-180' : ''}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

/**
 * Desktop sidebar: pinned under the header, independently scrollable, and collapsible to an
 * icon rail (the choice is remembered). Labels stay available to screen readers and as
 * tooltips when collapsed.
 */
export function Sidebar({ links, title }: { links: SidebarLink[]; title: string }) {
  const [collapsed, setCollapsed] = React.useState(readCollapsed);

  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* storage unavailable - keep in memory only */
      }
      return next;
    });

  return (
    <aside
      aria-label={`${title} navigation`}
      className={`sticky top-14 hidden h-[calc(100vh-56px)] shrink-0 self-start overflow-y-auto overflow-x-hidden overscroll-contain border-r border-slate-200 bg-white pb-6 transition-[width] duration-200 md:block ${collapsed ? 'w-16' : 'w-60'}`}
    >
      <div className={`flex items-center py-3 ${collapsed ? 'justify-center px-2' : 'justify-between px-4'}`}>
        {!collapsed && <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</span>}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Chevron flip={collapsed} />
        </button>
      </div>
      <nav aria-label="Primary" className="flex flex-col gap-0.5 px-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            title={collapsed ? link.label : undefined}
            className={({ isActive }) => `${linkClass(isActive, 'py-2')} ${collapsed ? 'justify-center px-0' : ''}`}
          >
            <span className="shrink-0">{link.icon}</span>
            <span className={collapsed ? 'sr-only' : 'truncate'}>{link.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

/**
 * Mobile navigation: a floating menu button opens a slide-in drawer from the left. The
 * drawer's link list scrolls independently, so long menus (admin has 11 links) are always
 * reachable. Closes on route change, backdrop tap or Escape.
 */
export function MobileNav({ links, title = 'Menu' }: { links: SidebarLink[]; title?: string }) {
  const [open, setOpen] = React.useState(false);
  const location = useLocation();

  React.useEffect(() => setOpen(false), [location.pathname]);

  React.useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        className="fixed bottom-4 left-4 z-30 flex h-12 items-center gap-2 rounded-full bg-brand-600 px-4 text-sm font-medium text-white shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
        Menu
      </button>

      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="rounded p-1 text-xl leading-none text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>
            <nav aria-label="Primary" className="flex-1 overflow-y-auto overscroll-contain px-2 py-2">
              {links.map((link) => (
                <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => linkClass(isActive, 'py-3')}>
                  {link.icon}
                  {link.label}
                </NavLink>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </div>
  );
}
