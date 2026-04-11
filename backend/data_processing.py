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

states = gpd.read_file(shp_path)
queensland = states[states["STE_NAME21"] == "Queensland"]

# Correct path to the TIF file
tif_path = os.path.join(data_dir, "Bushfire fuel classification fuel types map release 2.tif")

if not os.path.exists(tif_path):
    raise FileNotFoundError(f"TIF file not found at: {tif_path}")

# User Inputs for cropping
print("\n--- Custom Crop Configuration ---")
try:
    origin_lon = float(input("Enter origin longitude (e.g., 153.02): ") or "153.02")
    origin_lat = float(input("Enter origin latitude (e.g., -27.47): ") or "-27.47")
    size_m = float(input("Enter square size in meters (e.g., 5000): ") or "5000")
except (ValueError, EOFError):
    print("Invalid input, using defaults (Brisbane area, 5km)")
    origin_lon, origin_lat, size_m = 153.02, -27.47, 5000

with rasterio.open(tif_path) as src:
    # 1. Project the origin point to the TIFF's CRS (Australian Albers EPSG:3577)
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
    qld_reprojected = queensland.to_crs(src.crs)
    final_geometry = qld_reprojected.geometry.intersection(bbox)

    if final_geometry.is_empty.all():
        print("Error: The requested crop area is entirely outside of Queensland.")
        exit()

    print(f"Clipping TIF to {size_m}m area around ({origin_lon}, {origin_lat})...")

    # 4. Mask the TIF
    clipped, transform = mask(src, final_geometry, crop=True, nodata=src.nodata)
    nodata = src.nodata
    band = clipped[0]

# Identify non-nodata pixels
rows, cols = np.where(band != nodata)
xs, ys = rasterio.transform.xy(transform, rows, cols)

print(f"Generating DataFrame for {len(rows):,} pixels...")

df = pd.DataFrame({
    "longitude": xs,
    "latitude": ys,
    "fuel_type_code": band[rows, cols].astype(int)
})

bfc_labels = {
    110: "Tall, closed forest",
    120: "Closed forest",
    210: "Tall open forest",
    220: "Open forest",
    230: "Low open forest",
    310: "Broadleaf plantation",
    321: "Radiata pine",
    322: "Maritime pine",
    323: "Southern pine",
    324: "Other conifer",
    330: "Other plantation",
    411: "Tall woodland with grassy understory",
    421: "Woodland with shrubby understory",
    422: "Woodland with spinifex understory",
    423: "Woodland with grassy understory",
    424: "Woodland with sparse understory",
    431: "Low woodland with shrubby understory",
    432: "Low woodland with spinifex understory",
    433: "Low woodland with grassy understory",
    434: "Low woodland with sparse understory",
    510: "Tall shrubland",
    520: "Shrubland",
    531: "Open shrubland with spinifex understory",
    532: "Open shrubland with grassy understory",
    533: "Open shrubland with sparse understory",
    610: "Sedgeland",
    620: "Hummock grassland",
    631: "Grassland",
    632: "Open grassland",
    633: "Sparse grassland",
    640: "Croplands",
    700: "Horticulture",
    800: "Wetlands",
    910: "Water",
    920: "Wildland urban interface 1",
    930: "Wildland urban interface 2",
    940: "Wildland urban interface 3",
    950: "Built-up",
    960: "Bare ground",
}

df["fuel_type_label"] = df["fuel_type_code"].map(bfc_labels).fillna("Unknown")

output_path = os.path.join(base_dir, "cropped_fuel_types.csv")
df.to_csv(output_path, index=False)

print(f"Done! Saved {len(df):,} rows to '{output_path}'")
print(df.head())
print("\nFuel type summary:")
print(df["fuel_type_label"].value_counts())