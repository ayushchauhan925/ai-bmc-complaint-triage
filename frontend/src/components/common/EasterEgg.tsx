import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
const ITEMS = ['🚧', '🕳️', '🗑️', '💡', '🚰', '🌳', '🛣️', '🚦', '🧹', '✅'];
const MESSAGES = [
  'Ticket #0 resolved: boredom. 🎉',
  'Pothole filled. Citizens rejoice. 🕳️➡️🛣️',
  'SLA met: 0 hours. New record. ⏱️',
  'No duplicates found. You are one of a kind. ✨',
];
const CLICKS_NEEDED = 5;
const DURATION_MS = 4500;

/**
 * Login-page easter egg: click the logo 5 times (or enter the Konami code) and civic
 * emoji rain down with a light-hearted "ticket resolved" message. Purely cosmetic; respects
 * reduced-motion by showing only the message.
 */
export function useEasterEgg() {
  const [active, setActive] = useState(false);
  const [message, setMessage] = useState(MESSAGES[0]);
  const clicks = useRef({ count: 0, last: 0 });
  const keys = useRef<string[]>([]);
  const timer = useRef<number>();

  const trigger = useCallback(() => {
    setMessage(MESSAGES[Math.floor(Math.random() * MESSAGES.length)]);
    setActive(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setActive(false), DURATION_MS);
  }, []);

  const onLogoClick = useCallback(() => {
    const now = Date.now();
    clicks.current.count = now - clicks.current.last < 1200 ? clicks.current.count + 1 : 1;
    clicks.current.last = now;
    if (clicks.current.count >= CLICKS_NEEDED) {
      clicks.current.count = 0;
      trigger();
    }
  }, [trigger]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keys.current = [...keys.current, k].slice(-KONAMI.length);
      if (keys.current.join('|') === KONAMI.join('|')) {
        keys.current = [];
        trigger();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer.current);
    };
  }, [trigger]);

  return { active, message, onLogoClick };
}

export function EasterEggOverlay({ active, message }: { active: boolean; message: string }) {
  const drops = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        emoji: ITEMS[i % ITEMS.length],
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        duration: 2.4 + Math.random() * 1.6,
        size: 20 + Math.random() * 18,
      })),
    // regenerate a fresh layout on each activation
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active]
  );

  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-live="polite">
      <div className="egg-drops">
        {drops.map((d) => (
          <span
            key={d.id}
            aria-hidden="true"
            className="egg-drop"
            style={{ left: `${d.left}%`, animationDelay: `${d.delay}s`, animationDuration: `${d.duration}s`, fontSize: d.size }}
          >
            {d.emoji}
          </span>
        ))}
      </div>
      <div className="absolute inset-x-0 top-6 flex justify-center px-4">
        <p role="status" className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow-lg">
          {message}
        </p>
      </div>
    </div>
  );
}
