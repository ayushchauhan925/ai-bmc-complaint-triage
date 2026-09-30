import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { Sidebar, MobileNav } from './Sidebar';
import { HomeIcon, PlusCircleIcon, ClipboardIcon, UserIcon } from '../common/Icons';

const links = [
  { to: '/', label: 'Home', icon: <HomeIcon size={18} />, end: true },
  { to: '/complaints/new', label: 'Report Issue', icon: <PlusCircleIcon size={18} /> },
  { to: '/my-complaints', label: 'My Complaints', icon: <ClipboardIcon size={18} /> },
  { to: '/profile', label: 'Profile', icon: <UserIcon size={18} /> },
];

export function CitizenLayout({ children }: { children?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="flex">
        <Sidebar links={links} title="Citizen" />
        <main className="flex min-h-[calc(100vh-56px)] min-w-0 flex-1 flex-col overflow-x-hidden pb-20 md:pb-0">
          <div className="flex-1">{children ?? <Outlet />}</div>
          <Footer variant="compact" />
        </main>
      </div>
      <MobileNav links={links} />
    </div>
  );
}
