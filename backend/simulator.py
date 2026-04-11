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

# Import processing functions
from data_processing.fuel_processing import process_fuel
from data_processing.elevation_processing import process_elevation

class GridFireSimulation:
    def __init__(self, origin_lon, origin_lat, side_length_m, wind_speed, wind_dir, 
                 cell_res_m=5.0, burn_duration=5):
        """
        Wildfire Simulation with three-pane visualization (Fire, Topo, Veg).
        """
        self.cell_res_m = cell_res_m
        self.size = max(20, int(side_length_m / cell_res_m))
        self.origin_lon = origin_lon
        self.origin_lat = origin_lat
        self.side_length_m = side_length_m
        self.wind_speed = wind_speed
        self.wind_dir = wind_dir
        
        # Alexandridis Coefficients
        self.a_s = 0.078 
        self.c_w1 = 0.045 
        self.c_w2 = 0.131 
        self.burn_duration = burn_duration
        
        # Grid Initialization
        self.state = np.zeros((self.size, self.size), dtype=np.int8)
        self.burn_time = np.zeros((self.size, self.size), dtype=np.int16)
        self.elevation = np.zeros((self.size, self.size), dtype=np.float32)
        self.flammability = np.zeros((self.size, self.size), dtype=np.float32)
        
        self.base_dir = os.path.dirname(os.path.abspath(__file__))

        # 1. RUN DATA PROCESSING AUTOMATICALLY
        print("\n--- Automating Data Processing ---")
        process_fuel(self.origin_lon, self.origin_lat, self.side_length_m)
        process_elevation(self.origin_lon, self.origin_lat, self.side_length_m)

        # 2. Determine target metric bounds
        transformer_to_3577 = Transformer.from_crs("EPSG:4326", "EPSG:3577", always_xy=True)
        self.ox, self.oy = transformer_to_3577.transform(self.origin_lon, self.origin_lat)
        
        half_size = (self.size * self.cell_res_m) / 2
        self.x_min, self.x_max = self.ox - half_size, self.ox + half_size
        self.y_min, self.y_max = self.oy - half_size, self.oy + half_size

        self._load_and_interpolate()

    def _load_and_interpolate(self):
        output_data_dir = os.path.join(self.base_dir, "data_processing", "output_data")
        fuel_path = os.path.join(output_data_dir, "cropped_fuel_types.csv")
        elev_path = os.path.join(output_data_dir, "cropped_elevation.csv")

        df_fuel = pd.read_csv(fuel_path)
        df_elev = pd.read_csv(elev_path)

        # Sync Elevation to Metric
        transformer_elev = Transformer.from_crs("EPSG:4326", "EPSG:3577", always_xy=True)
        ex, ey = transformer_elev.transform(df_elev['longitude'].values, df_elev['latitude'].values)
        df_elev['x'], df_elev['y'] = ex, ey

        # Create target grid
        grid_y, grid_x = np.mgrid[self.y_min:self.y_max:complex(0, self.size), 
                                  self.x_min:self.x_max:complex(0, self.size)]

        print(f"Interpolating {self.size}x{self.size} grid...")
        self.flammability = griddata((df_fuel['latitude'], df_fuel['longitude']), df_fuel['flammability'], (grid_y, grid_x), method='nearest', fill_value=0.0)
        self.elevation = griddata((df_elev['y'], df_elev['x']), df_elev['elevation'], (grid_y, grid_x), method='linear', fill_value=np.nanmean(df_elev['elevation']))

        self.flammability = np.nan_to_num(self.flammability, nan=0.0)
        self.elevation = np.nan_to_num(self.elevation, nan=np.nanmean(self.elevation))

        # Initialize Water/Break state (3) where flammability is 0
        self.state[self.flammability <= 0.01] = 3

        # Initial Ignition
        cy, cx = self.size // 2, self.size // 2
        if self.flammability[cy, cx] < 0.1:
            y_idx, x_idx = np.where(self.flammability > 0.1)
            if len(y_idx) > 0:
                dist = (y_idx - cy)**2 + (x_idx - cx)**2
                idx = np.argmin(dist)
                cy, cx = y_idx[idx], x_idx[idx]
        
        self.state[cy, cx] = 1
        self.burn_time[cy, cx] = self.burn_duration

    def get_snapshot(self):
        """
        Returns a dictionary representing the current simulation state.
        Useful for pausing and resuming by saving the 'snapshot'.
        """
        return {
            "state": self.state.tolist(),
            "burn_time": self.burn_time.tolist(),
            "wind_speed": self.wind_speed,
            "wind_dir": self.wind_dir
        }

    def load_snapshot(self, snapshot):
        """
        Restores the simulation from a snapshot.
        """
        self.state = np.array(snapshot["state"], dtype=np.int8)
        self.burn_time = np.array(snapshot["burn_time"], dtype=np.int16)
        self.wind_speed = snapshot.get("wind_speed", self.wind_speed)
        self.wind_dir = snapshot.get("wind_dir", self.wind_dir)

    def update_grid(self, x, y, new_state, radius=0):
        """
        Updates the state of a cell or an area (blob) at (x, y).
        Returns the list of changed cells.
        """
        changes = []
        if radius <= 0:
            if 0 <= x < self.size and 0 <= y < self.size:
                self.state[y, x] = new_state
                if new_state == 3: # Water/Break
                    self.burn_time[y, x] = 0
                changes.append({"x": int(x), "y": int(y), "s": int(new_state)})
        else:
            # Apply to a circular area
            Y, X = np.ogrid[:self.size, :self.size]
            dist_sq = (X - x)**2 + (Y - y)**2
            mask = dist_sq <= radius**2
            
            y_indices, x_indices = np.where(mask)
            for yi, xi in zip(y_indices, x_indices):
                self.state[yi, xi] = new_state
                if new_state == 3:
                    self.burn_time[yi, xi] = 0
                changes.append({"x": int(xi), "y": int(yi), "s": int(new_state)})
        
        return changes

    @property
    def is_active(self):
        """Returns True if there is at least one cell currently burning."""
        return np.any(self.state == 1)

    def step(self):
        changes = []
        math_wind_dir = math.radians(90 - self.wind_dir)
        
        # 1. Aging and Burn-out (State 1 -> 2)
        burning_mask = (self.state == 1)
        self.burn_time[burning_mask] -= 1
        
        burned_out_mask = (self.burn_time <= 0) & burning_mask
        if np.any(burned_out_mask):
            y_indices, x_indices = np.where(burned_out_mask)
            for y, x in zip(y_indices, x_indices):
                changes.append({"x": int(x), "y": int(y), "s": 2})
            self.state[burned_out_mask] = 2
        
        # 2. Fire Spread (State 0 -> 1)
        unburned_mask = (self.state == 0)
        prob_not_igniting = np.ones_like(self.state, dtype=np.float32)
        
        for dy in [-1, 0, 1]:
            for dx in [-1, 0, 1]:
                if dx == 0 and dy == 0: continue
                angle_spread = math.atan2(-dy, -dx)
                alignment = math.cos(math_wind_dir - angle_spread)
                M_wind = math.exp(self.c_w1 * self.wind_speed + self.c_w2 * self.wind_speed * (alignment - 1))
                dist = self.cell_res_m * (1.414 if dx != 0 and dy != 0 else 1.0)
                
                y_t, x_t = slice(max(0, -dy), min(self.size, self.size - dy)), slice(max(0, -dx), min(self.size, self.size - dx))
                y_n, x_n = slice(max(0, dy), min(self.size, self.size + dy)), slice(max(0, dx), min(self.size, self.size + dx))
                
                neighbor_burning = (self.state[y_n, x_n] == 1)
                if np.any(neighbor_burning):
                    rise = self.elevation[y_t, x_t] - self.elevation[y_n, x_n]
                    slope_deg = np.arctan(rise / dist) * 180 / np.pi
                    M_slope = np.exp(self.a_s * slope_deg)
                    P = self.flammability[y_t, x_t] * M_slope * M_wind
                    P = np.clip(P, 0, 1)
                    prob_not_igniting[y_t, x_t] *= (1.0 - neighbor_burning * P)

        new_ignitions = (np.random.rand(self.size, self.size) < (1.0 - prob_not_igniting)) & unburned_mask
        if np.any(new_ignitions):
            y_indices, x_indices = np.where(new_ignitions)
            for y, x in zip(y_indices, x_indices):
                changes.append({"x": int(x), "y": int(y), "s": 1})
            self.state[new_ignitions] = 1
            self.burn_time[new_ignitions] = self.burn_duration
            
        # 3. Drying (State 3 -> 0)
        # Wet cells (state 3) with fuel (flammability > 0.01) can dry out if near fire
        wet_mask = (self.state == 3) & (self.flammability > 0.01)
        if np.any(wet_mask):
            near_fire = np.zeros_like(self.state, dtype=bool)
            for dy in [-1, 0, 1]:
                for dx in [-1, 0, 1]:
                    if dx == 0 and dy == 0: continue
                    y_n, x_n = slice(max(0, dy), min(self.size, self.size + dy)), slice(max(0, dx), min(self.size, self.size + dx))
                    y_t, x_t = slice(max(0, -dy), min(self.size, self.size - dy)), slice(max(0, -dx), min(self.size, self.size - dx))
                    near_fire[y_t, x_t] |= (self.state[y_n, x_n] == 1)
            
            # Increment 'heat exposure' for wet cells near fire, decrement if not (cooling down)
            exposure_mask = wet_mask & near_fire
            cooling_mask = wet_mask & ~near_fire
            self.burn_time[exposure_mask] += 1
            self.burn_time[cooling_mask] = np.maximum(0, self.burn_time[cooling_mask] - 1)
            
            # If exposure exceeds a limit (2x burn duration), low chance to dry out
            drying_limit = self.burn_duration * 2
            drying_eligible = exposure_mask & (self.burn_time >= drying_limit)
            dried_out = drying_eligible & (np.random.rand(self.size, self.size) < 0.1) # 10% chance per tick
            
            if np.any(dried_out):
                y_indices, x_indices = np.where(dried_out)
                for y, x in zip(y_indices, x_indices):
                    changes.append({"x": int(x), "y": int(y), "s": 0})
                self.state[dried_out] = 0
                self.burn_time[dried_out] = 0
                
        return changes

