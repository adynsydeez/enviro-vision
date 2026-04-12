import sys
import os
import asyncio
import threading
import json
import numpy as np
from typing import Optional
from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Add current directory to sys.path to ensure imports work when running from root
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from simulator_helper import build_init_frame, build_tick_frame
from simulator import GridFireSimulation
from services.ai_quiz import education_router

app = FastAPI(title="Bushfire Simulation API")

# Serve the processed CSV data
base_dir = os.path.dirname(os.path.abspath(__file__))
output_data_path = os.path.join(base_dir, "data_processing", "output_data")
os.makedirs(output_data_path, exist_ok=True)
app.mount("/static_data", StaticFiles(directory=output_data_path), name="static_data")

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
    scenario_id: str
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

@simulation_router.post("/start/{scenario_id}", response_model=StartResponse)
async def start_simulation(scenario_id: str, body: StartRequest):
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
            scenario_id   = scenario_id,
        )

    loop = asyncio.get_event_loop()
    try:
        sim = await asyncio.wait_for(
            loop.run_in_executor(None, _init),
            timeout=120.0
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Simulation init timed out.")

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
    global _tick
    sim = _require_sim()
    with _sim_lock:
        all_changes = []
        for _ in range(steps):
            all_changes.extend(sim.step())
            _tick += 1
    return StepResponse(changes=all_changes, **_summary(sim, _tick))

@simulation_router.get("/state", response_model=StateResponse)
def get_state():
    sim = _require_sim()
    return StateResponse(
        grid_size   = sim.size,
        wind_speed  = sim.wind_speed,
        wind_dir    = sim.wind_dir,
        p_base_fire = sim.p_base_fire,
        **_summary(sim, _tick),
    )

@app.websocket("/ws/simulation/stream")
async def stream_simulation(
    websocket: WebSocket,
    scenario_id:      str = "",
    tick_interval_ms: int = 200,
):
    global _tick
    if _sim is None:
        await websocket.accept()
        await websocket.send_json({"error": "No simulation running."})
        await websocket.close()
        return

    await websocket.accept()
    sim      = _sim
    paused   = False
    interval = tick_interval_ms / 1000.0

    await websocket.send_json(build_init_frame(sim, scenario_id))

    try:
        while True:
            try:
                # Use wait_for to check for messages without blocking the tick loop
                raw_msg = await asyncio.wait_for(websocket.receive_text(), timeout=0.01)
                msg = json.loads(raw_msg)
                cmd = msg.get("cmd")

                if cmd == "pause":
                    paused = True
                elif cmd == "resume":
                    paused = False
                elif cmd == "set_interval":
                    interval = max(0.05, msg.get("ms", interval * 1000) / 1000.0)
                elif cmd == "set_env":
                    with _sim_lock:
                        if "wind_speed" in msg: sim.wind_speed = msg["wind_speed"]
                        if "wind_dir" in msg: sim.wind_dir = msg["wind_dir"]
                elif cmd == "interact":
                    tool = msg.get("tool")
                    with _sim_lock:
                        if tool == "water":
                            sim.add_water_drop(msg["x"], msg["y"], msg.get("radius", 3))
                        elif tool == "line":
                            sim.add_control_line(msg["x0"], msg["y0"], msg["x1"], msg["y1"])
                        elif tool == "backburn":
                            sim.add_backburn(msg["x0"], msg["y0"], msg["x1"], msg["y1"])
                        elif tool == "evac":
                            sim.add_evacuation_point(msg["x"], msg["y"])

            except asyncio.TimeoutError:
                pass

            if not paused:
                loop = asyncio.get_event_loop()
                with _sim_lock:
                    await loop.run_in_executor(None, sim.step)
                    _tick += 1
                frame = build_tick_frame(sim, _tick)
                await websocket.send_json(frame)

            await asyncio.sleep(interval)
    except WebSocketDisconnect:
        pass

app.include_router(simulation_router)
app.include_router(education_router)
