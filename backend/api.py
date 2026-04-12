from fastapi import FastAPI, APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
import numpy as np
import threading
import asyncio
from simulator_helper import build_env_frame, build_init_frame, build_status_frame, build_tick_frame
from simulator import GridFireSimulation
from websocket import WebSocket, WebSocketDisconnect
import json

app = FastAPI(title="Bushfire Simulation API")
simulation_router = APIRouter(prefix="/simulation", tags=["simulation"])

# ── Global Simulation State 
_sim: Optional[GridFireSimulation] = None
_sim_lock = threading.Lock()
_tick: int = 0

# ── Request / Response Objects
class StartRequest(BaseModel):
    origin_lon:    float = Field(153.02, description="Origin longitude")
    origin_lat:    float = Field(-27.47, description="Origin latitude")
    size_m:        float = Field(5000.0, description="Grid side length in metres")
    wind_speed:    float = Field(10.0,   description="Wind speed in m/s")
    wind_dir:      float = Field(45.0,   description="Wind direction in degrees (0=N, 90=E)")
    cell_res_m:    float = Field(5.0,    description="Metres per grid cell")
    burn_duration: int   = Field(5,      description="Ticks a cell stays burning")

class StartResponse(BaseModel):
    scenario_id: int
    message:     str
    grid_size:   int
    cell_res_m:  float


class StepResponse(BaseModel):
    tick:    int
    changes: list
    burned_pct: float
    burning_pct: float
    active_fire: bool

class StateResponse(BaseModel):
    tick:        int
    grid_size:   int
    wind_speed:  float
    wind_dir:    float
    p_base_fire: float
    burned_pct:  float
    burning_pct: float
    active_fire: bool

def _require_sim() -> GridFireSimulation:
    if _sim is None:
        raise HTTPException(status_code=400, detail="No simulation running. POST /simulation/start first.")
    return _sim

def _summary(sim: GridFireSimulation, tick: int) -> dict:
    total = sim.size * sim.size
    burned  = int(np.sum(sim.state == 2))
    burning = int(np.sum(sim.state == 1))
    return {
        "tick":        tick,
        "burned_pct":  round(burned  / total * 100, 2),
        "burning_pct": round(burning / total * 100, 2),
        "active_fire": burning > 0,
    }

# ── Routes 

