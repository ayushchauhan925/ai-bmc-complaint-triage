import { api } from './api';
import type { ApiResponse, Complaint, Hotspot } from '../utils/types';

export interface IntelligenceData {
  summary: Record<string, number | string>;
  departmentWorkload: { department: string; count: number }[];
  wardStatistics: { ward: string; count: number }[];
  hotspots: Hotspot[];
  recentIncidents: any[];
  latestSituationReport: SituationReport | null;
  slaCheck: { checked: number; newEscalations: number };
  dataScope: string;
}

export interface SituationReportContent {
  summary: string;
  highlights: string[];
  recommended_focus_areas: string[];
}

export interface SituationReport {
  id: number;
  generated_by: number | null;
  generated_by_name?: string | null;
  summary: SituationReportContent;
  stats_snapshot: Record<string, unknown>;
  created_at: string;
}

export async function getIntelligence() {
  const res = await api.get<ApiResponse<IntelligenceData>>('/admin/intelligence');
  return res.data.data;
}

export async function getHotspots() {
  const res = await api.get<ApiResponse<{ hotspots: Hotspot[] }>>('/admin/hotspots');
  return res.data.data.hotspots;
}

export interface AiSearchResult {
  available: boolean;
  reason?: string;
  appliedFilters?: Record<string, unknown>;
  droppedFields?: string[];
  total?: number;
  results?: Complaint[];
}

export async function aiSearch(query: string) {
  const res = await api.post<ApiResponse<AiSearchResult>>('/admin/ai-search', { query });
  return res.data.data;
}

export async function generateSituationReport() {
  const res = await api.post<
    ApiResponse<{ available: boolean; reason?: string; report?: SituationReport; content?: SituationReportContent }>
  >('/admin/situation-report');
  return res.data.data;
}

export async function listSituationReports() {
  const res = await api.get<ApiResponse<{ reports: SituationReport[] }>>('/admin/situation-reports');
  return res.data.data.reports;
}

export async function runSlaCheck() {
  const res = await api.post<ApiResponse<{ checked: number; newEscalations: number }>>('/admin/sla/check');
  return res.data.data;
}

export async function listSlaEscalations() {
  const res = await api.get<ApiResponse<{ escalations: any[] }>>('/admin/sla/escalations');
  return res.data.data.escalations;
}

export interface OfficerRecommendation {
  officerId: number;
  name: string;
  email: string;
  workload: number;
  criticalCount: number;
  nearbyAssignments: number;
  avgDistanceMeters: number | null;
  // Ward-aware ranking (backend adds these; optional so older responses still type-check)
  rank?: number;
  wardId?: number | null;
  wardName?: string | null;
  wardMatch?: boolean;
  slaBreaches?: number;
  reasons?: string[];
}

export async function recommendOfficer(complaintId: number | string) {
  const res = await api.get<ApiResponse<{ recommendations: OfficerRecommendation[] }>>(
    `/admin/complaints/${complaintId}/recommend-officer`
  );
  return res.data.data.recommendations;
}
