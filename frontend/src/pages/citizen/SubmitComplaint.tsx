import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LocationPicker } from '../../components/map/LocationPicker';
import { CameraIcon } from '../../components/common/Icons';
import { GuidedAssistant } from '../../components/complaint/GuidedAssistant';
import { DuplicateWarning } from '../../components/complaint/DuplicateWarning';
import { createComplaint } from '../../services/complaint.service';
import { getErrorMessage, getErrorDetails } from '../../services/api';
import { useI18n } from '../../i18n';
import { QualityHint } from '../../components/complaint/QualityHint';

const MAX_IMAGES = 5;

export default function SubmitComplaint() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const previews = images.map((f) => URL.createObjectURL(f));

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const next = [...images, ...Array.from(files)].slice(0, MAX_IMAGES);
    setImages(next);
  };

  const removeImage = (idx: number) => setImages((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!location) {
      setError(t('submit.needLocation'));
      return;
    }
    setSubmitting(true);
    try {
      const complaint = await createComplaint({
        description,
        latitude: location.lat,
        longitude: location.lng,
        address,
        images,
      });
      navigate(`/complaints/${complaint.id}`, { state: { justSubmitted: true } });
    } catch (err) {
      const details = getErrorDetails(err);
      setError(details ? details.map((d) => d.message).join(' ') : getErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-slate-900">{t('submit.title')}</h1>
      <p className="mt-1 text-sm text-slate-500">
        {t('submit.sub')}
      </p>

      <form onSubmit={handleSubmit} className="card mt-6 space-y-5 p-6">
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div>
          <label className="label" htmlFor="sc-description">{t('submit.whatIssue')}</label>
          <textarea
            id="sc-description"
            required
            rows={4}
            className="input"
            placeholder={t('submit.placeholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="mt-2">
            <GuidedAssistant draft={description} onAcceptSuggestion={setDescription} />
          </div>
        </div>

        <div>
          <label className="label">{t('submit.photos', { n: MAX_IMAGES })}</label>
          <div className="flex flex-wrap gap-3">
            {previews.map((src, idx) => (
              <div key={idx} className="relative h-20 w-20 overflow-hidden rounded-lg border border-slate-200">
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white"
                >
                  ×
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-brand-400 hover:text-brand-500">
                <CameraIcon size={20} />
                <span className="text-[10px]">{t('submit.addPhoto')}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
              </label>
            )}
          </div>
        </div>

        <div>
          <label className="label">{t('submit.location')}</label>
          <LocationPicker value={location} onChange={(lat, lng) => setLocation({ lat, lng })} />
        </div>

        <div>
          <label className="label" htmlFor="sc-address">{t('submit.address')}</label>
          <input
            id="sc-address"
            className="input"
            placeholder={t('submit.addressPh')}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>

        <QualityHint description={description} address={address} hasLocation={!!location} photoCount={images.length} />

        <div className="border-t border-slate-100 pt-4">
          <DuplicateWarning description={description} location={location} />
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
          {submitting ? t('submit.analyzing') : t('submit.submit')}
        </button>
      </form>
    </div>
  );
}
