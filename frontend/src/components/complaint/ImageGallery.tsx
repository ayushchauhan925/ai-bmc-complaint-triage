import React, { useState } from 'react';
import type { ComplaintImage } from '../../utils/types';

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

function resolveUrl(url: string) {
  return url.startsWith('http') ? url : `${API_ORIGIN}${url}`;
}

export function ImageGallery({ images }: { images: ComplaintImage[] }) {
  const [active, setActive] = useState<string | null>(null);
  const before = images.filter((i) => i.image_type === 'ORIGINAL');
  const after = images.filter((i) => i.image_type === 'RESOLUTION');

  if (images.length === 0) {
    return <p className="text-sm text-slate-400">No photos were attached to this complaint.</p>;
  }

  return (
    <div className="space-y-4">
      {before.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Before</p>
          <div className="flex flex-wrap gap-2">
            {before.map((img) => (
              <button key={img.id} onClick={() => setActive(resolveUrl(img.image_url))}>
                <img
                  src={resolveUrl(img.image_url)}
                  alt="Complaint"
                  className="h-24 w-24 rounded-lg border border-slate-200 object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
      {after.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">After (resolution)</p>
          <div className="flex flex-wrap gap-2">
            {after.map((img) => (
              <button key={img.id} onClick={() => setActive(resolveUrl(img.image_url))}>
                <img
                  src={resolveUrl(img.image_url)}
                  alt="Resolution"
                  className="h-24 w-24 rounded-lg border border-green-200 object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setActive(null)}
        >
          <img src={active} alt="" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
