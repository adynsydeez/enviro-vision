import rasterio
from rasterio.mask import mask
import numpy as np
import pandas as pd
import geopandas as gpd
import requests
import zipfile
import io

abs_url = (
    "https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/"
    "jul2021-jun2026/access-and-downloads/digital-boundary-files/"
    "STE_2021_AUST_SHP_GDA2020.zip"
)

response = requests.get(abs_url)
with zipfile.ZipFile(io.BytesIO(response.content)) as z:
    z.extractall("abs_states")

states = gpd.read_file("abs_states/STE_2021_AUST_GDA2020.shp")
queensland = states[states["STE_NAME21"] == "Queensland"]

tif_path = "data/veg_data.tif"  

print("Clipping TIF to Queensland boundary...")

with rasterio.open(tif_path) as src:
    qld_reprojected = queensland.to_crs(src.crs)
    shapes = qld_reprojected.geometry.values

    clipped, transform = mask(src, shapes, crop=True, nodata=src.nodata)
    nodata = src.nodata
    band = clipped[0]  # First band = fuel type codes

rows, cols = np.where(band != nodata)
xs, ys = rasterio.transform.xy(transform, rows, cols)

df = pd.DataFrame({
    "longitude": xs,
    "latitude": ys,
    "fuel_type_code": band[rows, cols].astype(int)
})

bfc_labels = {
    1:  "Grassland",
    2:  "Shrubland",
    3:  "Mallee/Mulga shrubland",
    4:  "Savanna",
    5:  "Shrubby woodland",
    6:  "Shrubby dry forest",
    7:  "Shrubby wet forest",
    8:  "Closed forest",
    9:  "Spinifex",
    10: "Non-fuel / Urban / Water",
    11: "Plantation",
    12: "Crop / Pasture",
}

df["fuel_type_label"] = df["fuel_type_code"].map(bfc_labels).fillna("Unknown")

output_path = "queensland_fuel_types.csv"
df.to_csv(output_path, index=False)

print(f"Done! Saved {len(df):,} rows to '{output_path}'")
print(df.head())
print("\nFuel type summary:")
print(df["fuel_type_label"].value_counts())