def run_simulation_animated():
    print("\n--- Multimodal Wildfire Simulator ---")
    try:
        lon = float(input("Longitude (e.g. 153.02): ") or "153.02")
        lat = float(input("Latitude (e.g. -27.47): ") or "-27.47")
        side_length = float(input("Side length in meters (e.g. 2000): ") or "2000")
        ws = float(input("Wind speed m/s (e.g. 10): ") or "10")
        wd = float(input("Wind dir deg (0=N, 90=E): ") or "45")
    except:
        lon, lat, side_length, ws, wd = 153.02, -27.47, 2000, 10, 45

    sim = GridFireSimulation(lon, lat, side_length, ws, wd)
    
    # 3-Pane Layout
    fig, (ax1, ax2, ax3) = plt.subplots(1, 3, figsize=(18, 6))
    cmap_fire = ListedColormap(['#2d5a27', '#ff4500', '#2F4F4F', '#1E90FF']) 
    ext = [sim.x_min, sim.x_max, sim.y_min, sim.y_max]
    
    # Fire Simulation
    img_fire = ax1.imshow(sim.state, cmap=cmap_fire, vmin=0, vmax=3, origin='lower', extent=ext, interpolation='nearest')
    ax1.set_title("Live Fire Spread")
    ax1.set_xlabel("Easting (m)"); ax1.set_ylabel("Northing (m)")
    
    # Topography
    topo = ax2.imshow(sim.elevation, cmap='terrain', origin='lower', extent=ext)
    plt.colorbar(topo, ax=ax2, label='Elevation (m)')
    ax2.set_title("Topography Context")
    ax2.set_xlabel("Easting (m)")
    
    # Vegetation/Flammability
    veg = ax3.imshow(sim.flammability, cmap='YlGn', origin='lower', extent=ext, vmin=0, vmax=1)
    plt.colorbar(veg, ax=ax3, label='Flammability Index (0-1)')
    ax3.set_title("Fuel Risk (Vegetation)")
    ax3.set_xlabel("Easting (m)")

    # Unified Legend for Fire
    from matplotlib.patches import Patch
    legend_elements = [
        Patch(facecolor='#2d5a27', label='Fuel'),
        Patch(facecolor='#ff4500', label='Burning'),
        Patch(facecolor='#2F4F4F', label='Burned'),
        Patch(facecolor='#1E90FF', label='Water/Break')
    ]
    ax1.legend(handles=legend_elements, loc='lower left', fontsize='x-small')

    def frame_generator():
        for frame in range(10000): # High upper limit
            if not sim.is_active:
                print(f"Simulation finished at tick {frame}: No fire remaining.")
                break
            yield frame

    def update(frame):
        sim.step()
        img_fire.set_array(sim.state)
        ax1.set_title(f"Tick {frame} | Wind: {sim.wind_speed}m/s @ {sim.wind_dir}°")
        return [img_fire]

    ani = FuncAnimation(fig, update, frames=frame_generator, interval=50, blit=True, repeat=False, cache_frame_data=False)
    plt.tight_layout(); plt.show()

if __name__ == "__main__":
    run_simulation_animated()
