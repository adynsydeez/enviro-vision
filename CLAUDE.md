# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**FireCommander** — a wildfire simulation training platform for firefighters. Users practice suppression strategies (control lines, water drops, backburns) on realistic Australian terrain scenarios. See `PLAN.md` for the full technical specification.

## Commands

### Frontend (in `frontend/`)
```bash
npm run dev       # Start Vite dev server with HMR
npm run build     # Production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

### Backend (repo root)
```bash
uvicorn api:app --reload --port 8000   # Start FastAPI dev server
```

No test framework is configured yet.

## Architecture

```
frontend/src/         React + Vite (JavaScript/JSX, no TypeScript)
api.py                FastAPI backend (currently a stub)
```

**Data flow:**
- Frontend connects to FastAPI via REST (`/api/scenarios`, `/api/simulation/*`) and WebSocket (`/ws/simulation`)
- Backend runs a NumPy cellular-automata simulation (Alexandridis model, 100×100 grid) and broadcasts sparse state updates every 500ms over WebSocket
- SQLite stores scenarios and leaderboard results

**Frontend map stack:** `react-leaflet` + ArcGIS satellite tile layer, centered on Australia (`[-27, 153]`). Fire state is rendered on a Canvas overlay on top of the Leaflet map.

**Simulation cell states:** `0` Unburned · `1` Burning · `2` Burned · `3` Control Line · `4` Watered

**WebSocket message types:** `FULL_SYNC` (initial state dump) and `TICK_UPDATE` (sparse changed cells).

## SQLite Schema (planned, not yet implemented)
```sql
CREATE TABLE scenarios (id, name, center_lat, center_lng, initial_fire BLOB, fuel_map BLOB);
CREATE TABLE results   (id, team_name, scenario_id, score, ha_burned REAL, timestamp);
```

## Tech Stack
- **Frontend:** React 18, react-leaflet 4, Vite 8, Tailwind CSS, Lucide icons
- **Backend:** FastAPI, NumPy, SQLite (no ORM, raw sqlite3)
- **No TypeScript** — pure JSX throughout
