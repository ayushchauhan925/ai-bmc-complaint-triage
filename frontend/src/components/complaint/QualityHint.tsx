import React from 'react';
import { assessQuality, type QualityLevel } from '../../utils/complaintQuality';
import { useI18n } from '../../i18n';
import { CheckCircleIcon } from '../common/Icons';

const BAR: Record<QualityLevel, string> = { LOW: 'bg-slate-400', FAIR: 'bg-amber-500', GOOD: 'bg-lime-500', GREAT: 'bg-green-600' };
const STEPS: Record<QualityLevel, number> = { LOW: 1, FAIR: 2, GOOD: 3, GREAT: 4 };

/**
 * Live completeness hint for the draft complaint. Supportive, specific and non-blocking;
 * it is a simple checklist (not AI) and says so.
 */
export function QualityHint(props: { description: string; address: string; hasLocation: boolean; photoCount: number }) {
  const { t } = useI18n();
  // Nothing typed yet: stay out of the way.
  if (props.description.trim().length === 0 && !props.hasLocation && props.photoCount === 0) return null;

  const q = assessQuality(props);
  return (
    <section aria-label={t('quality.title')} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-800">{t('quality.title')}</h3>
        <span className="text-sm font-semibold text-slate-700" aria-live="polite">{t(`quality.${q.level}`)}</span>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${STEPS[q.level] >= i ? BAR[q.level] : 'bg-slate-200'}`} />)}
      </div>
      {q.suggestions.length === 0 ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-green-700"><CheckCircleIcon size={15} /> {t('quality.allGood')}</p>
      ) : (
        <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
          {q.suggestions.map((k) => <li key={k} className="flex gap-2"><span aria-hidden="true" className="text-brand-600">•</span>{t(k)}</li>)}
        </ul>
      )}
      <p className="mt-3 text-[11px] text-slate-400">{t('quality.note')}</p>
    </section>
  );
}
