import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar, MobileNav } from './Sidebar';
import { HomeIcon, ClipboardIcon, UserIcon } from '../common/Icons';

const links = [
  { to: '/officer', label: 'Assigned', icon: <HomeIcon size={18} />, end: true },
  { to: '/officer/all', label: 'All Complaints', icon: <ClipboardIcon size={18} /> },
  { to: '/profile', label: 'Profile', icon: <UserIcon size={18} /> },
];

export function OfficerLayout({ children }: { children?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="flex">
        <Sidebar links={links} title="Officer" />
        <main className="min-h-[calc(100vh-56px)] flex-1 overflow-x-hidden pb-16 md:pb-0">
          {children ?? <Outlet />}
        </main>
      </div>
      <MobileNav links={links} />
    </div>
  );
}
