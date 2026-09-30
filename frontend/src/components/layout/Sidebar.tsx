import React from 'react';
import { NavLink } from 'react-router-dom';

export interface SidebarLink {
  to: string;
  label: string;
  icon: React.ReactNode;
  end?: boolean;
}

export function Sidebar({ links, title }: { links: SidebarLink[]; title: string }) {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white md:block">
      <div className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</div>
      <nav className="flex flex-col gap-0.5 px-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
              }`
            }
          >
            {link.icon}
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export function MobileNav({ links }: { links: SidebarLink[] }) {
  return (
    <nav aria-label="Primary" className="fixed bottom-0 left-0 right-0 z-30 flex overflow-x-auto border-t border-slate-200 bg-white py-1.5 md:hidden">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) =>
            `flex min-w-[4.5rem] shrink-0 flex-col items-center gap-0.5 px-2 py-1 text-center text-[11px] font-medium ${
              isActive ? 'text-brand-700' : 'text-slate-500'
            }`
          }
        >
          {link.icon}
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}
