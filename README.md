# 🔥 ProjectPyro

> *"Play with fire. Safely."*

** Best Community Project — QUT AIML Hackathon 2025 (18 teams)**

ProjectPyro is a real-time wildfire simulation and interactive firefighting 
experience built to grow environmental literacy in young people. Users select 
a real Queensland wildfire scenario, then deploy suppression tactics (water 
drops, control lines, and backburns) against a live fire simulation.

## How It Works

### Simulation Engine — Alexandridis Cellular Automata

The core of ProjectPyro is a 1000×1000 grid cellular automata model (each cell 
= 10x10m, covering a 10×10km area) based on the Alexandridis CA fire spread model.

Each cell has one of five states:

| State | Value | Description |
|-------|-------|-------------|
| Unburned | 0 | Unaffected vegetation |
| Burning | 1 | Actively burning |
| Burned | 2 | Fully consumed |
| Control Line | 3 | Manual firebreak |
| Watered | 4 | Suppressed by water drop |

**Ignition probability** per tick is calculated as:
P_burn = P₀ · (1 + P_veg) · (1 + P_den) · P_w · P_s

Where:
- `P₀ = 0.58` — base ignition probability
- `P_veg`, `P_den` — vegetation type and density factors
- `P_w = exp(V · [0.045 + 0.131·(cos(θ)−1)])` — wind factor
- `P_s = exp(0.078 · slope_angle)` — slope factor
- Spread stops when fuel moisture exceeds 25%

### Real Geographic Data

Simulations are anchored to real Queensland locations using two authoritative 
data sources:

- **Fuel Data:** CSIRO/NBIC Vegetation Fuel Classification (24 vegetation types 
  across 4 groups)
- **Elevation Data:** Geoscience Australia SRTM 3-Second DEM

Raw GIS data (.TIF) is preprocessed into `.npy` arrays per scenario using 
coordinate reprojection and scipy `griddata` interpolation for 
accurate metric grid alignment.

### Scenarios (all Queensland)

| Scenario | Year | Area | Risk Level |
|----------|------|------|------------|
| D'Aguilar | 2023 | 22,000 ha | High |
| Lamington | 2019 | 6,000 ha | High |
| Glass House Mountains | 2019 | 28,000 ha | Extreme |
| Bunya Mountains | 2019 | 12,000 ha | High |
| Girraween | 2019 | 36,000 ha | Catastrophic |
| Eungella | 2018 | 9,000 ha | Extreme |

### Real-Time Streaming via WebSocket

Wildfire state is streamed live from the FastAPI backend to the React frontend 
over WebSocket. Frames are zlib-compressed and base64-encoded for efficient 
binary transport:

- `init` frame (sent on connect): grid dimensions, cell resolution, origin 
  coordinates, wind state, and compressed initial state/elevation/flammability arrays
- `tick` frame (sent every tick): compressed cell state, live counts 
  (burning, burned, watered, control), burn percentage, and simulation time

### Canvas Rendering

Fire state is rendered on a Leaflet canvas layer using a `requestAnimationFrame` 
loop, with:

- Cell colour mapped to burn state and age (orange → deep red fade)
- Shadow glow (`ctx.shadowBlur`) for burning cells
- Wind-drifted ember particle system (up to 600 particles, with size/opacity decay)
- Togglable vegetation and elevation overlays with hover tooltips

## Tech Stack

**Frontend:** React 18, react-leaflet, Vite, Tailwind CSS v4
**Backend:** Python, FastAPI, NumPy, Uvicorn
**Data:** rasterio, scipy, CSIRO fuel TIF, Geoscience Australia SRTM DEM
**Transport:** WebSocket (zlib + base64 binary frames)
**AI:** Anthropic API (educational quiz generation)


## API Endpoints

| Method | Path | Status |
|--------|------|--------|
| WS | `/ws/simulation/stream` | Live |
| POST | `/simulation/start` | Live |
| POST | `/simulation/step` | Live |
| GET | `/simulation/state` | Live |
| GET | `/simulation/grid` | Live |
| POST | `/simulation/interact` | In progress |
| PATCH | `/simulation/env` | In progress |
| POST | `/education/quiz` | Live |

## Getting Started

### Prerequisites

- Node.js and npm
- Python 3.10+
- `ANTHROPIC_API_KEY` in a `.env` file at repo root (for quiz endpoint)
- GIS data files manually placed in `backend/data_processing/input_data/` 
  (see Data Setup below)

### Install and Run

```bash
# Install all dependencies (frontend + backend)
npm run install:all

# Start both servers simultaneously
npm run dev
# Frontend → http://localhost:5173
# Backend  → http://localhost:8000
```

### Data Setup

The simulation requires large GIS files not tracked in git. Place these manually:

1. **Fuel data:** `Bushfire fuel classification fuel types map release 2.tif`
   — [CSIRO/NBIC Vegetation Fuel Data](https://research.csiro.au/nbic/home/data/veg-fuel/)

2. **Elevation data:** `3secSRTM_DEM/` directory
   — [Geoscience Australia SRTM 3 Second DEM](https://dev.ecat.ga.gov.au/geonetwork/)

Then preprocess into cached `.npy` arrays:

```bash
cd backend
python -m data_processing.preprocess_scenarios
```

## Team

Built in 24 hours at the QUT AIML Hackathon 2026.

Theo Dela Cruz, Adyn Sydee, Derek Yeung, Emmanuel Go, Farzad Hayat

Thanks to sponsor **NTI**.