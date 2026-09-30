import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Circle, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.heat';
import { useQuery } from '@tanstack/react-query';
import '../../components/map/leafletIconFix';
import { MarkerClusterLayer } from '../../components/map/MarkerClusterLayer';
import * as adminService from '../../services/admin.service';
import * as incidentService from '../../services/incident.service';
import * as platform from '../../services/platform.service';
import { PriorityBadge, StatusBadge, SlaBadge } from '../../components/common/Badge';
import { CATEGORIES, PRIORITY_LEVELS, COMPLAINT_STATUSES, formatStatus, formatCategory, PRIORITY_MARKER_COLORS } from '../../utils/constants';
import { FlameIcon, LayersIcon, ActivityIcon } from '../../components/common/Icons';
import type { MapPoint } from '../../utils/types';

const MUMBAI_CENTER: [number, number] = [19.09, 72.87];

// Heat layer: a thin wrapper, re-created when the weighted points change.
function HeatLayer({ points }: { points: [number, number, number][] }) {
  const map = useMap();
  useEffect(() => {
    const layer = L.heatLayer(points, { radius: 26, blur: 22, maxZoom: 16, gradient: { 0.3: '#3b82f6', 0.55: '#f59e0b', 0.8: '#ea580c', 1: '#dc2626' } });
    layer.addTo(map);
    return () => { map.removeLayer(layer); };
  }, [map, points]);
  return null;
}

function FlyTo({ target }: { target: { lat: number; lng: number; zoom?: number } | null }) {
  const map = useMap();
  useEffect(() => { if (target) map.flyTo([target.lat, target.lng], target.zoom ?? 16, { duration: 0.8 }); }, [map, target]);
  return null;
}

type Layers = { markers: boolean; heat: boolean; hotspots: boolean; incidents: boolean };
type Selection = { kind: 'point'; point: MapPoint } | { kind: 'hotspot'; hotspot: platform.HotspotV2 } | null;

