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

def process_elevation(origin_lon, origin_lat, size_m, scenario_id: str = "default"):
    """
    Processes elevation data for a specific area.
    Returns the path to the generated CSV.
    """
    # Define paths relative to script location
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

    dem_path = os.path.join(input_data_dir, "3secSRTM_DEM", "DEM_ESRI_GRID_16bit_Integer", "dem3s_int")
    if not os.path.exists(dem_path):
        raise FileNotFoundError(f"DEM folder not found at: {dem_path}")

    with rasterio.open(dem_path) as src:
        # Project point to metric for bounding box
        origin_gdf = gpd.GeoDataFrame(
            geometry=[Point(origin_lon, origin_lat)], 
            crs="EPSG:4326"
        ).to_crs("EPSG:3577")

        origin_point = origin_gdf.geometry.iloc[0]
        half_size = size_m / 2
        bbox_metric = box(
            origin_point.x - half_size, 
            origin_point.y - half_size, 
            origin_point.x + half_size, 
            origin_point.y + half_size
        )
        
        # Back to degrees for masking
        bbox_gdf = gpd.GeoDataFrame(geometry=[bbox_metric], crs="EPSG:3577").to_crs(src.crs)
        bbox = bbox_gdf.geometry.iloc[0]

        qld_reprojected = queensland.to_crs(src.crs)
        final_geometry = qld_reprojected.geometry.intersection(bbox)

        if final_geometry.is_empty.all():
            raise ValueError("Error: The requested crop area is entirely outside of Queensland.")

        print(f"[{scenario_id}] Clipping Elevation DEM to {size_m}m area...")
        clipped, transform = mask(src, final_geometry, crop=True, nodata=src.nodata)
        nodata = src.nodata
        elevation_band = clipped[0]
        src_crs = src.crs

    rows, cols = np.where(elevation_band != nodata)
    xs, ys = rasterio.transform.xy(transform, rows, cols)

    # Transform coordinates to Lat/Lon (EPSG:4326)
    from rasterio.warp import transform as warp_transform
    lons, lats = warp_transform(src_crs, "EPSG:4326", xs, ys)

    df = pd.DataFrame({
        "longitude": lons,
        "latitude": lats,
        "elevation": elevation_band[rows, cols]
    })

    output_path = os.path.join(output_data_dir, f"{scenario_id}_elevation.csv")
    df.to_csv(output_path, index=False)
    print(f"[{scenario_id}] Elevation processing complete: {len(df)} pixels → {output_path}")
    return output_path

if __name__ == "__main__":
    print("\n--- Custom Elevation Crop Configuration ---")
    try:
        lon = float(input("Enter origin longitude (e.g., 153.02): ") or "153.02")
        lat = float(input("Enter origin latitude (e.g., -27.47): ") or "-27.47")
        size = float(input("Enter square size in meters (e.g., 10000): ") or "10000")
        sid = input("Enter scenario_id (e.g., daguilar): ") or "custom"
        process_elevation(lon, lat, size, sid)
    except Exception as e:
        print(f"Error: {e}")
