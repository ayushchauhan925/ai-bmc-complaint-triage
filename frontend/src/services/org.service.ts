import { api } from './api';
import type { ApiResponse } from '../utils/types';

// Department catalog + officer management (admin). Typed client used with TanStack Query.

export interface DepartmentOverview {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  contactEmail: string | null;
  contactPhone: string | null;
  isFallback: boolean;
  inCatalog: boolean;
  primaryCategories: string[];
  secondaryCategories: string[];
  activeOfficers: number;
  totalOfficers: number;
  activeComplaints: number;
  criticalComplaints: number;
  updatedAt: string;
}

export interface OfficerOverview {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  departmentId: number | null;
  departmentName: string | null;
  departmentCode: string | null;
  departmentActive: boolean | null;
  wardId: number | null;
  wardName: string | null;
  isActive: boolean;
  activeAssignments: number;
  criticalAssignments: number;
  slaBreaches: number;
  createdAt: string;
}

export interface DepartmentUpdate {
  description?: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  is_active?: boolean;
  reassign_to_department_id?: number | null;
}

export interface OfficerCreate {
  name: string;
  email: string;
  password: string;
  phone?: string;
  department_id: number;
  ward_id?: number | null;
}

export interface OfficerUpdate {
  name?: string;
  phone?: string | null;
  department_id?: number;
  ward_id?: number | null;
  is_active?: boolean;
  release_assignments?: boolean;
}

export async function departmentOverview(params: { search?: string; active?: 'true' | 'false' } = {}) {
  const res = await api.get<ApiResponse<{ departments: DepartmentOverview[] }>>('/admin/departments/overview', { params });
  return res.data.data.departments;
}

export async function updateDepartment(id: number, body: DepartmentUpdate) {
  const res = await api.patch<ApiResponse<{ department: DepartmentOverview; reassigned: number }>>(`/admin/departments/${id}`, body);
  return res.data.data;
}

export async function officerOverview(params: { search?: string; department_id?: number | string; status?: 'active' | 'inactive' } = {}) {
  const res = await api.get<ApiResponse<{ officers: OfficerOverview[] }>>('/admin/officers/overview', { params });
  return res.data.data.officers;
}

export async function createOfficer(body: OfficerCreate) {
  const res = await api.post<ApiResponse<{ officer: { id: number } }>>('/admin/officers', body);
  return res.data.data.officer;
}

export async function updateOfficer(id: number, body: OfficerUpdate) {
  const res = await api.patch<ApiResponse<{ released: number }>>(`/admin/officers/${id}`, body);
  return res.data.data;
}

export async function changeOfficerPassword(id: number, password: string) {
  await api.patch(`/admin/officers/${id}/password`, { password });
}

/** Extracts a structured API error detail such as { openComplaints } / { openAssignments }. */
export function errorDetails(err: unknown): Record<string, number> | null {
  const d = (err as { response?: { data?: { details?: unknown } } })?.response?.data?.details;
  return d && typeof d === 'object' && !Array.isArray(d) ? (d as Record<string, number>) : null;
}
