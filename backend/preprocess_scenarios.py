"""
One-time GIS preprocessing script.
Run from the repo root:

    python backend/preprocess_scenarios.py

Produces three .npy files per scenario in backend/data_processing/output_data/:
  {scenario_id}_flammability.npy   float32 (1000, 1000)
  {scenario_id}_elevation.npy      float32 (1000, 1000)
  {scenario_id}_veg_grid.npy       uint8   (1000, 1000)  — frontend veg IDs 0-24
"""
import os
import sys
import numpy as np
import pandas as pd
from pyproj import Transformer
from scipy.interpolate import griddata

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from backend.data_processing.fuel_processing import process_fuel
    from backend.data_processing.elevation_processing import process_elevation
except ImportError:
    from data_processing.fuel_processing import process_fuel
    from data_processing.elevation_processing import process_elevation

SCENARIOS = {
    'daguilar':             {'lat': -27.291,  'lon': 152.8196},
    'lamington':            {'lat': -28.231,  'lon': 153.1196},
    'glass-house-mountains':{'lat': -26.883,  'lon': 152.957},
    'bunya-mountains':      {'lat': -26.871,  'lon': 151.573},
    'girraween':            {'lat': -28.889,  'lon': 151.945},
    'eungella':             {'lat': -21.132,  'lon': 148.491},
}

GRID_SIZE = 1000
CELL_RES  = 10.0
SIZE_M    = GRID_SIZE * CELL_RES

BFC_TO_VEG_ID = {
    110: 3, 120: 6, 210: 2, 220: 5, 230: 8,
    310: 21, 321: 21, 322: 21, 323: 21, 324: 21, 330: 21,
    411: 1,
    421: 4, 422: 4, 423: 4, 424: 4,
    431: 7, 432: 7, 433: 7, 434: 7,
    510: 9, 520: 11,
    531: 10, 532: 10, 533: 10,
    610: 17, 620: 13, 631: 12, 632: 15, 633: 14, 640: 16,
    700: 22, 800: 19, 910: 23,
    920: 20, 930: 20, 940: 20, 950: 20, 960: 18,
}


def map_fuel_codes_to_veg_ids(codes):
    veg = np.zeros_like(codes, dtype=np.uint8)
    for code, vid in BFC_TO_VEG_ID.items():
        veg[codes == code] = vid
    return veg


def process_scenario(scenario_id, lat, lon, output_dir):
    print(f"\n{'='*60}")
    print(f"Processing: {scenario_id}  ({lat}, {lon})")
    print('='*60)

    try:
        process_fuel(lon, lat, SIZE_M)
        process_elevation(lon, lat, SIZE_M)
    except Exception as e:
        print(f"ERROR running GIS processing for {scenario_id}: {e}")
        return False

    transformer = Transformer.from_crs("EPSG:4326", "EPSG:3577", always_xy=True)
    ox, oy = transformer.transform(lon, lat)
    half   = (GRID_SIZE * CELL_RES) / 2
    x_min, x_max = ox - half, ox + half
    y_min, y_max = oy - half, oy + half

    base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data_processing", "output_data")
    try:
        df_fuel = pd.read_csv(os.path.join(base, "cropped_fuel_types.csv"))
        df_elev = pd.read_csv(os.path.join(base, "cropped_elevation.csv"))
    except FileNotFoundError as e:
        print(f"ERROR reading CSV for {scenario_id}: {e}")
        return False

    fx, fy = transformer.transform(df_fuel['longitude'].values, df_fuel['latitude'].values)
    ex, ey = transformer.transform(df_elev['longitude'].values, df_elev['latitude'].values)

    grid_y, grid_x = np.mgrid[
        y_min:y_max:complex(0, GRID_SIZE),
        x_min:x_max:complex(0, GRID_SIZE),
    ]

    print(f"Interpolating {GRID_SIZE}x{GRID_SIZE} grid ...")

    flammability = griddata(
        (fy, fx), df_fuel['flammability'].values,
        (grid_y, grid_x), method='nearest', fill_value=0.0,
    ).astype(np.float32)
    flammability = np.nan_to_num(flammability, nan=0.0)

    mean_elev = float(np.nanmean(df_elev['elevation'].values))
    elevation = griddata(
        (ey, ex), df_elev['elevation'].values,
        (grid_y, grid_x), method='linear', fill_value=mean_elev,
    ).astype(np.float32)
    elevation = np.nan_to_num(elevation, nan=mean_elev)

    fuel_codes = griddata(
        (fy, fx), df_fuel['fuel_type_code'].values.astype(np.float32),
        (grid_y, grid_x), method='nearest', fill_value=0,
    ).astype(np.int32)
    veg_grid = map_fuel_codes_to_veg_ids(fuel_codes)

    np.save(os.path.join(output_dir, f"{scenario_id}_flammability.npy"), flammability)
    np.save(os.path.join(output_dir, f"{scenario_id}_elevation.npy"),    elevation)
    np.save(os.path.join(output_dir, f"{scenario_id}_veg_grid.npy"),     veg_grid)

    print(f"Saved {scenario_id}_*.npy  "
          f"(flam {flammability.min():.2f}-{flammability.max():.2f}, "
          f"elev {elevation.min():.0f}-{elevation.max():.0f}m)")
    return True


def main():
    output_dir = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "data_processing", "output_data",
    )
    os.makedirs(output_dir, exist_ok=True)

    results = {}
    for sid, coords in SCENARIOS.items():
        ok = process_scenario(sid, coords['lat'], coords['lon'], output_dir)
        results[sid] = 'OK' if ok else 'FAILED'

    print("\n" + "="*60)
    print("Preprocessing summary:")
    for sid, status in results.items():
        print(f"  {sid:<30} {status}")
    print("="*60)
    failed = [s for s, r in results.items() if r == 'FAILED']
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
