const CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  light: { label: "Light traffic", color: "#4CAF6D", bg: "rgba(76,175,109,0.12)" },
  moderate: { label: "Moderate traffic", color: "#F2B705", bg: "rgba(242,183,5,0.12)" },
  heavy: { label: "Heavy congestion", color: "#E5484D", bg: "rgba(229,72,77,0.12)" },
};

export default function CongestionBadge({ level }: { level: string }) {
  const cfg = CONFIG[level] ?? CONFIG.moderate;
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-xs uppercase tracking-[0.15em]"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cfg.color }} />
      {cfg.label}
    </span>
  );
}
