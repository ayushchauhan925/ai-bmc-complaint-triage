// Chart color parameters (dataviz skill: sequential/status use reserved, fixed hues;
// categorical hues are assigned in fixed order, never cycled or generated per-series).

export const CHART_BRAND = '#2563eb'; // single sequential hue for magnitude bars/lines
export const CHART_BRAND_SOFT = '#93c5fd';

// Status palette - fixed order, reserved meaning, never reused for arbitrary series.
export const PRIORITY_CHART_COLORS: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#ea580c',
  MEDIUM: '#d97706',
  LOW: '#64748b',
};

// Fixed categorical order for the (small, enumerable) status set.
export const STATUS_CHART_COLORS: Record<string, string> = {
  SUBMITTED: '#94a3b8',
  AI_ANALYZED: '#6366f1',
  ASSIGNED: '#2563eb',
  IN_PROGRESS: '#d97706',
  RESOLUTION_SUBMITTED: '#a855f7',
  RESOLVED: '#16a34a',
  NEEDS_REVIEW: '#db2777',
  REJECTED: '#dc2626',
  REOPENED: '#ea580c',
};

export const CHART_GRID = '#e2e8f0';
export const CHART_AXIS_TEXT = '#64748b';
