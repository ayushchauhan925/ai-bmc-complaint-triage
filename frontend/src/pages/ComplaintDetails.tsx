import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getComplaint } from '../services/complaint.service';
import * as platform from '../services/platform.service';
import { PdfButton } from '../components/ui/PdfButton';
import { complaintReport } from '../utils/pdf';
import { PageLoader } from '../components/common/Spinner';
import { ErrorState } from '../components/common/EmptyState';
import { PriorityBadge, StatusBadge, CategoryBadge, SlaBadge } from '../components/common/Badge';
import { PriorityReasons } from '../components/complaint/PriorityReasons';
import { SeveritySignalsList } from '../components/complaint/SeveritySignalsList';
import { StatusTimeline } from '../components/complaint/StatusTimeline';
import { ImageGallery } from '../components/complaint/ImageGallery';
import { FeedbackForm } from '../components/complaint/FeedbackForm';
import { OfficerActions } from '../components/complaint/OfficerActions';
import { AdminActions } from '../components/complaint/AdminActions';
import { EvidenceIntelligence } from '../components/complaint/EvidenceIntelligence';
import { ResolutionVerificationCard } from '../components/complaint/ResolutionVerificationCard';
import { ReopenDialog } from '../components/complaint/ReopenDialog';
import { OfficerCopilotPanel } from '../components/complaint/OfficerCopilotPanel';
import { SlaPanel, ComplaintTimeline, InsightsPanel, RelatedComplaints, ReviewPanel } from '../components/complaint/Intelligence';
import { getErrorMessage } from '../services/api';
import { formatCategory } from '../utils/constants';
import type { Complaint } from '../utils/types';

export default function ComplaintDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const justSubmitted = (location.state as { justSubmitted?: boolean })?.justSubmitted;

  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [duplicateCount, setDuplicateCount] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const load = async () => {
    if (!id) return;
    try {
      const data = await getComplaint(id);
      setComplaint(data);
      if (data.status !== 'SUBMITTED') {
        platform.duplicates(id)
          .then((d) => setDuplicateCount(d.duplicates.filter((x) => x.reviewStatus !== 'REJECTED').length))
          .catch(() => {});
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load this complaint.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) return <PageLoader />;
  if (error || !complaint) return <div className="p-6"><ErrorState message={error || 'Not found'} /></div>;

  const hasFeedback = complaint.status === 'RESOLVED';
  const isStaff = user?.role === 'ADMIN' || user?.role === 'OFFICER';

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {justSubmitted && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Complaint submitted successfully! Your complaint ID is <strong>{complaint.complaint_number}</strong>.
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-slate-400">{complaint.complaint_number}</p>
          <h1 className="mt-1 text-xl font-semibold text-slate-900">
            {complaint.ai_title || formatCategory(complaint.category)}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PdfButton
            label={isStaff ? 'Export PDF' : 'Download receipt'}
            build={async () => {
              const [tl, sla, trace] = await Promise.all([
                platform.timeline(complaint.id),
                platform.complaintSla(complaint.id).catch(() => null),
                isStaff ? platform.decisionTrace(complaint.id).catch(() => null) : Promise.resolve(null),
              ]);
              await complaintReport({ complaint, timeline: tl, sla, trace, staff: isStaff });
            }}
          />
          <PriorityBadge level={complaint.priority_level} />
          <StatusBadge status={complaint.status} />
          <SlaBadge status={complaint.sla_status} />
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-700">{complaint.description}</p>

      {complaint.address && <p className="mt-1 text-xs text-slate-400">📍 {complaint.address}</p>}

      {complaint.ai_analysis_failed && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          AI analysis was unavailable for this complaint. You can continue tracking it - our team will classify it
          manually.
        </div>
      )}

      {complaint.review_required && !complaint.ai_analysis_failed && (
        <div className="mt-4 rounded-lg border border-pink-200 bg-pink-50 px-4 py-3 text-sm text-pink-800">
          This complaint has been flagged for manual review. {complaint.review_reason}
        </div>
      )}

      <div className="mt-6"><SlaPanel complaintId={complaint.id} /></div>

      {isStaff && (
        <div className="mt-4 space-y-4">
          <InsightsPanel complaintId={complaint.id} />
          <RelatedComplaints complaintId={complaint.id} canAct onChanged={load} />
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <PriorityReasons level={complaint.priority_level} score={complaint.priority_score} reasons={complaint.priority_reasons} />

        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-800">AI Analysis</h3>
          {complaint.ai_summary ? (
            <>
              <p className="mt-1 text-sm text-slate-600">{complaint.ai_summary}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <CategoryBadge category={complaint.category} />
                {complaint.language && (
                  <span className="badge border-slate-200 bg-slate-100 text-slate-600">{complaint.language}</span>
                )}
                {complaint.ai_confidence !== null && (
                  <span className="badge border-slate-200 bg-slate-100 text-slate-600">
                    {Math.round(Number(complaint.ai_confidence) * 100)}% confidence
                  </span>
                )}
              </div>
              {complaint.image_verified === false && (
                <p className="mt-2 text-xs text-amber-600">Uploaded image may not clearly support this complaint.</p>
              )}
              {complaint.missing_information && complaint.missing_information.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-slate-500">Missing information:</p>
                  <ul className="mt-1 list-inside list-disc text-xs text-slate-500">
                    {complaint.missing_information.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-400">Analysis pending.</p>
          )}
        </div>
      </div>

      {complaint.resolution_verification && (
        <div className="mt-4">
          <ResolutionVerificationCard verification={complaint.resolution_verification} />
        </div>
      )}

      {complaint.evidence_analysis && (
        <div className="mt-4">
          <EvidenceIntelligence evidence={complaint.evidence_analysis} confidence={complaint.evidence_confidence} />
        </div>
      )}

      <div className="card mt-4 p-4">
        <h3 className="text-sm font-semibold text-slate-800">Risk signals</h3>
        <div className="mt-2">
          <SeveritySignalsList signals={complaint.severity_signals} />
        </div>
      </div>

      {duplicateCount !== null && duplicateCount > 0 && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          {duplicateCount} related complaint{duplicateCount === 1 ? '' : 's'} found nearby
          {complaint.incident_id && ' - grouped into an incident for faster resolution.'}
        </div>
      )}

      <div className="card mt-4 p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-800">Photos</h3>
        <ImageGallery images={complaint.images || []} />
      </div>

      {user?.role === 'OFFICER' && (
        <div className="mt-4 space-y-4">
          <OfficerActions complaint={complaint} onUpdated={setComplaint} />
          <OfficerCopilotPanel complaintId={complaint.id} />
        </div>
      )}

      {isStaff && (
        <div className="mt-4">
          <ReviewPanel complaint={complaint} isAdmin={user?.role === 'ADMIN'} onUpdated={load} />
        </div>
      )}

      {user?.role === 'ADMIN' && (
        <div className="mt-4">
          <AdminActions complaint={complaint} onUpdated={setComplaint} />
        </div>
      )}

      {user?.role === 'CITIZEN' && hasFeedback && (
        <div className="mt-4 space-y-3">
          {showFeedback ? (
            <p className="text-sm text-green-600">Thanks for your feedback!</p>
          ) : (
            <FeedbackForm complaintId={complaint.id} onDone={() => { setShowFeedback(true); load(); }} />
          )}
          <ReopenDialog complaintId={complaint.id} onReopened={(updated) => { setComplaint(updated); setShowFeedback(false); }} />
        </div>
      )}

      <div className="mt-4">
        <ComplaintTimeline complaintId={complaint.id} staff={isStaff} />
      </div>
    </div>
  );
}
