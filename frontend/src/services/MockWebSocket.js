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

export const GRID_SIZE = 1000; // 1000×1000 cells over the 10×10km area → 10m per cell

const TICK_MS       = 500;
const BURN_DURATION = 14;   // ticks a cell burns before becoming ash
const SPREAD_PROB   = 0.16; // base ignition probability per neighbour per tick
const DIRS          = [[-1,0],[1,0],[0,-1],[0,1]];

// Wind: direction the wind is blowing FROM (meteorological convention), degrees
// Downwind vector (direction fire spreads toward) = windDir + 180
const WIND_DIR = 45;   // NE wind → fire spreads SW
const WIND_SPD = 30;   // km/h
const WIND_BIAS = 2.5; // max multiplier at full alignment + full speed

export class MockWebSocket {
  constructor(scenario) {
    this.onopen    = null;
    this.onmessage = null;
    this.onclose   = null;
    this.onerror   = null;
    this.readyState = 0; // CONNECTING

    this._scenario  = scenario;
    this._grid      = new Uint8Array(GRID_SIZE * GRID_SIZE);
    this._burnAge   = new Uint8Array(GRID_SIZE * GRID_SIZE);
    this._tick      = 0;
    this._interval  = null;
    this._paused    = false;
    this._windDir   = WIND_DIR;
    this._windSpd   = WIND_SPD;

    this._vegGrid   = new Uint8Array(GRID_SIZE * GRID_SIZE);
    this._generateVegetation();

    // Precompute downwind unit vector (direction fire spreads toward)
    this._updateWindVec();

    this._seedFire();

    // Simulate async handshake — store handle so close() can cancel it
    this._connectTimer = setTimeout(() => {
      this.readyState = 1; // OPEN
      this.onopen?.({ type: 'open' });
      this._emit({
        type:           'FULL_SYNC',
        gridSize:       GRID_SIZE,
        grid:           this._snapshot(),
        vegetationGrid: Array.from(this._vegGrid),
        stats:          this._calcStats(),
      });
      this._interval = setInterval(() => this._tick_(), TICK_MS);
    }, 80);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  send(raw) {
    try {
      const msg = JSON.parse(raw);
      if (msg.action === 'pause')  { this._pause();  return; }
      if (msg.action === 'resume') { this._resume(); return; }
      this._handleInteraction(msg);
    } catch { /* ignore malformed messages */ }
  }

  close() {
    clearTimeout(this._connectTimer);
    clearInterval(this._interval);
    this.readyState = 3; // CLOSED
    this.onopen    = null;
    this.onmessage = null;
    const onclose  = this.onclose;
    this.onclose   = null;
    onclose?.({ type: 'close' });
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
    this._paused   = true;
  }

  _resume() {
    if (!this._paused) return;
    this._paused   = false;
    this._interval = setInterval(() => this._tick_(), TICK_MS);
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  _updateWindVec() {
    // Downwind = wind direction + 180° (direction the fire is pushed toward)
    const rad = ((this._windDir + 180) % 360) * Math.PI / 180;
    this._dwx = Math.sin(rad);  // +x = east
    this._dwy = -Math.cos(rad); // +y = south (grid row increases downward)
  }

  _generateVegetation() {
    // Voronoi on a coarse grid produces large coherent regions instead of random noise.
    // Each coarse cell (= 10 real cells = 100 m) takes the type of its nearest seed.
    const COARSE     = 100;
    const NUM_SEEDS  = 120;
    const scale      = GRID_SIZE / COARSE; // 10 real cells per coarse cell

    // Scatter seeds at random positions on the coarse grid
    const seeds = [];
    for (let i = 0; i < NUM_SEEDS; i++) {
      seeds.push({
        x:    Math.random() * COARSE,
        y:    Math.random() * COARSE,
        type: Math.floor(Math.random() * 15) + 1,
      });
    }

    // Build coarse Voronoi (100×100 × 120 seeds = 1.2 M comparisons — fast)
    const coarse = new Uint8Array(COARSE * COARSE);
    for (let cy = 0; cy < COARSE; cy++) {
      for (let cx = 0; cx < COARSE; cx++) {
        let minD = Infinity, nearest = 1;
        for (const s of seeds) {
          const d = (cx - s.x) ** 2 + (cy - s.y) ** 2;
          if (d < minD) { minD = d; nearest = s.type; }
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

  _i(x, y) { return y * GRID_SIZE + x; }

  _seedFire() {
    const cx = Math.floor(GRID_SIZE / 2);
    const cy = Math.floor(GRID_SIZE / 2);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE)
          this._grid[this._i(x, y)] = 1;
      }
    }
  }

  _tick_() {
    this._tick++;
    const changes = this._computeSpread();
    this._emit({
      type:    'TICK_UPDATE',
      changes,
      stats:   this._calcStats(),
    });
  }

  _computeSpread() {
    const changes  = [];
    const next     = new Uint8Array(this._grid);
    const nextAge  = new Uint8Array(this._burnAge);

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const i = this._i(x, y);
        if (this._grid[i] !== 1) continue;

        nextAge[i]++;
        if (nextAge[i] >= BURN_DURATION) {
          next[i] = 2;
          changes.push({ x, y, s: 2 });
          continue;
        }

        const windT = Math.min(this._windSpd / 60, 1); // 0–1 at 60 km/h
        for (const [dx, dy] of DIRS) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) continue;
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
      }
    }

    this._grid.set(next);
    this._burnAge.set(nextAge);
    return changes;
  }

  _handleInteraction({ tool, x, y }) {
    const gx = Math.round(x), gy = Math.round(y);
    if (gx < 0 || gx >= GRID_SIZE || gy < 0 || gy >= GRID_SIZE) return;
    const i = this._i(gx, gy);
    const cur = this._grid[i];
    let next = cur;

    if (tool === 'water'        && (cur === 1 || cur === 0)) next = 4;
    if (tool === 'control_line' && cur === 0)                next = 3;
    if (tool === 'backburn'     && cur === 0)                next = 1;

    if (next === cur) return;
    this._grid[i] = next;
    this._emit({
      type:    'TICK_UPDATE',
      changes: [{ x: gx, y: gy, s: next }],
      stats:   this._calcStats(),
    });
  }

  _snapshot() {
    const cells = [];
    for (let i = 0; i < this._grid.length; i++) {
      if (this._grid[i] !== 0)
        cells.push({ x: i % GRID_SIZE, y: Math.floor(i / GRID_SIZE), s: this._grid[i] });
    }
    return cells;
  }

  _calcStats() {
    let burning = 0, burned = 0;
    for (const s of this._grid) {
      if (s === 1) burning++;
      if (s === 2) burned++;
    }
    const total    = GRID_SIZE * GRID_SIZE;
    const burnedHa = +(burned * 0.01).toFixed(2); // 1 cell = 10×10m = 0.01 ha
    const score    = Math.max(0, 100 - Math.floor((burned / total) * 150));
    return { burning, burned, burnedHa, score, tick: this._tick,
             windDir: this._windDir, windSpd: this._windSpd };
  }

  _emit(data) {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}
