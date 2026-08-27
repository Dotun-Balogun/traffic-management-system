"use client";

import { useEffect, useState } from "react";
import StatusBar, { SystemState } from "@/components/StatusBar";
import UploadPanel from "@/components/UploadPanel";
import ResultsReadout, { CountResults } from "@/components/ResultsReadout";
import ZoneEditor, { Zone } from "@/components/ZoneEditor";
import HistoryChart, { HistoryEntry } from "@/components/HistoryChart";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<SystemState>("idle");
  const [results, setResults] = useState<CountResults | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [frameImage, setFrameImage] = useState<string | null>(null);
  const [zones, setZones] = useState<Zone[]>([]);
  const [showZoneEditor, setShowZoneEditor] = useState(false);
  const [extractingFrame, setExtractingFrame] = useState(false);

  const [roadWidthMeters, setRoadWidthMeters] = useState("");

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const loadHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/history`);
      if (res.ok) setHistory(await res.json());
    } catch {
      // history is a nice-to-have; fail silently if backend is unreachable
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleFileSelected = (selected: File | null) => {
    setFile(selected);
    setResults(null);
    setErrorMessage(null);
    setState("idle");
    setFrameImage(null);
    setZones([]);
    setShowZoneEditor(false);
  };

  const handleDefineZones = async () => {
    if (!file) return;
    setExtractingFrame(true);
    setErrorMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_URL}/extract-frame`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Failed to extract frame");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFrameImage(data.image);
      setShowZoneEditor(true);
    } catch {
      setErrorMessage("Couldn't extract a preview frame from that video.");
    } finally {
      setExtractingFrame(false);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setState("processing");
    setErrorMessage(null);
    setResults(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (zones.length > 0) {
        formData.append(
          "zones",
          JSON.stringify(zones.map(({ name, x1, y1, x2, y2 }) => ({ name, x1, y1, x2, y2 })))
        );
      }
      if (roadWidthMeters) {
        formData.append("road_width_meters", roadWidthMeters);
      }

      const res = await fetch(`${API_URL}/process-video`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(`Server responded with ${res.status}`);

      const data: CountResults = await res.json();
      setResults(data);
      setState("done");
      loadHistory();
    } catch {
      setErrorMessage(
        "Couldn't process that video. Make sure the backend is running on " + API_URL + "."
      );
      setState("error");
    }
  };

  return (
    <main className="min-h-screen bg-asphalt">
      <StatusBar state={state} />

      <div className="mx-auto max-w-2xl px-6 py-12">
        <header className="mb-10">
          <h1 className="text-2xl font-semibold text-ink">Traffic Management System</h1>
          <p className="mt-2 text-sm text-ink-muted">
            Upload footage to detect and count vehicles, classify congestion,
            break results down by lane, and estimate speed.
          </p>
        </header>

        <div className="space-y-6">
          <UploadPanel
            file={file}
            onFileSelected={handleFileSelected}
            onAnalyze={handleAnalyze}
            disabled={!file || state === "processing"}
            loading={state === "processing"}
          />

          {file && (
            <div className="rounded-lg border border-edge bg-panel p-6">
              <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">
                02 · Optional: zones &amp; calibration
              </h2>
              <p className="mt-2 text-sm text-ink-muted">
                Draw zones to get a per-lane breakdown, and/or enter the
                real-world width of the road in view to get a speed estimate.
                Both are optional — skip straight to analyzing if you just
                want a total count.
              </p>

              {!showZoneEditor && (
                <button
                  onClick={handleDefineZones}
                  disabled={extractingFrame}
                  className="mt-4 rounded-md border border-edge px-4 py-2 font-mono text-xs uppercase tracking-[0.15em] text-ink hover:border-signal-amber disabled:opacity-50"
                >
                  {extractingFrame ? "Loading frame…" : "Define zones on this video"}
                </button>
              )}

              {showZoneEditor && frameImage && (
                <div className="mt-4">
                  <ZoneEditor frameImage={frameImage} zones={zones} onZonesChange={setZones} />
                </div>
              )}

              <div className="mt-5">
                <label className="block font-mono text-xs uppercase tracking-[0.15em] text-ink-muted">
                  Road width in view (meters) — for speed estimate
                </label>
                <input
                  type="number"
                  min={0}
                  value={roadWidthMeters}
                  onChange={(e) => setRoadWidthMeters(e.target.value)}
                  placeholder="e.g. 12"
                  className="mt-2 w-full rounded-md border border-edge bg-panel-raised px-3 py-2 text-sm text-ink"
                />
                <p className="mt-1 text-xs text-ink-muted">
                  Leave blank to skip speed estimation — it's only accurate
                  if this number roughly matches the real road width.
                </p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="rounded-md border border-signal-red/40 bg-signal-red/10 px-4 py-3 text-sm text-signal-red">
              {errorMessage}
            </div>
          )}

          {results && <ResultsReadout results={results} />}

          <div className="rounded-lg border border-edge bg-panel p-6">
            <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-ink-muted">
              04 · History &amp; trends
            </h2>
            <div className="mt-4">
              <HistoryChart entries={history} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
