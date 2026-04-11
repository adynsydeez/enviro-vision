# Palan-Tir of Fire: Wildfire Simulation Training Platform

## 1. Problem Statement
Wildfire spread is rapid and unpredictable, making real-world training for firefighters dangerous and expensive. This platform provides a low-risk, high-fidelity environment to train for wildfire spread scenarios across Australia using simulated data.

## 2. Goals
- **Simulation Engine:** A Python/NumPy-based cellular automata model that calculates fire spread in real-time.
- **Interactive Dashboard:** A React-based UI for visualizing fire spread on a map and interacting with simulation variables.
- **Dynamic Inputs:** Sliders for temperature, humidity, wind speed, and wind direction.
- **Tactical Tools:** Mitigation tools like Water Drops, Control Lines, and Backburns to halt fire spread.
- **Training Metrics:** Real-time stats on hectares burned, structures saved, and overall containment score.

## 3. High-Level Architecture
The platform uses a client-server architecture optimized for low-latency simulation updates:

- **Frontend (React + Leaflet):**
    - **`react-leaflet`**: Renders the base map layers.
    - **HTML5 `<Canvas>` Layer**: A custom overlay that renders the fire grid as glowing particles.
    - **WebSocket Client**: Receives the real-time "Fire Matrix" from the backend.
- **Backend (FastAPI + Python):**
    - **Simulation Engine**: A Python class managing a 2D NumPy array for the fire grid.
    - **WebSocket Server**: Broadcasters the compressed fire state (active fire cell coordinates) to the frontend every 500ms.
    - **REST API**: Handles scenario initialization, resets, and user authentication.

## 4. Simulation Engine (The Grid & Math)
The simulation is a **State-Based Cellular Automata (CA)** model running on a 100x100 grid (extensible to 500x500).

### 4.1. Cell States
- `0`: Unburned (Full fuel)
- `1`: Burning (Active fire source)
- `2`: Burned (Zero fuel, inactive)
- `3`: Control Line (Permanent barrier)
- `4`: Watered (Temporary resistance)

### 4.2. Transition Rules (Alexandridis CA Model)
Each **Unburned** cell calculates its probability of ignition ($P_{burn}$) in every simulation tick:
- $P_{burn} = P_0 \cdot (1 + P_{veg}) \cdot (1 + P_{den}) \cdot P_w \cdot P_s$
- **Constants**:
    - $P_0 = 0.58$: Base ignition probability.
    - $P_{veg}$: Vegetation factor (e.g., Pine Forest: 0.4).
    - $P_w = \exp(V_{mid} \cdot [0.045 + 0.131 \cdot (\cos(\theta) - 1)])$: Wind factor based on midflame speed $V_{mid}$ and angle $\theta$.
- **Moisture Threshold**: If Fuel Moisture (calculated from Temp/Humidity) $> 25\%$, spread stops.

## 5. UI Layout & User Experience
The dashboard is designed for rapid tactical decision-making:

- **Sidebar (Left):**
    - **Atmospheric Sliders**: Real-time control of Temp (0-50°C), Wind (0-100 km/h), and Humidity (0-100%).
    - **Tool Palette**: Icons for Water Drop, Control Line, Backburn, and Evac Zone.
    - **Post-Incident Report**: Real-time stats on fire impact.
- **Map (Right):**
    - A full-screen interactive map with a glowing, flickering fire overlay rendered on a canvas.
    - **Interactivity**: Clicking on the map with an "armed" tool sends the GPS coordinates to the backend to apply mitigation effects.

## 6. API Specification & Data Model

### 6.1. REST API (FastAPI)
- `GET /api/scenarios`: List pre-defined maps (e.g., D'Aguilar, Blue Mountains).
- `POST /api/simulation/start?scenario_id={id}`: Reset and initialize a global simulation session.
- `PATCH /api/simulation/env`: Update environmental factors (Temp, Wind, Humidity).
- `POST /api/simulation/interact`: Apply a tool (Water Drop, etc.) to GPS coordinates.
- `GET /api/leaderboard`: Top 10 historical scores for the pitch presentation.

### 6.2. WebSocket Protocol (`/ws/simulation`)
- **TICK_UPDATE**: Sparse matrix update sending only cells that changed state.
- **FULL_SYNC**: Sent on connection or reset to sync the entire current state.

### 6.3. Database Schema (SQLite)
- **Table: `scenarios`**: `id`, `name`, `center_lat`, `center_lng`, `initial_fire`, `fuel_map`.
- **Table: `results`**: `id`, `team_name`, `scenario_id`, `score`, `ha_burned`, `timestamp`.

## 7. Team Roles & Milestones

### 7.1. Team Roles (5 People)
- **Role 1 (Sim Engine - BE)**: NumPy fire spread logic and the core tick-loop.
- **Role 2 (API/WS - BE)**: FastAPI server, WebSocket broadcaster, and Tool event handlers.
- **Role 3 (Map/Canvas - FE)**: Leaflet integration and Canvas fire rendering (Glow/Particles).
- **Role 4 (UI/Dash - FE)**: Sliders, Tool selection logic, sidebar, and real-time stats.
- **Role 5 (Data/Pitch - Integration)**: Scenario data, UI polishing, and final pitch presentation.

### 7.2. Hackathon Milestones
- **Hours 0-4**: Scaffolding (FastAPI <-> React WebSocket link working).
- **Hours 4-12**: MVP Simulation (Fire spreads on a static grid in the browser).
- **Hours 12-24**: Interactivity (Sliders update $P_{burn}$ and Water Drops work).
- **Hours 24-36**: Polishing (Glow effects, real map locations, stats dashboard).
- **Hours 36-48**: Pitch & Presentation preparation.

## 8. Technical Stack
- **Frontend**: React, Leaflet.js, Lucide Icons, Tailwind CSS.
- **Backend**: Python 3.10+, FastAPI, NumPy, Uvicorn, SQLite.
- **Communication**: WebSockets (for the simulation stream).

## 9. Success Criteria
- **Sim performance**: <100ms calculation time per tick for a 100x100 grid.
- **UI Responsiveness**: Fire visuals update smoothly in sync with backend ticks.
- **Training Validity**: Fire spread follows intuitive physical patterns.
