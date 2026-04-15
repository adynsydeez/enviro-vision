# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FireCommander** — a wildfire simulation platform. Motto: *"Play with fire. Safely."*

**Target Audience:** Kids, teens, and young adults — not professional firefighters. The goal is environmental literacy and basic tactical thinking around wildfire behaviour. UI should be approachable, engaging, and game-like while remaining grounded in realistic fire science.

Users select a Queensland wildfire scenario, then practice suppression strategies — control lines, water drops, backburns — on a real satellite map locked to a 10×10km area around the location.

## Commands

### Unified (repo root)
```bash
npm run install:all   # Install both frontend npm deps and Python deps in one shot
npm run dev           # Start both Backend (8000) and Frontend (5173) simultaneously
```

### Frontend (in `frontend/`)
```bash
npm run dev       # Start Vite dev server only
npm run build     # Production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

### Backend (repo root)
```bash
uvicorn backend.api:app --reload --port 8000   # Start FastAPI dev server only
pip install -r backend/requirements.txt        # Install Python deps
```

Backend requires `ANTHROPIC_API_KEY` in a `.env` file at repo root for the AI quiz endpoint.

No test framework is configured yet.

## Architecture

```
frontend/src/
  App.jsx                         Route between LandingPage, MapView, and QuizPage
  LandingPage.jsx                 Scenario selection with Grid/Map toggle, ember animation
  MapView.jsx                     Full-screen Leaflet map, satellite, canvas layers, UI overlays
  ScenarioMapView.jsx             QLD overview map with all 6 scenario pins + popup cards
  components/
    ControlLineOverlay.jsx        Canvas preview for pending control lines (start → cursor)
    MapClickHandler.jsx           Handles tool interactions (click/drag) and cell rasterisation
    Mascot.jsx                    Interactive character with speech bubbles and intro sequences
    MascotBubble.jsx              Simple speech bubble component for static messages
    QuizPage.jsx                  10-question educational quiz with mascot feedback
    ToolPalette.jsx               Floating bottom bar for suppression tools (Water, Control, etc.)
  hooks/
    useMascot.js                  Mascot state management, intro sequences, random dialogue
    useSimulation.js              WebSocket (or MockWebSocket) state management
  services/
    MockWebSocket.js              Client-side Alexandridis CA simulation (production-ready)
  layers/
    BaseCanvasLayer.js            L.Layer subclass with rAF render loop
    FireCanvasLayer.js            Fire cells + ember particle system
    VegetationCanvasLayer.js      Vegetation overlay with hover tooltips
    ElevationCanvasLayer.js       Elevation/topo overlay
    WindCanvasLayer.js            Wind direction/speed visualisation
  data/
    quiz-questions.js             Pool of wildfire educational questions and facts
    scenarios.js                  6 QLD scenarios with coords, images, risk levels, dialogue
    vegetation-mapping.js         24 vegetation types across 4 classification groups
  utils/
    geo.js                        Lat/lng bounds from center + radius in km, cell conversion
backend/
  api.py                          FastAPI app — WebSocket stream + REST routes for simulation
  simulator.py                    Core GridFireSimulation engine (Alexandridis CA)
  simulator_helper.py             Frame builders (build_init_frame / build_tick_frame) + zlib+base64 encoding
  requirements.txt                Python dependencies (numpy, pandas, rasterio, etc.)
  data_processing/
    fuel_processing.py            TIF-based flammability mapping
    elevation_processing.py       SRTM-based elevation extraction
    output_data/                  Cached CSVs + .npy arrays per scenario (veg_grid, flammability, elevation)
  abs_states/                     Australian state boundary shapefiles
  routers/                        API router stubs (users.py)
  services/
    ai_quiz.py                    /education/quiz endpoint — generates quiz via Anthropic API
