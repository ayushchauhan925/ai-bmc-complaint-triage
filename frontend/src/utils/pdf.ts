import type { Complaint, Incident } from './types';
import type { OverviewData, SlaOverview, DecisionTrace, TimelineItem, SlaSnapshot, IncidentIntelligence, AuditRow } from '../services/platform.service';
import type { PublicStatistics } from '../services/public.service';
import { formatCategory, formatStatus } from './constants';

/**
 * PDF reports, generated in the browser from data the signed-in user is already allowed to
 * see (no extra server load, no new permissions). jsPDF is loaded on demand so it never
 * weighs down the main bundle.
 *
 * Limitation: the built-in PDF fonts only cover Latin text. Hindi/Marathi (Devanagari) text
 * cannot be embedded without shipping a large font, so such text is replaced by a clear
 * placeholder and the English AI summary is included instead. Nothing is silently garbled.
 */

const BRAND: [number, number, number] = [30, 58, 138];
const MUTED: [number, number, number] = [100, 116, 139];
const MARGIN = 14;

type Doc = import('jspdf').jsPDF;
type AutoTable = (doc: Doc, options: Record<string, unknown>) => void;

// Normalise typographic punctuation, then flag anything the standard font cannot draw.
export function pdfSafe(input: unknown): string {
  if (input === null || input === undefined) return '';
  const s = String(input)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[•·]/g, '-')
    .replace(/→/g, '->')
    .replace(/[ ]/g, ' ');
  // eslint-disable-next-line no-control-regex
  return /[^\u0000-ÿ]/.test(s) ? s.replace(/[^\u0000-ÿ]+/g, '[non-Latin text]') : s;
}

const dt = (d: string | null | undefined) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-');
const pct = (v: number | null | undefined) => (v === null || v === undefined ? '-' : `${Math.round(v * 100)}%`);
const stamp = () => new Date().toISOString().slice(0, 10);

interface Ctx {
  doc: Doc;
  autoTable: AutoTable;
  y: number;
}

async function start(title: string, subtitle?: string): Promise<Ctx> {
  const [{ jsPDF }, autoTableModule] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const autoTable = (autoTableModule.default ?? (autoTableModule as unknown as { autoTable: AutoTable }).autoTable) as AutoTable;

  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, w, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Civic Connect', MARGIN, 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Civic AI Intelligence & Response Platform', MARGIN, 17);

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(pdfSafe(title), MARGIN, 35);
  let y = 41;
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    const lines = doc.splitTextToSize(pdfSafe(subtitle), w - MARGIN * 2) as string[];
    doc.text(lines, MARGIN, y);
    y += lines.length * 4.5 + 2;
  }
  return { doc, autoTable, y: y + 2 };
}

function heading(ctx: Ctx, text: string) {
  const h = ctx.doc.internal.pageSize.getHeight();
  if (ctx.y > h - 40) {
    ctx.doc.addPage();
    ctx.y = 20;
  }
  ctx.doc.setFont('helvetica', 'bold');
  ctx.doc.setFontSize(11.5);
  ctx.doc.setTextColor(...BRAND);
  ctx.doc.text(pdfSafe(text), MARGIN, ctx.y);
  ctx.y += 2;
  ctx.doc.setDrawColor(226, 232, 240);
  ctx.doc.line(MARGIN, ctx.y, ctx.doc.internal.pageSize.getWidth() - MARGIN, ctx.y);
  ctx.y += 5;
}

function paragraph(ctx: Ctx, text: string, size = 10) {
  const w = ctx.doc.internal.pageSize.getWidth() - MARGIN * 2;
  ctx.doc.setFont('helvetica', 'normal');
  ctx.doc.setFontSize(size);
  ctx.doc.setTextColor(30, 41, 59);
  const lines = ctx.doc.splitTextToSize(pdfSafe(text), w) as string[];
  const h = ctx.doc.internal.pageSize.getHeight();
  for (const line of lines) {
    if (ctx.y > h - 22) {
      ctx.doc.addPage();
      ctx.y = 20;
    }
    ctx.doc.text(line, MARGIN, ctx.y);
    ctx.y += size * 0.5;
  }
  ctx.y += 2;
}

