# backend/api.py
from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import numpy as np
import threading
import asyncio
import json
from simulator_helper import build_init_frame, build_tick_frame
from simulator import GridFireSimulation
from services.ai_quiz import education_router

app = FastAPI(title="Bushfire Simulation API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
simulation_router = APIRouter(prefix="/simulation", tags=["simulation"])

# ── Global simulation state ────────────────────────────────────────────────────
_sim:      Optional[GridFireSimulation] = None
_sim_lock  = threading.Lock()
_tick:     int  = 0
_started:  bool = False   # True once POST /simulation/start is called


# ── Scenario metadata (mirrors frontend scenarios.js) ─────────────────────────
SCENARIO_PRESETS = {
    "daguilar":              {"lon": 152.8196, "lat": -27.291,  "wind_speed": 10.0, "wind_dir": 45.0},
    "lamington":             {"lon": 153.1196, "lat": -28.231,  "wind_speed": 12.0, "wind_dir": 90.0},
    "glass-house-mountains": {"lon": 152.957,  "lat": -26.883,  "wind_speed": 15.0, "wind_dir": 315.0},
    "bunya-mountains":       {"lon": 151.573,  "lat": -26.871,  "wind_speed": 10.0, "wind_dir": 270.0},
    "girraween":             {"lon": 151.945,  "lat": -28.889,  "wind_speed": 14.0, "wind_dir": 0.0},
    "eungella":              {"lon": 148.491,  "lat": -21.132,  "wind_speed": 8.0,  "wind_dir": 180.0},
}


# ── Request / Response models ──────────────────────────────────────────────────
class CreateRequest(BaseModel):
    scenario_id: str = "daguilar"

class CreateResponse(BaseModel):
    status:      str
    scenario_id: str
    grid_size:   int
    cell_res_m:  float


def _require_sim() -> GridFireSimulation:
    if _sim is None:
        raise HTTPException(status_code=400, detail="No simulation. POST /simulation/create first.")
    return _sim


# ── REST routes ────────────────────────────────────────────────────────────────

@simulation_router.post("/create", response_model=CreateResponse)
async def create_simulation(body: CreateRequest):
    """Initialise a new simulation for the given scenario. Takes ~2s with .npy cache."""
    global _sim, _tick, _started

    preset = SCENARIO_PRESETS.get(body.scenario_id)
    if preset is None:
        raise HTTPException(status_code=404, detail=f"Unknown scenario_id: {body.scenario_id!r}")

    def _init():
        return GridFireSimulation(
            scenario_id = body.scenario_id,
            origin_lon  = preset["lon"],
            origin_lat  = preset["lat"],
            wind_speed  = preset["wind_speed"],
            wind_dir    = preset["wind_dir"],
        )

    loop = asyncio.get_running_loop()
    try:
        sim = await asyncio.wait_for(
            loop.run_in_executor(None, _init),
            timeout=120.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Simulation init timed out.")

    with _sim_lock:
        _sim      = sim
        _tick     = 0
        _started  = False

    return CreateResponse(
        status      = "ready",
        scenario_id = body.scenario_id,
        grid_size   = sim.size,
        cell_res_m  = sim.cell_res_m,
    )


@simulation_router.post("/start")
async def start_simulation():
    """Begin ticking the simulation (called after WS is connected and init frame received)."""
    global _started
    _require_sim()
    _started = True
    return {"status": "started"}


@simulation_router.get("/state")
def get_state():
    sim = _require_sim()
    total   = sim.size * sim.size
    burned  = int(np.sum(sim.state == 2))
    burning = int(np.sum(sim.state == 1))
    return {
        "tick":        _tick,
        "started":     _started,
        "grid_size":   sim.size,
        "wind_speed":  sim.wind_speed,
        "wind_dir":    sim.wind_dir,
        "burning":     burning,
        "burned":      burned,
        "burned_ha":   round(burned * (sim.cell_res_m ** 2) / 10_000, 2),
        "active_fire": burning > 0,
    }


# ── WebSocket stream ───────────────────────────────────────────────────────────

@app.websocket("/ws/simulation/stream")
async def stream_simulation(websocket: WebSocket, tick_interval_ms: int = 200):
    global _tick, _started

    if _sim is None:
        await websocket.accept()
        await websocket.send_json({"error": "No simulation. POST /simulation/create first."})
        await websocket.close()
        return

    await websocket.accept()
    sim      = _sim
    paused   = False
    interval = tick_interval_ms / 1000.0

    # Send init frame
    await websocket.send_json(build_init_frame(sim, sim.scenario_id))

    try:
        while True:
            # ── Receive client command (non-blocking) ──────────────────────────
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=0.01)
                msg = json.loads(raw)
                cmd = msg.get("cmd")

                if cmd == "pause":
                    paused = True

                elif cmd == "resume":
                    paused = False

                elif cmd == "set_interval":
                    interval = max(0.05, msg.get("ms", interval * 1000) / 1000.0)

                elif cmd == "set_wind":
                    with _sim_lock:
                        sim.wind_speed = float(msg.get("speed", sim.wind_speed))
                        sim.wind_dir   = float(msg.get("dir",   sim.wind_dir))

                elif cmd == "interact":
                    tool = msg.get("tool")
                    with _sim_lock:
                        # Frontend uses screen coords (y=0=north); flip to grid coords (y=0=south)
                        sz = sim.size
                        if tool == "water":
                            y_grid = sz - 1 - int(msg["y"])
                            sim.add_water_drop(int(msg["x"]), y_grid)
                        elif tool == "control_line":
                            cells = [{"x": int(c["x"]), "y": sz - 1 - int(c["y"])} for c in msg.get("cells", [])]
                            sim.add_control_line(cells)
                        elif tool == "backburn":
                            y_grid = sz - 1 - int(msg["y"])
                            sim.add_backburn(int(msg["x"]), y_grid)

            except asyncio.TimeoutError:
                pass

            # ── Tick ──────────────────────────────────────────────────────────
            if not _started or paused:
                await asyncio.sleep(0.05)
                continue

            loop = asyncio.get_running_loop()
            with _sim_lock:
                changes = await loop.run_in_executor(None, sim.step)
                _tick += 1

            frame = build_tick_frame(sim, _tick, changes)
            await websocket.send_json(frame)
            await asyncio.sleep(interval)

    except WebSocketDisconnect:
        pass


app.include_router(simulation_router)
app.include_router(education_router)
