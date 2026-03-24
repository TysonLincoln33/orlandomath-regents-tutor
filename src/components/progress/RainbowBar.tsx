'use client';

import React from 'react';

export type RainbowBarProps = {
  /** Progress percent 0–100 */
  value: number;
  /** Optional labels shown above the bar */
  labelLeft?: React.ReactNode;
  labelRight?: React.ReactNode;
  /** Bar height (px) */
  heightPx?: number;
  /** Optional wrapper className */
  className?: string;
};

/**
 * Rainbow progress bar (Unit 3-style vibe) that is HYDRATION-SAFE.
 *
 * Many pages compute progress from localStorage after mount.
 * If the server renders 0% but the client hydrates to a different value,
 * React can throw a hydration mismatch. We avoid that by rendering a
 * deterministic placeholder until mounted, then showing the real value.
 */
export default function RainbowBar({
  value,
  labelLeft,
  labelRight,
  heightPx = 12,
  className = '',
}: RainbowBarProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const clamp = (n: number, a: number, b: number) => Math.min(Math.max(n, a), b);

  const pct = clamp(Number.isFinite(value) ? value : 0, 0, 100);
  const pctDisplay = mounted ? pct : 0;

  const left = mounted ? labelLeft : null;
  const right = mounted ? labelRight : null;

  return (
    <div className={className}>
      {(left != null || right != null) && (
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs text-slate-700">{left ?? ''}</span>
          <span className="text-xs text-slate-700">{right ?? ''}</span>
        </div>
      )}

      <div
        className="relative w-full overflow-hidden rounded-full bg-[#e6e6e6]"
        style={{ height: `${heightPx}px` }}
        role="progressbar"
        aria-valuenow={pctDisplay}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{
            width: `${pctDisplay}%`,
            background:
              'linear-gradient(90deg, #ff3b30 0%, #ff9500 18%, #ffcc00 34%, #34c759 52%, #00c7be 70%, #007aff 85%, #af52de 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 65%)',
          }}
        />
      </div>
    </div>
  );
}
