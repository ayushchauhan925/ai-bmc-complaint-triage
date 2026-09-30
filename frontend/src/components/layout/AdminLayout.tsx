import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Sidebar, MobileNav } from './Sidebar';
import React, { Suspense } from 'react';
import { HomeIcon, ClipboardIcon, MapIcon, ChartIcon, LayersIcon, AlertIcon, BoltIcon, ActivityIcon, ShieldIcon, CpuIcon, ScrollIcon } from '../common/Icons';
import { PageSkeleton } from '../ui/kit';

const links = [
  { to: '/admin', label: 'Command', icon: <HomeIcon size={18} />, end: true },
  { to: '/admin/complaints', label: 'Complaints', icon: <ClipboardIcon size={18} /> },
  { to: '/admin/map', label: 'GIS map', icon: <MapIcon size={18} /> },
  { to: '/admin/incidents', label: 'Incidents', icon: <LayersIcon size={18} /> },
  { to: '/admin/review', label: 'Review queue', icon: <AlertIcon size={18} /> },
  { to: '/admin/operations', label: 'Anomalies & forecast', icon: <ActivityIcon size={18} /> },
  { to: '/admin/sla', label: 'SLA & escalations', icon: <ShieldIcon size={18} /> },
  { to: '/admin/analytics', label: 'Analytics', icon: <ChartIcon size={18} /> },
  { to: '/admin/intelligence', label: 'Intelligence', icon: <BoltIcon size={18} /> },
  { to: '/admin/ai', label: 'AI & system', icon: <CpuIcon size={18} /> },
  { to: '/admin/audit', label: 'Audit log', icon: <ScrollIcon size={18} /> },
];

export function AdminLayout({ children }: { children?: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="flex">
        <Sidebar links={links} title="Admin" />
        <main className="min-h-[calc(100vh-56px)] flex-1 overflow-x-hidden pb-16 md:pb-0">
          <Suspense fallback={<div className="p-6"><PageSkeleton /></div>}>{children ?? <Outlet />}</Suspense>
        </main>
      </div>
      <MobileNav links={links} />
    </div>
  );
}
