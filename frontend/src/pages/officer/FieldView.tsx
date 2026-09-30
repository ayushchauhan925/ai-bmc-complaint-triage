import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import '../../components/map/leafletIconFix';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../i18n';
import * as officerService from '../../services/officer.service';
import { getErrorMessage } from '../../services/api';
import { PriorityBadge, SlaBadge, CategoryBadge, StatusBadge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { CardSkeleton, PageHeader, QueryBoundary, fmtRemaining } from '../../components/ui/kit';
import { LocationIcon, RefreshIcon } from '../../components/common/Icons';
import { PRIORITY_MARKER_COLORS } from '../../utils/constants';
import { directionsUrl, formatDistance, haversineMeters } from '../../utils/geo';
import type { Complaint } from '../../utils/types';

type View = 'list' | 'map';
type Pos = { lat: number; lng: number } | null;
const CLOSED = ['RESOLVED', 'REJECTED'];
const FALLBACK_CENTER: [number, number] = [19.09, 72.87];

function FitBounds({ points, me }: { points: [number, number][]; me: Pos }) {
  const map = useMap();
  useEffect(() => {
    const all = [...points, ...(me ? ([[me.lat, me.lng]] as [number, number][]) : [])];
    if (all.length > 1) map.fitBounds(all, { padding: [30, 30], maxZoom: 16 });
    else if (all.length === 1) map.setView(all[0], 15);
  }, [map, points, me]);
  return null;
}

/**
 * Mobile-first field view: open tasks sorted by distance from the officer, big tap targets,
 * a map of tasks, one-tap accept/start and turn-by-turn navigation. Location is read only in
 * the browser to sort the list; it is never sent to the server.
 */
export default function FieldView() {
  const { user } = useAuth();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [view, setView] = useState<View>('list');
  const [pos, setPos] = useState<Pos>(null);
  const [geoState, setGeoState] = useState<'idle' | 'locating' | 'denied' | 'ok'>('idle');
  const [actionError, setActionError] = useState('');

  const q = useQuery({ queryKey: ['field-tasks'], queryFn: () => officerService.listAssigned({ limit: 100 }), refetchInterval: 60_000 });

  const locate = () => {
    if (!('geolocation' in navigator)) return setGeoState('denied');
    setGeoState('locating');
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setGeoState('ok'); },
      () => setGeoState('denied'),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };
  useEffect(locate, []);

  const act = useMutation({
    mutationFn: async ({ id, kind }: { id: number; kind: 'accept' | 'start' }) => (kind === 'accept' ? officerService.accept(id) : officerService.start(id)),
    onSuccess: () => { setActionError(''); qc.invalidateQueries({ queryKey: ['field-tasks'] }); qc.invalidateQueries({ queryKey: ['officer-queue'] }); },
    onError: (e) => setActionError(getErrorMessage(e)),
  });

  const tasks = useMemo(() => {
    const open = (q.data?.rows ?? []).filter((c) => !CLOSED.includes(c.status));
    const withDistance = open.map((c) => ({ c, d: pos ? haversineMeters(pos.lat, pos.lng, Number(c.latitude), Number(c.longitude)) : Number.NaN }));
    return withDistance.sort((a, b) => {
      if (pos) return a.d - b.d;
      return b.c.priority_score - a.c.priority_score;
    });
  }, [q.data, pos]);

  const nextAction = (c: Complaint): { kind: 'accept' | 'start'; label: string } | null => {
    if (c.status === 'ASSIGNED' && !c.officer_id) return { kind: 'accept', label: 'Accept task' };
    if (c.status === 'ASSIGNED' && c.officer_id === user?.id) return { kind: 'start', label: 'Start work' };
    if (c.status === 'REOPENED' && c.officer_id === user?.id) return { kind: 'start', label: 'Start work' };
    return null;
  };

  return (
    <div className="mx-auto max-w-3xl px-3 py-4 sm:px-6">
      <PageHeader
        title={t('field.title')}
        description={t('field.sub')}
        actions={<button className="btn-secondary !py-1.5 text-xs" onClick={() => { locate(); q.refetch(); }}><RefreshIcon size={14} className={geoState === 'locating' || q.isFetching ? 'animate-spin' : ''} /> Refresh</button>}
      />

      {geoState === 'denied' && <p role="note" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Location is unavailable, so tasks are sorted by priority instead of distance. Allow location access to sort by nearest.</p>}
      {geoState === 'ok' && <p className="mt-2 text-[11px] text-slate-400">Your position is used in this browser only, to sort tasks - it is not sent to the server.</p>}

      <div className="sticky top-14 z-20 -mx-3 mt-3 bg-slate-50/95 px-3 py-2 backdrop-blur sm:mx-0 sm:px-0" role="group" aria-label="View">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1">
          {(['list', 'map'] as View[]).map((v) => (
            <button key={v} aria-pressed={view === v} onClick={() => setView(v)} className={`rounded-lg py-2.5 text-sm font-semibold transition-colors ${view === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>
              {v === 'list' ? `Tasks (${tasks.length})` : 'Map'}
            </button>
          ))}
        </div>
      </div>

      {actionError && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}

      <div className="mt-2">
        <QueryBoundary query={q} skeleton={<div className="space-y-3"><CardSkeleton lines={2} height="h-4" /><CardSkeleton lines={2} height="h-4" /></div>}>
          {() =>
            tasks.length === 0 ? (
              <EmptyState title="No open tasks" description="New complaints for your department will appear here." />
            ) : view === 'map' ? (
              <div className="h-[calc(100vh-15rem)] min-h-[320px] overflow-hidden rounded-xl border border-slate-200">
                <MapContainer center={FALLBACK_CENTER} zoom={12} className="h-full w-full">
                  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <FitBounds points={tasks.map((x) => [Number(x.c.latitude), Number(x.c.longitude)] as [number, number])} me={pos} />
                  {tasks.map(({ c }) => (
                    <CircleMarker key={c.id} center={[Number(c.latitude), Number(c.longitude)]} radius={10} pathOptions={{ color: '#fff', weight: 2, fillColor: PRIORITY_MARKER_COLORS[c.priority_level], fillOpacity: 1 }}>
                      <Tooltip direction="top">{c.complaint_number} · {c.priority_level}</Tooltip>
                    </CircleMarker>
                  ))}
                  {pos && <CircleMarker center={[pos.lat, pos.lng]} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}><Tooltip direction="top">You are here</Tooltip></CircleMarker>}
                </MapContainer>
              </div>
            ) : (
              <ul className="space-y-3">
                {tasks.map(({ c, d }) => {
                  const remaining = c.sla_deadline ? new Date(c.sla_deadline).getTime() - Date.now() : null;
                  const action = nextAction(c);
                  return (
                    <li key={c.id} className="card overflow-hidden">
                      <Link to={`/complaints/${c.id}`} className="block p-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-mono text-xs text-slate-400">{c.complaint_number}</p>
                            <p className="mt-0.5 line-clamp-2 text-base font-semibold text-slate-900">{c.ai_title || c.description}</p>
                          </div>
                          <PriorityBadge level={c.priority_level} />
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2"><CategoryBadge category={c.category} /><StatusBadge status={c.status} /><SlaBadge status={c.sla_status} /></div>
                        <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-600">
                          <LocationIcon size={15} className="shrink-0 text-slate-400" />
                          <span className="truncate">{c.address || `${Number(c.latitude).toFixed(4)}, ${Number(c.longitude).toFixed(4)}`}</span>
                          {Number.isFinite(d) && <span className="ml-auto shrink-0 font-semibold text-brand-700">{formatDistance(d)}</span>}
                        </p>
                        {remaining !== null && <p className={`mt-1 text-xs font-medium ${remaining < 0 ? 'text-red-700' : 'text-slate-500'}`}>{fmtRemaining(remaining)}</p>}
                      </Link>
                      <div className="grid grid-cols-2 gap-px border-t border-slate-100 bg-slate-100">
                        <a href={directionsUrl(Number(c.latitude), Number(c.longitude))} target="_blank" rel="noopener noreferrer" className="bg-white py-3.5 text-center text-sm font-semibold text-slate-700 active:bg-slate-50">Navigate</a>
                        {action ? (
                          <button disabled={act.isPending} onClick={() => act.mutate({ id: c.id, kind: action.kind })} className="bg-brand-600 py-3.5 text-sm font-semibold text-white active:bg-brand-700 disabled:opacity-60">{action.label}</button>
                        ) : (
                          <Link to={`/complaints/${c.id}`} className="bg-white py-3.5 text-center text-sm font-semibold text-brand-700 active:bg-slate-50">{c.status === 'IN_PROGRESS' ? 'Resolve…' : 'Open'}</Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          }
        </QueryBoundary>
      </div>
    </div>
  );
}
