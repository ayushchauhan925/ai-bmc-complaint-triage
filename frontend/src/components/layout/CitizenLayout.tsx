import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { useI18n } from '../../i18n';
import { VerifyEmailBanner } from '../common/VerifyEmailBanner';
import { Footer } from './Footer';
import { Sidebar, MobileNav } from './Sidebar';
import { HomeIcon, PlusCircleIcon, ClipboardIcon, UserIcon, CheckCircleIcon } from '../common/Icons';

const buildLinks = (t: (k: string) => string) => [
  { to: '/', label: t('nav.home'), icon: <HomeIcon size={18} />, end: true },
  { to: '/complaints/new', label: t('nav.report'), icon: <PlusCircleIcon size={18} /> },
  { to: '/my-complaints', label: t('nav.myComplaints'), icon: <ClipboardIcon size={18} /> },
  { to: '/resolved', label: t('nav.resolved'), icon: <CheckCircleIcon size={18} /> },
  { to: '/profile', label: t('nav.profile'), icon: <UserIcon size={18} /> },
];

export function CitizenLayout({ children }: { children?: React.ReactNode }) {
  const { t } = useI18n();
  const links = buildLinks(t);
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <VerifyEmailBanner />
      <div className="flex">
        <Sidebar links={links} title={t('nav.menu')} />
        <main className="flex min-h-[calc(100vh-56px)] min-w-0 flex-1 flex-col overflow-x-hidden pb-20 md:pb-0">
          <div className="flex-1">{children ?? <Outlet />}</div>
          <Footer variant="compact" />
        </main>
      </div>
      <MobileNav links={links} />
    </div>
  );
}
