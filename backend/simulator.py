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

class GridFireSimulation:
    def __init__(self, origin_lon, origin_lat, size_m, wind_speed, wind_dir, 
                 grid_size=100, p_base_fire=0.3, burn_duration=5, c_s=2.0, c_w=0.1):
        self.size = grid_size
        self.origin_lon = origin_lon
        self.origin_lat = origin_lat
        self.size_m = size_m
        self.wind_speed = wind_speed
        self.wind_dir = wind_dir
        
        self.p_base_fire = p_base_fire
        self.burn_duration = burn_duration
        self.c_s = c_s # Slope constant
        self.c_w = c_w # Wind constant
        
        # Grid Initialization
        # States: 0=Dry, 1=Burning, 2=Burned, 3=Watered
        self.state = np.zeros((self.size, self.size), dtype=int)
        self.burn_time = np.zeros((self.size, self.size), dtype=int)
        self.elevation = np.zeros((self.size, self.size), dtype=float)
        self.flammability = np.ones((self.size, self.size), dtype=float) * 0.5
        
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.cell_res_m = size_m / self.size

        self._load_real_data()

    def _load_real_data(self):
        """Loads processed fuel and elevation CSVs and interpolates onto the grid based on inputs."""
        output_data_dir = os.path.join(self.base_dir, "data_processing", "output_data")
        fuel_path = os.path.join(output_data_dir, "cropped_fuel_types.csv")
        elev_path = os.path.join(output_data_dir, "cropped_elevation.csv")

        if not os.path.exists(fuel_path) or not os.path.exists(elev_path):
            print("Warning: Real data files not found. Using synthetic landscape.")
            self._setup_synthetic_environment()
            return

        print(f"Loading data from {fuel_path} and {elev_path}...")
        df_fuel = pd.read_csv(fuel_path)
        df_elev = pd.read_csv(elev_path)

        # 1. Determine Grid Bounds in Metric CRS (EPSG:3577)
        transformer_to_3577 = Transformer.from_crs("EPSG:4326", "EPSG:3577", always_xy=True)
        ox, oy = transformer_to_3577.transform(self.origin_lon, self.origin_lat)
        
        half_size = self.size_m / 2
        x_min, x_max = ox - half_size, ox + half_size
        y_min, y_max = oy - half_size, oy + half_size
        
        print(f"Grid bounds (EPSG:3577): X[{x_min:.1f}, {x_max:.1f}], Y[{y_min:.1f}, {y_max:.1f}]")
        print(f"Resolution: {self.cell_res_m:.2f}m per cell")

        # 2. Coordinate Synchronization for Elevation (Fuel is already 3577)
        transformer_elev = Transformer.from_crs("EPSG:4326", "EPSG:3577", always_xy=True)
        elev_x, elev_y = transformer_elev.transform(df_elev['longitude'].values, df_elev['latitude'].values)
        df_elev['x'] = elev_x
        df_elev['y'] = elev_y

        # 3. Create Target Grid
        # complex(0, self.size) ensures exactly self.size points including endpoints
        grid_x, grid_y = np.mgrid[x_min:x_max:complex(0, self.size), 
                                  y_min:y_max:complex(0, self.size)]

        # 4. Interpolate Data
        print("Interpolating flammability...")
        # Fuel CSV 'longitude'/'latitude' are actually Easting/Northing in 3577
        self.flammability = griddata(
            (df_fuel['longitude'], df_fuel['latitude']), 
            df_fuel['flammability'], 
            (grid_x, grid_y), 
            method='linear', 
            fill_value=0.0
        )

        print("Interpolating elevation...")
        self.elevation = griddata(
            (df_elev['x'], df_elev['y']), 
            df_elev['elevation'], 
            (grid_x, grid_y), 
            method='linear', 
            fill_value=df_elev['elevation'].mean()
        )

        # Handle NaNs
        self.flammability = np.nan_to_num(self.flammability, nan=0.0)
        self.elevation = np.nan_to_num(self.elevation, nan=np.nanmean(self.elevation))

        # 5. Initial Ignition (Center of the grid)
        self.state[self.size // 2, self.size // 2] = 1
        self.burn_time[self.size // 2, self.size // 2] = self.burn_duration

    def _setup_synthetic_environment(self):
        """Fallback synthetic landscape."""
        for y in range(self.size):
            for x in range(self.size):
                self.elevation[y, x] = x * 1.5
        center = self.size // 2
        self.state[center, center] = 1
        self.burn_time[center, center] = self.burn_duration

    def calculate_angle(self, dx, dy):
        return math.atan2(-dy, -dx)

    def step(self):
        """Advances the simulation by one time step using internal wind settings."""
        wind_dir_rad = math.radians(self.wind_dir)
        next_state = self.state.copy()
        next_burn_time = self.burn_time.copy()

        for y in range(self.size):
            for x in range(self.size):
                current_val = self.state[y, x]

                if current_val == 2 or current_val == 3:
                    continue

                if current_val == 1:
                    next_burn_time[y, x] -= 1
                    if next_burn_time[y, x] <= 0:
                        next_state[y, x] = 2
                    continue

                if current_val == 0:
                    if self.flammability[y, x] <= 0.01:
                        continue

                    prob_not_combusting = 1.0
                    
                    for dy in [-1, 0, 1]:
                        for dx in [-1, 0, 1]:
                            if dx == 0 and dy == 0: continue
                            
                            ny, nx = y + dy, x + dx
                            if 0 <= ny < self.size and 0 <= nx < self.size:
                                if self.state[ny, nx] == 1:
                                    dist = self.cell_res_m * (math.sqrt(2) if dx != 0 and dy != 0 else 1.0)
                                    
                                    rise = self.elevation[y, x] - self.elevation[ny, nx]
                                    slope_val = rise / dist
                                    M_slope = math.exp(self.c_s * slope_val)
                                    
                                    angle_to_neighbor = self.calculate_angle(dx, dy)
                                    alignment = math.cos(wind_dir_rad - angle_to_neighbor)
                                    M_wind = math.exp(self.c_w * self.wind_speed * alignment)
                                    
                                    P_ignite = self.p_base_fire * self.flammability[y, x] * M_slope * M_wind
                                    P_ignite = min(1.0, P_ignite)
                                    
                                    prob_not_combusting *= (1.0 - P_ignite)

                    if random.random() < (1.0 - prob_not_combusting):
                        next_state[y, x] = 1
                        next_burn_time[y, x] = self.burn_duration

        changes = []
        diff_indices = np.where(next_state != self.state)
        for y, x in zip(diff_indices[0], diff_indices[1]):
            changes.append({"x": int(x), "y": int(y), "s": int(next_state[y, x])})

        self.state = next_state
        self.burn_time = next_burn_time
        return changes

def run_simulation_animated():
    print("\n--- Simulation Initialization ---")
    try:
        origin_lon = float(input("Enter origin longitude (e.g., 153.02): ") or "153.02")
        origin_lat = float(input("Enter origin latitude (e.g., -27.47): ") or "-27.47")
        size_m = float(input("Enter square size in meters (e.g., 5000): ") or "5000")
        wind_speed = float(input("Enter wind speed in m/s (e.g., 10.0): ") or "10.0")
        wind_direction = float(input("Enter wind direction in degrees (0=North, 90=East): ") or "45.0")
    except (ValueError, EOFError):
        print("Invalid input, using defaults.")
        origin_lon, origin_lat, size_m = 153.02, -27.47, 5000
        wind_speed, wind_direction = 10.0, 45.0

    sim = GridFireSimulation(origin_lon=origin_lon, origin_lat=origin_lat, size_m=size_m, 
                             wind_speed=wind_speed, wind_dir=wind_direction, grid_size=100)
    
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 7))
    
    cmap = ListedColormap(['#2d5a27', '#ff4500', '#2F4F4F', '#1E90FF']) 
    img = ax1.imshow(sim.state, cmap=cmap, vmin=0, vmax=3, interpolation='nearest')
    ax1.set_title("Fire Spread Simulation")
    
    topo = ax2.imshow(sim.elevation, cmap='terrain')
    fig.colorbar(topo, ax=ax2, label='Elevation (m)')
    ax2.set_title("Topography Context")

    from matplotlib.patches import Patch
    legend_elements = [
        Patch(facecolor='#2d5a27', label='Unburned Fuel'),
        Patch(facecolor='#ff4500', label='Active Fire'),
        Patch(facecolor='#2F4F4F', label='Burned Out'),
        Patch(facecolor='#1E90FF', label='Water/Firebreak')
    ]
    ax1.legend(handles=legend_elements, loc='lower left')

    def update(frame):
        changes = sim.step()
        img.set_array(sim.state)
        ax1.set_title(f"Tick {frame} | Wind: {sim.wind_speed}m/s @ {sim.wind_dir}°")
        return [img]

    ani = FuncAnimation(fig, update, frames=200, interval=100, blit=True, repeat=False)
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    run_simulation_animated()
