import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as platform from '../../services/platform.service';
import * as adminService from '../../services/admin.service';
import { getErrorMessage } from '../../services/api';
import { PriorityBadge, SlaBadge, CategoryBadge, StatusBadge } from '../common/Badge';
import { QueryBoundary, CardSkeleton, Meter, InsufficientData, fmtDate, fmtRemaining, pct } from '../ui/kit';
import { CATEGORIES, PRIORITY_LEVELS, formatCategory } from '../../utils/constants';
import { AlertIcon, CheckCircleIcon, ClockIcon, BoltIcon, LayersIcon, UserIcon, ShieldIcon, LocationIcon, ActivityIcon } from '../common/Icons';
import type { Complaint } from '../../utils/types';

const keys = {
  trace: (id: number | string) => ['decision-trace', String(id)],
  timeline: (id: number | string) => ['timeline', String(id)],
  dups: (id: number | string) => ['duplicates', String(id)],
  sla: (id: number | string) => ['complaint-sla', String(id)],
};

/* ------------------------------------------------------------------ SLA */
export function SlaPanel({ complaintId }: { complaintId: number }) {
  const q = useQuery({ queryKey: keys.sla(complaintId), queryFn: () => platform.complaintSla(complaintId), refetchInterval: 60_000 });
  return (
    <QueryBoundary query={q} skeleton={<CardSkeleton lines={2} height="h-2" />}>
      {(sla) => (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><ClockIcon size={16} /> Service level</h3>
            <SlaBadge status={sla.status} />
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-slate-500">Target</dt>
            <dd className="text-right font-medium text-slate-800">{sla.targetHours ? `${sla.targetHours} h` : '—'}</dd>
            <dt className="text-slate-500">Deadline</dt>
            <dd className="text-right text-slate-800">{fmtDate(sla.deadline)}</dd>
            <dt className="text-slate-500">{sla.resolutionMs !== null ? 'Resolved in' : 'Time left'}</dt>
            <dd className={`text-right font-medium ${sla.breached ? 'text-red-700' : sla.warning ? 'text-amber-700' : 'text-slate-800'}`}>
              {sla.resolutionMs !== null ? fmtRemaining(sla.resolutionMs).replace(' left', '') : fmtRemaining(sla.remainingMs)}
            </dd>
          </dl>
        </div>
      )}
    </QueryBoundary>
  );
}

/* ------------------------------------------------------------ Timeline */
const TIMELINE_ICON: Record<string, React.ReactNode> = {
  SUBMITTED: <UserIcon size={13} />,
  CREATED: <UserIcon size={13} />,
  AI_ANALYZED: <BoltIcon size={13} />,
  AI_FAILED: <AlertIcon size={13} />,
  EVIDENCE_SCORED: <ShieldIcon size={13} />,
  PRIORITY_SET: <ActivityIcon size={13} />,
  DEPARTMENT_ASSIGNED: <LayersIcon size={13} />,
  ASSIGNED: <LayersIcon size={13} />,
  DUPLICATE_DETECTED: <LayersIcon size={13} />,
  INCIDENT_LINKED: <LocationIcon size={13} />,
  HUMAN_REVIEW: <UserIcon size={13} />,
  SLA_WARNING: <ClockIcon size={13} />,
  SLA_BREACHED: <AlertIcon size={13} />,
  ESCALATED: <AlertIcon size={13} />,
  RESOLVED: <CheckCircleIcon size={13} />,
};
const TIMELINE_TONE = (t: string) =>
  ['SLA_BREACHED', 'ESCALATED', 'AI_FAILED'].includes(t) ? 'bg-red-100 text-red-700 border-red-200'
  : ['SLA_WARNING'].includes(t) ? 'bg-amber-100 text-amber-700 border-amber-200'
  : ['RESOLVED'].includes(t) ? 'bg-green-100 text-green-700 border-green-200'
  : 'bg-slate-100 text-slate-600 border-slate-200';

