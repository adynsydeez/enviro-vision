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
    this._windDir   = WIND_DIR;
    this._windSpd   = WIND_SPD;

    // Precompute downwind unit vector (direction fire spreads toward)
    this._updateWindVec();

    this._seedFire();

    // Simulate async handshake
    setTimeout(() => {
      this.readyState = 1; // OPEN
      this.onopen?.({ type: 'open' });
      this._emit({
        type:     'FULL_SYNC',
        gridSize: GRID_SIZE,
        grid:     this._snapshot(),
        stats:    this._calcStats(),
      });
      this._interval = setInterval(() => this._tick_(), TICK_MS);
    }, 80);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  send(raw) {
    try {
      this._handleInteraction(JSON.parse(raw));
    } catch { /* ignore malformed messages */ }
  }

  close() {
    clearInterval(this._interval);
    this.readyState = 3; // CLOSED
    this.onclose?.({ type: 'close' });
  }

  setWind(dir, spd) {
    this._windDir = ((dir % 360) + 360) % 360;
    this._windSpd = Math.max(0, Math.min(100, spd));
    this._updateWindVec();
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  _updateWindVec() {
    // Downwind = wind direction + 180° (direction the fire is pushed toward)
    const rad = ((this._windDir + 180) % 360) * Math.PI / 180;
    this._dwx = Math.sin(rad);  // +x = east
    this._dwy = -Math.cos(rad); // +y = south (grid row increases downward)
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