function keyValues(ctx: Ctx, rows: [string, string][]) {
  ctx.autoTable(ctx.doc, {
    startY: ctx.y,
    body: rows.map(([k, v]) => [pdfSafe(k), pdfSafe(v)]),
    theme: 'plain',
    styles: { fontSize: 9.5, cellPadding: { top: 1.4, bottom: 1.4, left: 1, right: 2 } },
    columnStyles: { 0: { fontStyle: 'bold', textColor: MUTED, cellWidth: 42 } },
    margin: { left: MARGIN, right: MARGIN },
  });
  ctx.y = (ctx.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
}

function table(ctx: Ctx, head: string[], body: (string | number)[][], opts: Record<string, unknown> = {}) {
  ctx.autoTable(ctx.doc, {
    startY: ctx.y,
    head: [head.map(pdfSafe)],
    body: body.map((r) => r.map((c) => pdfSafe(c))),
    theme: 'striped',
    headStyles: { fillColor: BRAND, fontSize: 8.5 },
    styles: { fontSize: 8.5, cellPadding: 1.8, overflow: 'linebreak' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: MARGIN, right: MARGIN },
    ...opts,
  });
  ctx.y = (ctx.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
}

function finish(ctx: Ctx, filename: string, note?: string) {
  const { doc } = ctx;
  const pages = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(MARGIN, h - 14, w - MARGIN, h - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(pdfSafe(note ?? 'Demo data is synthetic and not an official municipal record.'), MARGIN, h - 9);
    doc.text(`Generated ${new Date().toLocaleString()}  |  Page ${i} of ${pages}`, w - MARGIN, h - 9, { align: 'right' });
  }
  doc.save(filename);
}

/* ------------------------------------------------------------------ reports */

export async function complaintReport(input: {
  complaint: Complaint;
  timeline: TimelineItem[];
  sla?: SlaSnapshot | null;
  trace?: DecisionTrace | null;
  staff: boolean;
}) {
  const { complaint: c, timeline, sla, trace, staff } = input;
  const ctx = await start(
    `Complaint ${c.complaint_number}`,
    staff ? 'Complaint record with AI assessment and timeline (internal).' : 'Your complaint receipt and progress record.'
  );

  heading(ctx, 'Summary');
  keyValues(ctx, [
    ['Complaint ID', c.complaint_number],
    ['Reported', dt(c.created_at)],
    ['Category', formatCategory(c.category)],
    ['Status', formatStatus(c.status)],
    ['Priority', c.priority_level],
    ['Department', c.department_name || 'Being assigned'],
    ['Location', c.address || `${Number(c.latitude).toFixed(5)}, ${Number(c.longitude).toFixed(5)}`],
    ...(sla?.deadline ? ([['Target resolution', `${dt(sla.deadline)}${sla.targetHours ? ` (${sla.targetHours} h target)` : ''}`]] as [string, string][]) : []),
    ...(c.resolved_at ? ([['Resolved', dt(c.resolved_at)]] as [string, string][]) : []),
  ]);

  heading(ctx, 'What was reported');
  paragraph(ctx, c.description);
  if (c.ai_summary) {
    paragraph(ctx, `AI summary (English): ${c.ai_summary}`, 9.5);
  }

  if (staff && trace?.available) {
    heading(ctx, 'AI assessment (advisory)');
    keyValues(ctx, [
      ['Category (AI)', trace.ai ? formatCategory(trace.ai.category) : 'AI unavailable - fallback used'],
      ['AI confidence', trace.ai ? pct(trace.ai.confidence) : '-'],
      ['Evidence', `${trace.evidence.band} (score ${trace.evidence.score}/100)`],
      ['Priority score', `${trace.priority.finalScore} (${trace.priority.finalLevel})`],
      ['Human review', trace.humanReviewRequired ? `Requested: ${trace.reviewReasons.join('; ')}` : 'Not required'],
    ]);
    if (trace.factors.length) {
      table(ctx, ['Decision factor', 'Source', 'Points'], trace.factors.filter((f) => f.points !== 0).map((f) => [f.label, f.source, f.points > 0 ? `+${f.points}` : String(f.points)]));
    }
  }

  heading(ctx, 'Timeline');
  if (timeline.length === 0) paragraph(ctx, 'No activity recorded yet.');
  else table(ctx, ['When', 'Event', ...(staff ? ['Detail'] : [])], timeline.map((e) => [dt(e.at), e.title, ...(staff ? [typeof e.detail === 'string' ? e.detail : ''] : [])]));

  finish(ctx, `${c.complaint_number}.pdf`);
}

export async function incidentReport(input: { incident: Incident; complaints: Complaint[]; intelligence?: IncidentIntelligence | null }) {
  const { incident: inc, complaints, intelligence: i } = input;
  const ctx = await start(`Incident ${inc.incident_number}`, inc.title);

  heading(ctx, 'Overview');
  keyValues(ctx, [
    ['Category', formatCategory(inc.category)],
    ['Severity', inc.priority_level],
    ['Status', inc.status.replace('_', ' ')],
    ['Department', inc.department_name || 'Unassigned'],
    ['Linked complaints', String(inc.complaint_count)],
    ['Opened', dt(inc.created_at)],
    ...(i
      ? ([
          ['Open complaints', String(i.openComplaintCount)],
          ['First / latest report', `${dt(i.firstReportedAt)}  /  ${dt(i.latestReportedAt)}`],
          ['Trend', i.trend.label === 'INSUFFICIENT_DATA' ? 'Not enough reports to judge' : `${i.trend.label.toLowerCase()} (${i.trend.last24h} in last 24 h vs ${i.trend.previous24h} before)`],
          ['Affected area', i.extent ? `about ${i.extent.radiusMeters} m radius` : '-'],
          ['Worst SLA state', `${formatStatus(i.sla.worstStatus)} (${i.sla.breachedCount} breached)`],
        ] as [string, string][])
      : []),
  ]);

  heading(ctx, 'Linked complaints');
  if (complaints.length === 0) paragraph(ctx, 'No complaints are linked.');
  else
    table(
      ctx,
      ['ID', 'Category', 'Priority', 'Status', 'SLA', 'Reported'],
      complaints.map((c) => [c.complaint_number, formatCategory(c.category), c.priority_level, formatStatus(c.status), formatStatus(c.sla_status), dt(c.created_at)])
    );
  finish(ctx, `${inc.incident_number}.pdf`);
}

export async function commandCenterReport(o: OverviewData) {
  const ctx = await start('Operations snapshot', `Situation summary generated ${new Date().toLocaleString()}.`);
  heading(ctx, 'Headline metrics');
  keyValues(ctx, [
    ['Total complaints', String(o.totals.total)],
    ['Open / resolved', `${o.totals.open} / ${o.totals.resolved}`],
    ['High-priority open', String(o.totals.highPriorityOpen)],
    ['Active incidents', String(o.totals.activeIncidents)],
    ['SLA breaches', String(o.totals.slaBreaches)],
    ['Open escalations', String(o.totals.openEscalations)],
    ['Awaiting human review', String(o.totals.reviewQueue)],
    ['Avg. resolution', o.resolution.avgResolutionHours === null ? 'Insufficient data' : `${o.resolution.avgResolutionHours} h`],
    ['Duplicate rate', `${o.duplicateRate.percentage}% (${o.duplicateRate.grouped} of ${o.duplicateRate.total})`],
  ]);

  heading(ctx, 'Open complaints by SLA state');
  table(ctx, ['State', 'Complaints'], [['On track', o.sla.ON_TRACK], ['Warning', o.sla.APPROACHING], ['Breached', o.sla.BREACHED]]);

  heading(ctx, 'Anomalies (last 24 h vs baseline)');
  if (!o.anomalies.sufficientData) paragraph(ctx, `Insufficient data. ${o.anomalies.notes[0] ?? ''}`);
  else if (o.anomalies.items.length === 0) paragraph(ctx, 'No anomalies detected.');
  else table(ctx, ['Alert', 'Observed', 'Baseline (median)', 'Score', 'Explanation'], o.anomalies.items.map((a) => [a.label, a.observed, a.baseline.median, a.score, a.explanation]));

  heading(ctx, 'Hotspots (open complaints, last 14 days)');
  if (o.hotspots.length === 0) paragraph(ctx, 'No hotspots.');
  else table(ctx, ['Hotspot', 'Complaints', 'Unresolved', 'Radius (m)', 'Severity', 'Score'], o.hotspots.map((h) => [h.label, h.complaintCount, h.unresolvedCount, h.radiusMeters, h.dominantPriority, h.score]));

  heading(ctx, 'Department workload');
  table(
    ctx,
    ['Department', 'Pending', 'Overdue', 'High priority', 'Resolved', 'Avg resolution', 'SLA compliance'],
    o.departmentWorkload.filter((d) => d.assigned > 0).map((d) => [d.department, d.pending, d.overdue, d.pendingHighPriority, d.resolved, d.avgResolutionHours === null ? '-' : `${d.avgResolutionHours} h`, d.slaCompliance === null ? 'no data' : pct(d.slaCompliance)])
  );
  finish(ctx, `operations-snapshot-${stamp()}.pdf`, `${o.dataScope}`);
}

export async function slaReport(s: SlaOverview) {
  const ctx = await start('SLA status report', `Generated ${new Date().toLocaleString()}.`);
  heading(ctx, 'Summary');
  keyValues(ctx, [
    ['On track', String(s.summary.ON_TRACK)],
    ['Warning', String(s.summary.APPROACHING)],
    ['Breached', String(s.summary.BREACHED)],
    ['Resolved on time', `${s.resolved.withinSla} (compliance ${pct(s.resolved.compliance)})`],
    ['Resolved late', String(s.resolved.afterSla)],
  ]);
  heading(ctx, 'Targets');
  table(ctx, ['Priority', 'Category', 'Target (h)', 'Warn at'], s.policies.map((p) => [p.priority_level, p.category_key === '*' ? 'All' : formatCategory(p.category_key), p.target_hours, pct(Number(p.warning_pct))]));
  heading(ctx, 'Needs attention');
  if (s.atRisk.length === 0) paragraph(ctx, 'No open complaint is approaching or past its deadline.');
  else table(ctx, ['Complaint', 'Category', 'Priority', 'Department', 'Deadline', 'SLA'], s.atRisk.map((c) => [c.complaint_number, formatCategory(c.category), c.priority_level, c.department_name || 'Unassigned', dt(c.sla_deadline), formatStatus(c.sla_status)]));
  finish(ctx, `sla-report-${stamp()}.pdf`);
}

export async function publicSummaryReport(d: PublicStatistics) {
  const ctx = await start('Civic complaints - public summary', 'Aggregated, anonymous statistics from the public transparency dashboard.');
  heading(ctx, 'Headline figures');
  keyValues(ctx, [
    ['Complaints reported', String(d.total_complaints)],
    ['Resolved', `${d.resolved} (${d.resolution_rate_pct ?? '-'}%)`],
    ['Being worked on', String(d.pending_or_active)],
    ['Active incidents', String(d.active_incidents ?? 0)],
    ['Avg. time to resolve', d.avg_resolution_hours === null ? 'Not enough data' : `${d.avg_resolution_hours} h`],
    ['Resolved within deadline', d.sla_compliance_pct === null ? 'Not enough data' : `${d.sla_compliance_pct}%`],
    ...(d.week_over_week ? ([['This week vs last', `${d.week_over_week.this_week} vs ${d.week_over_week.last_week}`]] as [string, string][]) : []),
  ]);
  if (d.by_status?.length) {
    heading(ctx, 'By status');
    table(ctx, ['Status', 'Complaints'], d.by_status.map((s) => [formatStatus(s.status), s.count]));
  }
  heading(ctx, 'By category');
  table(ctx, ['Category', 'Complaints', 'Resolved'], d.by_category.map((c) => [formatCategory(c.category), c.count, c.resolved ?? '-']));
  if (d.by_department?.length) {
    heading(ctx, 'By department');
    table(ctx, ['Department', 'Complaints', 'Resolved', 'Avg. time'], d.by_department.map((x) => [x.department, x.total, x.resolved, x.avg_resolution_hours === null ? '-' : `${x.avg_resolution_hours} h`]));
  }
  finish(ctx, `civic-complaints-public-summary-${stamp()}.pdf`, d.data_scope);
}

export async function complaintListReport(title: string, subtitle: string, rows: Complaint[]) {
  const ctx = await start(title, subtitle);
  if (rows.length === 0) paragraph(ctx, 'No complaints match the current filters.');
  else
    table(
      ctx,
      ['ID', 'Category', 'Priority', 'Status', 'SLA', 'Department', 'Reported'],
      rows.map((c) => [c.complaint_number, formatCategory(c.category), c.priority_level, formatStatus(c.status), formatStatus(c.sla_status), c.department_name || '-', dt(c.created_at)])
    );
  finish(ctx, `complaints-${stamp()}.pdf`);
}

export async function auditReport(subtitle: string, rows: AuditRow[]) {
  const ctx = await start('Audit log extract', subtitle);
  if (rows.length === 0) paragraph(ctx, 'No entries.');
  else
    table(
      ctx,
      ['When', 'Actor', 'Action', 'Entity', 'Change'],
      rows.map((r) => [
        dt(r.created_at),
        r.actor_name ? `${r.actor_name} (${r.actor_role})` : r.actor_role ?? 'System',
        r.action,
        `${r.entity_type}${r.entity_id ? ` #${r.entity_id}` : ''}`,
        [r.previous_value ? `from ${JSON.stringify(r.previous_value)}` : '', r.new_value ? `to ${JSON.stringify(r.new_value)}` : ''].filter(Boolean).join(' ').slice(0, 220),
      ]),
      { styles: { fontSize: 7.5, cellPadding: 1.5, overflow: 'linebreak' } }
    );
  finish(ctx, `audit-log-${stamp()}.pdf`, 'Sanitised audit extract - credentials are never stored in the audit log.');
}
