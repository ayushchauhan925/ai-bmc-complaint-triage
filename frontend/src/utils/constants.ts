// Mirrors backend/src/utils/constants.js so the UI stays in sync with the single
// source of truth for categories, priority levels and statuses.

export const CATEGORIES = [
  'POTHOLE',
  'ROAD_DAMAGE',
  'GARBAGE',
  'WASTE_COLLECTION',
  'WATER_LEAKAGE',
  'WATER_SUPPLY',
  'DRAINAGE',
  'SEWERAGE',
  'STREETLIGHT',
  'TRAFFIC_SIGNAL',
  'ROAD_SIGNAGE',
  'FOOTPATH_DAMAGE',
  'ENCROACHMENT',
  'PUBLIC_TOILET',
  'SANITATION',
  'DEAD_ANIMAL',
  'TREE_HAZARD',
  'FLOODING',
  'ILLEGAL_DUMPING',
  'OTHER',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const PRIORITY_LEVELS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

export const COMPLAINT_STATUSES = [
  'SUBMITTED',
  'AI_ANALYZED',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLUTION_SUBMITTED',
  'RESOLVED',
  'NEEDS_REVIEW',
  'REJECTED',
  'REOPENED',
] as const;
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number];

export const SLA_STATUSES = [
  'ON_TRACK',
  'APPROACHING',
  'BREACHED',
  'COMPLETED_WITHIN_SLA',
  'COMPLETED_AFTER_SLA',
] as const;
export type SlaStatus = (typeof SLA_STATUSES)[number];

export const ROLES = ['CITIZEN', 'OFFICER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const PRIORITY_COLORS: Record<PriorityLevel, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  HIGH: 'bg-orange-100 text-orange-700 border-orange-200',
  MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200',
  LOW: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const PRIORITY_MARKER_COLORS: Record<PriorityLevel, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#ea580c',
  MEDIUM: '#d97706',
  LOW: '#64748b',
};

export const STATUS_COLORS: Record<string, string> = {
  SUBMITTED: 'bg-slate-100 text-slate-600 border-slate-200',
  AI_ANALYZED: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  ASSIGNED: 'bg-blue-100 text-blue-700 border-blue-200',
  IN_PROGRESS: 'bg-amber-100 text-amber-700 border-amber-200',
  RESOLUTION_SUBMITTED: 'bg-purple-100 text-purple-700 border-purple-200',
  RESOLVED: 'bg-green-100 text-green-700 border-green-200',
  NEEDS_REVIEW: 'bg-pink-100 text-pink-700 border-pink-200',
  REJECTED: 'bg-red-100 text-red-700 border-red-200',
  REOPENED: 'bg-orange-100 text-orange-700 border-orange-200',
};

export const SLA_STATUS_COLORS: Record<string, string> = {
  ON_TRACK: 'bg-green-100 text-green-700 border-green-200',
  APPROACHING: 'bg-amber-100 text-amber-700 border-amber-200',
  BREACHED: 'bg-red-100 text-red-700 border-red-200',
  COMPLETED_WITHIN_SLA: 'bg-green-100 text-green-700 border-green-200',
  COMPLETED_AFTER_SLA: 'bg-orange-100 text-orange-700 border-orange-200',
};

import { trEnum } from '../i18n';

export function formatCategory(category: string): string {
  const translated = trEnum('category', category);
  if (translated) return translated;
  return category
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' ');
}

export function formatStatus(status: string): string {
  const translated = trEnum('status', status);
  if (translated) return translated;
  return status
    .split('_')
    .map((w) => (w === 'AI' ? 'AI' : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(' ');
}
