import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from matplotlib.colors import ListedColormap
from matplotlib.animation import FuncAnimation
import math
import os
from pyproj import Transformer
from scipy.interpolate import griddata

# Support both 'python -m backend.simulator' (from repo root)
# and 'python simulator.py' (from backend/ directory).
try:
    from backend.data_processing.fuel_processing import process_fuel
    from backend.data_processing.elevation_processing import process_elevation
except ImportError:
    from data_processing.fuel_processing import process_fuel
    from data_processing.elevation_processing import process_elevation


class GridFireSimulation:
    def __init__(self, origin_lon, origin_lat, size_m, wind_speed, wind_dir,
                 cell_res_m=5.0, burn_duration=5,
                 flammability=None, elevation=None, veg_grid=None):
        """
        Wildfire Simulation (Alexandridis CA).
        States: 0=Unburned  1=Burning  2=Burned  3=Control Line  4=Watered

        Pre-loaded path: pass flammability, elevation, veg_grid numpy arrays.
          origin_lon/lat/size_m may be None; grid size is derived from array shape.
        CLI path: pass origin_lon, origin_lat, size_m; arrays are processed from GIS files.
        """
        self.wind_speed = wind_speed
        self.wind_dir = wind_dir
        self.burn_duration = burn_duration
        self.tick = 0

        # Alexandridis coefficients
        self.a_s  = 0.078
        self.c_w1 = 0.045
        self.c_w2 = 0.131

        if flammability is not None:
            # ── Pre-loaded path ──────────────────────────────────────────────
            self.flammability = flammability.astype(np.float32)
            self.elevation    = elevation.astype(np.float32)
            self.veg_grid     = veg_grid  # uint8 or None
            self.size         = self.flammability.shape[0]
            self.cell_res_m   = 10.0

            self.state     = np.zeros((self.size, self.size), dtype=np.int8)
            self.burn_time = np.zeros((self.size, self.size), dtype=np.int16)

            # Water bodies (flammability <= 0.01) become permanent barriers
            self.state[self.flammability <= 0.01] = 3

        else:
            # ── Original CLI path ────────────────────────────────────────────
            self.cell_res_m   = cell_res_m
            self.size         = max(20, int(size_m / cell_res_m))
            self.origin_lon   = origin_lon
            self.origin_lat   = origin_lat
            self.size_m       = size_m
            self.veg_grid     = None

            self.state     = np.zeros((self.size, self.size), dtype=np.int8)
            self.burn_time = np.zeros((self.size, self.size), dtype=np.int16)
            self.elevation = np.zeros((self.size, self.size), dtype=np.float32)
            self.flammability = np.zeros((self.size, self.size), dtype=np.float32)

            self.base_dir = os.path.dirname(os.path.abspath(__file__))

            print(f"\n--- Processing Data for ({origin_lon}, {origin_lat}) ---")
            process_fuel(self.origin_lon, self.origin_lat, self.size_m)
            process_elevation(self.origin_lon, self.origin_lat, self.size_m)

            transformer = Transformer.from_crs("EPSG:4326", "EPSG:3577", always_xy=True)
            self.ox, self.oy = transformer.transform(origin_lon, origin_lat)
            half = (self.size * self.cell_res_m) / 2
            self.x_min, self.x_max = self.ox - half, self.ox + half
            self.y_min, self.y_max = self.oy - half, self.oy + half

            self._load_and_interpolate()

    # ── Ignition ─────────────────────────────────────────────────────────────

    def seed_fire(self):
        """Ignite a 3x3 cluster at grid centre (nearest flammable cell). Returns changes."""
        cy, cx = self.size // 2, self.size // 2
        changes = []
        for dy in range(-1, 2):
            for dx in range(-1, 2):
                y, x = cy + dy, cx + dx
                if 0 <= y < self.size and 0 <= x < self.size:
                    if self.state[y, x] == 0 and self.flammability[y, x] > 0.01:
                        self.state[y, x] = 1
                        self.burn_time[y, x] = self.burn_duration
                        changes.append({"x": int(x), "y": int(y), "s": 1})
        return changes

    # ── Wind ─────────────────────────────────────────────────────────────────

    def set_wind(self, wind_dir, wind_speed):
        """Update wind direction and speed mid-simulation."""
        self.wind_dir   = ((wind_dir % 360) + 360) % 360
        self.wind_speed = max(0.0, min(100.0, float(wind_speed)))

    # ── Stats ─────────────────────────────────────────────────────────────────

    def get_stats(self):
        """Return stats dict matching the frontend protocol."""
        burning   = int(np.sum(self.state == 1))
        burned    = int(np.sum(self.state == 2))
        total     = self.size * self.size
        burned_ha = round(burned * 0.01, 2)
        score     = max(0, 100 - int((burned / total) * 150))
        return {
            "burning":  burning,
            "burned":   burned,
            "burnedHa": burned_ha,
            "score":    score,
            "tick":     self.tick,
            "windDir":  self.wind_dir,
            "windSpd":  self.wind_speed,
        }

    # ── Simulation step ──────────────────────────────────────────────────────

    def step(self):
        """Advance one tick. Returns list of changed cells: [{"x":...,"y":...,"s":...}]."""
        self.tick += 1
        prev_state = self.state.copy()

        math_wind_dir = math.radians(90 - self.wind_dir)

        # 1. Aging and burn-out (1 -> 2)
        burning_mask = (self.state == 1)
        self.burn_time[burning_mask] -= 1
        self.state[(self.burn_time <= 0) & burning_mask] = 2

        # 2. Fire spread (0 -> 1)
        unburned_mask     = (self.state == 0)
        prob_not_igniting = np.ones_like(self.state, dtype=np.float32)

        for dy in [-1, 0, 1]:
            for dx in [-1, 0, 1]:
                if dx == 0 and dy == 0:
                    continue
                angle_spread = math.atan2(-dy, -dx)
                alignment    = math.cos(math_wind_dir - angle_spread)
                M_wind       = math.exp(self.c_w1 * self.wind_speed +
                                        self.c_w2 * self.wind_speed * (alignment - 1))
                dist = self.cell_res_m * (1.414 if dx != 0 and dy != 0 else 1.0)

                y_t = slice(max(0, -dy), min(self.size, self.size - dy))
                x_t = slice(max(0, -dx), min(self.size, self.size - dx))
                y_n = slice(max(0,  dy), min(self.size, self.size + dy))
                x_n = slice(max(0,  dx), min(self.size, self.size + dx))

                neighbor_burning = (self.state[y_n, x_n] == 1)
                if np.any(neighbor_burning):
                    rise      = self.elevation[y_t, x_t] - self.elevation[y_n, x_n]
                    slope_deg = np.arctan(rise / dist) * 180 / np.pi
                    M_slope   = np.exp(self.a_s * slope_deg)
                    P         = self.flammability[y_t, x_t] * M_slope * M_wind
                    P         = np.clip(P, 0, 1)
                    prob_not_igniting[y_t, x_t] *= (1.0 - neighbor_burning * P)

        new_ignitions = (
            (np.random.rand(self.size, self.size) < (1.0 - prob_not_igniting))
            & unburned_mask
        )
        self.state[new_ignitions]     = 1
        self.burn_time[new_ignitions] = self.burn_duration

        # 3. Drying (4 -> 0)
        wet_mask = (self.state == 4) & (self.flammability > 0.01)
        if np.any(wet_mask):
            near_fire = np.zeros_like(self.state, dtype=bool)
            for dy in [-1, 0, 1]:
                for dx in [-1, 0, 1]:
                    if dx == 0 and dy == 0:
                        continue
                    y_n = slice(max(0,  dy), min(self.size, self.size + dy))
                    x_n = slice(max(0,  dx), min(self.size, self.size + dx))
                    y_t = slice(max(0, -dy), min(self.size, self.size - dy))
                    x_t = slice(max(0, -dx), min(self.size, self.size - dx))
                    near_fire[y_t, x_t] |= (self.state[y_n, x_n] == 1)

            self.burn_time[wet_mask & near_fire]  += 1
            self.burn_time[wet_mask & ~near_fire]  = np.maximum(
                0, self.burn_time[wet_mask & ~near_fire] - 1
            )
            drying_limit = self.burn_duration * 2
            dried_out = (
                wet_mask
                & (self.burn_time >= drying_limit)
                & (np.random.rand(self.size, self.size) < 0.1)
            )
            self.state[dried_out]     = 0
            self.burn_time[dried_out] = 0

        # Compute sparse diff
        diff = self.state != prev_state
        ys, xs = np.where(diff)
        return [{"x": int(x), "y": int(y), "s": int(self.state[y, x])}
                for y, x in zip(ys, xs)]

    # ── Tool actions ──────────────────────────────────────────────────────────

    def add_water_drop(self, x, y, radius=3):
        """Apply circular water drop. Returns list of changed cells."""
        yy, xx  = np.mgrid[:self.size, :self.size]
        dist_sq = (xx - x) ** 2 + (yy - y) ** 2
        mask    = dist_sq <= radius ** 2
        target  = mask & ((self.state == 0) | (self.state == 1))
        self.state[target]     = 4
        self.burn_time[target] = 0
        ys, xs = np.where(target)
        return [{"x": int(xi), "y": int(yi), "s": 4} for yi, xi in zip(ys, xs)]

    def add_control_line(self, x0, y0, x1, y1, thickness=2.4):
        """Add permanent control line (state 3). For CLI use."""
        yy, xx   = np.mgrid[:self.size, :self.size]
        ldx, ldy = x1 - x0, y1 - y0
        llen2    = ldx * ldx + ldy * ldy
        if llen2 == 0:
            dist_sq = (xx - x0) ** 2 + (yy - y0) ** 2
        else:
            t       = np.clip(((xx - x0) * ldx + (yy - y0) * ldy) / llen2, 0, 1)
            dist_sq = (xx - (x0 + t * ldx)) ** 2 + (yy - (y0 + t * ldy)) ** 2
        mask = dist_sq <= (thickness / 2.0) ** 2
        self.state[(mask) & (self.state == 0)] = 3

    # ── CLI path helpers ──────────────────────────────────────────────────────

    def _load_and_interpolate(self):
        output_dir = os.path.join(self.base_dir, "data_processing", "output_data")
        df_fuel = pd.read_csv(os.path.join(output_dir, "cropped_fuel_types.csv"))
        df_elev = pd.read_csv(os.path.join(output_dir, "cropped_elevation.csv"))

        transformer = Transformer.from_crs("EPSG:4326", "EPSG:3577", always_xy=True)

        ex, ey = transformer.transform(df_elev['longitude'].values, df_elev['latitude'].values)
        df_elev['x'], df_elev['y'] = ex, ey

        fx, fy = transformer.transform(df_fuel['longitude'].values, df_fuel['latitude'].values)
        df_fuel['x'], df_fuel['y'] = fx, fy

        grid_y, grid_x = np.mgrid[
            self.y_min:self.y_max:complex(0, self.size),
            self.x_min:self.x_max:complex(0, self.size),
        ]

        print(f"Interpolating {self.size}x{self.size} grid ({self.cell_res_m}m resolution)...")
        self.flammability = griddata(
            (df_fuel['y'], df_fuel['x']), df_fuel['flammability'],
            (grid_y, grid_x), method='nearest', fill_value=0.0,
        ).astype(np.float32)
        self.elevation = griddata(
            (df_elev['y'], df_elev['x']), df_elev['elevation'],
            (grid_y, grid_x), method='linear',
            fill_value=float(np.nanmean(df_elev['elevation'])),
        ).astype(np.float32)

        self.flammability = np.nan_to_num(self.flammability, nan=0.0)
        self.elevation    = np.nan_to_num(
            self.elevation, nan=float(np.nanmean(self.elevation))
        )

        self.state[self.flammability <= 0.01] = 3

        # Initial ignition for CLI visualisation
        cy, cx = self.size // 2, self.size // 2
        if self.flammability[cy, cx] < 0.1:
            y_idx, x_idx = np.where(self.flammability > 0.1)
            if len(y_idx) > 0:
                dist = (y_idx - cy) ** 2 + (x_idx - cx) ** 2
                idx  = np.argmin(dist)
                cy, cx = y_idx[idx], x_idx[idx]
        self.state[cy, cx]     = 1
        self.burn_time[cy, cx] = self.burn_duration


