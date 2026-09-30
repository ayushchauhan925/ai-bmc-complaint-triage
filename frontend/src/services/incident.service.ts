import { api } from './api';
import type { ApiResponse, Complaint, Incident, PaginatedResponse } from '../utils/types';
import type { IncidentIntelligence } from './platform.service';

export interface IncidentEvent {
  id: number;
  incident_id: number;
  event_type: string;
  notes: string | null;
  actor_name: string | null;
  created_at: string;
}

export async function listIncidents(filters: Record<string, unknown> = {}) {
  const res = await api.get<ApiResponse<PaginatedResponse<Incident>>>('/incidents', { params: filters });
  return res.data.data;
}

export async function getIncident(id: number | string) {
  const res = await api.get<ApiResponse<{ incident: Incident; complaints: Complaint[]; timeline: IncidentEvent[]; intelligence?: IncidentIntelligence }>>(
    `/incidents/${id}`
  );
  return res.data.data;
}

// Section 5: merge one incident's complaints into another; the source is closed, not deleted.
export async function mergeIncident(targetId: number | string, sourceIncidentId: number) {
  const res = await api.post<ApiResponse<{ incident: Incident }>>(`/incidents/${targetId}/merge`, {
    source_incident_id: sourceIncidentId,
  });
  return res.data.data.incident;
}

export async function updateIncidentStatus(id: number | string, status: string) {
  const res = await api.patch<ApiResponse<{ incident: Incident }>>(`/incidents/${id}`, { status });
  return res.data.data.incident;
}

export async function addComplaintToIncident(id: number | string, complaint_id: number) {
  const res = await api.post<ApiResponse<{ incident: Incident }>>(`/incidents/${id}/complaints`, { complaint_id });
  return res.data.data.incident;
}

export async function removeComplaintFromIncident(id: number | string, complaintId: number | string) {
  const res = await api.delete<ApiResponse<{ incident: Incident }>>(`/incidents/${id}/complaints/${complaintId}`);
  return res.data.data.incident;
}
