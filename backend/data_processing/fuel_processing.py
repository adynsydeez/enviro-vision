# backend/data_processing/fuel_processing.py
import rasterio
from rasterio.mask import mask
import numpy as np
import pandas as pd
import geopandas as gpd
import requests
import zipfile
import io
import os
from shapely.geometry import box, Point
try:
    from .veg_mapping import bfc_to_veg
except ImportError:
    from veg_mapping import bfc_to_veg

def process_fuel(origin_lon, origin_lat, size_m, scenario_id: str = "default"):
    """
    Processes fuel classification data for a specific area.
    Outputs {scenario_id}_fuel.csv with columns: longitude, latitude,
    fuel_type_code, fuel_type_label, flammability, veg_type.
    Returns the path to the generated CSV.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    input_data_dir = os.path.join(base_dir, "input_data")
    output_data_dir = os.path.join(base_dir, "output_data")
    abs_states_dir = os.path.join(os.path.dirname(base_dir), "abs_states")

    os.makedirs(input_data_dir, exist_ok=True)
    os.makedirs(output_data_dir, exist_ok=True)

    abs_url = (
        "https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/"
        "jul2021-jun2026/access-and-downloads/digital-boundary-files/"
        "STE_2021_AUST_SHP_GDA2020.zip"
    )
    shp_path = os.path.join(abs_states_dir, "STE_2021_AUST_GDA2020.shp")

    if not os.path.exists(shp_path):
        print("Downloading Australian state boundaries...")
        response = requests.get(abs_url)
        with zipfile.ZipFile(io.BytesIO(response.content)) as z:
            z.extractall(abs_states_dir)

    states = gpd.read_file(shp_path)
    queensland = states[states["STE_NAME21"] == "Queensland"]

    tif_path = os.path.join(input_data_dir, "Bushfire fuel classification fuel types map release 2.tif")
    if not os.path.exists(tif_path):
        raise FileNotFoundError(f"TIF file not found at: {tif_path}")

    with rasterio.open(tif_path) as src:
        origin_gdf = gpd.GeoDataFrame(
            geometry=[Point(origin_lon, origin_lat)],
            crs="EPSG:4326"
        ).to_crs(src.crs)

        origin_point = origin_gdf.geometry.iloc[0]
        half_size = size_m / 2
        bbox = box(
            origin_point.x - half_size,
            origin_point.y - half_size,
            origin_point.x + half_size,
            origin_point.y + half_size,
        )

        qld_reprojected = queensland.to_crs(src.crs)
        final_geometry = qld_reprojected.geometry.intersection(bbox)

        if final_geometry.is_empty.all():
            raise ValueError("The requested crop area is entirely outside Queensland.")

        print(f"[{scenario_id}] Clipping Fuel TIF to {size_m}m area...")
        clipped, transform = mask(src, final_geometry, crop=True, nodata=src.nodata)
        nodata = src.nodata
        band = clipped[0]
        src_crs = src.crs

    rows, cols = np.where(band != nodata)
    xs, ys = rasterio.transform.xy(transform, rows, cols)

    from rasterio.warp import transform as warp_transform
    lons, lats = warp_transform(src_crs, "EPSG:4326", xs, ys)

    bfc_labels = {
        110: ("Tall, closed forest", 0.65), 120: ("Closed forest", 0.60),
        210: ("Tall open forest", 0.85), 220: ("Open forest", 0.82), 230: ("Low open forest", 0.75),
        310: ("Broadleaf plantation", 0.60), 321: ("Radiata pine", 0.80), 322: ("Maritime pine", 0.82),
        323: ("Southern pine", 0.78), 324: ("Other conifer", 0.75), 330: ("Other plantation", 0.55),
        411: ("Tall woodland with grassy understory", 0.88), 421: ("Woodland with shrubby understory", 0.80),
        422: ("Woodland with spinifex understory", 0.95), 423: ("Woodland with grassy understory", 0.85),
        424: ("Woodland with sparse understory", 0.65), 431: ("Low woodland with shrubby understory", 0.75),
        432: ("Low woodland with spinifex understory", 0.92), 433: ("Low woodland with grassy understory", 0.80),
        434: ("Low woodland with sparse understory", 0.58),
        510: ("Tall shrubland", 0.78), 520: ("Shrubland", 0.72),
        531: ("Open shrubland with spinifex understory", 0.90), 532: ("Open shrubland with grassy understory", 0.75),
        533: ("Open shrubland with sparse understory", 0.55),
        610: ("Sedgeland", 0.50), 620: ("Hummock grassland", 0.88), 631: ("Grassland", 0.82),
        632: ("Open grassland", 0.78), 633: ("Sparse grassland", 0.55), 640: ("Croplands", 0.45),
        700: ("Horticulture", 0.20), 800: ("Wetlands", 0.10), 910: ("Water", 0.00),
        920: ("Wildland urban interface 1", 0.70), 930: ("Wildland urban interface 2", 0.55),
        940: ("Wildland urban interface 3", 0.40), 950: ("Built-up", 0.15), 960: ("Bare ground", 0.05),
    }

    codes = band[rows, cols].astype(int)
    df = pd.DataFrame({
        "longitude": lons,
        "latitude": lats,
        "fuel_type_code": codes,
        "fuel_type_label": [bfc_labels.get(c, ("Unknown", 0.5))[0] for c in codes],
        "flammability":    [bfc_labels.get(c, ("Unknown", 0.5))[1] for c in codes],
        "veg_type":        [bfc_to_veg(c) for c in codes],
    })

    output_path = os.path.join(output_data_dir, f"{scenario_id}_fuel.csv")
    df.to_csv(output_path, index=False)
    print(f"[{scenario_id}] Fuel processing complete: {len(df)} pixels → {output_path}")
    return output_path


if __name__ == "__main__":
    print("\n--- Custom Fuel Crop Configuration ---")
    try:
        lon = float(input("Enter origin longitude (e.g., 153.02): ") or "153.02")
        lat = float(input("Enter origin latitude (e.g., -27.47): ") or "-27.47")
        size = float(input("Enter square size in meters (e.g., 10000): ") or "10000")
        sid = input("Enter scenario_id (e.g., daguilar): ") or "custom"
        process_fuel(lon, lat, size, sid)
    except Exception as e:
        print(f"Error: {e}")
