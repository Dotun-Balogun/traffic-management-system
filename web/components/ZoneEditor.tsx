"use client";

import { useRef, useState } from "react";

export type Zone = {
  id: string;
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type Props = {
  frameImage: string; // data URL
  zones: Zone[];
  onZonesChange: (zones: Zone[]) => void;
};

const CANVAS_WIDTH = 560;

const ZONE_COLORS = ["#F2B705", "#4CAF6D", "#5B8DEF", "#E5484D", "#B968E5"];

export default function ZoneEditor({ frameImage, zones, onZonesChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(
    null
  );
  const [imgHeight, setImgHeight] = useState(CANVAS_WIDTH * 0.5625);

  const getRelativePos = (e: React.MouseEvent) => {
    const rect = containerRef.current!.getBoundingClientRect();
    const x = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const y = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const { x, y } = getRelativePos(e);
    setDrawing({ x1: x, y1: y, x2: x, y2: y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawing) return;
    const { x, y } = getRelativePos(e);
    setDrawing({ ...drawing, x2: x, y2: y });
  };

  const handleMouseUp = () => {
    if (!drawing) return;
    const x1 = Math.min(drawing.x1, drawing.x2);
    const x2 = Math.max(drawing.x1, drawing.x2);
    const y1 = Math.min(drawing.y1, drawing.y2);
    const y2 = Math.max(drawing.y1, drawing.y2);

    // Ignore accidental tiny clicks/drags
    if (x2 - x1 > 0.02 && y2 - y1 > 0.02) {
      const newZone: Zone = {
        id: `zone-${Date.now()}`,
        name: `Zone ${zones.length + 1}`,
        x1,
        y1,
        x2,
        y2,
      };
      onZonesChange([...zones, newZone]);
    }
    setDrawing(null);
  };

  const updateZoneName = (id: string, name: string) => {
    onZonesChange(zones.map((z) => (z.id === id ? { ...z, name } : z)));
  };

  const removeZone = (id: string) => {
    onZonesChange(zones.filter((z) => z.id !== id));
  };

  return (
    <div>
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setDrawing(null)}
        className="relative w-full cursor-crosshair select-none overflow-hidden rounded-md border border-edge"
        style={{ maxWidth: CANVAS_WIDTH }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={frameImage}
          alt="Video frame for zone drawing"
          className="pointer-events-none block w-full"
          onLoad={(e) => {
            const img = e.currentTarget;
            setImgHeight((CANVAS_WIDTH / img.naturalWidth) * img.naturalHeight);
          }}
          draggable={false}
        />

        {zones.map((z, i) => (
          <div
            key={z.id}
            className="absolute border-2 text-[10px] font-mono uppercase tracking-wide text-white"
            style={{
              left: `${z.x1 * 100}%`,
              top: `${z.y1 * 100}%`,
              width: `${(z.x2 - z.x1) * 100}%`,
              height: `${(z.y2 - z.y1) * 100}%`,
              borderColor: ZONE_COLORS[i % ZONE_COLORS.length],
              backgroundColor: `${ZONE_COLORS[i % ZONE_COLORS.length]}22`,
            }}
          >
            <span
              className="absolute left-0 top-0 px-1 py-0.5"
              style={{ backgroundColor: ZONE_COLORS[i % ZONE_COLORS.length] }}
            >
              {z.name}
            </span>
          </div>
        ))}

        {drawing && (
          <div
            className="absolute border-2 border-dashed border-signal-amber bg-signal-amber/10"
            style={{
              left: `${Math.min(drawing.x1, drawing.x2) * 100}%`,
              top: `${Math.min(drawing.y1, drawing.y2) * 100}%`,
              width: `${Math.abs(drawing.x2 - drawing.x1) * 100}%`,
              height: `${Math.abs(drawing.y2 - drawing.y1) * 100}%`,
            }}
          />
        )}
      </div>

      <p className="mt-2 text-xs text-ink-muted">
        Click and drag on the frame to draw a lane or zone. Draw as many as you need.
      </p>

      {zones.length > 0 && (
        <div className="mt-3 space-y-2">
          {zones.map((z, i) => (
            <div key={z.id} className="flex items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: ZONE_COLORS[i % ZONE_COLORS.length] }}
              />
              <input
                value={z.name}
                onChange={(e) => updateZoneName(z.id, e.target.value)}
                className="flex-1 rounded border border-edge bg-panel-raised px-2 py-1 text-sm text-ink"
              />
              <button
                onClick={() => removeZone(z.id)}
                className="text-xs text-ink-muted hover:text-signal-red"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
