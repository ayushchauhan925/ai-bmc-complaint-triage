import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../hooks/useNotifications';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const rightRef = useRef<HTMLDivElement>(null);

  // Close open menus on outside click or Escape.
  useEffect(() => {
    if (!open && !menuOpen) return undefined;
    const onDown = (e: MouseEvent) => {
      if (rightRef.current && !rightRef.current.contains(e.target as Node)) { setOpen(false); setMenuOpen(false); }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); setMenuOpen(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, menuOpen]);

  const roleLabel = user?.role === 'ADMIN' ? 'Admin' : user?.role === 'OFFICER' ? 'Officer' : 'Citizen';
  const roleCls = user?.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : user?.role === 'OFFICER' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700';

  const homePath = user?.role === 'ADMIN' ? '/admin' : user?.role === 'OFFICER' ? '/officer' : '/';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <Link to={homePath} className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">CC</span>
          <span className="hidden sm:inline">Civic Connect</span>
        </Link>

        {user && (
          <div className="flex items-center gap-3" ref={rightRef}>
            <div className="relative">
              <button
                aria-haspopup="true"
                aria-expanded={open}
                onClick={() => { setOpen((o) => !o); setMenuOpen(false); }}
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                aria-label="Notifications"
              >
                <BellIcon />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
              {open && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg">
                  <div className="border-b border-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
                    Notifications
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 && (
                      <div className="px-4 py-6 text-center text-sm text-slate-400">No notifications yet.</div>
                    )}
                    {notifications.slice(0, 15).map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          markRead(n.id);
                          if (n.related_complaint_id) navigate(`/complaints/${n.related_complaint_id}`);
                          setOpen(false);
                        }}
                        className={`block w-full border-b border-slate-50 px-4 py-3 text-left text-sm hover:bg-slate-50 ${
                          !n.is_read ? 'bg-brand-50/40' : ''
                        }`}
                      >
                        <p className="font-medium text-slate-800">{n.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{n.message}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                aria-haspopup="true"
                aria-expanded={menuOpen}
                onClick={() => { setMenuOpen((o) => !o); setOpen(false); }}
                className="flex items-center gap-2 rounded-full border border-slate-200 py-1 pl-1 pr-3 text-sm hover:bg-slate-50"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span className="hidden sm:inline text-slate-700">{user.name}</span>
                <span className={`hidden rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide sm:inline ${roleCls}`}>{roleLabel}</span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  <div className="border-b border-slate-100 px-4 py-2">
                    <p className="truncate text-sm font-medium text-slate-800">{user.name}</p>
                    <p className="truncate text-xs text-slate-400">{user.email}</p>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Profile
                  </Link>
                  <button
                    onClick={() => {
                      logout();
                      navigate('/login');
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
