# Traffic Density Monitor — Complete Project

A full working project: a Next.js (TypeScript) dashboard + a Python (YOLOv8)
backend that counts vehicles in an uploaded video.

```
traffic-management-v2/
├── web/     ← complete Next.js app (already built — just install & run)
└── api/     ← Python backend (YOLOv8 detection + counting)
```

Nothing here needs scaffolding — `web/` is a real, ready-to-run project.
You just need to install dependencies for each side and start both servers.

---

## What's in this version

Beyond a basic vehicle count, this system now includes:

- **Congestion classification** — light / moderate / heavy, based on
  average vehicles visible per frame. The thresholds are placeholder
  values in `api/main.py` (`CONGESTION_THRESHOLDS`) — tune them to your
  actual camera's field of view and road capacity.
- **Per-zone / per-lane breakdown** — after selecting a video, click
  "Define zones on this video" to draw rectangles directly on an extracted
  frame (e.g. one per lane). Results will then show a count per zone, not
  just one total. Optional — skip it for a simple total count.
- **Speed estimation** — enter the real-world width (in meters) of the
  road visible in the frame, and the system estimates average vehicle
  speed in km/h using pixel displacement over time. This is an estimate,
  not a certified measurement — accuracy depends entirely on how correct
  that width figure is, and on camera angle (a heavily angled camera will
  distort distances). Leave it blank to skip.
- **History & trends** — every analysis is saved locally (SQLite,
  `api/history.db`, created automatically) and shown as a chart at the
  bottom of the page, so you can compare multiple uploads over time.

---

## Part 1 — Backend (Python)

### Step 1: Install Python
Get Python 3.10+ from https://www.python.org/downloads/

**Windows:** check "Add Python to PATH" during install.
**Mac:** PATH is handled automatically.

Check it worked:
```bash
python3 --version
```

### Step 2: Install backend dependencies
Open a terminal **inside the `api/` folder**:

```bash
python3 -m venv venv --upgrade-deps

# Mac/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Install PyTorch's CPU-only build first (much smaller download than the
# default GPU build, and this project doesn't need a GPU).
# IMPORTANT: install torch and torchvision together, in the same command —
# installing them separately can pull mismatched versions and cause a
# "torchvision::nms does not exist" error at runtime.
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu

pip install -r requirements.txt
```

This installs FastAPI, Uvicorn, and Ultralytics (YOLOv8) — takes a few
minutes the first time.

### Step 3: Run the backend
Still in `api/`, venv activated:
```bash
uvicorn main:app --reload --port 8000
```

First run auto-downloads the YOLO model weights (~6MB, one-time, needs
internet). You should see `Uvicorn running on http://127.0.0.1:8000`.

Check it: open http://localhost:8000 → should show `{"status":"ok"}`.

**Leave this terminal running.**

---

## Part 2 — Frontend (Next.js)

### Step 1: Install dependencies
In a **new terminal**, inside the `web/` folder:

```bash
npm install
# or, if you use pnpm:
pnpm install
```

This project uses **Tailwind CSS v4** — theme colors and fonts are defined
directly in `app/globals.css` via `@theme`, not in a separate
`tailwind.config.ts` (that file doesn't exist here, which is expected —
v4 removed the JS config in favor of CSS).

### Step 2: Run it
```bash
npm run dev
```

Open http://localhost:3000 — you'll see the full dashboard: a status bar,
a drag-and-drop upload zone, and a results readout panel (they're already
wired together, no extra setup needed).

---

## Part 3 — Try it

1. Confirm the backend terminal is still running on port 8000.
2. On http://localhost:3000, drag in a short video (10–20 sec mp4 is
   fastest for testing) or click the zone to browse for one.
3. Click **Analyze footage**.
4. The status bar switches to "Analyzing footage" while it processes.
5. Once done, you'll see the total vehicle count animate in, plus a
   breakdown by type (car/truck/bus/motorcycle) as bars.

---

## Project structure reference

**`web/app/page.tsx`** — the main page; holds state (selected file,
loading, results) and calls the backend.
**`web/components/UploadPanel.tsx`** — the drag-and-drop upload zone.
**`web/components/ResultsReadout.tsx`** — the animated count + per-type
bars.
**`web/components/StatusBar.tsx`** — the top status indicator.
**`api/main.py`** — the FastAPI endpoint that runs YOLOv8 + tracking and
returns counts as JSON.

If you ever want to change the backend URL (e.g. once deployed), set it
via an environment variable instead of editing code — create
`web/.env.local`:
```
NEXT_PUBLIC_API_URL=https://your-deployed-backend.com
```

---

## Troubleshooting

- **"Couldn't process that video"** → check the backend terminal for
  errors; make sure it's still running on port 8000.
- **`RuntimeError: operator torchvision::nms does not exist`** → torch and
  torchvision versions don't match (usually from installing them in
  separate commands). Fix: `pip uninstall torch torchvision -y`, then
  `pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu`
  (install both together, not one after the other).
- **`python3` not found** → reinstall Python, ensure PATH was checked
  (Windows), restart your terminal.
- **Slow first analysis** → normal — model loads and weights download
  once. Subsequent runs are faster.
- **Port already in use** → something else is on 8000 or 3000; stop it,
  or run the backend on a different port (`--port 8001`) and update
  `NEXT_PUBLIC_API_URL` to match.

---

## Deploying later (not needed to test locally)

- `web/` → Vercel, same as any Next.js app.
- `api/` → Railway or Render, both run Python apps directly from
  `requirements.txt`.
- Set `NEXT_PUBLIC_API_URL` in Vercel's environment variables to point
  at your deployed backend's URL.
