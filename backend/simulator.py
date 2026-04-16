import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap
from matplotlib.animation import FuncAnimation
import math
import random
import json
import os
from pyproj import Transformer
from scipy.interpolate import griddata

# Resolves because uvicorn is started with --app-dir backend (backend/ on sys.path).
from data_processing.fuel_processing import process_fuel
from data_processing.elevation_processing import process_elevation

class GridFireSimulation:
    def __init__(self, scenario_id: str, origin_lon: float, origin_lat: float,
                 wind_speed: float = 10.0, wind_dir: float = 45.0,
                 cell_res_m: float = 10.0, size_m: float = 10_000.0,
                 burn_duration: int = 14):
        """
        States: 0=Unburned  1=Burning  2=Burned  3=Control Line  4=Watered
        Defaults to 1000×1000 cells at 10 m/cell = 10×10 km.
        """
        self.scenario_id  = scenario_id
        self.cell_res_m   = cell_res_m
        self.size         = max(20, int(size_m / cell_res_m))
        self.origin_lon   = origin_lon
        self.origin_lat   = origin_lat
        self.size_m       = size_m
        self.wind_speed   = wind_speed
        self.wind_dir     = wind_dir

        # Alexandridis coefficients
        self.a_s  = 0.078
        self.c_w1 = 0.045
        self.c_w2 = 0.131
        self.burn_duration = burn_duration

        # Grid arrays
        self.state             = np.zeros((self.size, self.size), dtype=np.int8)
        self.burn_time         = np.zeros((self.size, self.size), dtype=np.int16)
        self.elevation         = np.zeros((self.size, self.size), dtype=np.float32)
        self.flammability      = np.zeros((self.size, self.size), dtype=np.float32)
        self.veg_grid          = np.zeros((self.size, self.size), dtype=np.uint8)
        # Records the pre-water state (0=unburned, 1=burning, 2=burned) for each
        # watered cell so drying can restore the correct state.
        self._pre_water_state  = np.zeros((self.size, self.size), dtype=np.int8)

        self.base_dir = os.path.dirname(os.path.abspath(__file__))

        # Metric bounds (EPSG:3577)
        transformer = Transformer.from_crs("EPSG:4326", "EPSG:3577", always_xy=True)
        self.ox, self.oy = transformer.transform(self.origin_lon, self.origin_lat)
        half = (self.size * self.cell_res_m) / 2
        self.x_min = self.ox - half
        self.x_max = self.ox + half
        self.y_min = self.oy - half
        self.y_max = self.oy + half

        self._load_data()

    def _load_data(self):
        """Load from .npy cache if available, otherwise process raw TIF data."""
        output_dir = os.path.join(self.base_dir, "data_processing", "output_data")
        veg_path  = os.path.join(output_dir, f"{self.scenario_id}_veg_grid.npy")
        flam_path = os.path.join(output_dir, f"{self.scenario_id}_flammability.npy")
        elev_path = os.path.join(output_dir, f"{self.scenario_id}_elevation.npy")

        if all(os.path.exists(p) for p in [veg_path, flam_path, elev_path]):
            print(f"[{self.scenario_id}] Loading .npy cache...")
            raw_veg  = np.load(veg_path)
            raw_flam = np.load(flam_path)
            raw_elev = np.load(elev_path)
        else:
            print(f"[{self.scenario_id}] No .npy cache — processing from TIF (slow)...")
            process_fuel(self.origin_lon, self.origin_lat, self.size_m, self.scenario_id)
            process_elevation(self.origin_lon, self.origin_lat, self.size_m, self.scenario_id)
            raw_veg, raw_flam, raw_elev = self._interpolate_from_csv()
            # Save for next time
            np.save(veg_path,  raw_veg)
            np.save(flam_path, raw_flam)
            np.save(elev_path, raw_elev)

        # Resize to self.size if cached arrays have different shape
        target = (self.size, self.size)
        self.veg_grid     = self._ensure_shape(raw_veg,  target, np.uint8,   12)
        self.flammability = self._ensure_shape(raw_flam, target, np.float32, 0.0)
        elev_fill = float(np.nanmean(raw_elev)) if not np.all(np.isnan(raw_elev)) else 0.0
        self.elevation    = self._ensure_shape(raw_elev, target, np.float32, elev_fill)

        # Permanent barriers where flammability ≈ 0 (water bodies)
        self.state[self.flammability <= 0.01] = 3

        # Initial ignition at centre (or nearest flammable cell)
        cy, cx = self.size // 2, self.size // 2
        if self.flammability[cy, cx] < 0.1:
            ys, xs = np.where(self.flammability > 0.1)
            if len(ys) > 0:
                dist = (ys - cy) ** 2 + (xs - cx) ** 2
                idx = np.argmin(dist)
                cy, cx = int(ys[idx]), int(xs[idx])

        self.state[cy, cx] = 1
        self.burn_time[cy, cx] = self.burn_duration

    def _ensure_shape(self, arr, target_shape, dtype, fill):
        """Resize array to target shape if it doesn't match."""
        if arr.shape == target_shape:
            return arr.astype(dtype)
        from scipy.ndimage import zoom
        factors = (target_shape[0] / arr.shape[0], target_shape[1] / arr.shape[1])
        resized = zoom(arr.astype(np.float32), factors, order=0)
        return np.nan_to_num(resized, nan=fill).astype(dtype)

    def _interpolate_from_csv(self):
        output_dir = os.path.join(self.base_dir, "data_processing", "output_data")
        fuel_path = os.path.join(output_dir, f"{self.scenario_id}_fuel.csv")
        elev_path = os.path.join(output_dir, f"{self.scenario_id}_elevation.csv")

        df_fuel = pd.read_csv(fuel_path)
        df_elev = pd.read_csv(elev_path)

        transformer = Transformer.from_crs("EPSG:4326", "EPSG:3577", always_xy=True)
        fx, fy = transformer.transform(df_fuel["longitude"].values, df_fuel["latitude"].values)
        ex, ey = transformer.transform(df_elev["longitude"].values, df_elev["latitude"].values)

        grid_y, grid_x = np.mgrid[
            self.y_min:self.y_max:complex(0, self.size),
            self.x_min:self.x_max:complex(0, self.size),
        ]

        veg_grid = griddata((fy, fx), df_fuel["veg_type"].values,   (grid_y, grid_x), method="nearest", fill_value=12).astype(np.uint8)
        flam     = griddata((fy, fx), df_fuel["flammability"].values, (grid_y, grid_x), method="nearest", fill_value=0.0).astype(np.float32)
        fill_e   = float(np.nanmean(df_elev["elevation"].values))
        elev     = griddata((ey, ex), df_elev["elevation"].values,   (grid_y, grid_x), method="linear",  fill_value=fill_e).astype(np.float32)

        return (
            np.nan_to_num(veg_grid, nan=12),
            np.nan_to_num(flam,     nan=0.0),
            np.nan_to_num(elev,     nan=fill_e),
        )

    # ── Tool interactions ──────────────────────────────────────────────────────

    def add_water_drop(self, x: int, y: int, radius: int = 3):
        """Apply circular water suppression (state 4) centred at (x, y)."""
        yy, xx = np.mgrid[:self.size, :self.size]
        dist_sq = (xx - x) ** 2 + (yy - y) ** 2
        mask = (dist_sq <= radius ** 2) & (self.state <= 2)  # unburned, burning, burned
        # Record pre-water state before overwriting so drying can restore correctly
        self._pre_water_state[mask] = self.state[mask]
        self.state[mask] = 4
        self.burn_time[mask] = 0

    def add_control_line(self, cells: list):
        """Mark a list of {x, y} cells as permanent control lines (state 3).
        Works on unburned (0), burning (1), and burned (2) cells.
        """
        for cell in cells:
            x, y = int(cell["x"]), int(cell["y"])
            if 0 <= x < self.size and 0 <= y < self.size and self.state[y, x] in (0, 1, 2):
                self.state[y, x] = 3
                self.burn_time[y, x] = 0

    def add_backburn(self, x: int, y: int, radius: int = 3):
        """Ignite a backburn fire at (x, y) on unburned cells."""
        yy, xx = np.mgrid[:self.size, :self.size]
        dist_sq = (xx - x) ** 2 + (yy - y) ** 2
        mask = (dist_sq <= radius ** 2) & (self.state == 0)
        self.state[mask] = 1
        self.burn_time[mask] = self.burn_duration

    # ── Simulation step ────────────────────────────────────────────────────────

    def step(self) -> list:
        """Advance simulation by one tick. Returns sparse list of changed cells."""
        prev_state = self.state.copy()

        math_wind_dir = math.radians(90 - self.wind_dir)

        # 1. Aging and burn-out (state 1 → 2)
        burning_mask = (self.state == 1)
        self.burn_time[burning_mask] -= 1
        self.state[(self.burn_time <= 0) & burning_mask] = 2

        # 2. Fire spread (state 0 → 1)
        unburned_mask = (self.state == 0)
        prob_not_igniting = np.ones_like(self.state, dtype=np.float32)

        for dy in [-1, 0, 1]:
            for dx in [-1, 0, 1]:
                if dx == 0 and dy == 0:
                    continue
                angle_spread = math.atan2(-dy, -dx)
                alignment = math.cos(math_wind_dir - angle_spread)
                M_wind = math.exp(self.c_w1 * self.wind_speed + self.c_w2 * self.wind_speed * (alignment - 1))
                dist = self.cell_res_m * (1.414 if dx != 0 and dy != 0 else 1.0)

                y_t = slice(max(0, -dy), min(self.size, self.size - dy))
                x_t = slice(max(0, -dx), min(self.size, self.size - dx))
                y_n = slice(max(0, dy),  min(self.size, self.size + dy))
                x_n = slice(max(0, dx),  min(self.size, self.size + dx))

                neighbor_burning = (self.state[y_n, x_n] == 1)
                if np.any(neighbor_burning):
                    rise = self.elevation[y_t, x_t] - self.elevation[y_n, x_n]
                    slope_deg = np.arctan(rise / dist) * 180 / np.pi
                    M_slope = np.exp(self.a_s * slope_deg)
                    P = self.flammability[y_t, x_t] * M_slope * M_wind
                    P = np.clip(P, 0, 1)
                    prob_not_igniting[y_t, x_t] *= (1.0 - neighbor_burning * P)

        new_ignitions = (np.random.rand(self.size, self.size) < (1.0 - prob_not_igniting)) & unburned_mask
        self.state[new_ignitions] = 1
        self.burn_time[new_ignitions] = self.burn_duration

        # 3. Drying (state 4 → 0)
        wet_mask = (self.state == 4) & (self.flammability > 0.01)
        if np.any(wet_mask):
            near_fire = np.zeros_like(self.state, dtype=bool)
            for dy in [-1, 0, 1]:
                for dx in [-1, 0, 1]:
                    if dx == 0 and dy == 0:
                        continue
                    y_n = slice(max(0, dy),  min(self.size, self.size + dy))
                    x_n = slice(max(0, dx),  min(self.size, self.size + dx))
                    y_t = slice(max(0, -dy), min(self.size, self.size - dy))
                    x_t = slice(max(0, -dx), min(self.size, self.size - dx))
                    near_fire[y_t, x_t] |= (self.state[y_n, x_n] == 1)

            self.burn_time[wet_mask & near_fire] += 1
            self.burn_time[wet_mask & ~near_fire] = np.maximum(0, self.burn_time[wet_mask & ~near_fire] - 1)

            drying_limit = self.burn_duration * 2
            dried_out = wet_mask & (self.burn_time >= drying_limit) & (np.random.rand(self.size, self.size) < 0.1)
            # Restore to burned (2) if cell was burned before watering; otherwise unburned (0).
            # Burning cells (pre=1) become unburned — water prevents re-ignition.
            restore = np.where(self._pre_water_state[dried_out] == 2, 2, 0).astype(np.int8)
            self.state[dried_out] = restore
            self._pre_water_state[dried_out] = 0
            self.burn_time[dried_out] = 0

        # 4. Return sparse deltas
        rows, cols = np.where(self.state != prev_state)
        return [
            {"x": int(cols[i]), "y": int(rows[i]), "s": int(self.state[rows[i], cols[i]])}
            for i in range(len(rows))
        ]

