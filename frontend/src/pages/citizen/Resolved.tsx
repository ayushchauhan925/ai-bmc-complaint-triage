import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getComplaint, listComplaints } from '../../services/complaint.service';
import { ImageGallery } from '../../components/complaint/ImageGallery';
import { ReopenDialog } from '../../components/complaint/ReopenDialog';
import { EmptyState } from '../../components/common/EmptyState';
import { CategoryBadge, PriorityBadge } from '../../components/common/Badge';
import { PageHeader, QueryBoundary, CardSkeleton, fmtDate } from '../../components/ui/kit';
import { PlusCircleIcon } from '../../components/common/Icons';
import { useI18n } from '../../i18n';
import type { Complaint } from '../../utils/types';

const parse = (d: string) => new Date(d.replace(' ', 'T')).getTime();

function timeTaken(c: Complaint): string | null {
  if (!c.resolved_at) return null;
  const ms = parse(c.resolved_at) - parse(c.created_at);
  if (!Number.isFinite(ms) || ms < 0) return null;
  const hours = Math.round(ms / 3_600_000);
  if (hours < 1) return '< 1 h';
  if (hours < 48) return `${hours} h`;
  return `${Math.round(hours / 24)} days`;
}

/** Complaints an admin has marked Resolved, with the before/after photos, so the citizen can verify the fix. */
export default function Resolved() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['my-complaints', 'resolved'], queryFn: () => listComplaints({ limit: 100, status: 'RESOLVED' }) });

  const rows = useMemo(
    () => [...(q.data?.rows ?? [])].sort((a, b) => parse(b.resolved_at ?? b.updated_at) - parse(a.resolved_at ?? a.updated_at)),
    [q.data]
  );

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['my-complaints'] });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <PageHeader
        title={t('resolved.title')}
        description={t('resolved.sub')}
        actions={<Link to="/complaints/new" className="btn-primary"><PlusCircleIcon size={16} /> {t('home.report')}</Link>}
      />
      <div className="mt-5">
        <QueryBoundary query={q} skeleton={<CardSkeleton lines={4} />}>
          {() =>
            rows.length === 0 ? (
              <EmptyState
                title={t('resolved.emptyTitle')}
                description={t('resolved.emptyText')}
                action={<Link to="/my-complaints" className="btn-primary">{t('nav.myComplaints')}</Link>}
              />
            ) : (
              <ul className="space-y-4">
                {rows.map((c) => <ResolvedCard key={c.id} complaint={c} onChanged={refresh} />)}
              </ul>
            )
          }
        </QueryBoundary>
      </div>
    </div>
  );
}

function ResolvedCard({ complaint, onChanged }: { complaint: Complaint; onChanged: () => void }) {
  const { t } = useI18n();
  const detail = useQuery({ queryKey: ['resolved-detail', complaint.id], queryFn: () => getComplaint(complaint.id) });
  const took = timeTaken(complaint);

  return (
    <li className="card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs"><Link to={`/complaints/${complaint.id}`} className="font-mono font-medium text-brand-600 hover:underline">{complaint.complaint_number}</Link></p>
          <p className="mt-1 text-sm font-medium text-slate-900">{complaint.ai_title || complaint.description}</p>
          {complaint.address && <p className="mt-0.5 text-xs text-slate-500">{complaint.address}</p>}
        </div>
        <div className="flex gap-1.5"><PriorityBadge level={complaint.priority_level} /><CategoryBadge category={complaint.category} /></div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-lg bg-emerald-50 px-3 py-2"><dt className="text-emerald-700">{t('resolved.on')}</dt><dd className="font-semibold text-emerald-900">{complaint.resolved_at ? fmtDate(complaint.resolved_at) : '—'}</dd></div>
        <div className="rounded-lg bg-slate-50 px-3 py-2"><dt className="text-slate-500">{t('resolved.reported')}</dt><dd className="font-semibold text-slate-800">{fmtDate(complaint.created_at)}</dd></div>
        {took && <div className="rounded-lg bg-slate-50 px-3 py-2"><dt className="text-slate-500">{t('resolved.took')}</dt><dd className="font-semibold text-slate-800">{took}</dd></div>}
      </dl>

      <div className="mt-4">
        {detail.isLoading && <p className="text-sm text-slate-400">…</p>}
        {detail.data && <ImageGallery images={detail.data.images ?? []} />}
      </div>

      <div className="mt-4 flex flex-wrap items-start gap-2 border-t border-slate-100 pt-4">
        <Link to={`/complaints/${complaint.id}`} className="btn-primary text-sm">{t('resolved.view')}</Link>
        <ReopenDialog complaintId={complaint.id} onReopened={onChanged} />
      </div>
    </li>
  );
}
