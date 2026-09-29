import { api } from './api';
import type { ApiResponse } from '../utils/types';

export interface PublicStatistics {
  total_complaints: number;
  resolved: number;
  in_progress: number;
  pending_or_active: number;
  by_category: { category: string; count: number }[];
  complaints_over_time: { date: string; count: number }[];
  avg_resolution_hours: number | null;
  sla_compliance_pct: number | null;
  duplicate_rate_pct: number;
  data_scope: string;
}

// No auth token needed - this is the public transparency dashboard.
export async function getPublicStatistics() {
  const res = await api.get<ApiResponse<PublicStatistics>>('/public/statistics');
  return res.data.data;
}
