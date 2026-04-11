import rasterio
from rasterio.mask import mask
import numpy as np
import pandas as pd
import geopandas as gpd
import os
from shapely.geometry import box, Point

# Define paths relative to script location
base_dir = os.path.dirname(os.path.abspath(__file__))
data_dir = os.path.join(base_dir, "data")
abs_states_dir = os.path.join(base_dir, "abs_states")

# Ensure directories exist
os.makedirs(data_dir, exist_ok=True)

# Path to the ABS state boundaries (downloaded by fuel_processing.py)
shp_path = os.path.join(abs_states_dir, "STE_2021_AUST_GDA2020.shp")

if not os.path.exists(shp_path):
    print("Warning: State boundaries not found. Please run fuel_processing.py first.")
    # Fallback or exit
    states = None
else:
    states = gpd.read_file(shp_path)
    queensland = states[states["STE_NAME21"] == "Queensland"]

# --- ELEVATION DATA CONFIGURATION ---
# Note: You need to provide the path to your elevation TIFF file here.
# If you have a .gdb, you might need to export the raster or use a specific driver.
# For now, we assume a TIFF file similar to the fuel data.
tif_path = os.path.join(data_dir, "Queensland_Elevation_DEM.tif") 

if not os.path.exists(tif_path):
    print(f"\n[!] Elevation TIFF not found at: {tif_path}")
    print("Please ensure you have an elevation raster (e.g., DEM) in the data folder.")
    # For demonstration, we will exit, but you should replace this with your actual filename.
    exit()

# User Inputs for cropping (matching fuel_processing.py for consistency)
print("\n--- Custom Elevation Crop Configuration ---")
try:
    origin_lon = float(input("Enter origin longitude (e.g., 153.02): ") or "153.02")
    origin_lat = float(input("Enter origin latitude (e.g., -27.47): ") or "-27.47")
    size_m = float(input("Enter square size in meters (e.g., 5000): ") or "5000")
except (ValueError, EOFError):
    print("Invalid input, using defaults (Brisbane area, 5km)")
    origin_lon, origin_lat, size_m = 153.02, -27.47, 5000

with rasterio.open(tif_path) as src:
    # 1. Project the origin point to the TIFF's CRS
    origin_gdf = gpd.GeoDataFrame(
        geometry=[Point(origin_lon, origin_lat)], 
        crs="EPSG:4326"
    ).to_crs(src.crs)

    origin_point = origin_gdf.geometry.iloc[0]

    # 2. Create a bounding box centered on the origin
    half_size = size_m / 2
    bbox = box(
        origin_point.x - half_size, 
        origin_point.y - half_size, 
        origin_point.x + half_size, 
        origin_point.y + half_size
    )

    # 3. Intersect the bbox with Queensland boundary
    if states is not None:
        qld_reprojected = queensland.to_crs(src.crs)
        final_geometry = qld_reprojected.geometry.intersection(bbox)
    else:
        final_geometry = [bbox]

    if hasattr(final_geometry, 'is_empty') and final_geometry.is_empty.all():
        print("Error: The requested crop area is entirely outside of Queensland.")
        exit()

    print(f"Clipping Elevation TIF to {size_m}m area around ({origin_lon}, {origin_lat})...")

    # 4. Mask the TIF
    clipped, transform = mask(src, final_geometry, crop=True, nodata=src.nodata)
    nodata = src.nodata
    band = clipped[0]

# Identify non-nodata pixels
rows, cols = np.where(band != nodata)
xs, ys = rasterio.transform.xy(transform, rows, cols)

print(f"Generating Elevation DataFrame for {len(rows):,} pixels...")

df = pd.DataFrame({
    "longitude": xs,
    "latitude": ys,
    "elevation": band[rows, cols]
})

output_path = os.path.join(base_dir, "cropped_elevation_data.csv")
df.to_csv(output_path, index=False)

print(f"Done! Saved {len(df):,} rows to '{output_path}'")
print(df.head())
