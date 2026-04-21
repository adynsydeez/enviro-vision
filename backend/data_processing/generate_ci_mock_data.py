import os
import numpy as np

SCENARIOS = [
    "daguilar",
    "lamington",
    "glass-house-mountains",
    "bunya-mountains",
    "girraween",
    "eungella",
]

GRID_SIZE = 1000

def generate_mock_data():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(base_dir, "output_data")
    os.makedirs(output_dir, exist_ok=True)

    print(f"Generating mock data for CI in {output_dir}...")

    for sid in SCENARIOS:
        veg_path  = os.path.join(output_dir, f"{sid}_veg_grid.npy")
        flam_path = os.path.join(output_dir, f"{sid}_flammability.npy")
        elev_path = os.path.join(output_dir, f"{sid}_elevation.npy")

        # 1. Vegetation: All Grassland (12)
        veg = np.full((GRID_SIZE, GRID_SIZE), 12, dtype=np.uint8)
        np.save(veg_path, veg)

        # 2. Flammability: Uniform 0.5
        flam = np.full((GRID_SIZE, GRID_SIZE), 0.5, dtype=np.float32)
        np.save(flam_path, flam)

        # 3. Elevation: Uniform 100m
        elev = np.full((GRID_SIZE, GRID_SIZE), 100.0, dtype=np.float32)
        np.save(elev_path, elev)

        print(f"[{sid}] Created mock .npy files.")

    print("\nMock data generation complete.")

if __name__ == "__main__":
    generate_mock_data()
