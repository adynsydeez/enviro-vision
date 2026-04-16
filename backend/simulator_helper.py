# backend/simulator_helper.py
import numpy as np
import base64
import zlib


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
        # Compressed binary arrays (int8, uint8, float32)
        "state":       _encode_i8(sim.state),
        "vegetation":  _encode_u8(sim.veg_grid),
        "elevation":   _encode_f32(sim.elevation),
        "flammability": _encode_f32(sim.flammability),
    }


def build_tick_frame(sim, tick: int, changes: list, seconds_per_tick: int = 10) -> dict:
    total   = sim.size * sim.size
    burned  = int(np.sum(sim.state == 2))
    burning = int(np.sum(sim.state == 1))
    watered = int(np.sum(sim.state == 4))
    control = int(np.sum(sim.state == 3))
    burned_ha = round(burned * (sim.cell_res_m ** 2) / 10_000, 2)
    score = max(0, round(1000 * (1 - burned / total)))

    return {
        "type":       "tick",
        "tick":       tick,
        "changes":    changes,
        "burning":    burning,
        "burned":     burned,
        "burned_ha":  burned_ha,
        "watered":    watered,
        "control":    control,
        "score":      score,
        "active_fire": burning > 0,
        "sim_time_s": tick * seconds_per_tick,
    }