export function ComplaintTimeline({ complaintId, staff }: { complaintId: number; staff: boolean }) {
  const q = useQuery({ queryKey: keys.timeline(complaintId), queryFn: () => platform.timeline(complaintId) });
  return (
    <QueryBoundary query={q} skeleton={<CardSkeleton lines={5} height="h-2" />}>
      {(items) => (
        <div className="card p-4">
          <h3 className="mb-4 text-sm font-semibold text-slate-800">Timeline</h3>
          {items.length === 0 ? (
            <p className="text-sm text-slate-400">No activity yet.</p>
          ) : (
            <ol className="relative space-y-4 border-l border-slate-200 pl-6">
              {items.map((e, i) => (
                <li key={`${e.kind}-${e.type}-${e.at}-${i}`} className="relative">
                  <span className={`absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full border ${TIMELINE_TONE(e.type)}`}>
                    {TIMELINE_ICON[e.type] ?? <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                  </span>
                  <p className="text-sm font-medium text-slate-800">
                    {e.title}
                    {staff && e.visibility === 'STAFF' && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">Internal</span>}
                  </p>
                  {staff && typeof e.detail === 'string' && e.detail && <p className="mt-0.5 text-sm text-slate-500">{e.detail}</p>}
                  <p className="mt-0.5 text-xs text-slate-400">
                    {fmtDate(e.at)}
                    {e.actor ? ` · ${e.actor}` : e.kind === 'STATUS' ? '' : ' · Automated'}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </QueryBoundary>
  );
}

/* ---------------------------------------------------------- AI insights */
const BAND_LABEL: Record<string, { label: string; cls: string; tone: 'good' | 'warn' | 'bad' }> = {
  STRONG: { label: 'Strong', cls: 'bg-green-100 text-green-800 border-green-200', tone: 'good' },
  MODERATE: { label: 'Moderate', cls: 'bg-blue-100 text-blue-800 border-blue-200', tone: 'good' },
  WEAK: { label: 'Limited', cls: 'bg-amber-100 text-amber-800 border-amber-200', tone: 'warn' },
  INSUFFICIENT: { label: 'Very limited', cls: 'bg-red-100 text-red-800 border-red-200', tone: 'bad' },
};
const SOURCE_LABEL: Record<string, string> = { RULE: 'Rule', AI: 'AI signal', HISTORY: 'History', EVIDENCE: 'Evidence', SIMILARITY: 'Similar reports' };

export function InsightsPanel({ complaintId }: { complaintId: number }) {
  const traceQ = useQuery({ queryKey: keys.trace(complaintId), queryFn: () => platform.decisionTrace(complaintId) });
  const evQ = useQuery({ queryKey: ['evidence', String(complaintId)], queryFn: () => platform.evidence(complaintId) });

  return (
    <QueryBoundary query={traceQ} skeleton={<CardSkeleton lines={6} />}>
      {(trace) => {
        if (!trace.available) return <div className="card p-4"><h3 className="text-sm font-semibold text-slate-800">AI assessment</h3><div className="mt-3"><InsufficientData reason={trace.reason} /></div></div>;
        const band = BAND_LABEL[trace.evidence.band] ?? BAND_LABEL.WEAK;
        const contributing = trace.factors.filter((f) => f.points !== 0 || f.source === 'SIMILARITY');
        return (
          <div className="space-y-4">
            <div className="card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><BoltIcon size={16} /> AI assessment</h3>
                <span className="text-[11px] text-slate-400">Decision engine v{trace.engineVersion} · advisory, staff-verifiable</span>
              </div>

              {trace.ai ? (
                <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div><dt className="text-xs text-slate-500">Category</dt><dd className="mt-0.5"><CategoryBadge category={trace.ai.category} /></dd></div>
                  <div><dt className="text-xs text-slate-500">Priority</dt><dd className="mt-0.5"><PriorityBadge level={trace.priority.current.level} /></dd></div>
                  <div><dt className="text-xs text-slate-500">AI confidence</dt><dd className="mt-0.5 text-sm font-semibold text-slate-800">{pct(trace.ai.confidence)}</dd></div>
                  <div><dt className="text-xs text-slate-500">Evidence</dt><dd className="mt-0.5"><span className={`badge border ${band.cls}`}>{band.label} · {trace.evidence.score}</span></dd></div>
                </dl>
              ) : (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">AI analysis was unavailable; a rule-based fallback classification is in place until staff review.</p>
              )}

              {trace.ai?.recommendedAction && <p className="mt-3 text-sm text-slate-600"><span className="font-medium text-slate-700">Suggested action: </span>{trace.ai.recommendedAction}</p>}

              {trace.humanReviewRequired && (
                <div className="mt-3 rounded-lg border border-pink-200 bg-pink-50 px-3 py-2 text-sm text-pink-800" role="note">
                  <p className="flex items-center gap-1.5 font-medium"><AlertIcon size={14} /> Human review requested</p>
                  <ul className="mt-1 list-inside list-disc text-xs">{trace.reviewReasons.map((r) => <li key={r}>{r}</li>)}</ul>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-slate-800">Decision factors</h3>
                <p className="mt-0.5 text-xs text-slate-500">Score {trace.priority.baseScore} from rules, adjusted to {trace.priority.finalScore}.</p>
                <ul className="mt-3 space-y-1.5">
                  {contributing.map((f, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 text-sm">
                      <span className="text-slate-700">
                        {f.label}
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-500">{SOURCE_LABEL[f.source] ?? f.source}</span>
                      </span>
                      <span className={`shrink-0 font-mono text-xs ${f.points < 0 ? 'text-red-700' : 'text-slate-600'}`}>{f.points > 0 ? `+${f.points}` : f.points}</span>
                    </li>
                  ))}
                </ul>
                {trace.ai && trace.ai.explanationFactors.length > 0 && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <p className="text-xs font-medium text-slate-500">What the AI noticed</p>
                    <ul className="mt-1 list-inside list-disc text-xs text-slate-600">{trace.ai.explanationFactors.map((x, i) => <li key={i}>{x}</li>)}</ul>
                  </div>
                )}
              </div>

              <div className="card p-4">
                <h3 className="text-sm font-semibold text-slate-800">Evidence</h3>
                <div className="mt-2"><Meter value={trace.evidence.score} tone={band.tone} label={`Evidence strength: ${band.label}`} /></div>
                {trace.evidence.indicators.length > 0 && (
                  <ul className="mt-3 space-y-1 text-sm text-slate-700">
                    {trace.evidence.indicators.map((x) => <li key={x} className="flex items-center gap-1.5"><CheckCircleIcon size={13} className="text-green-600" /> {x}</li>)}
                  </ul>
                )}
                <QueryBoundary query={evQ} skeleton={null}>
                  {(ev) => ev.available && ev.signals ? (
                    <details className="mt-3 text-xs">
                      <summary className="cursor-pointer text-slate-500 hover:text-slate-700">Signal breakdown</summary>
                      <table className="data-table data-table-compact mt-2">
                        <tbody>
                          {ev.signals.filter((s) => s.applicable).map((s) => (
                            <tr key={s.key} className="border-t border-slate-100">
                              <td className="py-1 text-slate-600">{s.label}<span className="block text-[11px] text-slate-400">{s.detail}</span></td>
                              <td className="py-1 text-right font-mono text-slate-700">{s.points}/{s.max}<span className="sr-only"> {s.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </details>
                  ) : null}
                </QueryBoundary>
              </div>
            </div>

            {trace.reviews.length > 0 && (
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-slate-800">Review history</h3>
                <ul className="mt-2 divide-y divide-slate-100 text-sm">
                  {trace.reviews.map((r) => (
                    <li key={r.id} className="py-2">
                      <span className="font-medium text-slate-800">{r.action.replace(/_/g, ' ').toLowerCase()}</span> by {r.reviewer_name} · <span className="text-xs text-slate-400">{fmtDate(r.created_at)}</span>
                      {r.action === 'CORRECT' && (
                        <p className="text-xs text-slate-500">
                          {r.ai_category !== r.human_category && <>Category {formatCategory(r.ai_category || '')} → {formatCategory(r.human_category || '')}. </>}
                          {r.ai_priority_level !== r.human_priority_level && <>Priority {r.ai_priority_level} → {r.human_priority_level}.</>}
                        </p>
                      )}
                      {r.notes && <p className="text-xs text-slate-500">“{r.notes}”</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      }}
    </QueryBoundary>
  );
}

/* ------------------------------------------------ Related / duplicates */
export function RelatedComplaints({ complaintId, canAct, onChanged }: { complaintId: number; canAct: boolean; onChanged: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: keys.dups(complaintId), queryFn: () => platform.duplicates(complaintId) });
  const [error, setError] = useState('');
  const mutate = useMutation({
    mutationFn: (v: { related: number; action: 'CONFIRM_DUPLICATE' | 'REJECT_DUPLICATE' }) =>
      platform.review(complaintId, { action: v.action, related_complaint_id: v.related }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: keys.dups(complaintId) }); qc.invalidateQueries({ queryKey: keys.timeline(complaintId) }); onChanged(); },
    onError: (e) => setError(getErrorMessage(e)),
  });

  return (
    <QueryBoundary query={q} skeleton={<CardSkeleton lines={3} height="h-2" />}>
      {({ duplicates, incidentId }) => (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><LayersIcon size={16} /> Possible related complaints</h3>
            {incidentId && <Link to={`/admin/incidents/${incidentId}`} className="text-xs font-medium text-brand-600 hover:underline">View incident →</Link>}
          </div>
          {duplicates.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">No similar complaints found nearby.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {duplicates.map((d) => (
                <li key={d.relatedComplaintId} className="flex flex-wrap items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm">
                      <Link to={`/complaints/${d.relatedComplaintId}`} className="font-mono text-xs font-medium text-brand-600 hover:underline">{d.complaintNumber}</Link>
                      <span className="ml-2 text-slate-700">{formatCategory(d.category)}</span>
                      <span className="ml-2"><StatusBadge status={d.status} /></span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      <strong className="text-slate-700">{Math.round(d.duplicateProbability * 100)}% match</strong> · {d.distanceMeters} m away · {d.indicators.join(' · ')}
                    </p>
                    {d.excerpt && <p className="mt-1 line-clamp-2 text-xs text-slate-400">{d.excerpt}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {d.reviewStatus !== 'SUGGESTED' && (
                      <span className={`badge border ${d.reviewStatus === 'CONFIRMED' ? 'border-green-200 bg-green-100 text-green-800' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
                        {d.reviewStatus === 'CONFIRMED' ? '✓ Linked' : '✕ Not related'}
                      </span>
                    )}
                    {canAct && (
                      <>
                        <button disabled={mutate.isPending || d.reviewStatus === 'CONFIRMED'} onClick={() => mutate.mutate({ related: d.relatedComplaintId, action: 'CONFIRM_DUPLICATE' })} className="btn-secondary !px-2.5 !py-1 text-xs">Link</button>
                        <button disabled={mutate.isPending || d.reviewStatus === 'REJECTED'} onClick={() => mutate.mutate({ related: d.relatedComplaintId, action: 'REJECT_DUPLICATE' })} className="btn-secondary !px-2.5 !py-1 text-xs">Not related</button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-slate-400">Suggestions never merge or delete reports — every citizen report is preserved.</p>
          {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </QueryBoundary>
  );
}

/* --------------------------------------------------------- Staff review */
export function ReviewPanel({ complaint, isAdmin, onUpdated }: { complaint: Complaint; isAdmin: boolean; onUpdated: () => void }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<'idle' | 'correct'>('idle');
  const [category, setCategory] = useState(complaint.category as string);
  const [priority, setPriority] = useState(complaint.priority_level as string);
  const [departmentId, setDepartmentId] = useState<number | ''>(complaint.department_id || '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const depts = useQuery({ queryKey: ['departments'], queryFn: adminService.listDepartments, enabled: isAdmin && mode === 'correct' });

  const done = () => {
    qc.invalidateQueries({ queryKey: keys.trace(complaint.id) });
    qc.invalidateQueries({ queryKey: keys.timeline(complaint.id) });
    qc.invalidateQueries({ queryKey: keys.sla(complaint.id) });
    setMode('idle'); setNotes(''); setError('');
    onUpdated();
  };
  const run = useMutation({
    mutationFn: (body: Record<string, unknown>) => platform.review(complaint.id, { ...body, notes: notes || undefined }),
    onSuccess: done,
    onError: (e) => setError(getErrorMessage(e)),
  });

  const closed = ['RESOLVED', 'REJECTED'].includes(complaint.status);
  const correctBody: Record<string, unknown> = { action: 'CORRECT' };
  if (category !== complaint.category) correctBody.category = category;
  if (priority !== complaint.priority_level) correctBody.priority_level = priority;
  if (isAdmin && departmentId && departmentId !== complaint.department_id) correctBody.department_id = departmentId;
  const changed = Object.keys(correctBody).length > 1;

  return (
    <div className="card p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800"><ShieldIcon size={16} /> Staff review</h3>
      <p className="mt-0.5 text-xs text-slate-500">
        {complaint.review_status === 'PENDING' ? 'Confirm or correct the AI/system decision. Your review is recorded for AI quality tracking.' : `Current review status: ${String(complaint.review_status).toLowerCase().replace('_', ' ')}.`}
      </p>

      {closed ? (
        <p className="mt-3 text-sm text-slate-400">This complaint is closed.</p>
      ) : mode === 'idle' ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-primary !py-1.5 text-xs" disabled={run.isPending} onClick={() => run.mutate({ action: 'APPROVE' })}><CheckCircleIcon size={14} /> Approve as is</button>
          <button className="btn-secondary !py-1.5 text-xs" onClick={() => setMode('correct')}>Correct…</button>
          <button className="btn-secondary !py-1.5 text-xs text-red-700" disabled={run.isPending} onClick={() => { if (window.confirm('Mark this complaint as a false positive and close it? The report is kept.')) run.mutate({ action: 'FALSE_POSITIVE' }); }}>False positive</button>
        </div>
      ) : (
        <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); if (changed) run.mutate(correctBody); }}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="rv-cat">Category</label>
              <select id="rv-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{formatCategory(c)}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="rv-pri">Priority</label>
              <select id="rv-pri" className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITY_LEVELS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            {isAdmin && (
              <div>
                <label className="label" htmlFor="rv-dep">Department</label>
                <select id="rv-dep" className="input" value={departmentId} onChange={(e) => setDepartmentId(Number(e.target.value) || '')}>
                  <option value="">Auto (by category)</option>
                  {(depts.data || []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="label" htmlFor="rv-notes">Note (optional)</label>
            <input id="rv-notes" className="input" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Why was the decision changed?" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary !py-1.5 text-xs" disabled={!changed || run.isPending}>Save correction</button>
            <button type="button" className="btn-secondary !py-1.5 text-xs" onClick={() => setMode('idle')}>Cancel</button>
          </div>
          {!changed && <p className="text-xs text-slate-400">Change at least one value to save a correction.</p>}
        </form>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
