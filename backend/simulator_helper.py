# backend/simulator_helper.py
#
# Coordinate convention
# ─────────────────────
# Backend (simulator.py):  row 0 = SOUTH  (np.mgrid goes y_min → y_max)
# Frontend canvas:         row 0 = NORTH  (screen y=0 is the top edge)
#
# Rule: flip Y before sending to the frontend, flip Y on incoming interact coords.
#   • build_init_frame  → np.flipud on all 2D arrays
#   • build_tick_frame  → size-1-y on each sparse delta
#   • api.py interact   → size-1-y on each incoming cell coord
#
import numpy as np
import base64
import zlib


def _screen_y(grid_y: int, size: int) -> int:
    """Convert backend grid y (0=south) to screen y (0=north)."""
    return size - 1 - grid_y


def _encode_i8(arr: np.ndarray) -> str:
    raw = arr.flatten().astype(np.int8).tobytes()
    return base64.b64encode(zlib.compress(raw, level=6)).decode()

def _encode_u8(arr: np.ndarray) -> str:
    raw = arr.flatten().astype(np.uint8).tobytes()
    return base64.b64encode(zlib.compress(raw, level=6)).decode()

def _encode_f32(arr: np.ndarray) -> str:
    raw = arr.flatten().astype(np.float32).tobytes()
    return base64.b64encode(zlib.compress(raw, level=6)).decode()


def build_init_frame(sim, scenario_id: str) -> dict:
    # Flip arrays vertically so row 0 = north (screen top), matching the frontend
    # canvas convention where y=0 is the top edge. Backend stores row 0 = south
    # (from np.mgrid[y_min:y_max:...]) so flipud aligns the two coordinate systems.
    return {
        "type":        "init",
        "scenario_id": scenario_id,
        "grid_size":   sim.size,
        "cell_res_m":  sim.cell_res_m,
        "origin_lon":  sim.origin_lon,
        "origin_lat":  sim.origin_lat,
        "wind_speed":  sim.wind_speed,
        "wind_dir":    sim.wind_dir,
        "encoding":    "zlib+base64",
        # Compressed binary arrays (int8, uint8, float32) — flipped N-up
        "state":        _encode_i8(np.flipud(sim.state)),
        "vegetation":   _encode_u8(np.flipud(sim.veg_grid)),
        "elevation":    _encode_f32(np.flipud(sim.elevation)),
        "flammability": _encode_f32(np.flipud(sim.flammability)),
    }


def build_tick_frame(sim, tick: int, changes: list, seconds_per_tick: int = 10) -> dict:
    total   = sim.size * sim.size
    burned  = int(np.sum(sim.state == 2))
    burning = int(np.sum(sim.state == 1))
    watered = int(np.sum(sim.state == 4))
    control = int(np.sum(sim.state == 3))
    burned_ha = round(burned * (sim.cell_res_m ** 2) / 10_000, 2)
    score = max(0, round(100 * (1 - burned / total)))

    flipped_changes = [
        {"x": c["x"], "y": _screen_y(c["y"], sim.size), "s": c["s"]}
        for c in changes
    ]

    return {
        "type":       "tick",
        "tick":       tick,
        "changes":    flipped_changes,
        "burning":    burning,
        "burned":     burned,
        "burned_ha":  burned_ha,
        "watered":    watered,
        "control":    control,
        "score":      score,
        "active_fire": burning > 0,
        "sim_time_s": tick * seconds_per_tick,
    }
