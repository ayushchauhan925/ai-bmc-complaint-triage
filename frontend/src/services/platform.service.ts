import { api } from './api';
import type { ApiResponse } from '../utils/types';

// Typed client for the civic-intelligence endpoints. Every screen goes through here (via
// TanStack Query) rather than calling axios ad hoc, so caching, errors and auth are uniform.

const get = async <T,>(url: string, params?: Record<string, unknown>) => {
  const res = await api.get<ApiResponse<T>>(url, { params, timeout: 30000 });
  return res.data.data;
};
const send = async <T,>(method: 'post' | 'put' | 'patch', url: string, body?: unknown) => {
  const res = await api.request<ApiResponse<T>>({ method, url, data: body, timeout: 30000 });
  return res.data.data;
};

/* ---------- types ---------- */
export interface HotspotV2 {
  id: string; category: string; label: string; complaintCount: number;
  centroid: { latitude: number; longitude: number }; radiusMeters: number; areaKm2: number;
  densityPerKm2: number; severityDensity: number; severityWeightedCount: number;
  unresolvedCount: number; unresolvedShare: number; recentCount: number; recentShare: number;
  incidentCount: number; dominantPriority: string; score: number;
  scoreComponents: { severityWeightedCount: number; recentShare: number; unresolvedShare: number };
  timeRange: { from: string; to: string }; complaintIds: number[];
}
export interface Anomaly {
  type: string; dimension: string; subject: string; label: string; score: number; observed: number; ratio?: number;
  baseline: { mean?: number; median: number; mad?: number; days: number };
  window: { from: string; to: string }; explanation: string;
  location?: { latitude: number; longitude: number; approxRadiusMeters: number };
  category?: string; departmentId?: number;
}
export interface AnomalyResult { generatedAt: string; sufficientData: boolean; baselineDaysAvailable: number; anomalies: Anomaly[]; notes: string[] }
export interface DepartmentWorkload {
  departmentId: number; code: string; department: string; assigned: number; pending: number; inProgress: number; resolved: number;
  overdue: number; pendingHighPriority: number; avgResolutionHours: number | null; slaCompliance: number | null; backlog: number;
  incoming7d: number; incomingPrev7d: number; incomingTrend: 'UP' | 'DOWN' | 'FLAT' | 'NEW';
  categoryDistribution: { category: string; count: number }[];
}
export interface OverviewData {
  totals: { total: number; open: number; resolved: number; highPriorityOpen: number; slaBreaches: number; activeIncidents: number; reviewQueue: number; openEscalations: number };
  sla: { ON_TRACK: number; APPROACHING: number; BREACHED: number };
  trend: { date: string; count: number }[];
  aiConfidence: { buckets: { range: string; count: number }[]; analysed: number; avgConfidence: number | null; aiFailures: number } | null;
  duplicateRate: { total: number; grouped: number; percentage: number };
  resolution: { resolvedCount: number; avgResolutionHours: number | null };
  hotspots: HotspotV2[];
  hotspotCount: number;
  anomalies: { sufficientData: boolean; items: Anomaly[]; total: number; notes: string[] };
  departmentWorkload: DepartmentWorkload[];
  dataScope: string;
}
export interface ForecastModel {
  available: boolean; reason?: string; historyDays: number; method?: string; horizonDays?: number; intervalNote?: string;
  forecast?: { step: number; value: number; lower: number; upper: number }[];
  backtest?: { holdoutDays: number; maeModel: number; maeNaive: number; beatsNaive: boolean } | null;
  history: { date: string; value: number }[];
}
export interface ForecastData {
  generatedAt: string; horizonDays: number; note: string;
  overall: ForecastModel;
  categories: (ForecastModel & { category: string })[];
  departments: (ForecastModel & { departmentId: number; department: string })[];
  unresolved: ForecastModel;
}
export interface Trends {
  windowDays: number; created: { date: string; count: number }[]; resolved: { date: string; count: number }[];
  byCategoryDaily: { date: string; category: string; count: number }[];
  weekOverWeek: { thisWeek: number; lastWeek: number; changePct: number | null };
}
export interface DecisionFactor { source: string; label: string; points: number }
export interface DecisionTrace {
  available: boolean; reason?: string; engineVersion?: string;
  ai: null | { category: string; subcategory: string | null; confidence: number; urgency: string; riskIndicators: string[]; locationRelevance: string; explanationFactors: string[]; recommendedAction: string | null };
  evidence: { score: number; band: string; indicators: string[] };
  priority: { baseScore: number; finalScore: number; finalLevel: string; current: { score: number; level: string } };
  factors: DecisionFactor[]; humanReviewRequired: boolean; reviewReasons: string[]; reviewStatus: string;
  reviews: { id: number; action: string; reviewer_name: string; created_at: string; notes: string | null; ai_category: string | null; human_category: string | null; ai_priority_level: string | null; human_priority_level: string | null }[];
}
export interface EvidenceSignal { key: string; label: string; points: number; max: number; applicable: boolean; status: 'positive' | 'neutral' | 'negative'; detail: string }
export interface EvidenceData { available: boolean; score?: number; band?: string; indicators?: string[]; signals?: EvidenceSignal[]; redFlags?: { label: string }[] }
export interface TimelineItem { kind: string; type: string; title: string; detail: unknown; actor: string | null; at: string; visibility: string }
export interface DuplicateSuggestion {
  relatedComplaintId: number; complaintNumber: string; category: string; status: string; incidentId: number | null; reportedAt: string;
  duplicateProbability: number; semanticScore: number | null; textScore: number | null; distanceMeters: number; imageSimilarity: number | null;
  indicators: string[]; reviewStatus: 'SUGGESTED' | 'CONFIRMED' | 'REJECTED'; excerpt?: string; shouldLinkToIncident: boolean;
}
export interface SlaSnapshot { startedAt: string; deadline: string | null; targetHours: number | null; status: string; remainingMs: number | null; breached: boolean; warning: boolean; resolutionMs: number | null }
export interface SlaOverview {
  summary: { ON_TRACK: number; APPROACHING: number; BREACHED: number };
  policies: { id: number; priority_level: string; category_key: string; target_hours: number; warning_pct: string; is_active: number }[];
  atRisk: { id: number; complaint_number: string; category: string; priority_level: string; status: string; sla_status: string; sla_deadline: string; department_name: string | null; sla: SlaSnapshot }[];
  resolved: { withinSla: number; afterSla: number; compliance: number | null; avgResolutionHours: number | null };
}
export interface EscalationEvent { id: number; rule_code: string; severity: string; title: string; status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED'; created_at: string; complaint_id: number | null; incident_id: number | null; complaint_number: string | null; incident_number: string | null; department_name: string | null; details: Record<string, unknown> | null }
export interface AuditRow { id: number; actor_id: number | null; actor_name: string | null; actor_role: string | null; action: string; entity_type: string; entity_id: string | null; previous_value: unknown; new_value: unknown; created_at: string }
export interface AiFeedback {
  windowDays: number; sufficientData: boolean; minSample: number; reviewedDecisions: number;
  classificationAccuracy: number | null; priorityAgreement: number | null; departmentRoutingAgreement: number | null; approvalRate: number | null; correctionRate: number | null; falsePositives: number;
  duplicate: { confirmed: number; rejected: number; pendingSuggestions: number; precision: number | null; sufficientData: boolean };
  calibration: { avgConfidenceWhenCorrect: number | null; avgConfidenceWhenCorrected: number | null; samples: number };
  confidenceDistribution: { range: string; count: number }[]; note: string;
}
export interface EvalRun { runId: string; mode: string; at: string; cases: number; agreed: number; tasks: { task: string; total: number; agreed: number; accuracy: number }[] }
export interface EvalResult { runId: string; mode: string; summary: { task: string; total: number; agreed: number; accuracy: number | null; status: string; reason?: string }[] }
export interface AiUsage {
  windowDays: number; costNote: string;
  totals: { requests: number; failures: number; failureRate: number; totalTokens: number; estimatedCostUsd: number };
  byUseCase: { useCase: string; requests: number; failures: number; failureRate: number; totalTokens: number; estimatedCostUsd: number; avgLatencyMs: number }[];
  byModel: { model: string; requests: number; totalTokens: number; estimatedCostUsd: number }[];
  daily: { date: string; requests: number; estimatedCostUsd: number }[];
}
export interface Observability {
  database: { ok: boolean; roundTripMs: number };
  metrics: { startedAt: string; uptimeSeconds: number; counters: Record<string, number>; latency: Record<string, { count: number; avgMs: number; p50Ms: number | null; p95Ms: number | null; maxMs: number }>; recentErrors: { kind: string; message: string; at: string }[] };
  jobs: { enabled: boolean; definitions: { name: string; everyMinutes: number; running: boolean }[]; recentRuns: { id: number; job_name: string; status: string; duration_ms: number; started_at: string; error_message: string | null }[] };
  ai: { configured: boolean; last7Days: AiUsage['totals'] | null };
  notifications: { channels: string[] }; note: string;
}
export interface IncidentIntelligence {
  complaintCount: number; openComplaintCount: number; categories: { category: string; count: number }[]; severity: string;
  firstReportedAt: string | null; latestReportedAt: string | null;
  trend: { label: 'RISING' | 'STABLE' | 'FALLING' | 'INSUFFICIENT_DATA'; last24h: number | null; previous24h: number | null };
  extent: { centroid: { latitude: number; longitude: number }; radiusMeters: number } | null;
  sla: { worstStatus: string; breachedCount: number; nextDeadline: string | null };
  escalation: { openCount: number; events: { id: number; rule_code: string; severity: string; title: string; status: string; created_at: string }[] };
}
export type GeoFilters = { category?: string; priority?: string; department_id?: number | string; status?: string; days?: number | string; radius?: number; min_complaints?: number };

/* ---------- calls ---------- */
export const overview = () => get<OverviewData>('/analytics/overview');
export const trends = (p: Record<string, unknown>) => get<Trends>('/analytics/trends', p);
export const hotspots = (f: GeoFilters) => get<{ hotspots: HotspotV2[]; evaluatedComplaints: number }>('/analytics/hotspots', f as Record<string, unknown>);
export const heatmap = (f: GeoFilters) => get<{ points: [number, number, number][]; count: number }>('/analytics/heatmap', f as Record<string, unknown>);
export const anomalies = (refresh = false) => get<AnomalyResult>('/analytics/anomalies', refresh ? { refresh: 'true' } : undefined);
export const forecast = () => get<ForecastData>('/analytics/forecast');
export const departmentWorkload = (department_id?: number) =>
  get<{ departments: DepartmentWorkload[]; trend: { incoming: { date: string; count: number }[]; resolved: { date: string; count: number }[] } | null }>(
    '/analytics/department-workload',
    department_id ? { department_id } : undefined
  );

export const decisionTrace = (id: number | string) => get<DecisionTrace>(`/complaints/${id}/decision-trace`);
export const evidence = (id: number | string) => get<EvidenceData>(`/complaints/${id}/evidence`);
export const timeline = (id: number | string) => get<{ timeline: TimelineItem[] }>(`/complaints/${id}/timeline`).then((d) => d.timeline);
export const duplicates = (id: number | string) => get<{ duplicates: DuplicateSuggestion[]; incidentId: number | null }>(`/complaints/${id}/duplicates`);
export const complaintSla = (id: number | string) => get<{ sla: SlaSnapshot }>(`/complaints/${id}/sla`).then((d) => d.sla);
export const review = (id: number | string, body: Record<string, unknown>) => send<{ complaint: unknown }>('post', `/complaints/${id}/review`, body);

export const slaOverview = () => get<SlaOverview>('/sla');
export const saveSlaPolicy = (body: { priority_level: string; target_hours: number; category?: string; warning_pct?: number }) => send('put', '/sla/policies', body);
export const escalations = (status?: string) =>
  get<{ events: EscalationEvent[]; summary: { ruleCode: string; status: string; count: number }[] }>('/escalations', status ? { status } : undefined);
export const acknowledgeEscalation = (id: number) => send('patch', `/escalations/${id}/acknowledge`);
export const runEscalations = () => send('post', '/escalations/run');

export const auditLogs = (p: Record<string, unknown>) => get<{ rows: AuditRow[]; total: number; page: number; limit: number }>('/admin/audit-logs', p);
export const aiPerformance = () => get<{ feedback: AiFeedback; evaluations: EvalRun[] }>('/admin/ai-performance');
export const aiUsage = (days = 30) => get<AiUsage>('/admin/ai-usage', { days });
export const runEvaluation = (mode: 'deterministic' | 'live') => send<EvalResult>('post', '/admin/evaluations/run', { mode });
export const observability = () => get<Observability>('/admin/observability');
export const runJob = (name: string) => send('post', `/admin/jobs/${name}/run`);
export const semanticSearch = (q: string) =>
  get<{ mode: 'semantic' | 'keyword'; reason?: string; results: { id: number; complaint_number: string; category: string; ai_title: string | null; description: string; status: string; priority_level: string; similarity: number | null }[] }>('/admin/search/semantic', { q });
