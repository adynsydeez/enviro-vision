/**
 * MockWebSocket — mirrors the native WebSocket API.
 * Internally runs a simplified Alexandridis cellular automata simulation
 * and emits the same FULL_SYNC / TICK_UPDATE message format the real
 * FastAPI backend will send over /ws/simulation.
 *
 * To switch to the real backend, replace:
 *   new MockWebSocket(scenario)
 * with:
 *   new WebSocket('ws://localhost:8000/ws/simulation')
 * in useSimulation.js — nothing else changes.
 */

import { GRID_SIZE } from "../constants";
export { GRID_SIZE }; // re-export for any legacy direct imports

const TICK_MS = 500;
const BURN_DURATION = 14; // ticks a cell burns before becoming ash
const WATER_DURATION = 20; // ticks water persists before evaporating (~10 s)
const WATER_RADIUS = 3; // 7×7 circle drop (cells with dx²+dy² ≤ 9)
const SPREAD_PROB = 0.16; // base ignition probability per neighbour per tick
const DIRS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

// Wind: direction the wind is blowing FROM (meteorological convention), degrees
// Downwind vector (direction fire spreads toward) = windDir + 180
const WIND_DIR = 45; // NE wind → fire spreads SW
const WIND_SPD = 30; // km/h
const WIND_BIAS = 2.5; // max multiplier at full alignment + full speed
async function loadElevationGrid(gs) {
  const response = await fetch("/cropped_elevation.csv");
  const text = await response.text();
  const lines = text.trim().split("\n").slice(1);

  const points = [];
  let elevMin = Infinity,
    elevMax = -Infinity;
  for (const line of lines) {
    const [lon, lat, elev] = line.split(",").map(Number);
    if (isNaN(elev) || isNaN(lon) || isNaN(lat)) continue;
    points.push([lon, lat, elev]);
    if (elev < elevMin) elevMin = elev;
    if (elev > elevMax) elevMax = elev;
  }

  const lons = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  const minLon = Math.min(...lons),
    maxLon = Math.max(...lons);
  const minLat = Math.min(...lats),
    maxLat = Math.max(...lats);
  const range = elevMax - elevMin || 1;

  // Build a coarse lookup grid from the CSV points
  const COARSE = 200;
  const coarse = new Float32Array(COARSE * COARSE);
  const coarseCount = new Uint16Array(COARSE * COARSE);

  for (const [lon, lat, elev] of points) {
    const col = Math.min(
      Math.floor(((lon - minLon) / (maxLon - minLon)) * (COARSE - 1)),
      COARSE - 1,
    );
    const row = Math.min(
      Math.floor(((maxLat - lat) / (maxLat - minLat)) * (COARSE - 1)),
      COARSE - 1,
    );
    coarse[row * COARSE + col] += elev;
    coarseCount[row * COARSE + col]++;
  }

  // Average filled cells
  for (let i = 0; i < COARSE * COARSE; i++) {
    if (coarseCount[i] > 0) coarse[i] /= coarseCount[i];
    else coarse[i] = -1; // mark empty
  }

  // Fill empty coarse cells with nearest filled neighbour
  // Fill empty coarse cells — two-pass forward/backward smear
  for (let row = 0; row < COARSE; row++) {
    let last = elevMin;
    for (let col = 0; col < COARSE; col++) {
      const i = row * COARSE + col;
      if (coarse[i] >= 0) last = coarse[i];
      else coarse[i] = last;
    }
    last = elevMin;
    for (let col = COARSE - 1; col >= 0; col--) {
      const i = row * COARSE + col;
      coarse[i] = (coarse[i] + last) / 2;
      last = coarse[i];
    }
  }

  for (let col = 0; col < COARSE; col++) {
    let last = elevMin;
    for (let row = 0; row < COARSE; row++) {
      const i = row * COARSE + col;
      if (coarse[i] >= 0) last = coarse[i];
      else coarse[i] = last;
    }
    last = elevMin;
    for (let row = COARSE - 1; row >= 0; row--) {
      const i = row * COARSE + col;
      coarse[i] = (coarse[i] + last) / 2;
      last = coarse[i];
    }
  }

  // Upsample coarse grid to full gs×gs output
  const out = new Float32Array(gs * gs);
  for (let row = 0; row < gs; row++) {
    for (let col = 0; col < gs; col++) {
      const cr = Math.min(Math.floor((row / gs) * COARSE), COARSE - 1);
      const cc = Math.min(Math.floor((col / gs) * COARSE), COARSE - 1);
      const elev = coarse[cr * COARSE + cc];
      out[row * gs + col] = 200 + ((elev - elevMin) / range) * 750;
    }
  }
  return out;
}

