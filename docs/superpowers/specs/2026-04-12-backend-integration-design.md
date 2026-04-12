# Backend Integration Design
**Date:** 2026-04-12  
**Status:** Approved

## Overview

Connect the FastAPI backend (`backend/api.py` + `backend/simulator.py`) to the React frontend, replacing the in-browser `MockWebSocket` with a real WebSocket to the Python simulation engine. The frontend simulation protocol (FULL_SYNC / TICK_UPDATE messages) is preserved exactly — the swap is transparent to all canvas layers, the mascot, and the tool palette.

---

## 1. Pre-processing Script

### Purpose
Run once (manually or in CI) before starting the server. Produces cached NumPy arrays for all 6 scenarios so the server starts in under a second.

### Script: `backend/preprocess_scenarios.py`
- Iterates all 6 scenarios defined in a `SCENARIOS` dict (id → lat, lon)
- For each scenario calls `process_fuel(lon, lat, size_m=10000)` and `process_elevation(lon, lat, size_m=10000)`
- Reprojects both datasets to EPSG:3577, interpolates onto a **1000×1000 grid at 10m/cell** using `scipy.griddata`
- Maps the 35 BFC fuel type codes to frontend vegetation IDs 1–24 (see mapping table below)
- Saves three `.npy` files per scenario into `backend/data_processing/output_data/`:
  - `{scenario_id}_flammability.npy` — float32 (1000, 1000)
  - `{scenario_id}_elevation.npy` — float32 (1000, 1000)
  - `{scenario_id}_veg_grid.npy` — uint8 (1000, 1000), IDs 0–24

### BFC code → frontend veg ID mapping
| BFC code(s) | Frontend ID | Label |
|---|---|---|
| 110 | 3 | Tall closed forest |
| 120 | 6 | Closed forest |
| 210 | 2 | Tall open forest |
| 220 | 5 | Open forest |
| 230 | 8 | Low open forest |
| 310, 321–324, 330 | 21 | Plantation |
| 411 | 1 | Tall woodland |
| 421–424 | 4 | Woodland |
| 431–434 | 7 | Low woodland |
| 510 | 9 | Tall shrubland |
| 520 | 11 | Shrubland |
| 531–533 | 10 | Open shrubland |
| 610 | 17 | Sedgeland |
| 620 | 13 | Hummock grassland |
| 631 | 12 | Grassland |
| 632 | 15 | Open grassland |
| 633 | 14 | Sparse grassland |
| 640 | 16 | Croplands |
| 700 | 22 | Horticulture |
| 800 | 19 | Wetland |
| 910 | 23 | Permanent water |
| 920–940 | 20 | Built-up (wildland-urban) |
| 950 | 20 | Built-up |
| 960 | 18 | Bare ground |

Water bodies (BFC 910, veg ID 23) are also initialised as cell state 3 (permanent barrier) in the simulator.

---

## 2. Simulator Changes (`backend/simulator.py`)

### Grid alignment
Fixed at **1000×1000 cells, 10m/cell** (`cell_res_m=10`, `size_m=10000`) to match the frontend exactly.

### Constructor — pre-loaded path
The constructor gains an alternate code path: when `flammability`, `elevation`, and `veg_grid` NumPy arrays are passed in directly, all GIS processing is skipped. The CLI/matplotlib path (passing only `origin_lon`, `origin_lat`) continues to work unchanged.

### `step()` — return sparse changes
Currently returns `[]`. Modified to return a list of `(x, y, new_state)` tuples for every cell whose state changed this tick. The WebSocket handler serialises these as `[{"x":…,"y":…,"s":…}]`.

### `set_wind(dir, spd)` — new method
Updates `wind_dir` and `wind_speed` mid-simulation (same semantics as `MockWebSocket.setWind`).

### Ignition
Keeps the existing smart-center logic (ignites at grid center, or nearest flammable cell if center is water/bare). Historical ignition points per scenario are not implemented in this integration.

---

