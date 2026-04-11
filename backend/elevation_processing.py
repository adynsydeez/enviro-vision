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

# Define paths relative to script location
base_dir = os.path.dirname(os.path.abspath(__file__))
data_dir = os.path.join(base_dir, "data")
abs_states_dir = os.path.join(base_dir, "abs_states")

# Ensure directories exist
os.makedirs(data_dir, exist_ok=True)

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
else:
    print("State boundaries already exist.")

# Load state boundaries and filter for Queensland (similar to fuel_processing)
states = gpd.read_file(shp_path)
queensland = states[states["STE_NAME21"] == "Queensland"]

# Path to the DEM folder
dem_path = os.path.join(data_dir, "3secSRTM_DEM", "DEM_ESRI_GRID_16bit_Integer", "dem3s_int")

if not os.path.exists(dem_path):
    raise FileNotFoundError(f"DEM data not found at: {dem_path}")

# User Inputs for cropping (matches fuel_processing)
print("\n--- Custom Elevation Crop Configuration ---")
try:
    origin_lon = float(input("Enter origin longitude (e.g., 153.02): ") or "153.02")
    origin_lat = float(input("Enter origin latitude (e.g., -27.47): ") or "-27.47")
    size_m = float(input("Enter square size in meters (e.g., 5000): ") or "5000")
except (ValueError, EOFError):
    print("Invalid input, using defaults (Brisbane area, 5km)")
    origin_lon, origin_lat, size_m = 153.02, -27.47, 5000

with rasterio.open(dem_path) as src:
    # 1. Project the origin point to a metric CRS for accurate distance calculation
    # We'll use EPSG:3577 (Australian Albers) as a metric reference
    origin_gdf = gpd.GeoDataFrame(
        geometry=[Point(origin_lon, origin_lat)], 
        crs="EPSG:4326"
    ).to_crs("EPSG:3577")

    origin_point = origin_gdf.geometry.iloc[0]

    # 2. Create a bounding box centered on the origin (in meters)
    half_size = size_m / 2
    bbox_metric = box(
        origin_point.x - half_size, 
        origin_point.y - half_size, 
        origin_point.x + half_size, 
        origin_point.y + half_size
    )
    
    # 3. Project the bbox back to the raster's CRS (EPSG:4326 for SRTM)
    bbox_gdf = gpd.GeoDataFrame(geometry=[bbox_metric], crs="EPSG:3577").to_crs(src.crs)
    bbox = bbox_gdf.geometry.iloc[0]

    # 4. Intersect the bbox with Queensland boundary
    qld_reprojected = queensland.to_crs(src.crs)
    final_geometry = qld_reprojected.geometry.intersection(bbox)

    if final_geometry.is_empty.all():
        print("Error: The requested crop area is entirely outside of Queensland.")
        exit()

    print(f"Clipping DEM to {size_m}m area around ({origin_lon}, {origin_lat})...")

    # 5. Mask the DEM
    clipped, transform = mask(src, final_geometry, crop=True, nodata=src.nodata)
    nodata = src.nodata
    elevation_band = clipped[0]

# Identify non-nodata pixels for CSV output
rows, cols = np.where(elevation_band != nodata)
xs, ys = rasterio.transform.xy(transform, rows, cols)

print(f"Generating DataFrame for {len(rows):,} pixels...")

df = pd.DataFrame({
    "longitude": xs,
    "latitude": ys,
    "elevation": elevation_band[rows, cols]
})

output_path = os.path.join(base_dir, "cropped_elevation.csv")
df.to_csv(output_path, index=False)

print(f"Done! Saved {len(df):,} rows to '{output_path}'")
