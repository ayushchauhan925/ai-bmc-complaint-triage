import { api } from './api';
import type { ApiResponse, Complaint, Department, MapPoint, PaginatedResponse, User, Ward } from '../utils/types';
import type { ComplaintFilters } from './complaint.service';

export async function listComplaints(filters: ComplaintFilters = {}) {
  const res = await api.get<ApiResponse<PaginatedResponse<Complaint>>>('/admin/complaints', { params: filters });
  return res.data.data;
}

export async function assignComplaint(id: number | string, department_id: number, officer_id?: number) {
  const res = await api.patch<ApiResponse<{ complaint: Complaint }>>(`/admin/complaints/${id}/assign`, {
    department_id,
    officer_id,
  });
  return res.data.data.complaint;
}

export type ResolutionView = 'approved' | 'confirmed' | 'awaiting-feedback' | 'not-resolved';

export interface ResolutionRow {
  id: number;
  complaint_number: string;
  title: string;
  category: string;
  priority_level: string;
  status: string;
  citizen_name: string;
  department_name: string | null;
  officer_name: string | null;
  officer_email: string | null;
  created_at: string;
  resolved_at: string | null;
  feedback: { resolved: boolean; rating: number | null; comment: string | null; created_at: string } | null;
  reopen: { reason: string | null; created_at: string } | null;
}

export interface ResolutionOverview {
  view: ResolutionView;
  counts: { approved: number; confirmed: number; awaitingFeedback: number; notResolved: number; notResolvedComplaints: number };
  rows: ResolutionRow[];
}

export async function getResolutions(view: ResolutionView) {
  const res = await api.get<ApiResponse<ResolutionOverview>>('/admin/resolutions', { params: { view, limit: 200 } });
  return res.data.data;
}

export async function getStatistics() {
  const res = await api.get<ApiResponse<any>>('/admin/statistics');
  return res.data.data;
}

export async function getAnalytics() {
  const res = await api.get<ApiResponse<any>>('/admin/analytics');
  return res.data.data;
}

export async function getMapData(filters: Record<string, unknown> = {}) {
  const res = await api.get<ApiResponse<{ points: MapPoint[] }>>('/admin/map-data', { params: filters });
  return res.data.data.points;
}

export async function listDepartments() {
  const res = await api.get<ApiResponse<{ departments: Department[] }>>('/admin/departments');
  return res.data.data.departments;
}

export async function listWards() {
  const res = await api.get<ApiResponse<{ wards: Ward[] }>>('/admin/wards');
  return res.data.data.wards;
}

export async function listOfficers() {
  const res = await api.get<ApiResponse<{ officers: User[] }>>('/admin/officers');
  return res.data.data.officers;
}