def run_simulation_animated():
    presets = {
        "1": {"name": "Toowoomba Escarpment", "lon": 151.99, "lat": -27.58, "area": 4000, "ws": 12, "wd": 90},
        "2": {"name": "Springbrook Plateau",  "lon": 153.27, "lat": -28.14, "area": 4000, "ws": 10, "wd": 45},
        "3": {"name": "Noosa Everglades",     "lon": 153.02, "lat": -26.30, "area": 5000, "ws":  8, "wd": 180},
        "4": {"name": "Bunya Mountains",      "lon": 151.59, "lat": -26.90, "area": 3000, "ws": 10, "wd": 270},
        "5": {"name": "Boondall Wetlands",    "lon": 153.07, "lat": -27.34, "area": 4000, "ws": 15, "wd": 45},
    }

    print("\n=== Wildfire Simulation Presets ===")
    for k, v in presets.items():
        print(f"{k}. {v['name']}")
    print("0. Custom Configuration")

    choice = input("\nSelect a scenario (0-5) [Default: 0]: ") or "0"

    if choice in presets:
        p = presets[choice]
        lon, lat, area_side, ws, wd = p['lon'], p['lat'], p['area'], p['ws'], p['wd']
    else:
        try:
            lon       = float(input("Longitude (e.g. 153.02): ") or "153.02")
            lat       = float(input("Latitude (e.g. -27.47): ")  or "-27.47")
            area_side = float(input("Area side length in meters: ") or "2000")
            ws        = float(input("Wind speed m/s: ") or "10")
            wd        = float(input("Wind dir deg (0=N, 90=E): ") or "45")
        except Exception:
            lon, lat, area_side, ws, wd = 153.02, -27.47, 2000, 10, 45

    sim = GridFireSimulation(lon, lat, area_side, ws, wd)

    fig, (ax1, ax2, ax3) = plt.subplots(1, 3, figsize=(18, 6))
    cmap_fire = ListedColormap(['#2d5a27', '#ff4500', '#2F4F4F', '#3b82f6', '#0ea5e9'])
    ext = [sim.x_min, sim.x_max, sim.y_min, sim.y_max]

    img_fire = ax1.imshow(sim.state, cmap=cmap_fire, vmin=0, vmax=4,
                          origin='lower', extent=ext, interpolation='nearest')
    ax1.set_title("Live Fire Spread")
    ax1.set_xlabel("Easting (m)")
    ax1.set_ylabel("Northing (m)")

    topo = ax2.imshow(sim.elevation, cmap='terrain', origin='lower', extent=ext)
    plt.colorbar(topo, ax=ax2, label='Elevation (m)')
    ax2.set_title("Topography")

    veg = ax3.imshow(sim.flammability, cmap='YlGn', origin='lower', extent=ext, vmin=0, vmax=1)
    plt.colorbar(veg, ax=ax3, label='Flammability Index')
    ax3.set_title("Fuel Risk")

    click_points = []

    def on_click(event):
        if event.inaxes != ax1:
            return
        gx = int((event.xdata - sim.x_min) / sim.cell_res_m)
        gy = int((event.ydata - sim.y_min) / sim.cell_res_m)
        if event.button == 3:
            sim.add_water_drop(gx, gy)
            click_points.clear()
        elif event.button == 1:
            click_points.append((gx, gy))
            if len(click_points) == 2:
                sim.add_control_line(*click_points[0], *click_points[1])
                click_points.clear()

    fig.canvas.mpl_connect('button_press_event', on_click)

    from matplotlib.patches import Patch
    legend_elements = [
        Patch(facecolor='#2d5a27', label='Fuel'),
        Patch(facecolor='#ff4500', label='Burning'),
        Patch(facecolor='#2F4F4F', label='Burned'),
        Patch(facecolor='#3b82f6', label='Control Line'),
        Patch(facecolor='#0ea5e9', label='Watered'),
    ]
    ax1.legend(handles=legend_elements, loc='lower left', fontsize='x-small')

    def update(frame):
        sim.step()
        img_fire.set_array(sim.state)
        ax1.set_title(f"Tick {frame} | Wind: {sim.wind_speed}m/s @ {sim.wind_dir}°")
        return [img_fire]

    ani = FuncAnimation(fig, update, frames=200, interval=50, blit=True, repeat=False)
    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    run_simulation_animated()
