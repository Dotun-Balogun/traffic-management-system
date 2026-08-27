export type SystemState = "idle" | "processing" | "done" | "error";

const STATE_COPY: Record<SystemState, string> = {
  idle: "Awaiting footage",
  processing: "Analyzing footage",
  done: "Count complete",
  error: "Analysis failed",
};

const STATE_COLOR: Record<SystemState, string> = {
  idle: "bg-signal-amber",
  processing: "bg-signal-amber",
  done: "bg-signal-green",
  error: "bg-signal-red",
};

export default function StatusBar({ state }: { state: SystemState }) {
  return (
    <div className="flex items-center justify-between border-b border-edge px-6 py-4">
      <div className="flex items-center gap-3">
        <span
          className={`h-2.5 w-2.5 rounded-full ${STATE_COLOR[state]} ${
            state === "processing" ? "pulse" : ""
          }`}
        />
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">
          {STATE_COPY[state]}
        </span>
      </div>
      <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">
        Vehicle Counter · v1
      </span>
    </div>
  );
}