docs/superpowers/                 Implementation plans and design specs
frontend/design_assets/           UI mockups, design system, fire-viz comparison
```

## Scenarios (all Queensland)

| Name | Year | Area | Risk |
|------|------|------|------|
| D'Aguilar | 2023 | 22,000 ha | High |
| Lamington | 2019 | 6,000 ha | High |
| Glass House Mountains | 2019 | 28,000 ha | Extreme |
| Bunya Mountains | 2019 | 12,000 ha | High |
| Girraween | 2019 | 36,000 ha | Catastrophic |
| Eungella | 2018 | 9,000 ha | Extreme |

## What Is Implemented

**Landing page (`LandingPage.jsx`)**
- Animated ember background (55 particles, CSS keyframes: rise + sway)
- Scenario card grid (3×2)
- Grid/Map view toggle — switches between card grid and `ScenarioMapView`

**Scenario map view (`ScenarioMapView.jsx`)**
- CartoDB Dark Matter base tiles
- Custom orange fire pins with glow shadows for all 6 scenarios
- Popup cards with scenario image, risk badge, Launch button
- Leaflet popup chrome stripped via CSS overrides

**Simulation map (`MapView.jsx`)**
- Satellite imagery (Esri/Maxar), bounds locked to 10×10km
- Togglable layer registry (`LAYER_DEFS`) — Fire and Foliage layers
- FlyToScenario animation (1.5s)
- Wind compass + speed slider (0–100 km/h)
- Live stats panel (burning cells, burned ha, tick, score)
- Pause/resume, visual effects toggle
- **Mascot Integration:** Intro sequences and triggered dialogue per scenario
- **Tool Palette:** Sidebar for arming suppression tools

**Interactive Tools (`ToolPalette.jsx` / `MapClickHandler.jsx`)**
- **Water Drop:** 5×5 circular suppression (radius 3), 3s cooldown
- **Control Line:** Two-click placement, max 30 cells, 10s cooldown. Includes `ControlLineOverlay` for canvas preview during placement.
- **Backburn/Evac:** UI stubs in palette (locked/coming soon).

**Mascot & Education (`Mascot.jsx` / `QuizPage.jsx`)**
- **Intro Sequences:** Animated intro dialogue on scenario launch.
- **Dynamic Dialogue:** Random "General", "Success", or "Failure" messages based on simulation state.
- **Wildfire Quiz:** 10-question randomized quiz with facts and performance badges.

**Canvas layers**
- `BaseCanvasLayer.js` — rAF loop, resize handling, proper cleanup
- `FireCanvasLayer.js` — cell state colours, shadow glow (ctx.shadowBlur), burn-age colour fade (orange → deep red), ember particle system (max 600, wind-drifted, size/opacity decay)
- `VegetationCanvasLayer.js` — 35% transparent overlay, type-specific colours, hover tooltips showing type + name, group filter

**Client-side simulation (`MockWebSocket.js`)**
- Alexandridis cellular automata, 1000×1000 grid (10m cells = 10×10km)
- Procedural Voronoi vegetation generation (24 types)
- Wind-biased spread (dot product, 2.5× max multiplier)
- Base ignition prob: 0.16, burn duration: 14 ticks (~7s)
- Interactive tools: water drops, control lines, backburns
- Emits `FULL_SYNC` / `TICK_UPDATE` message format — ready for FastAPI backend
- Pause/resume support

**`useSimulation.js` hook**
- `gridRef` — `Map<"x,y", state>` (never in React state)
- `burnAgeRef` — `Map<"x,y", number>`
- Stats: burning, burned, burnedHa, score, tick, wind
- Methods: pause/resume, setWind, interact (tool + GPS coords)

**Backend Simulation Engine (`backend/simulator.py`)**
- Functional `GridFireSimulation` class with Alexandridis CA model.
- Integration with local data processing for real fuel and elevation data.
- Synchronised coordinate transformation (EPSG:3577) to map lat/lon data onto an accurate metric grid using scipy `griddata`.
- Matplotlib-based local visualization for debugging.

**FastAPI Backend (`backend/api.py`)**
- WebSocket endpoint `/ws/simulation/stream` — streams `init` + `tick` frames; supports `pause`/`resume`/`set_interval` commands
- REST: `POST /simulation/start`, `POST /simulation/step`, `GET /simulation/state`, `GET /simulation/grid`
- `POST /simulation/interact` and `PATCH /simulation/env` routes exist but are not yet implemented
- Global `_sim` + `_sim_lock` — single simulation instance per server process

**AI Quiz (`backend/services/ai_quiz.py`)**
- `POST /education/quiz` — calls Anthropic API to generate a year-group-tailored bushfire safety quiz
- Requires `ANTHROPIC_API_KEY` in environment (loaded via `dotenv`)

**Data Processing Pipeline (`backend/data_processing/`)**
- Fuel and elevation processing from raw GIS data (TIF/DEM) to simulation-ready CSVs and `.npy` arrays.
- Pre-processed `.npy` arrays exist per scenario in `output_data/` (`_veg_grid`, `_flammability`, `_elevation`).
- Accurate cropping and reprojection using source CRS and bounding box intersections.
- Automated downloading of Australian state boundaries (ABS).

## What Is Not Yet Implemented

- Frontend WebSocket swap (frontend still uses `MockWebSocket`; backend WS endpoint exists but is not wired up)
- `POST /simulation/interact` and `PATCH /simulation/env` — routes exist but return empty responses
- SQLite storage (scenarios table, leaderboard)
- Atmospheric sliders (temp 0–50°C, humidity 0–100%) — wind only is live
- Leaderboard screen

## Simulation Model (Alexandridis CA)

- Cell states: `0` Unburned · `1` Burning · `2` Burned · `3` Control Line · `4` Watered
- Ignition: `P_burn = P₀ · (1 + P_veg) · (1 + P_den) · P_w · P_s` where `P₀ = 0.58` (mock uses 0.16)
- Wind factor: `P_w = exp(V · [0.045 + 0.131·(cos(θ)−1)])`
- Slope factor: `P_s = exp(0.078 · slope_angle)`
- Moisture threshold: spread stops if fuel moisture > 25%

## WebSocket Protocol

Frames are JSON. Binary arrays (`state`, `elevation`, `flammability`) are `zlib+base64`-encoded flat arrays.

- `init` — sent on connect: `grid_size`, `cell_res_m`, `origin_lon/lat`, metric bounds (`x_min/max`, `y_min/max`), `wind_speed/dir`, compressed `state`/`elevation`/`flammability`
- `tick` — sent every tick: full compressed `state`, counts (`burning_count`, `burned_count`, `watered_count`, `control_count`), `burned_pct`, `active_fire`, `sim_time_s`

Client commands (JSON over WebSocket): `{"cmd": "pause"}`, `{"cmd": "resume"}`, `{"cmd": "set_interval", "ms": 200}`

Decoding: `pako.inflate(atob(encoded))` → typed array (`Int8Array` for state, `Float32Array` for elevation/flammability).

## Implemented API Endpoints

| Method | Path | Status |
|--------|------|--------|
| WS | `/ws/simulation/stream` | Live |
| POST | `/simulation/start` | Live |
| POST | `/simulation/step` | Live |
| GET | `/simulation/state` | Live |
| GET | `/simulation/grid` | Live |
| POST | `/simulation/interact` | Stub (no-op) |
| PATCH | `/simulation/env` | Stub (no-op) |
| POST | `/education/quiz` | Live (needs `ANTHROPIC_API_KEY`) |
| GET | `/api/leaderboard` | Not started |
| GET | `/api/scenarios` | Not started |

## Planned SQLite Schema

```sql
CREATE TABLE scenarios (id, name, center_lat, center_lng, initial_fire BLOB, fuel_map BLOB);
CREATE TABLE results   (id, team_name, scenario_id, score, ha_burned REAL, timestamp);
```

## Tech Stack

- **Frontend:** React 18.2, react-leaflet 4.2.1, Vite 8.0.8, Tailwind CSS v4.2.2, Lucide icons
- **Backend:** FastAPI, NumPy, SQLite (raw sqlite3, no ORM), Uvicorn
- **No TypeScript** — pure JSX throughout

## Design System

`frontend/design_assets/design-system.md` — "Tactical Sentinel" dark theme, glassmorphism panels, Manrope + Inter fonts, orange/navy palette.

Reference files:
- `fire-viz-comparison.html` — side-by-side comparison of 4 fire rendering approaches (Option 1 chosen and implemented)
- `foliage-colors.html` — vegetation colour palette
- `wind-viz-options.html` — wind visualisation mockups
- `dashboard-mockup.html/.png` — full UI mockup with left sidebar (sliders, tool palette), map, stats panel

## Dashboard UI (planned)

- **Left sidebar:** atmospheric sliders (temp 0–50°C, wind 0–100 km/h, humidity 0–100%), tool palette (Water Drop, Control Line, Backburn, Evac Zone), real-time stats
- **Map:** full-screen satellite view with Canvas fire overlay; clicking with an armed tool sends GPS coords to backend
