from dataclasses import dataclass, asdict
from typing import Literal
import numpy as np
import time

# ── Cell state encoding ───────────────────────────────────────────────────────
# Kept as single integers to minimise payload size
# 0 = Unburned, 1 = Burning, 2 = Burned, 3 = Watered
CellState = int

@dataclass
class InitFrame:
    type:         Literal["init"] = "init"
    scenario_id:  int   = 0
    grid_size:    int   = 100
    cell_res_m:   float = 5.0           # Changed: was derived, now passed directly

    origin_lon:   float = 0.0
    origin_lat:   float = 0.0

    # Metric bounds (EPSG:3577) — new, needed for frontend coordinate mapping
    x_min:        float = 0.0
    x_max:        float = 0.0
    y_min:        float = 0.0
    y_max:        float = 0.0

    elevation:    list[float] = None
    flammability: list[float] = None
    state:        list[int]   = None

    wind_speed:   float = 0.0
    wind_dir:     float = 0.0
    # Removed: p_base_fire — replaced by Alexandridis coefficients internally


@dataclass
class TickFrame:
    type:          Literal["tick"] = "tick"
    tick:          int   = 0

    # Full state instead of deltas — step() now returns [] always
    state:         list[int] = None

    burning_count: int   = 0
    burned_count:  int   = 0
    watered_count: int   = 0           # New: state 4 cells
    control_count: int   = 0           # New: state 3 cells
    burned_pct:    float = 0.0
    active_fire:   bool  = True
    sim_time_s:    int   = 0


@dataclass
class EnvFrame:
    type:        Literal["env"] = "env"
    tick:        int   = 0
    wind_speed:  float = 0.0
    wind_dir:    float = 0.0


def build_init_frame(sim, scenario_id: int) -> dict:
    return asdict(InitFrame(
        scenario_id  = scenario_id,
        grid_size    = sim.size,
        cell_res_m   = sim.cell_res_m,          # Now set directly, not derived
        origin_lon   = sim.origin_lon,
        origin_lat   = sim.origin_lat,
        # Metric bounds for frontend coordinate mapping
        x_min        = sim.x_min,
        x_max        = sim.x_max,
        y_min        = sim.y_min,
        y_max        = sim.y_max,
        elevation    = sim.elevation.flatten().round(1).tolist(),
        flammability = sim.flammability.flatten().round(3).tolist(),
        state        = sim.state.flatten().tolist(),
        wind_speed   = sim.wind_speed,
        wind_dir     = sim.wind_dir,
    ))


def build_tick_frame(sim, tick: int, seconds_per_tick: int = 60) -> dict:
    """
    step() no longer returns changes — diff the state ourselves.
    Call this AFTER sim.step() has been called.
    """
    total        = sim.size * sim.size
    burned_count = int(np.sum(sim.state == 2))
    burning      = int(np.sum(sim.state == 1))
    watered      = int(np.sum(sim.state == 4))
    control      = int(np.sum(sim.state == 3))

    return asdict(TickFrame(
        tick          = tick,
        state         = sim.state.flatten().tolist(),  # Full state — step() no longer returns deltas
        burning_count = burning,
        burned_count  = burned_count,
        watered_count = watered,
        control_count = control,
        burned_pct    = round(burned_count / total * 100, 2),
        active_fire   = burning > 0,
        sim_time_s    = tick * seconds_per_tick,
    ))