## 3. WebSocket Endpoint (`backend/api.py`)

### Endpoint
```
WS /ws/simulation/{scenario_id}
```

### Startup
- `SCENARIO_CACHE: dict[str, dict]` populated at application startup by loading all `.npy` files with `np.load()`.
- If a scenario's files are missing it is logged and that scenario is excluded from the cache.

### Connection lifecycle
1. Client connects → look up `SCENARIO_CACHE[scenario_id]` → instantiate `GridFireSimulation` from cached arrays
2. Serialise initial state → send `FULL_SYNC`
3. Spawn async background task running tick loop at 500ms intervals
4. Loop: receive client messages → dispatch to simulation; send `TICK_UPDATE` per tick
5. Disconnect → cancel tick task, discard instance

### Client → server messages (unchanged from mock protocol)
| Message | Action |
|---|---|
| `{"action":"start"}` | Seed fire at ignition point |
| `{"action":"pause"}` | Pause tick loop |
| `{"action":"resume"}` | Resume tick loop |
| `{"action":"setWind","dir":…,"spd":…}` | Update wind live |
| `{"tool":"water","x":…,"y":…}` | Apply water drop |
| `{"tool":"control_line","cells":[…]}` | Draw control line |

### Server → client messages (unchanged from mock protocol)
**FULL_SYNC** (sent once on connect):
```json
{
  "type": "FULL_SYNC",
  "gridSize": 1000,
  "grid": [{"x":…,"y":…,"s":…}],
  "vegetationGrid": [0,5,2,…],
  "stats": {"burning":0,"burned":0,"burnedHa":0,"score":100,"tick":0,"windDir":45,"windSpd":30}
}
```

**TICK_UPDATE** (sent every 500ms):
```json
{
  "type": "TICK_UPDATE",
  "changes": [{"x":…,"y":…,"s":…}],
  "stats": {…}
}
```

`vegetationGrid` is a flat list of 1,000,000 uint8 values matching the shape `VegetationCanvasLayer` already expects.

### Threading model
The numpy simulation step is CPU-bound. Each tick runs via `asyncio.to_thread(sim.step)` so the FastAPI event loop is never blocked.

---

## 4. Frontend Changes

### `frontend/src/hooks/useSimulation.js`
Two targeted changes only:

1. **Replace MockWebSocket** with native `WebSocket`:
   ```js
   // Before
   const ws = new MockWebSocket(scenario);
   // After
   const ws = new WebSocket(`ws://localhost:8000/ws/simulation/${scenario.id}`);
   ```

2. **Replace direct `setWind` method call** with a send:
   ```js
   // Before
   wsRef.current?.setWind(dir, spd);
   // After
   wsRef.current?.send(JSON.stringify({ action: 'setWind', dir, spd }));
   ```

### `frontend/src/MapView.jsx`
Add a loading overlay shown while `status === 'connecting'`. The backend serialises 1M-cell grid + veg array on first connect; this takes up to ~500ms. Without the overlay the canvas appears blank briefly.

### Everything else — unchanged
`FireCanvasLayer`, `VegetationCanvasLayer`, `ToolPalette`, `Mascot`, `QuizPage`, stats panel — all consume the same message protocol and require no changes.

---

## 5. Error Handling

| Scenario | Behaviour |
|---|---|
| Scenario ID not in cache | WebSocket closes with code 4004; frontend logs warning |
| `.npy` files missing at startup | That scenario skipped; others work normally |
| Client disconnects during tick | Tick task cancelled cleanly; no leaked threads |
| Malformed client message | Silently ignored (same as mock) |
| `setWind` out of range | Clamped: dir mod 360, spd 0–100 |

---

## 6. What Is Not In Scope

- SQLite leaderboard / scenario table
- Atmospheric sliders (temp, humidity) — wind only
- Backburn tool backend effects (UI stub remains locked)
- AI quiz generation
- Historical scenario-specific ignition points
- Multi-player / shared simulation state
