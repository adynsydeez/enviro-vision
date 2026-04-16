"""
One-shot preprocessing: crop TIF data for all 6 scenarios and interpolate
to 1000×1000 grids at 10m/cell, saving .npy files for fast simulator startup.

Run from repo root:
    cd backend && python -m data_processing.preprocess_scenarios

Requires:
    backend/data_processing/input_data/Bushfire fuel classification fuel types map release 2.tif
    backend/data_processing/input_data/3secSRTM_DEM/DEM_ESRI_GRID_16bit_Integer/dem3s_int
"""
import os
import sys
import numpy as np
import pandas as pd
from pyproj import Transformer
from scipy.interpolate import griddata

# Allow running as script from backend/ or repo root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data_processing.fuel_processing import process_fuel
from data_processing.elevation_processing import process_elevation

GRID_SIZE = 1000      # cells per side
CELL_RES_M = 10.0     # metres per cell
SIZE_M = GRID_SIZE * CELL_RES_M  # 10 000 m = 10 km

# Scenario coords: (id, lon, lat) — note scenarios.js stores [lat, lng], here we use (lon, lat)
SCENARIOS = [
    ("daguilar",            152.8196,  -27.291),
    ("lamington",           153.1196,  -28.231),
    ("glass-house-mountains", 152.957, -26.883),
    ("bunya-mountains",     151.573,   -26.871),
    ("girraween",           151.945,   -28.889),
    ("eungella",            148.491,   -21.132),
]


def interpolate_to_grid(points_xy, values, x_min, x_max, y_min, y_max, method="nearest", fill=0.0):
    """Interpolate scattered (x,y,value) points onto a GRID_SIZE×GRID_SIZE regular grid."""
    grid_y, grid_x = np.mgrid[
        y_min:y_max:complex(0, GRID_SIZE),
        x_min:x_max:complex(0, GRID_SIZE),
    ]
    result = griddata(points_xy, values, (grid_y, grid_x), method=method, fill_value=fill)
    return np.nan_to_num(result, nan=fill)


def metric_bounds(origin_lon, origin_lat):
    transformer = Transformer.from_crs("EPSG:4326", "EPSG:3577", always_xy=True)
    ox, oy = transformer.transform(origin_lon, origin_lat)
    half = (GRID_SIZE * CELL_RES_M) / 2
    return ox - half, ox + half, oy - half, oy + half, transformer


def preprocess_one(scenario_id, origin_lon, origin_lat):
    base_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(base_dir, "output_data")
    os.makedirs(output_dir, exist_ok=True)

    veg_path  = os.path.join(output_dir, f"{scenario_id}_veg_grid.npy")
    flam_path = os.path.join(output_dir, f"{scenario_id}_flammability.npy")
    elev_path = os.path.join(output_dir, f"{scenario_id}_elevation.npy")

    if all(os.path.exists(p) for p in [veg_path, flam_path, elev_path]):
        print(f"[{scenario_id}] .npy cache already exists — skipping.")
        return

    # 1. Process raw TIF data → CSVs
    fuel_csv = process_fuel(origin_lon, origin_lat, SIZE_M, scenario_id)
    elev_csv = process_elevation(origin_lon, origin_lat, SIZE_M, scenario_id)

    # 2. Project CSV coords to EPSG:3577 metric
    x_min, x_max, y_min, y_max, transformer = metric_bounds(origin_lon, origin_lat)

    df_fuel = pd.read_csv(fuel_csv)
    fx, fy = transformer.transform(df_fuel["longitude"].values, df_fuel["latitude"].values)

    df_elev = pd.read_csv(elev_csv)
    ex, ey = transformer.transform(df_elev["longitude"].values, df_elev["latitude"].values)

    # 3. Interpolate to 1000×1000 grid
    print(f"[{scenario_id}] Interpolating to {GRID_SIZE}×{GRID_SIZE} grid...")

    veg_grid = interpolate_to_grid(
        (fy, fx), df_fuel["veg_type"].values,
        x_min, x_max, y_min, y_max, method="nearest", fill=12,  # 12 = Grassland
    ).astype(np.uint8)

    flammability = interpolate_to_grid(
        (fy, fx), df_fuel["flammability"].values,
        x_min, x_max, y_min, y_max, method="nearest", fill=0.0,
    ).astype(np.float32)

    fill_elev = float(np.nanmean(df_elev["elevation"].values))
    elevation = interpolate_to_grid(
        (ey, ex), df_elev["elevation"].values,
        x_min, x_max, y_min, y_max, method="linear", fill=fill_elev,
    ).astype(np.float32)

    # 4. Save .npy caches
    np.save(veg_path,  veg_grid)
    np.save(flam_path, flammability)
    np.save(elev_path, elevation)
    print(f"[{scenario_id}] Saved: veg_grid={veg_grid.shape}, flam={flammability.shape}, elev={elevation.shape}")


if __name__ == "__main__":
    for sid, lon, lat in SCENARIOS:
        try:
            preprocess_one(sid, lon, lat)
        except Exception as e:
            print(f"[{sid}] ERROR: {e}")
    print("\nPreprocessing complete.")
