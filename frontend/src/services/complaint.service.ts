import { api } from './api';
import type { ApiResponse, Complaint, DuplicateMatch, PaginatedResponse } from '../utils/types';

export interface ComplaintFilters {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  priority_level?: string;
  department_id?: number;
  ward_id?: number;
  search?: string;
  review_required?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
}

export async function createComplaint(payload: {
  description: string;
  latitude: number;
  longitude: number;
  address?: string;
  images: File[];
}) {
  const form = new FormData();
  form.append('description', payload.description);
  form.append('latitude', String(payload.latitude));
  form.append('longitude', String(payload.longitude));
  if (payload.address) form.append('address', payload.address);
  payload.images.forEach((file) => form.append('images', file));

  const res = await api.post<ApiResponse<{ complaint: Complaint }>>('/complaints', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data.complaint;
}

export async function listComplaints(filters: ComplaintFilters = {}) {
  const res = await api.get<ApiResponse<PaginatedResponse<Complaint>>>('/complaints', { params: filters });
  return res.data.data;
}

export async function getComplaint(id: number | string) {
  const res = await api.get<ApiResponse<{ complaint: Complaint }>>(`/complaints/${id}`);
  return res.data.data.complaint;
}

export async function updateComplaintStatus(id: number | string, status: string, notes?: string) {
  const res = await api.patch<ApiResponse<{ complaint: Complaint }>>(`/complaints/${id}/status`, { status, notes });
  return res.data.data.complaint;
}

export async function updateComplaint(id: number | string, fields: Record<string, unknown>) {
  const res = await api.patch<ApiResponse<{ complaint: Complaint }>>(`/complaints/${id}`, fields);
  return res.data.data.complaint;
}

export async function reanalyzeComplaint(id: number | string) {
  const res = await api.post<ApiResponse<{ complaint: Complaint }>>(`/complaints/${id}/analyze`);
  return res.data.data.complaint;
}

export async function getDuplicates(id: number | string) {
  const res = await api.post<ApiResponse<{ duplicates: DuplicateMatch[] }>>(`/complaints/${id}/duplicates`);
  return res.data.data.duplicates;
}

export async function submitFeedback(
  id: number | string,
  payload: { resolved: boolean; rating?: number; comment?: string }
) {
  const res = await api.post<ApiResponse<{ complaint: Complaint }>>(`/complaints/${id}/feedback`, payload);
  return res.data.data.complaint;
}

// Section 1: guided complaint assistant (one-shot, not a chatbot).
export interface GuidedAssistResult {
  available: boolean;
  reason?: string;
  likely_category?: string;
  follow_up_questions?: string[];
  suggested_description?: string | null;
  confidence?: number;
}

export async function getGuidedAssist(draft: string) {
  const res = await api.post<ApiResponse<GuidedAssistResult>>('/complaints/ai-assist', { draft });
  return res.data.data;
}

// Section 16: pre-submission duplicate warning.
export async function checkDuplicates(description: string, latitude: number, longitude: number) {
  const res = await api.post<ApiResponse<{ duplicates: DuplicateMatch[] }>>('/complaints/duplicate-check', {
    description,
    latitude,
    longitude,
  });
  return res.data.data.duplicates;
}

// Section 17: citizen reopens a resolved complaint.
export async function reopenComplaint(id: number | string, reason?: string, image?: File | null) {
  const form = new FormData();
  if (reason) form.append('reason', reason);
  if (image) form.append('image', image);
  const res = await api.post<ApiResponse<{ complaint: Complaint }>>(`/complaints/${id}/reopen`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data.complaint;
}
