import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import '../../components/map/leafletIconFix';
import * as incidentService from '../../services/incident.service';
import type { IncidentEvent } from '../../services/incident.service';
import { PriorityBadge } from '../../components/common/Badge';
import { PageLoader } from '../../components/common/Spinner';
import { ErrorState } from '../../components/common/EmptyState';
import { PdfButton } from '../../components/ui/PdfButton';
import { incidentReport } from '../../utils/pdf';
import { IncidentIntel } from '../../components/complaint/IncidentIntel';
import type { IncidentIntelligence } from '../../services/platform.service';
import { ComplaintCard } from '../../components/complaint/ComplaintCard';
import { getErrorMessage } from '../../services/api';
import { formatCategory } from '../../utils/constants';
import type { Complaint, Incident } from '../../utils/types';

const STATUS_OPTIONS = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export default function AdminIncidentDetails() {
  const { id } = useParams();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [timeline, setTimeline] = useState<IncidentEvent[]>([]);
  const [intel, setIntel] = useState<IncidentIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mergeSourceId, setMergeSourceId] = useState('');

  const load = async () => {
    if (!id) return;
    try {
      const data = await incidentService.getIncident(id);
      setIncident(data.incident);
      setComplaints(data.complaints);
      setTimeline(data.timeline);
      setIntel(data.intelligence ?? null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const changeStatus = async (status: string) => {
    if (!id) return;
    setBusy(true);
    try {
      const updated = await incidentService.updateIncidentStatus(id, status);
      setIncident(updated);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const mergeIncident = async () => {
    if (!id || !mergeSourceId) return;
    setBusy(true);
    setError('');
    try {
      await incidentService.mergeIncident(id, Number(mergeSourceId));
      setMergeSourceId('');
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const removeComplaint = async (complaintId: number) => {
    if (!id) return;
    setBusy(true);
    try {
      await incidentService.removeComplaintFromIncident(id, complaintId);
      await load();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageLoader />;
  if (error || !incident) return <div className="p-6"><ErrorState message={error || 'Not found'} /></div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-slate-400">{incident.incident_number}</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">{incident.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <PdfButton label="Export PDF" build={() => incidentReport({ incident, complaints, intelligence: intel })} />
          <PriorityBadge level={incident.priority_level} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="badge border-brand-100 bg-brand-50 text-brand-700">{formatCategory(incident.category)}</span>
        <span className="badge border-slate-200 bg-slate-100 text-slate-600">{incident.department_name || 'Unassigned'}</span>
        <span className="text-xs text-slate-400">{complaints.length} linked complaint(s)</span>
      </div>

      {intel && <IncidentIntel intel={intel} />}

      <div className="card mt-4 p-4">
        <label className="label">Incident status</label>
        <div className="flex gap-2">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              disabled={busy}
              onClick={() => changeStatus(s)}
              className={s === incident.status ? 'btn-primary text-xs' : 'btn-secondary text-xs'}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="card mt-4 p-4">
        <label className="label">Merge another incident into this one</label>
        {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <input
            className="input"
            type="number"
            placeholder="Source incident ID"
            value={mergeSourceId}
            onChange={(e) => setMergeSourceId(e.target.value)}
          />
          <button disabled={busy || !mergeSourceId} onClick={mergeIncident} className="btn-secondary shrink-0 text-sm">
            Merge
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          The source incident's complaints move here and it is closed (not deleted).
        </p>
      </div>

      <div className="card mt-4 h-64 overflow-hidden">
        <MapContainer center={[Number(incident.latitude), Number(incident.longitude)]} zoom={16} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={[Number(incident.latitude), Number(incident.longitude)]} />
        </MapContainer>
      </div>

      <h2 className="mt-6 text-sm font-semibold text-slate-800">Linked complaints</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {complaints.map((c) => (
          <div key={c.id} className="relative">
            <ComplaintCard complaint={c} variant="staff" />
            <button
              disabled={busy}
              onClick={() => removeComplaint(c.id)}
              className="absolute right-3 top-3 rounded-full bg-white px-2 py-0.5 text-xs text-red-600 shadow"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <h2 className="mt-6 text-sm font-semibold text-slate-800">Timeline</h2>
      <div className="card mt-3 p-4">
        {timeline.length === 0 ? (
          <p className="text-sm text-slate-400">No events yet.</p>
        ) : (
          <ol className="space-y-2">
            {timeline.map((e) => (
              <li key={e.id} className="text-sm">
                <span className="font-medium text-slate-700">{e.event_type.replace(/_/g, ' ')}</span>
                {e.notes && <span className="text-slate-500"> - {e.notes}</span>}
                <span className="ml-2 text-xs text-slate-400">
                  {new Date(e.created_at).toLocaleString()}
                  {e.actor_name ? ` · ${e.actor_name}` : ''}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
