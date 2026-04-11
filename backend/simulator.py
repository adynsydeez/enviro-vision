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
    def __init__(self, size=100, p_base_fire=0.3, burn_duration=5, c_s=2.0, c_w=0.1):
        self.size = size
        self.p_base_fire = p_base_fire
        self.burn_duration = burn_duration
        self.c_s = c_s # Slope constant
        self.c_w = c_w # Wind constant
        
        # Grid Initialization
        # States: 0=Dry, 1=Burning, 2=Burned, 3=Watered
        self.state = np.zeros((size, size), dtype=int)
        self.burn_time = np.zeros((size, size), dtype=int)
        self.elevation = np.zeros((size, size), dtype=float)
        self.flammability = np.ones((size, size), dtype=float) * 0.5
        
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.cell_res_m = 10.0 # Default, will be calculated from data

        self._load_real_data()

    def _load_real_data(self):
        """Loads processed fuel and elevation CSVs and interpolates onto the grid."""
        fuel_path = os.path.join(self.base_dir, "cropped_fuel_types.csv")
        elev_path = os.path.join(self.base_dir, "cropped_elevation.csv")

        if not os.path.exists(fuel_path) or not os.path.exists(elev_path):
            print("Warning: Real data files not found. Using synthetic landscape.")
            self._setup_synthetic_environment()
            return

        print(f"Loading data from {fuel_path} and {elev_path}...")
        df_fuel = pd.read_csv(fuel_path)
        df_elev = pd.read_csv(elev_path)

        # 1. Coordinate Synchronization
        # Fuel data is in EPSG:3577 (Albers), Elevation is in EPSG:4326 (WGS84)
        # We'll project elevation to EPSG:3577
        transformer = Transformer.from_crs("EPSG:4326", "EPSG:3577", always_xy=True)
        elev_x, elev_y = transformer.transform(df_elev['longitude'].values, df_elev['latitude'].values)
        df_elev['x'] = elev_x
        df_elev['y'] = elev_y

        # 2. Determine Bounding Box (from fuel data as it's the primary risk layer)
        x_min, x_max = df_fuel['longitude'].min(), df_fuel['longitude'].max()
        y_min, y_max = df_fuel['latitude'].min(), df_fuel['latitude'].max()
        
        self.cell_res_m = (x_max - x_min) / self.size
        print(f"Grid bounds: X[{x_min:.1f}, {x_max:.1f}], Y[{y_min:.1f}, {y_max:.1f}]")
        print(f"Calculated resolution: {self.cell_res_m:.2f}m per cell")

        # 3. Create Target Grid
        grid_x, grid_y = np.mgrid[x_min:x_max:complex(0, self.size), 
                                  y_min:y_max:complex(0, self.size)]

        # 4. Interpolate Data
        print("Interpolating flammability...")
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

        # Handle NaNs from interpolation
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

    def step(self, wind_speed, wind_dir_deg):
        """Advances the simulation by one time step."""
        wind_dir_rad = math.radians(wind_dir_deg)
        next_state = self.state.copy()
        next_burn_time = self.burn_time.copy()

        # Pre-calculate neighbors for efficiency if needed, but for 100x100 simple loop is fine
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
                    # Watered cells or Non-flammable cells don't ignite
                    if self.flammability[y, x] <= 0.01:
                        continue

                    prob_not_combusting = 1.0
                    
                    # Check 8 neighbors
                    for dy in [-1, 0, 1]:
                        for dx in [-1, 0, 1]:
                            if dx == 0 and dy == 0: continue
                            
                            ny, nx = y + dy, x + dx
                            if 0 <= ny < self.size and 0 <= nx < self.size:
                                if self.state[ny, nx] == 1:
                                    dist = self.cell_res_m * (math.sqrt(2) if dx != 0 and dy != 0 else 1.0)
                                    
                                    # Slope Factor (Ps)
                                    # Spread is faster uphill (positive slope)
                                    rise = self.elevation[y, x] - self.elevation[ny, nx]
                                    slope_val = rise / dist
                                    M_slope = math.exp(self.c_s * slope_val)
                                    
                                    # Wind Factor (Pw)
                                    angle_to_neighbor = self.calculate_angle(dx, dy)
                                    # Alignment: 1 if wind is blowing FROM neighbor TO current cell
                                    alignment = math.cos(wind_dir_rad - angle_to_neighbor)
                                    M_wind = math.exp(self.c_w * wind_speed * alignment)
                                    
                                    # Probability of ignition from this neighbor
                                    # P = P0 * (1+Pveg) * (1+Pden) * Pw * Ps
                                    # Here flammability covers Pveg/Pden
                                    P_ignite = self.p_base_fire * self.flammability[y, x] * M_slope * M_wind
                                    P_ignite = min(1.0, P_ignite)
                                    
                                    prob_not_combusting *= (1.0 - P_ignite)

                    if random.random() < (1.0 - prob_not_combusting):
                        next_state[y, x] = 1
                        next_burn_time[y, x] = self.burn_duration

        changes = []
        # Find changes for the sparse update protocol
        diff_indices = np.where(next_state != self.state)
        for y, x in zip(diff_indices[0], diff_indices[1]):
            changes.append({"x": int(x), "y": int(y), "s": int(next_state[y, x])})

        self.state = next_state
        self.burn_time = next_burn_time
        return changes

def run_simulation_animated():
    # Use a larger grid for real data
    sim = GridFireSimulation(size=100, p_base_fire=0.4, burn_duration=5)
    
    try:
        print("\n--- Simulation Environment Loaded ---")
        wind_speed = float(input("Enter wind speed in m/s (e.g., 10.0): ") or "10.0")
        wind_direction = float(input("Enter wind direction in degrees (0=North, 90=East): ") or "45.0")
    except (ValueError, EOFError):
        wind_speed, wind_direction = 10.0, 45.0

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 7))
    
    # 1. Fire Simulation Plot
    cmap = ListedColormap(['#2d5a27', '#ff4500', '#2F4F4F', '#1E90FF']) # Green for fuel
    img = ax1.imshow(sim.state, cmap=cmap, vmin=0, vmax=3, interpolation='nearest')
    ax1.set_title("Fire Spread Simulation")
    
    # 2. Elevation/Topo Plot for context
    topo = ax2.imshow(sim.elevation, cmap='terrain')
    fig.colorbar(topo, ax=ax2, label='Elevation (m)')
    ax2.set_title("Topography Context")

    # Add legend
    from matplotlib.patches import Patch
    legend_elements = [
        Patch(facecolor='#2d5a27', label='Unburned Fuel'),
        Patch(facecolor='#ff4500', label='Active Fire'),
        Patch(facecolor='#2F4F4F', label='Burned Out'),
        Patch(facecolor='#1E90FF', label='Water/Firebreak')
    ]
    ax1.legend(handles=legend_elements, loc='lower left')

    def update(frame):
        changes = sim.step(wind_speed, wind_direction)
        img.set_array(sim.state)
        ax1.set_title(f"Tick {frame} | Wind: {wind_speed}m/s @ {wind_direction}°")
        return [img]

    ani = FuncAnimation(fig, update, frames=150, interval=100, blit=True, repeat=False)
    plt.tight_layout()
    plt.show()

if __name__ == "__main__":
    run_simulation_animated()
