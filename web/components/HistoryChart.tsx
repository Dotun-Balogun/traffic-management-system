"use client";

export type HistoryEntry = {
  id: number;
  timestamp: number;
  filename: string;
  totalVehicles: number;
  congestionLevel: string;
};

const LEVEL_COLOR: Record<string, string> = {
  light: "#4CAF6D",
  moderate: "#F2B705",
  heavy: "#E5484D",
};

const WIDTH = 640;
const HEIGHT = 180;
const PADDING = 28;

export default function HistoryChart({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        No analysis history yet — results are saved here after each run.
      </p>
    );
  }

  const max = Math.max(1, ...entries.map((e) => e.totalVehicles));
  const stepX =
    entries.length > 1 ? (WIDTH - PADDING * 2) / (entries.length - 1) : 0;

  const points = entries.map((e, i) => {
    const x = PADDING + i * stepX;
    const y = HEIGHT - PADDING - (e.totalVehicles / max) * (HEIGHT - PADDING * 2);
    return { x, y, entry: e };
  });

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  return (
    <div className="overflow-x-auto">
      <svg width={WIDTH} height={HEIGHT} className="min-w-full">
        {/* baseline */}
        <line
          x1={PADDING}
          y1={HEIGHT - PADDING}
          x2={WIDTH - PADDING}
          y2={HEIGHT - PADDING}
          stroke="#2A2F3A"
        />

        <path d={path} fill="none" stroke="#F2B705" strokeWidth={2} />

        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={4}
              fill={LEVEL_COLOR[p.entry.congestionLevel] ?? "#F2B705"}
            />
            <title>
              {new Date(p.entry.timestamp * 1000).toLocaleString()} —{" "}
              {p.entry.totalVehicles} vehicles ({p.entry.congestionLevel})
            </title>
          </g>
        ))}
      </svg>

      <div className="mt-2 flex items-center gap-4 font-mono text-[10px] uppercase tracking-wide text-ink-muted">
        {Object.entries(LEVEL_COLOR).map(([level, color]) => (
          <span key={level} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            {level}
          </span>
        ))}
      </div>
    </div>
  );
}