def run_simulation_animated():
    presets = {
        "1": {"name": "Toowoomba Escarpment (Steep Uphill)", "lon": 151.99, "lat": -27.58, "area": 4000, "ws": 12, "wd": 90},
        "2": {"name": "Springbrook Plateau (High Elevation Heath)", "lon": 153.27, "lat": -28.14, "area": 4000, "ws": 10, "wd": 45},
        "3": {"name": "Noosa Everglades (Wetland Firebreaks)", "lon": 153.02, "lat": -26.30, "area": 5000, "ws": 8, "wd": 180},
        "4": {"name": "Bunya Mountains (Mosaic Grasslands)", "lon": 151.59, "lat": -26.90, "area": 3000, "ws": 10, "wd": 270},
        "5": {"name": "Boondall Wetlands (Coastal Urban Interface)", "lon": 153.07, "lat": -27.34, "area": 4000, "ws": 15, "wd": 45}
    }

    print("\n=== Wildfire Simulation Presets ===")
    for k, v in presets.items():
        print(f"{k}. {v['name']}")
    print("0. Custom Configuration")
    
    choice = input("\nSelect a scenario (0-5) [Default: 0]: ") or "0"
    
    if choice in presets:
        p = presets[choice]
        print(f"\nLoading Scenario: {p['name']}...")
        lon, lat, area_side, ws, wd = p['lon'], p['lat'], p['area'], p['ws'], p['wd']
    else:
        print("\n--- Custom Configuration ---")
        try:
            lon = float(input("Longitude (e.g. 153.02): ") or "153.02")
            lat = float(input("Latitude (e.g. -27.47): ") or "-27.47")
            area_side = float(input("Area side length in meters (e.g. 2000): ") or "2000")
            ws = float(input("Wind speed m/s (e.g. 10): ") or "10")
            wd = float(input("Wind dir deg (0=N, 90=E): ") or "45")
        except:
            lon, lat, area_side, ws, wd = 153.02, -27.47, 2000, 10, 45

    sim = GridFireSimulation("custom", lon, lat, wind_speed=ws, wind_dir=wd, size_m=area_side)
    
    fig, (ax1, ax2, ax3) = plt.subplots(1, 3, figsize=(18, 6))
    cmap_fire = ListedColormap(['#2d5a27', '#ff4500', '#2F4F4F', '#3b82f6', '#0ea5e9']) 
    ext = [sim.x_min, sim.x_max, sim.y_min, sim.y_max]
    
    img_fire = ax1.imshow(sim.state, cmap=cmap_fire, vmin=0, vmax=4, origin='lower', extent=ext, interpolation='nearest')
    ax1.set_title("Live Fire Spread")
    ax1.set_xlabel("Easting (m)"); ax1.set_ylabel("Northing (m)")
    
    topo = ax2.imshow(sim.elevation, cmap='terrain', origin='lower', extent=ext)
    plt.colorbar(topo, ax=ax2, label='Elevation (m)')
    ax2.set_title("Topography Context")
    
    veg = ax3.imshow(sim.flammability, cmap='YlGn', origin='lower', extent=ext, vmin=0, vmax=1)
    plt.colorbar(veg, ax=ax3, label='Flammability Index')
    ax3.set_title("Fuel Risk (Vegetation)")

    # Interactive Click Handling
    click_points = []
    def on_click(event):
        if event.inaxes != ax1: return
        gx = int((event.xdata - sim.x_min) / sim.cell_res_m)
        gy = int((event.ydata - sim.y_min) / sim.cell_res_m)
        
        if event.button == 3: # Right Click for Water Drop
            sim.add_water_drop(gx, gy)
            click_points.clear()
        elif event.button == 1: # Left Click for Control Line
            click_points.append((gx, gy))
            if len(click_points) == 2:
                sim.add_control_line([
                    {"x": click_points[0][0], "y": click_points[0][1]},
                    {"x": click_points[1][0], "y": click_points[1][1]},
                ])
                click_points.clear()

    fig.canvas.mpl_connect('button_press_event', on_click)

    from matplotlib.patches import Patch
    legend_elements = [
        Patch(facecolor='#2d5a27', label='Fuel'),
        Patch(facecolor='#ff4500', label='Burning'),
        Patch(facecolor='#2F4F4F', label='Burned'),
        Patch(facecolor='#3b82f6', label='Control Line'),
        Patch(facecolor='#0ea5e9', label='Watered')
    ]
    ax1.legend(handles=legend_elements, loc='lower left', fontsize='x-small')

    def update(frame):
        sim.step()
        img_fire.set_array(sim.state)
        ax1.set_title(f"Tick {frame} | Wind: {sim.wind_speed}m/s @ {sim.wind_dir}°\n(Left-Click twice: Line | Right-Click: Water)")
        return [img_fire]

    ani = FuncAnimation(fig, update, frames=200, interval=50, blit=True, repeat=False)
    plt.tight_layout(); plt.show()

if __name__ == "__main__":
    run_simulation_animated()
