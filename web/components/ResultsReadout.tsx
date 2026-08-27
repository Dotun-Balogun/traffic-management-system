"use client";

import { useEffect, useState } from "react";
import CongestionBadge from "./CongestionBadge";

export type CountResults = {
  totalVehicles: number;
  byType: Record<string, number>;
  framesProcessed: number;
  congestionLevel: string;
  avgConcurrentVehicles: number;
  zoneCounts: Record<string, number> | null;
  avgSpeedKmh: number | null;
};

const TYPE_LABEL: Record<string, string> = {
  car: "Car",
  truck: "Truck",
  bus: "Bus",
  motorcycle: "Motorcycle",
};

function useCountUp(target: number, durationMs = 700) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame: number;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);

  return value;
}

function BreakdownBars({
  entries,
  emptyLabel,
}: {
  entries: [string, number][];
  emptyLabel: string;
}) {
  const max = Math.max(1, ...entries.map(([, count]) => count));
  if (entries.length === 0) {
    return <p className="text-sm text-ink-muted">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-3">
      {entries.map(([label, count]) => (
        <div key={label}>
          <div className="mb-1 flex items-center justify-between font-mono text-xs text-ink-muted">
            <span className="uppercase tracking-[0.15em]">
              {TYPE_LABEL[label] ?? label}
            </span>
            <span className="tabular-nums text-ink">{count}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-raised">
            <div
              className="h-full rounded-full bg-signal-amber transition-all duration-700 ease-out"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ResultsReadout({ results }: { results: CountResults }) {
  const animatedTotal = useCountUp(results.totalVehicles);
  const typeEntries = Object.entries(results.byType).sort((a, b) => b[1] - a[1]);
  const zoneEntries = results.zoneCounts
    ? Object.entries(results.zoneCounts).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="rounded-lg border border-edge bg-panel p-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">
        03 · Readout
      </h2>

      <div className="mt-5 flex items-baseline gap-3 rounded-md border border-edge bg-asphalt px-6 py-8 shadow-glow">
        <span className="font-mono text-6xl font-semibold tabular-nums text-signal-amber">
          {String(animatedTotal).padStart(3, "0")}
        </span>
        <span className="text-sm text-ink-muted">vehicles counted</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <CongestionBadge level={results.congestionLevel} />
        <span className="text-xs text-ink-muted">
          avg {results.avgConcurrentVehicles} vehicles visible per frame
        </span>
      </div>

      {results.avgSpeedKmh !== null && (
        <div className="mt-4 rounded-md border border-edge bg-panel-raised px-4 py-3">
          <p className="font-mono text-xs uppercase tracking-[0.15em] text-ink-muted">
            Estimated avg. speed
          </p>
          <p className="mt-1 font-mono text-2xl text-ink">
            {results.avgSpeedKmh} <span className="text-sm text-ink-muted">km/h</span>
          </p>
        </div>
      )}

      <div className="mt-6">
        <h3 className="mb-3 font-mono text-xs uppercase tracking-[0.15em] text-ink-muted">
          By vehicle type
        </h3>
        <BreakdownBars entries={typeEntries} emptyLabel="No vehicles detected in this clip." />
      </div>

      {results.zoneCounts && (
        <div className="mt-6">
          <h3 className="mb-3 font-mono text-xs uppercase tracking-[0.15em] text-ink-muted">
            By zone / lane
          </h3>
          <BreakdownBars entries={zoneEntries} emptyLabel="No vehicles matched a defined zone." />
        </div>
      )}

      <p className="mt-6 text-xs text-ink-muted">
        {results.framesProcessed} frames processed · unique vehicles tracked across
        the full clip, not counted per-frame
      </p>
    </div>
  );
}
