import asyncio
import json
import os
import numpy as np
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from backend.simulator import GridFireSimulation

# ── Scenario cache ─────────────────────────────────────────────────────────────
SCENARIO_CACHE: dict = {}

SCENARIO_IDS = [
    'daguilar',
    'lamington',
    'glass-house-mountains',
    'bunya-mountains',
    'girraween',
    'eungella',
]

DEFAULT_WIND_DIR = 45
DEFAULT_WIND_SPD = 30
TICK_INTERVAL    = 0.5  # seconds


def _load_scenario_cache():
    base = os.path.join(os.path.dirname(__file__), "data_processing", "output_data")
    for sid in SCENARIO_IDS:
        f = os.path.join(base, f"{sid}_flammability.npy")
        e = os.path.join(base, f"{sid}_elevation.npy")
        v = os.path.join(base, f"{sid}_veg_grid.npy")
        if all(os.path.exists(p) for p in [f, e, v]):
            SCENARIO_CACHE[sid] = {
                "flammability": np.load(f),
                "elevation":    np.load(e),
                "veg_grid":     np.load(v),
            }
            print(f"[startup] loaded scenario: {sid}")
        else:
            print(f"[startup] SKIP {sid}: .npy files not found in {base}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_scenario_cache()
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/")
async def root():
    return {"message": "FireCommander backend", "scenarios": list(SCENARIO_CACHE.keys())}


@app.websocket("/ws/simulation/{scenario_id}")
async def ws_simulation(websocket: WebSocket, scenario_id: str):
    await websocket.accept()

    if scenario_id not in SCENARIO_CACHE:
        await websocket.close(code=4004)
        return

    data = SCENARIO_CACHE[scenario_id]
    sim  = GridFireSimulation(
        origin_lon=None, origin_lat=None, size_m=None,
        wind_speed=DEFAULT_WIND_SPD,
        wind_dir=DEFAULT_WIND_DIR,
        flammability=data["flammability"],
        elevation=data["elevation"],
        veg_grid=data["veg_grid"],
    )

    # Send FULL_SYNC
    grid_cells = [
        {"x": int(x), "y": int(y), "s": int(sim.state[y, x])}
        for y, x in zip(*np.where(sim.state != 0))
    ]
    veg_flat = sim.veg_grid.flatten().tolist() if sim.veg_grid is not None else []

    await websocket.send_json({
        "type":           "FULL_SYNC",
        "gridSize":       sim.size,
        "grid":           grid_cells,
        "vegetationGrid": veg_flat,
        "stats":          sim.get_stats(),
    })

    paused   = True
    sim_lock = asyncio.Lock()

    async def tick_loop():
        while True:
            await asyncio.sleep(TICK_INTERVAL)
            if not paused:
                async with sim_lock:
                    changes = await asyncio.to_thread(sim.step)
                await websocket.send_json({
                    "type":    "TICK_UPDATE",
                    "changes": changes,
                    "stats":   sim.get_stats(),
                })

    tick_task = asyncio.create_task(tick_loop())

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            action = msg.get("action")
            tool   = msg.get("tool")

            if action == "start":
                async with sim_lock:
                    changes = sim.seed_fire()
                paused = False
                await websocket.send_json({
                    "type":    "TICK_UPDATE",
                    "changes": changes,
                    "stats":   sim.get_stats(),
                })

            elif action == "pause":
                paused = True

            elif action == "resume":
                paused = False

            elif action == "setWind":
                wind_dir = msg.get("dir", sim.wind_dir)
                wind_spd = msg.get("spd", sim.wind_speed)
                async with sim_lock:
                    sim.set_wind(wind_dir, wind_spd)

            elif tool == "water":
                gx = int(round(msg.get("x", 0)))
                gy = int(round(msg.get("y", 0)))
                if 0 <= gx < sim.size and 0 <= gy < sim.size:
                    async with sim_lock:
                        changes = sim.add_water_drop(gx, gy)
                    if changes:
                        await websocket.send_json({
                            "type":    "TICK_UPDATE",
                            "changes": changes,
                            "stats":   sim.get_stats(),
                        })

            elif tool == "control_line":
                cells = msg.get("cells", [])
                changes = []
                async with sim_lock:
                    for cell in cells:
                        cx = max(0, min(sim.size - 1, int(round(cell.get("x", 0)))))
                        cy = max(0, min(sim.size - 1, int(round(cell.get("y", 0)))))
                        if sim.state[cy, cx] == 0:
                            sim.state[cy, cx] = 3
                            changes.append({"x": cx, "y": cy, "s": 3})
                if changes:
                    await websocket.send_json({
                        "type":    "TICK_UPDATE",
                        "changes": changes,
                        "stats":   sim.get_stats(),
                    })

    except WebSocketDisconnect:
        pass
    finally:
        tick_task.cancel()
        try:
            await tick_task
        except asyncio.CancelledError:
            pass
