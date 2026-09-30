import React from 'react';

type IconProps = { size?: number; className?: string };
const base = (size = 18) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export const HomeIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path d="M9 22V12h6v10" /></svg>
);
export const ClipboardIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M9 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-3" /><path d="M9 12h6M9 16h6" /></svg>
);
export const PlusCircleIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" /></svg>
);
export const MapIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M1 6l7-3 8 3 7-3v15l-7 3-8-3-7 3z" /><path d="M8 3v15M16 6v15" /></svg>
);
export const ChartIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M3 3v18h18" /><rect x="7" y="12" width="3" height="6" /><rect x="12" y="8" width="3" height="10" /><rect x="17" y="5" width="3" height="13" /></svg>
);
export const AlertIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
);
export const UsersIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></svg>
);
export const SettingsIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.36.14.65.38.86.69" /></svg>
);
export const LayersIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M12 2l9 5-9 5-9-5z" /><path d="M3 12l9 5 9-5M3 17l9 5 9-5" /></svg>
);
export const CheckCircleIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" /></svg>
);
export const ClockIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
);
export const CameraIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><circle cx="12" cy="13" r="4" /></svg>
);
export const LocationIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z" /><circle cx="12" cy="10" r="3" /></svg>
);
export const UserIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
);
export const BellIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg>
);
export const BoltIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M13 2L3 14h7l-1 8 10-12h-7z" /></svg>
);
export const InboxIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" /></svg>
);
export const ShieldIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" /></svg>
);
export const ActivityIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
);
export const FlameIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 002.5 2.5z" /></svg>
);
export const TrendingUpIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M23 6l-9.5 9.5-5-5L1 18" /><path d="M17 6h6v6" /></svg>
);
export const ScrollIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></svg>
);
export const CpuIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" /><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" /></svg>
);
export const RefreshIcon = ({ size, className }: IconProps) => (
  <svg {...base(size)} className={className}><path d="M23 4v6h-6M1 20v-6h6" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></svg>
);
