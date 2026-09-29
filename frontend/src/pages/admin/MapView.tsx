import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer } from 'react-leaflet';
import '../../components/map/leafletIconFix';
import { MarkerClusterLayer } from '../../components/map/MarkerClusterLayer';
import * as adminService from '../../services/admin.service';
import { PriorityBadge, StatusBadge } from '../../components/common/Badge';
import { CATEGORIES, PRIORITY_LEVELS, COMPLAINT_STATUSES, formatStatus, formatCategory } from '../../utils/constants';
import type { MapPoint } from '../../utils/types';

const MUMBAI_CENTER: [number, number] = [19.09, 72.87];

export default function AdminMapView() {
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [selected, setSelected] = useState<MapPoint | null>(null);
  const [filters, setFilters] = useState({ category: '', priority_level: '', status: '' });

  useEffect(() => {
    adminService.getMapData(filters).then(setPoints);
  }, [filters]);

  const updateFilter = (key: string, value: string) => setFilters((f) => ({ ...f, [key]: value }));

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <h1 className="mr-4 text-sm font-semibold text-slate-800">Complaint Map ({points.length})</h1>
        <select className="input w-auto" value={filters.category} onChange={(e) => updateFilter('category', e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {formatCategory(c)}
            </option>
          ))}
        </select>
        <select className="input w-auto" value={filters.priority_level} onChange={(e) => updateFilter('priority_level', e.target.value)}>
          <option value="">All priorities</option>
          {PRIORITY_LEVELS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select className="input w-auto" value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
          <option value="">All statuses</option>
          {COMPLAINT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {formatStatus(s)}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-3 text-xs text-slate-500">
          {PRIORITY_LEVELS.map((p) => (
            <span key={p} className="flex items-center gap-1">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  background: { CRITICAL: '#dc2626', HIGH: '#ea580c', MEDIUM: '#d97706', LOW: '#64748b' }[p],
                }}
              />
              {p}
            </span>
          ))}
        </div>
      </div>

      <div className="relative flex-1">
        <MapContainer center={MUMBAI_CENTER} zoom={12} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MarkerClusterLayer points={points} onSelect={setSelected} />
        </MapContainer>

        {selected && (
          <div className="absolute right-4 top-4 z-[1000] w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <button onClick={() => setSelected(null)} className="absolute right-2 top-2 text-slate-400 hover:text-slate-600">
              ×
            </button>
            <p className="font-mono text-xs text-slate-400">{selected.complaint_number}</p>
            <p className="mt-1 text-sm font-medium text-slate-800">{formatCategory(selected.category)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <PriorityBadge level={selected.priority_level} />
              <StatusBadge status={selected.status} />
            </div>
            <p className="mt-2 text-xs text-slate-500">{selected.department_name || 'Unassigned'}</p>
            {selected.incident_id && (
              <Link to={`/admin/incidents/${selected.incident_id}`} className="mt-1 block text-xs text-brand-600 hover:underline">
                Part of incident #{selected.incident_id}
              </Link>
            )}
            <Link to={`/complaints/${selected.id}`} className="btn-primary mt-3 w-full text-xs">
              View complaint
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
