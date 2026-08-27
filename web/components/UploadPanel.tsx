"use client";

import { useRef, useState } from "react";

type Props = {
  file: File | null;
  onFileSelected: (file: File | null) => void;
  onAnalyze: () => void;
  disabled: boolean;
  loading: boolean;
};

export default function UploadPanel({
  file,
  onFileSelected,
  onAnalyze,
  disabled,
  loading,
}: Props) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) onFileSelected(dropped);
  };

  return (
    <div className="rounded-lg border border-edge bg-panel p-6">
      <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">
        01 · Load footage
      </h2>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-6 py-10 text-center transition-colors ${
          dragActive
            ? "border-signal-amber bg-panel-raised"
            : "border-edge hover:border-ink-muted"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => onFileSelected(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <>
            <p className="font-mono text-sm text-ink">{file.name}</p>
            <p className="mt-1 text-xs text-ink-muted">
              {(file.size / (1024 * 1024)).toFixed(1)} MB — click to replace
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-ink">
              Drop a video file here, or click to browse
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              MP4 recommended · short clips process fastest
            </p>
          </>
        )}
      </div>

      <button
        onClick={onAnalyze}
        disabled={disabled}
        className="mt-5 w-full rounded-md bg-signal-amber py-3 font-mono text-xs uppercase tracking-[0.2em] text-asphalt transition-opacity disabled:cursor-not-allowed disabled:opacity-30 hover:opacity-90"
      >
        {loading ? "Analyzing…" : "Analyze footage"}
      </button>
    </div>
  );
}
