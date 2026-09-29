import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar, MobileNav } from './Sidebar';
import { HomeIcon, ClipboardIcon, MapIcon, ChartIcon, LayersIcon, AlertIcon, BoltIcon } from '../common/Icons';

const links = [
  { to: '/admin', label: 'Dashboard', icon: <HomeIcon size={18} />, end: true },
  { to: '/admin/intelligence', label: 'Intelligence', icon: <BoltIcon size={18} /> },
  { to: '/admin/complaints', label: 'Complaints', icon: <ClipboardIcon size={18} /> },
  { to: '/admin/map', label: 'Map', icon: <MapIcon size={18} /> },
  { to: '/admin/incidents', label: 'Incidents', icon: <LayersIcon size={18} /> },
  { to: '/admin/analytics', label: 'Analytics', icon: <ChartIcon size={18} /> },
  { to: '/admin/review', label: 'Flagged', icon: <AlertIcon size={18} /> },
];

export function AdminLayout({ children }: { children?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="flex">
        <Sidebar links={links} title="Admin" />
        <main className="min-h-[calc(100vh-56px)] flex-1 overflow-x-hidden pb-16 md:pb-0">
          {children ?? <Outlet />}
        </main>
      </div>
      <MobileNav links={links} />
    </div>
  );
}
