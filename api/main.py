import base64
import json
import os
import shutil
import sqlite3
import tempfile
import time
from collections import Counter, defaultdict
from typing import Optional

import cv2
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO

app = FastAPI(title="Traffic Management System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Loaded once at startup. First run auto-downloads yolov8n.pt (~6MB).
model = YOLO("yolov8n.pt")

# COCO class IDs for vehicle-related classes
VEHICLE_CLASSES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}

# How many frames to skip between detections — big speed win, small
# accuracy cost for counting/congestion purposes.
VID_STRIDE = 3

# Congestion thresholds, in *average concurrent vehicles visible per frame*.
# These are placeholder values — tune them to your camera's actual field of
# view and road capacity. A wide multi-lane highway and a narrow side street
# will have very different "heavy" thresholds.
CONGESTION_THRESHOLDS = {"light": 3, "moderate": 8}  # >= moderate value = heavy

DB_PATH = os.path.join(os.path.dirname(__file__), "history.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp REAL NOT NULL,
            filename TEXT,
            total_vehicles INTEGER,
            by_type TEXT,
            congestion_level TEXT,
            avg_concurrent REAL,
            avg_speed_kmh REAL,
            zones TEXT,
            frames_processed INTEGER
        )
        """
    )
    conn.commit()
    conn.close()


init_db()


@app.get("/")
def health():
    return {"status": "ok"}


@app.post("/extract-frame")
async def extract_frame(file: UploadFile = File(...)):
    """
    Returns the first frame of an uploaded video as a base64 PNG, plus its
    pixel dimensions. Used by the frontend to let the user draw zones/lanes
    on top of a real frame before running the full analysis.
    """
    suffix = os.path.splitext(file.filename)[1] or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        cap = cv2.VideoCapture(tmp_path)
        ok, frame = cap.read()
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        cap.release()

        if not ok:
            return {"error": "Could not read a frame from this video."}

        ok, buf = cv2.imencode(".png", frame)
        b64 = base64.b64encode(buf.tobytes()).decode("utf-8")

        return {
            "image": f"data:image/png;base64,{b64}",
            "width": width,
            "height": height,
        }
    finally:
        os.remove(tmp_path)


def classify_congestion(avg_concurrent: float) -> str:
    if avg_concurrent < CONGESTION_THRESHOLDS["light"]:
        return "light"
    if avg_concurrent < CONGESTION_THRESHOLDS["moderate"]:
        return "moderate"
    return "heavy"


@app.post("/process-video")
async def process_video(
    file: UploadFile = File(...),
    zones: Optional[str] = Form(None),  # JSON string: [{name,x1,y1,x2,y2}] normalized 0-1
    road_width_meters: Optional[str] = Form(None),
):
    """
    Runs YOLOv8 + ByteTrack on an uploaded video and returns:
    - total unique vehicles + breakdown by type
    - a congestion level (light/moderate/heavy) based on average vehicles
      visible per frame
    - per-zone vehicle counts, if zones were provided
    - an estimated average speed, if road_width_meters was provided for
      pixel-to-real-world calibration (otherwise speed is omitted rather
      than shown as a made-up number)
    Also saves the result to local history for the trends view.
    """
    suffix = os.path.splitext(file.filename)[1] or ".mp4"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name

    try:
        cap = cv2.VideoCapture(tmp_path)
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 1
        cap.release()

        zone_defs = json.loads(zones) if zones else []
        meters_per_pixel = None
        if road_width_meters:
            try:
                rw = float(road_width_meters)
                if rw > 0:
                    meters_per_pixel = rw / frame_width
            except ValueError:
                pass

        seen_ids = defaultdict(set)  # class_name -> set of unique track ids
        zone_hits = defaultdict(Counter)  # track_id -> Counter of zone_name hits
        track_positions = defaultdict(list)  # track_id -> [(frame_idx, cx, cy)]

        results = model.track(
            source=tmp_path,
            classes=list(VEHICLE_CLASSES.keys()),
            tracker="bytetrack.yaml",
            persist=True,
            stream=True,
            verbose=False,
            vid_stride=VID_STRIDE,
        )

        frame_count = 0
        concurrent_counts = []  # vehicles visible in each processed frame

        for r in results:
            frame_count += 1
            if r.boxes is None or r.boxes.id is None:
                concurrent_counts.append(0)
                continue

            boxes_this_frame = 0
            for cls_id, track_id, xyxy in zip(
                r.boxes.cls.tolist(), r.boxes.id.tolist(), r.boxes.xyxy.tolist()
            ):
                cls_name = VEHICLE_CLASSES.get(int(cls_id))
                if not cls_name:
                    continue

                track_id = int(track_id)
                seen_ids[cls_name].add(track_id)
                boxes_this_frame += 1

                x1, y1, x2, y2 = xyxy
                cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                track_positions[track_id].append((frame_count, cx, cy))

                nx, ny = cx / frame_width, cy / frame_height
                for z in zone_defs:
                    if z["x1"] <= nx <= z["x2"] and z["y1"] <= ny <= z["y2"]:
                        zone_hits[track_id][z["name"]] += 1
                        break

            concurrent_counts.append(boxes_this_frame)

        by_type = {cls: len(ids) for cls, ids in seen_ids.items()}
        total = sum(by_type.values())

        avg_concurrent = (
            sum(concurrent_counts) / len(concurrent_counts) if concurrent_counts else 0
        )
        congestion_level = classify_congestion(avg_concurrent)

        # Per-zone counts: assign each vehicle to whichever zone it was seen
        # in most often, to smooth over edge noise near zone boundaries.
        zone_counts = Counter()
        for track_id, counter in zone_hits.items():
            if counter:
                zone_counts[counter.most_common(1)[0][0]] += 1

        # Speed estimate: for each track with 2+ positions, take first/last
        # position, divide displacement by elapsed real time.
        speeds_kmh = []
        seconds_per_processed_frame = VID_STRIDE / fps
        for track_id, positions in track_positions.items():
            if len(positions) < 2:
                continue
            f0, x0, y0 = positions[0]
            f1, x1_, y1_ = positions[-1]
            frame_gap = f1 - f0
            if frame_gap <= 0:
                continue
            pixel_dist = ((x1_ - x0) ** 2 + (y1_ - y0) ** 2) ** 0.5
            elapsed_sec = frame_gap * seconds_per_processed_frame
            pixel_speed = pixel_dist / elapsed_sec  # px/sec
            if meters_per_pixel:
                speeds_kmh.append(pixel_speed * meters_per_pixel * 3.6)

        avg_speed_kmh = round(sum(speeds_kmh) / len(speeds_kmh), 1) if speeds_kmh else None

        result = {
            "totalVehicles": total,
            "byType": by_type,
            "framesProcessed": frame_count,
            "congestionLevel": congestion_level,
            "avgConcurrentVehicles": round(avg_concurrent, 1),
            "zoneCounts": dict(zone_counts) if zone_defs else None,
            "avgSpeedKmh": avg_speed_kmh,
        }

        conn = get_db()
        conn.execute(
            """INSERT INTO runs
               (timestamp, filename, total_vehicles, by_type, congestion_level,
                avg_concurrent, avg_speed_kmh, zones, frames_processed)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                time.time(),
                file.filename,
                total,
                json.dumps(by_type),
                congestion_level,
                avg_concurrent,
                avg_speed_kmh,
                json.dumps(dict(zone_counts)) if zone_defs else None,
                frame_count,
            ),
        )
        conn.commit()
        conn.close()

        return result
    finally:
        os.remove(tmp_path)


@app.get("/history")
def history(limit: int = 50):
    """Returns past analysis runs, most recent last, for the trends chart."""
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM runs ORDER BY timestamp DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()

    return [
        {
            "id": r["id"],
            "timestamp": r["timestamp"],
            "filename": r["filename"],
            "totalVehicles": r["total_vehicles"],
            "byType": json.loads(r["by_type"]) if r["by_type"] else {},
            "congestionLevel": r["congestion_level"],
            "avgConcurrentVehicles": r["avg_concurrent"],
            "avgSpeedKmh": r["avg_speed_kmh"],
            "zoneCounts": json.loads(r["zones"]) if r["zones"] else None,
        }
        for r in reversed(rows)  # oldest first for a left-to-right trend chart
    ]