export class MockWebSocket {
  constructor(scenario) {
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this.readyState = 0; // CONNECTING

    this._scenario = scenario;
    this._grid = new Uint8Array(GRID_SIZE * GRID_SIZE);
    this._burnAge = new Uint8Array(GRID_SIZE * GRID_SIZE);
    this._tick = 0;
    this._interval = null;
    this._paused = true;
    this._windDir = WIND_DIR;
    this._windSpd = WIND_SPD;

    this._vegGrid = new Uint8Array(GRID_SIZE * GRID_SIZE);
    this._waterAge = new Uint8Array(GRID_SIZE * GRID_SIZE);
    // Pre-water state (0=unburned,1=burning,2=burned) recorded when water is applied,
    // so evaporation can restore the correct previous state instead of always unburned.
    this._preWaterState = new Uint8Array(GRID_SIZE * GRID_SIZE);
    this._generateVegetation();
    this._elevationGrid = null;

    // Precompute downwind unit vector (direction fire spreads toward)
    this._updateWindVec();

    // Simulate async handshake — store handle so close() can cancel it
    // Then in the setTimeout where FULL_SYNC is emitted, wrap it:
    this._connectTimer = setTimeout(async () => {
      this.readyState = 1;
      this.onopen?.({ type: "open" });

      // Get scenario bounds from getBounds util (same as MapView does)
      const center = this._scenario.center; // [-28.231, 153.1196]
      const halfDeg = 5 / 111; // ~5km in degrees
      const bounds = {
        minLat: center[0] - halfDeg,
        maxLat: center[0] + halfDeg,
        minLon: center[1] - halfDeg,
        maxLon: center[1] + halfDeg,
      };

      const elevationGrid = await loadElevationGrid(GRID_SIZE);

      this._emit({
        type: "FULL_SYNC",
        gridSize: GRID_SIZE,
        grid: this._snapshot(),
        vegetationGrid: Array.from(this._vegGrid),
        elevationGrid: Array.from(elevationGrid),
        stats: this._calcStats(),
      });

      if (!this._paused) {
        this._interval = setInterval(() => this._tick_(), TICK_MS);
      }
    }, 80);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  send(raw) {
    try {
      const msg = JSON.parse(raw);
      if (msg.action === "start") {
        const changes = this._seedFire();
        this._emit({
          type: "TICK_UPDATE",
          changes,
          stats: this._calcStats(),
        });
        return;
      }
      if (msg.action === "pause") {
        this._pause();
        return;
      }
      if (msg.action === "resume") {
        this._resume();
        return;
      }
      this._handleInteraction(msg);
    } catch {
      /* ignore malformed messages */
    }
  }

  close() {
    clearTimeout(this._connectTimer);
    clearInterval(this._interval);
    this.readyState = 3; // CLOSED
    this.onopen = null;
    this.onmessage = null;
    const onclose = this.onclose;
    this.onclose = null;
    onclose?.({ type: "close" });
  }

  setWind(dir, spd) {
    this._windDir = ((dir % 360) + 360) % 360;
    this._windSpd = Math.max(0, Math.min(100, spd));
    this._updateWindVec();
  }

  _pause() {
    if (this._paused) return;
    clearInterval(this._interval);
    this._interval = null;
    this._paused = true;
  }

  _resume() {
    if (!this._paused) return;
    this._paused = false;
    this._interval = setInterval(() => this._tick_(), TICK_MS);
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  _updateWindVec() {
    // Downwind = wind direction + 180° (direction the fire is pushed toward)
    const rad = (((this._windDir + 180) % 360) * Math.PI) / 180;
    this._dwx = Math.sin(rad); // +x = east
    this._dwy = -Math.cos(rad); // +y = south (grid row increases downward)
  }

  _generateVegetation() {
    // Voronoi on a coarse grid produces large coherent regions instead of random noise.
    // Each coarse cell (= 10 real cells = 100 m) takes the type of its nearest seed.
    const COARSE = 100;
    const NUM_SEEDS = 120;
    const scale = GRID_SIZE / COARSE; // 10 real cells per coarse cell

    // Scatter seeds at random positions on the coarse grid
    const seeds = [];
    for (let i = 0; i < NUM_SEEDS; i++) {
      seeds.push({
        x: Math.random() * COARSE,
        y: Math.random() * COARSE,
        type: Math.floor(Math.random() * 15) + 1,
      });
    }

    // Build coarse Voronoi (100×100 × 120 seeds = 1.2 M comparisons — fast)
    const coarse = new Uint8Array(COARSE * COARSE);
    for (let cy = 0; cy < COARSE; cy++) {
      for (let cx = 0; cx < COARSE; cx++) {
        let minD = Infinity,
          nearest = 1;
        for (const s of seeds) {
          const d = (cx - s.x) ** 2 + (cy - s.y) ** 2;
          if (d < minD) {
            minD = d;
            nearest = s.type;
          }
        }
        coarse[cy * COARSE + cx] = nearest;
      }
    }

    // Nearest-neighbour upsample to full grid
    for (let y = 0; y < GRID_SIZE; y++) {
      const cy = Math.min(Math.floor(y / scale), COARSE - 1);
      for (let x = 0; x < GRID_SIZE; x++) {
        const cx = Math.min(Math.floor(x / scale), COARSE - 1);
        this._vegGrid[y * GRID_SIZE + x] = coarse[cy * COARSE + cx];
      }
    }
  }

  _i(x, y) {
    return y * GRID_SIZE + x;
  }

  _seedFire() {
    const changes = [];
    const cx = Math.floor(GRID_SIZE / 2);
    const cy = Math.floor(GRID_SIZE / 2);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx,
          y = cy + dy;
        if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE) {
          const i = this._i(x, y);
          this._grid[i] = 1;
          changes.push({ x, y, s: 1 });
        }
      }
    }
    return changes;
  }

  _tick_() {
    this._tick++;
    const changes = this._computeSpread();
    this._emit({
      type: "TICK_UPDATE",
      changes,
      stats: this._calcStats(),
    });
  }

  _computeSpread() {
    const changes = [];
    const next = new Uint8Array(this._grid);
    const nextAge = new Uint8Array(this._burnAge);

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const i = this._i(x, y);
        const state = this._grid[i];

        if (state === 1) {
          nextAge[i]++;
          if (nextAge[i] >= BURN_DURATION) {
            next[i] = 2;
            changes.push({ x, y, s: 2 });
            continue;
          }

          const windT = Math.min(this._windSpd / 60, 1); // 0–1 at 60 km/h
          for (const [dx, dy] of DIRS) {
            const nx = x + dx,
              ny = y + dy;
            if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE)
              continue;
            const ni = this._i(nx, ny);
            if (this._grid[ni] !== 0) continue;
            // dot product of neighbor direction with downwind vector (-1..1)
            const dot = dx * this._dwx + dy * this._dwy;
            const windBias = 1 + dot * windT * WIND_BIAS;
            if (Math.random() < SPREAD_PROB * windBias) {
              next[ni] = 1;
              changes.push({ x: nx, y: ny, s: 1 });
            }
          }
        } else if (state === 4) {
          // Water evaporation — restore to pre-water state: burned → burned, others → unburned
          this._waterAge[i]++;
          if (this._waterAge[i] >= WATER_DURATION) {
            const restored = this._preWaterState[i] === 2 ? 2 : 0;
            next[i] = restored;
            this._waterAge[i] = 0;
            this._preWaterState[i] = 0;
            changes.push({ x, y, s: restored });
          }
        }
      }
    }

    this._grid.set(next);
    this._burnAge.set(nextAge);
    return changes;
  }

  _handleInteraction({ tool, x, y, cells }) {
    if (tool === "water") {
      const gx = Math.round(x),
        gy = Math.round(y);
      if (gx < 0 || gx >= GRID_SIZE || gy < 0 || gy >= GRID_SIZE) return;
      // Apply circular water drop (all cells within WATER_RADIUS distance)
      const changes = [];
      for (let dy = -WATER_RADIUS; dy <= WATER_RADIUS; dy++) {
        for (let dx = -WATER_RADIUS; dx <= WATER_RADIUS; dx++) {
          if (dx * dx + dy * dy > WATER_RADIUS * WATER_RADIUS) continue;
          const cx = gx + dx,
            cy = gy + dy;
          if (cx < 0 || cx >= GRID_SIZE || cy < 0 || cy >= GRID_SIZE) continue;
          const i = this._i(cx, cy);
          const cur = this._grid[i];
          if (cur <= 2) { // unburned, burning, burned
            this._preWaterState[i] = cur; // record pre-water state for correct restoration
            this._grid[i] = 4;
            this._waterAge[i] = 0; // reset evaporation timer
            changes.push({ x: cx, y: cy, s: 4 });
          }
        }
      }
      if (changes.length) {
        this._emit({ type: "TICK_UPDATE", changes, stats: this._calcStats() });
      }
      return;
    }

    if (tool === "control_line") {
      // Accepts a cells array [{x, y}] for a multi-cell line
      const cellList = cells ?? [];
      const changes = [];
      for (const { x: cx, y: cy } of cellList) {
        const gcx = Math.max(0, Math.min(GRID_SIZE - 1, Math.round(cx)));
        const gcy = Math.max(0, Math.min(GRID_SIZE - 1, Math.round(cy)));
        const i = this._i(gcx, gcy);
        if (this._grid[i] !== 3) {
          this._grid[i] = 3; // control lines never change after being set
          changes.push({ x: gcx, y: gcy, s: 3 });
        }
      }
      if (changes.length) {
        this._emit({ type: "TICK_UPDATE", changes, stats: this._calcStats() });
      }
      return;
    }

    const gx = Math.round(x),
      gy = Math.round(y);
    if (gx < 0 || gx >= GRID_SIZE || gy < 0 || gy >= GRID_SIZE) return;
    const i = this._i(gx, gy);
    const cur = this._grid[i];
    let next = cur;

    if (tool === "backburn" && cur === 0) next = 1;

    if (next === cur) return;
    this._grid[i] = next;
    this._emit({
      type: "TICK_UPDATE",
      changes: [{ x: gx, y: gy, s: next }],
      stats: this._calcStats(),
    });
  }

  _snapshot() {
    const cells = [];
    for (let i = 0; i < this._grid.length; i++) {
      if (this._grid[i] !== 0)
        cells.push({
          x: i % GRID_SIZE,
          y: Math.floor(i / GRID_SIZE),
          s: this._grid[i],
        });
    }
    return cells;
  }

  _calcStats() {
    let burning = 0,
      burned = 0;
    for (const s of this._grid) {
      if (s === 1) burning++;
      if (s === 2) burned++;
    }
    const total = GRID_SIZE * GRID_SIZE;
    const burnedHa = +(burned * 0.01).toFixed(2); // 1 cell = 10×10m = 0.01 ha
    const score = Math.max(0, 100 - Math.floor((burned / total) * 150));
    return {
      burning,
      burned,
      burnedHa,
      score,
      tick: this._tick,
      windDir: this._windDir,
      windSpd: this._windSpd,
    };
  }

  _emit(data) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}
