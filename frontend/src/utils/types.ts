import type { Category, ComplaintStatus, PriorityLevel, Role, SlaStatus } from './constants';

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  department_id: number | null;
  created_at: string;
}

export interface Department {
  id: number;
  code: string;
  name: string;
  description: string | null;
}

export interface Ward {
  id: number;
  ward_code: string;
  ward_name: string;
  is_demo: boolean;
}

export interface SeveritySignals {
  traffic_hazard?: boolean;
  large_damage?: boolean;
  water_accumulation?: boolean;
  near_school?: boolean;
  near_hospital?: boolean;
  near_public_place?: boolean;
  injury_reported?: boolean;
  public_health_risk?: boolean;
  environmental_risk?: boolean;
  emergency_access_blocked?: boolean;
  multiple_people_affected?: boolean;
}

export interface PriorityReason {
  label: string;
  points: number;
}

export interface ComplaintImage {
  id: number;
  complaint_id: number;
  image_url: string;
  image_type: 'ORIGINAL' | 'RESOLUTION' | 'REOPEN';
  blur_score?: string | number | null;
  uploaded_at: string;
}

export interface ComplaintHistoryEntry {
  id: number;
  complaint_id: number;
  old_status: ComplaintStatus | null;
  new_status: ComplaintStatus;
  changed_by: number | null;
  actor_name: string | null;
  actor_role: Role | null;
  notes: string | null;
  created_at: string;
}

export interface EvidenceAnalysis {
  issue_visible: boolean;
  issue_type: string | null;
  image_supports_claim: boolean;
  image_quality_sufficient: boolean;
  is_blurry: boolean;
  likely_irrelevant: boolean;
  possible_duplicate_image: boolean;
  manipulated_or_suspicious: boolean;
  contextual_notes: string | null;
  evidence_confidence: number;
}

export interface ResolutionVerification {
  status: 'SUPPORTED' | 'UNCERTAIN' | 'NOT_SUPPORTED';
  likely_resolved: boolean;
  confidence: number;
  summary: string;
  signals: {
    same_area_appears_addressed: boolean;
    image_quality_sufficient: boolean;
    after_image_appears_related_to_before: boolean;
    additional_review_recommended: boolean;
  };
}

export interface OfficerChecklist {
  inspection_checklist: string[];
  evidence_to_collect: string[];
  resolution_checklist: string[];
}

export interface DuplicateMatch {
  complaint_id: number;
  complaint_number: string;
  category: string;
  status: string;
  incident_id: number | null;
  created_at: string;
  similarity: number;
  distance_meters: number;
  combined_score: number;
}

export interface Hotspot {
  category: Category;
  complaintCount: number;
  centroid: { latitude: number; longitude: number };
  dominantPriority: PriorityLevel;
  radiusMeters: number;
  timeRange: { from: string; to: string };
  complaintIds: number[];
  complaintNumbers: string[];
}

export interface Complaint {
  id: number;
  complaint_number: string;
  user_id: number;
  description: string;
  ai_title: string | null;
  category: Category;
  subcategory: string | null;
  language: string | null;
  ai_summary: string | null;
  ai_confidence: number | null;
  missing_information: string[] | null;
  severity_signals: SeveritySignals | null;
  evidence_analysis: EvidenceAnalysis | null;
  evidence_confidence: number | null;
  resolution_verification: ResolutionVerification | null;
  resolution_verification_status: 'SUPPORTED' | 'UNCERTAIN' | 'NOT_SUPPORTED' | null;
  ai_officer_checklist: OfficerChecklist | null;
  image_verified: boolean | null;
  review_required: boolean;
  review_reason: string | null;
  ai_analysis_failed: boolean;
  priority_score: number;
  priority_level: PriorityLevel;
  priority_reasons: PriorityReason[] | null;
  department_id: number | null;
  department_name?: string | null;
  officer_id: number | null;
  ward_id: number | null;
  ward_name?: string | null;
  incident_id: number | null;
  citizen_name?: string | null;
  latitude: string | number;
  longitude: string | number;
  address: string | null;
  status: ComplaintStatus;
  sla_deadline: string | null;
  sla_status: SlaStatus;
  sla_hours?: number | null;
  review_status?: 'PENDING' | 'APPROVED' | 'CORRECTED' | 'FALSE_POSITIVE';
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  images?: ComplaintImage[];
  history?: ComplaintHistoryEntry[];
  relatedCount?: number;
  incidentId?: number | null;
}

export interface Incident {
  id: number;
  incident_number: string;
  title: string;
  category: Category;
  latitude: string | number;
  longitude: string | number;
  priority_score: number;
  priority_level: PriorityLevel;
  department_id: number | null;
  department_name?: string | null;
  status: string;
  complaint_count: number;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  rows: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  message: string;
  type: string;
  related_complaint_id: number | null;
  is_read: boolean;
  created_at: string;
}

export interface MapPoint {
  id: number;
  complaint_number: string;
  category: Category;
  priority_level: PriorityLevel;
  status: ComplaintStatus;
  latitude: string | number;
  longitude: string | number;
  department_name: string | null;
  incident_id: number | null;
}
