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
input_data_dir = os.path.join(base_dir, "input_data")
output_data_dir = os.path.join(base_dir, "output_data")
abs_states_dir = os.path.join(os.path.dirname(base_dir), "abs_states")

# Ensure directories exist
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
else:
    print("State boundaries already exist.")

states = gpd.read_file(shp_path)
queensland = states[states["STE_NAME21"] == "Queensland"]

# Correct path to the TIF file
tif_path = os.path.join(input_data_dir, "Bushfire fuel classification fuel types map release 2.tif")

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
    # ── Forests
    # Dense closed canopy limits wind/drying but carries extreme intensity when ignited
    110: ("Tall, closed forest",           0.65),
    120: ("Closed forest",                 0.60),
    # Open forests: high fuel loads + wind penetration = high risk
    210: ("Tall open forest",              0.85),
    220: ("Open forest",                   0.82),
    230: ("Low open forest",               0.75),

    # ── Plantations 
    # Managed but dense; conifers highly flammable, broadleaf somewhat less so
    310: ("Broadleaf plantation",          0.60),
    321: ("Radiata pine",                  0.80),
    322: ("Maritime pine",                 0.82),
    323: ("Southern pine",                 0.78),
    324: ("Other conifer",                 0.75),
    330: ("Other plantation",              0.55),

    # ── Woodlands 
    # Grassy understory = fast-spreading surface fire; spinifex = extreme fire risk
    411: ("Tall woodland with grassy understory",   0.88),
    421: ("Woodland with shrubby understory",       0.80),
    422: ("Woodland with spinifex understory",      0.95),  # Spinifex = extreme
    423: ("Woodland with grassy understory",        0.85),
    424: ("Woodland with sparse understory",        0.65),
    431: ("Low woodland with shrubby understory",   0.75),
    432: ("Low woodland with spinifex understory",  0.92),  # Spinifex = extreme
    433: ("Low woodland with grassy understory",    0.80),
    434: ("Low woodland with sparse understory",    0.58),

    # ── Shrublands 
    # Dense shrubs carry fire well; spinifex again highest
    510: ("Tall shrubland",                        0.78),
    520: ("Shrubland",                             0.72),
    531: ("Open shrubland with spinifex understory", 0.90),
    532: ("Open shrubland with grassy understory", 0.75),
    533: ("Open shrubland with sparse understory", 0.55),

    # ── Grasslands 
    # Grass fires spread extremely fast, especially when dry
    610: ("Sedgeland",                     0.50),
    620: ("Hummock grassland",             0.88),  # Spinifex-dominated
    631: ("Grassland",                     0.82),
    632: ("Open grassland",                0.78),
    633: ("Sparse grassland",              0.55),
    640: ("Croplands",                     0.45),

    # ── Other 
    700: ("Horticulture",                  0.20),
    800: ("Wetlands",                      0.10),
    910: ("Water",                         0.00),
    920: ("Wildland urban interface 1",    0.70),  # Bushland-adjacent, high exposure
    930: ("Wildland urban interface 2",    0.55),
    940: ("Wildland urban interface 3",    0.40),
    950: ("Built-up",                      0.15),
    960: ("Bare ground",                   0.05),
}

# Identify risk and labels from the bfc_labels dictionary
df["fuel_type_label"] = df["fuel_type_code"].apply(lambda x: bfc_labels.get(x, ("Unknown", 0.5))[0])
df["flammability"] = df["fuel_type_code"].apply(lambda x: bfc_labels.get(x, ("Unknown", 0.5))[1])

output_path = os.path.join(output_data_dir, "cropped_fuel_types.csv")
df.to_csv(output_path, index=False)

print(f"Done! Saved {len(df):,} rows to '{output_path}'")
print(df.head())
print("\nFuel type summary:")
print(df["fuel_type_label"].value_counts())