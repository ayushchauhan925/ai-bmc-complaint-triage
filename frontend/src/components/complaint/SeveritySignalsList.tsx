import React from 'react';
import type { SeveritySignals } from '../../utils/types';

const LABELS: Record<string, string> = {
  traffic_hazard: 'Traffic hazard',
  large_damage: 'Large damage',
  water_accumulation: 'Water accumulation',
  near_school: 'Near a school',
  near_hospital: 'Near a hospital',
  near_public_place: 'Near a public place',
  injury_reported: 'Injury reported',
  public_health_risk: 'Public health risk',
  environmental_risk: 'Environmental risk',
  emergency_access_blocked: 'Emergency access blocked',
  multiple_people_affected: 'Multiple people affected',
};

export function SeveritySignalsList({ signals }: { signals: SeveritySignals | null }) {
  const active = Object.entries(signals || {}).filter(([, v]) => v);

  if (active.length === 0) {
    return <p className="text-sm text-slate-400">No specific risk signals detected.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {active.map(([key]) => (
        <span key={key} className="badge border-amber-200 bg-amber-50 text-amber-700">
          {LABELS[key] || key}
        </span>
      ))}
    </div>
  );
}