@simulation_router.post("/start", response_model=StartResponse)
async def start_simulation(scenario_id: int, body: StartRequest):
    """Reset and initialise a new simulation session."""
    global _sim, _tick

    def _init():
        return GridFireSimulation(
            origin_lon    = body.origin_lon,
            origin_lat    = body.origin_lat,
            size_m        = body.size_m,
            wind_speed    = body.wind_speed,
            wind_dir      = body.wind_dir,
            cell_res_m    = body.cell_res_m,
            burn_duration = body.burn_duration,
        )

    loop = asyncio.get_event_loop()
    try:
        sim = await asyncio.wait_for(
            loop.run_in_executor(None, _init),
            timeout=120.0       # 2 min ceiling for data download + interpolation
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Simulation init timed out — data download took too long.")

    with _sim_lock:
        _sim  = sim
        _tick = 0

    return StartResponse(
        scenario_id = scenario_id,
        message     = "Simulation initialised.",
        grid_size   = _sim.size,
        cell_res_m  = _sim.cell_res_m,
    )


@simulation_router.post("/step", response_model=StepResponse)
def step_simulation(steps: int = 1):
    """Advance the simulation by one or more ticks and return cell changes."""
    global _tick
    sim = _require_sim()

    with _sim_lock:
        all_changes = []
        for _ in range(steps):
            all_changes.extend(sim.step())
            _tick += 1

    return StepResponse(changes=all_changes, **_summary(sim, _tick))


@simulation_router.post("/interact")
def interact():
    """Apply an action (ignite / water) to a region of the grid."""
    return


@simulation_router.patch("/env")
def update_environment():
    """Live-update wind speed, wind direction, or base ignition probability."""
    return
    

@simulation_router.get("/state", response_model=StateResponse)
def get_state():
    """Return current simulation metadata and fire progress summary."""
    sim = _require_sim()
    return StateResponse(
        grid_size   = sim.size,
        wind_speed  = sim.wind_speed,
        wind_dir    = sim.wind_dir,
        p_base_fire = sim.p_base_fire,
        **_summary(sim, _tick),
    )


@simulation_router.get("/grid")
def get_grid():
    """Return the full grid state as a 2D list (use sparingly for large grids)."""
    sim = _require_sim()
    return {"tick": _tick, "grid": sim.state.tolist()}

@app.websocket("/ws/simulation/stream")
async def stream_simulation(
    websocket: WebSocket,
    scenario_id:      int = 0,
    tick_interval_ms: int = 200,
    max_ticks:        int = 500,
):
    global _tick

    if _sim is None:
        await websocket.accept()
        await websocket.send_json({"error": "No simulation running. POST /simulation/start first."})
        await websocket.close()
        return

    await websocket.accept()
    sim      = _sim
    paused   = False
    interval = tick_interval_ms / 1000.0

    # ── Init frame ────────────────────────────────────────────────────────────
    await websocket.send_json(build_init_frame(sim, scenario_id))

    try:
        while True:
            # ── Client commands ───────────────────────────────────────────────
            try:
                msg = json.loads(await asyncio.wait_for(websocket.receive_text(), timeout=0.01))
                cmd = msg.get("cmd")

                if cmd == "pause":
                    paused = True

                elif cmd == "resume":
                    paused = False

                elif cmd == "stop":
                    await websocket.send_json(build_status_frame(sim, _tick, "stopped", "Client requested stop"))
                    break

                elif cmd == "set_interval":
                    interval = max(0.05, msg.get("ms", interval * 1000) / 1000.0)

                # ── New: interaction commands now handled via WebSocket ────────
                # Replaces the need for separate REST calls mid-simulation,
                # keeping interaction and state in sync with the tick loop.
                elif cmd == "water_drop":
                    x, y   = msg["x"], msg["y"]
                    radius = msg.get("radius", 3)
                    with _sim_lock:
                        sim.add_water_drop(x, y, radius)
                    await websocket.send_json(build_interact_frame(sim, _tick, "water_drop"))

                elif cmd == "control_line":
                    x0, y0 = msg["x0"], msg["y0"]
                    x1, y1 = msg["x1"], msg["y1"]
                    thickness = msg.get("thickness", 2.4)
                    with _sim_lock:
                        sim.add_control_line(x0, y0, x1, y1, thickness)
                    await websocket.send_json(build_interact_frame(sim, _tick, "control_line"))

                elif cmd == "env":
                    with _sim_lock:
                        if "wind_speed" in msg: sim.wind_speed = msg["wind_speed"]
                        if "wind_dir"   in msg: sim.wind_dir   = msg["wind_dir"]
                    await websocket.send_json(build_env_frame(sim, _tick))

            except asyncio.TimeoutError:
                pass

            if paused:
                await asyncio.sleep(0.05)
                continue

            # ── Tick ──────────────────────────────────────────────────────────
            loop = asyncio.get_event_loop()
            with _sim_lock:
                await loop.run_in_executor(None, sim.step)  # step() returns [] so we discard it
                _tick += 1

            frame = build_tick_frame(sim, _tick)            # builder now diffs state internally
            await websocket.send_json(frame)

            if not frame["active_fire"]:
                await websocket.send_json(build_status_frame(sim, _tick, "complete", "Fire extinguished"))
                break

            if max_ticks > 0 and _tick >= max_ticks:
                await websocket.send_json(build_status_frame(sim, _tick, "max_ticks", f"Reached {max_ticks} tick limit"))
                break

            await asyncio.sleep(interval)

    except WebSocketDisconnect:
        pass

app.include_router(simulation_router)
