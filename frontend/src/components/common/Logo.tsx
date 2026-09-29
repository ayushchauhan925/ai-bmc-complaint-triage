import React from 'react';

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <div
      className="flex items-center justify-center rounded-xl bg-brand-600 font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      CC
    </div>
  );
}
