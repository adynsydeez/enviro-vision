# backend/api.py
import uuid
import threading
import asyncio
import json
from dataclasses import dataclass, field
from typing import Optional

import numpy as np
from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# These imports resolve because uvicorn is started with --app-dir backend,
# which adds backend/ to sys.path. See package.json "dev" script.
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

# ── Per-session state ──────────────────────────────────────────────────────────

@dataclass
class SimSession:
    sim: GridFireSimulation
    tick: int = 0
    started: bool = False
    # Protects sim.step() + tick counter; never held across an await.
    lock: threading.Lock = field(default_factory=threading.Lock)

_sessions: dict[str, SimSession] = {}
_sessions_lock = threading.Lock()   # guards only the dict, not individual sessions
MAX_SESSIONS = 20


def _new_session_id() -> str:
    return uuid.uuid4().hex


def _require_session(session_id: str) -> SimSession:
    session = _sessions.get(session_id)
    if session is None:
        raise HTTPException(
            status_code=404,
            detail=f"Session {session_id!r} not found. POST /simulation/create first.",
        )
    return session


# ── Scenario metadata ──────────────────────────────────────────────────────────

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
    session_id:  str
    scenario_id: str
    grid_size:   int
    cell_res_m:  float


# ── REST routes ────────────────────────────────────────────────────────────────

@simulation_router.post("/create", response_model=CreateResponse)
async def create_simulation(body: CreateRequest):
    """
    Initialise a new per-client simulation. Returns a session_id for all
    subsequent REST calls and the WebSocket connection.
    """
    preset = SCENARIO_PRESETS.get(body.scenario_id)
    if preset is None:
        raise HTTPException(status_code=404, detail=f"Unknown scenario_id: {body.scenario_id!r}")

    with _sessions_lock:
        if len(_sessions) >= MAX_SESSIONS:
            raise HTTPException(
                status_code=503,
                detail=f"Server at capacity ({MAX_SESSIONS} active sessions). Try again later.",
            )

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

    session_id = _new_session_id()
    with _sessions_lock:
        _sessions[session_id] = SimSession(sim=sim)

    return CreateResponse(
        status      = "ready",
        session_id  = session_id,
        scenario_id = body.scenario_id,
        grid_size   = sim.size,
        cell_res_m  = sim.cell_res_m,
    )


@simulation_router.post("/start")
async def start_simulation(session_id: str):
    """Begin ticking the simulation for this session."""
    session = _require_session(session_id)
    with session.lock:
        session.started = True
    return {"status": "started"}


@simulation_router.get("/state")
def get_state(session_id: str):
    """Return current simulation stats for a session."""
    session = _require_session(session_id)
    sim = session.sim
    total   = sim.size * sim.size
    burned  = int(np.sum(sim.state == 2))
    burning = int(np.sum(sim.state == 1))
    return {
        "tick":        session.tick,
        "started":     session.started,
        "grid_size":   sim.size,
        "wind_speed":  sim.wind_speed,
        "wind_dir":    sim.wind_dir,
        "burning":     burning,
        "burned":      burned,
        "burned_ha":   round(burned * (sim.cell_res_m ** 2) / 10_000, 2),
        "active_fire": burning > 0,
        "sessions":    len(_sessions),
    }


@simulation_router.get("/sessions")
def list_sessions():
    """Debug: count of active sessions."""
    with _sessions_lock:
        return {"active_sessions": len(_sessions), "max_sessions": MAX_SESSIONS}


# ── WebSocket stream ───────────────────────────────────────────────────────────

@app.websocket("/ws/simulation/stream")
async def stream_simulation(websocket: WebSocket, session_id: str, tick_interval_ms: int = 200):
    session = _sessions.get(session_id)
    if session is None:
        await websocket.accept()
        await websocket.send_json({"error": f"Session {session_id!r} not found. POST /simulation/create first."})
        await websocket.close()
        return

    await websocket.accept()
    sim      = session.sim
    paused   = False
    interval = tick_interval_ms / 1000.0

    # Send init frame immediately on connect
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
                    with session.lock:
                        sim.wind_speed = float(msg.get("speed", sim.wind_speed))
                        sim.wind_dir   = float(msg.get("dir",   sim.wind_dir))

                elif cmd == "interact":
                    tool = msg.get("tool")
                    with session.lock:
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
            if not session.started or paused:
                await asyncio.sleep(0.05)
                continue

            loop = asyncio.get_running_loop()
            with session.lock:
                changes = await loop.run_in_executor(None, sim.step)
                session.tick += 1

            frame = build_tick_frame(sim, session.tick, changes)
            await websocket.send_json(frame)
            await asyncio.sleep(interval)

    except WebSocketDisconnect:
        pass
    finally:
        # Always clean up the session when the client disconnects,
        # even on unexpected errors, so memory is reclaimed.
        with _sessions_lock:
            _sessions.pop(session_id, None)


app.include_router(simulation_router)
app.include_router(education_router)
