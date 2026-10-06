import { api } from './api';
import type { ApiResponse, Complaint, OfficerChecklist, PaginatedResponse, ResolutionVerification } from '../utils/types';
import type { ComplaintFilters } from './complaint.service';
import type { ResolutionOverview, ResolutionView } from './admin.service';

/** Outcomes of this officer's resolutions: approval status from the admin and the citizen's response. */
export async function getMyResolutions(view: ResolutionView, scope: 'mine' | 'department' = 'mine') {
  const res = await api.get<ApiResponse<ResolutionOverview>>('/officer/resolutions', { params: { view, scope, limit: 200 } });
  return res.data.data;
}

export async function listAssigned(filters: ComplaintFilters = {}) {
  const res = await api.get<ApiResponse<PaginatedResponse<Complaint>>>('/officer/complaints', { params: filters });
  return res.data.data;
}

export async function accept(id: number | string) {
  const res = await api.patch<ApiResponse<{ complaint: Complaint }>>(`/officer/complaints/${id}/accept`);
  return res.data.data.complaint;
}

export async function start(id: number | string, notes?: string) {
  const res = await api.patch<ApiResponse<{ complaint: Complaint }>>(`/officer/complaints/${id}/start`, { notes });
  return res.data.data.complaint;
}

export async function uploadResolutionImage(id: number | string, file: File) {
  const form = new FormData();
  form.append('image', file);
  const res = await api.post<ApiResponse<{ complaint: Complaint }>>(
    `/officer/complaints/${id}/resolution-image`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return res.data.data.complaint;
}

export async function resolve(id: number | string, notes?: string) {
  const res = await api.patch<ApiResponse<{ complaint: Complaint; ai_verification: ResolutionVerification | null }>>(
    `/officer/complaints/${id}/resolve`,
    { notes }
  );
  return res.data.data;
}

// Section 12: Officer AI Copilot.
export async function getAiAssistance(id: number | string) {
  const res = await api.get<
    ApiResponse<{ checklist: OfficerChecklist | null; cached: boolean; unavailable?: boolean; reason?: string }>
  >(`/officer/ai-assistance/${id}`);
  return res.data.data;
}