export default function GisCommandCenter() {
  const [params] = useSearchParams();
  const focus = params.get('focus')?.split(',').map(Number);
  const [filters, setFilters] = useState({ category: params.get('category') || '', priority: '', status: '', department_id: '', days: '30' });
  const [layers, setLayers] = useState<Layers>({ markers: true, heat: false, hotspots: true, incidents: true });
  const [selected, setSelected] = useState<Selection>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number } | null>(focus && focus.length === 2 ? { lat: focus[0], lng: focus[1] } : null);

  const geo = useMemo(() => {
    const g: platform.GeoFilters = { days: filters.days };
    if (filters.category) g.category = filters.category;
    if (filters.priority) g.priority = filters.priority;
    if (filters.department_id) g.department_id = filters.department_id;
    if (filters.status === 'open' || filters.status === 'closed') g.status = filters.status;
    return g;
  }, [filters]);

  const points = useQuery({
    queryKey: ['map-points', filters],
    queryFn: () => adminService.getMapData({ category: filters.category || undefined, priority_level: filters.priority || undefined, status: filters.status && filters.status !== 'open' && filters.status !== 'closed' ? filters.status : undefined, department_id: filters.department_id || undefined, days: filters.days }),
  });
  const heat = useQuery({ queryKey: ['heatmap', geo], queryFn: () => platform.heatmap(geo), enabled: layers.heat });
  const hotspots = useQuery({ queryKey: ['hotspots', geo], queryFn: () => platform.hotspots(geo) });
  const incidents = useQuery({ queryKey: ['map-incidents'], queryFn: () => incidentService.listIncidents({ limit: 100 }), enabled: layers.incidents });
  const departments = useQuery({ queryKey: ['departments'], queryFn: adminService.listDepartments });
  const anomalies = useQuery({ queryKey: ['anomalies'], queryFn: () => platform.anomalies(), refetchInterval: 120_000 });

  const visiblePoints = useMemo(() => {
    const rows = points.data ?? [];
    // "open"/"closed" are handled client-side for the marker layer (the API filters by exact status).
    if (filters.status === 'open') return rows.filter((p) => !['RESOLVED', 'REJECTED'].includes(p.status));
    if (filters.status === 'closed') return rows.filter((p) => ['RESOLVED', 'REJECTED'].includes(p.status));
    return rows;
  }, [points.data, filters.status]);

  const setF = (k: string, v: string) => setFilters((f) => ({ ...f, [k]: v }));
  const toggle = (k: keyof Layers) => setLayers((l) => ({ ...l, [k]: !l[k] }));
  const onSelectPoint = useCallback((p: MapPoint) => setSelected({ kind: 'point', point: p }), []);
  const geoAnomalies = (anomalies.data?.anomalies ?? []).filter((a) => a.location);

  const layerBtn = (k: keyof Layers, label: string, icon: React.ReactNode) => (
    <button key={k} onClick={() => toggle(k)} aria-pressed={layers[k]} className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${layers[k] ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}>
      {icon}{label}{layers[k] ? ' ✓' : ''}
    </button>
  );

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <div className="space-y-2 border-b border-slate-200 bg-white px-3 py-3 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="mr-2 text-sm font-semibold text-slate-800">GIS command center</h1>
          <select aria-label="Category" className="input w-auto" value={filters.category} onChange={(e) => setF('category', e.target.value)}>
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{formatCategory(c)}</option>)}
          </select>
          <select aria-label="Severity" className="input w-auto" value={filters.priority} onChange={(e) => setF('priority', e.target.value)}>
            <option value="">All severities</option>
            {PRIORITY_LEVELS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select aria-label="Status" className="input w-auto" value={filters.status} onChange={(e) => setF('status', e.target.value)}>
            <option value="">All statuses</option>
            <option value="open">Unresolved (open)</option>
            <option value="closed">Closed</option>
            {COMPLAINT_STATUSES.map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}
          </select>
          <select aria-label="Department" className="input w-auto" value={filters.department_id} onChange={(e) => setF('department_id', e.target.value)}>
            <option value="">All departments</option>
            {(departments.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select aria-label="Date range" className="input w-auto" value={filters.days} onChange={(e) => setF('days', e.target.value)}>
            <option value="7">Last 7 days</option><option value="14">Last 14 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last year</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {layerBtn('markers', 'Complaints', <span className="h-2 w-2 rounded-full bg-slate-500" />)}
          {layerBtn('heat', 'Heatmap', <FlameIcon size={13} />)}
          {layerBtn('hotspots', 'Hotspots', <ActivityIcon size={13} />)}
          {layerBtn('incidents', 'Incidents', <LayersIcon size={13} />)}
          <span className="ml-auto text-xs text-slate-500" aria-live="polite">
            {points.isLoading ? 'Loading…' : `${visiblePoints.length} complaints · ${hotspots.data?.hotspots.length ?? 0} hotspots`}
            {points.isError && <span className="ml-2 text-red-600">Could not load map data.</span>}
          </span>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="relative min-h-[55%] flex-1">
          <MapContainer center={MUMBAI_CENTER} zoom={12} className="h-full w-full">
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FlyTo target={flyTo} />
            {layers.heat && heat.data && <HeatLayer points={heat.data.points} />}
            {layers.markers && <MarkerClusterLayer points={visiblePoints} onSelect={onSelectPoint} />}
            {layers.hotspots && hotspots.data?.hotspots.map((h) => (
              <Circle key={h.id} center={[h.centroid.latitude, h.centroid.longitude]} radius={Math.max(h.radiusMeters, 120)}
                pathOptions={{ color: PRIORITY_MARKER_COLORS[h.dominantPriority as keyof typeof PRIORITY_MARKER_COLORS] || '#ea580c', weight: 2, fillOpacity: 0.12, dashArray: '6 4' }}
                eventHandlers={{ click: () => setSelected({ kind: 'hotspot', hotspot: h }) }}>
                <Tooltip>{h.label}: {h.complaintCount} complaints</Tooltip>
              </Circle>
            ))}
            {layers.incidents && incidents.data?.rows.filter((i) => i.status !== 'CLOSED').map((i) => (
              <Circle key={`inc-${i.id}`} center={[Number(i.latitude), Number(i.longitude)]} radius={60 + i.complaint_count * 12}
                pathOptions={{ color: '#7c3aed', weight: 2, fillOpacity: 0.08 }}>
                <Tooltip>{i.incident_number}: {i.complaint_count} complaints</Tooltip>
              </Circle>
            ))}
            {geoAnomalies.map((a, idx) => (
              <Circle key={`an-${idx}`} center={[a.location!.latitude, a.location!.longitude]} radius={a.location!.approxRadiusMeters}
                pathOptions={{ color: '#dc2626', weight: 1, fillOpacity: 0.05, dashArray: '2 6' }}>
                <Tooltip>Anomaly: {a.label} ({a.observed} in 24 h)</Tooltip>
              </Circle>
            ))}
          </MapContainer>

          <div className="absolute bottom-3 left-3 z-[900] rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[11px] text-slate-600 shadow-sm">
            <p className="mb-1 font-semibold text-slate-700">Legend</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {PRIORITY_LEVELS.map((p) => <span key={p} className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: PRIORITY_MARKER_COLORS[p] }} />{p}</span>)}
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-orange-500" />Hotspot</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border-2 border-violet-600" />Incident</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border border-dotted border-red-600" />Anomaly area</span>
            </div>
          </div>
        </div>

        <aside className="w-full shrink-0 overflow-y-auto border-t border-slate-200 bg-white md:w-80 md:border-l md:border-t-0" aria-label="Map details">
          {selected?.kind === 'point' && (
            <div className="p-4">
              <button onClick={() => setSelected(null)} className="float-right text-slate-400 hover:text-slate-600" aria-label="Close details">×</button>
              <p className="font-mono text-xs text-slate-400">{selected.point.complaint_number}</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{formatCategory(selected.point.category)}</p>
              <div className="mt-2 flex flex-wrap gap-2"><PriorityBadge level={selected.point.priority_level} /><StatusBadge status={selected.point.status} />{(selected.point as any).sla_status && <SlaBadge status={(selected.point as any).sla_status} />}</div>
              <p className="mt-2 text-xs text-slate-500">{selected.point.department_name || 'Unassigned'}</p>
              {selected.point.incident_id && <Link to={`/admin/incidents/${selected.point.incident_id}`} className="mt-1 block text-xs text-brand-600 hover:underline">Part of incident #{selected.point.incident_id} →</Link>}
              <Link to={`/complaints/${selected.point.id}`} className="btn-primary mt-3 w-full text-xs">View complaint</Link>
            </div>
          )}
          {selected?.kind === 'hotspot' && (
            <div className="p-4">
              <button onClick={() => setSelected(null)} className="float-right text-slate-400 hover:text-slate-600" aria-label="Close details">×</button>
              <p className="text-xs font-semibold uppercase tracking-wide text-orange-700">Hotspot</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{selected.hotspot.label}</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <dt className="text-slate-500">Complaints</dt><dd className="text-right font-medium">{selected.hotspot.complaintCount}</dd>
                <dt className="text-slate-500">Unresolved</dt><dd className="text-right font-medium">{selected.hotspot.unresolvedCount} ({Math.round(selected.hotspot.unresolvedShare * 100)}%)</dd>
                <dt className="text-slate-500">Last 48 h</dt><dd className="text-right font-medium">{selected.hotspot.recentCount}</dd>
                <dt className="text-slate-500">Incidents</dt><dd className="text-right font-medium">{selected.hotspot.incidentCount}</dd>
                <dt className="text-slate-500">Density</dt><dd className="text-right font-medium">{selected.hotspot.densityPerKm2}/km²</dd>
                <dt className="text-slate-500">Severity</dt><dd className="text-right"><PriorityBadge level={selected.hotspot.dominantPriority} /></dd>
              </dl>
              <p className="mt-3 text-[11px] text-slate-400">Score {selected.hotspot.score} = severity-weighted count {selected.hotspot.scoreComponents.severityWeightedCount} × recency × unresolved share. Active {new Date(selected.hotspot.timeRange.from).toLocaleDateString()}–{new Date(selected.hotspot.timeRange.to).toLocaleDateString()}.</p>
            </div>
          )}
          {!selected && (
            <div className="p-4">
              <h2 className="text-sm font-semibold text-slate-800">Hotspots</h2>
              <p className="mt-0.5 text-xs text-slate-500">Ranked by severity-weighted, recent, unresolved concentration. Select one to inspect.</p>
              {hotspots.isLoading ? <p className="mt-3 text-sm text-slate-400">Detecting…</p>
                : hotspots.isError ? <p role="alert" className="mt-3 text-sm text-red-600">Could not load hotspots.</p>
                : (hotspots.data?.hotspots.length ?? 0) === 0 ? <p className="mt-3 text-sm text-slate-400">No hotspots for these filters.</p>
                : (
                  <ul className="mt-3 space-y-2">
                    {hotspots.data!.hotspots.slice(0, 15).map((h) => (
                      <li key={h.id}>
                        <button onClick={() => { setSelected({ kind: 'hotspot', hotspot: h }); setFlyTo({ lat: h.centroid.latitude, lng: h.centroid.longitude, zoom: 15 }); }} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
                          <span className="flex items-center justify-between gap-2"><span className="text-sm font-medium text-slate-800">{h.label}</span><PriorityBadge level={h.dominantPriority} /></span>
                          <span className="mt-0.5 block text-xs text-slate-500">{h.complaintCount} complaints · {h.unresolvedCount} unresolved · score {h.score}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              {geoAnomalies.length > 0 && (
                <div className="mt-5">
                  <h2 className="text-sm font-semibold text-slate-800">Anomaly areas</h2>
                  <ul className="mt-2 space-y-2">
                    {geoAnomalies.map((a, i) => (
                      <li key={i}><button onClick={() => setFlyTo({ lat: a.location!.latitude, lng: a.location!.longitude, zoom: 14 })} className="w-full rounded-lg border border-red-100 bg-red-50/60 px-3 py-2 text-left text-xs text-red-900 hover:bg-red-50"><strong>{a.label}</strong><br />{a.explanation}</button></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
