// frontend/src/services/SimulationClient.js
import { MockWebSocket } from "./MockWebSocket";

const API_URL = import.meta.env.VITE_API_URL;
const WS_URL  = import.meta.env.VITE_WS_URL;
const USE_MOCK = !API_URL;

/**
 * Unified simulation client.
 *
 * Real backend flow:
 *   1. client.connect(scenario)  → POST /simulation/create, open WebSocket
 *   2. WebSocket sends "init" frame automatically
 *   3. client.start()            → POST /simulation/start
 *   4. WebSocket streams "tick" frames
 *
 * Mock fallback (when VITE_API_URL is not set):
 *   Wraps MockWebSocket and normalises its messages to the canonical protocol.
 *
 * Exposes: onopen, onmessage, onclose callbacks + send(), setWind(), close(), start()
 */
export class SimulationClient {
  constructor() {
    this.onopen    = null;
    this.onmessage = null;
    this.onclose   = null;
    this._ws       = null;
    this._mock     = USE_MOCK;
  }

  async connect(scenario) {
    if (this._mock) {
      this._connectMock(scenario);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/simulation/create`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ scenario_id: scenario.id }),
      });
      if (!res.ok) throw new Error(`/simulation/create → ${res.status}`);
    } catch (err) {
      console.warn("Real backend unavailable, falling back to mock:", err.message);
      this._mock = true;
      this._connectMock(scenario);
      return;
    }

    const ws = new WebSocket(`${WS_URL}/ws/simulation/stream`);
    ws.onopen    = () => this.onopen?.();
    ws.onmessage = (e) => this.onmessage?.({ data: e.data });
    ws.onclose   = () => this.onclose?.();
    this._ws = ws;
  }

  async start() {
    if (this._mock) {
      // MockWebSocket starts on the "start" action
      this._ws?.send(JSON.stringify({ action: "start" }));
      return;
    }
    await fetch(`${API_URL}/simulation/start`, { method: "POST" });
  }

  send(data) {
    if (this._mock) {
      // Translate canonical cmd → mock action format
      const msg = JSON.parse(data);
      if (msg.cmd === "pause")        this._ws?.send(JSON.stringify({ action: "pause" }));
      else if (msg.cmd === "resume")  this._ws?.send(JSON.stringify({ action: "resume" }));
      else if (msg.cmd === "interact") this._ws?.send(data); // tool format is identical
      // set_wind and set_interval handled via setWind() or no-op in mock
    } else {
      this._ws?.send(data);
    }
  }

  setWind(dir, spd) {
    if (this._mock) {
      this._ws?.setWind(dir, spd);
    } else {
      this._ws?.send(JSON.stringify({ cmd: "set_wind", speed: spd, dir }));
    }
  }

  close() {
    this._ws?.close();
  }

  // ── Mock normalisation ────────────────────────────────────────────────────

  _connectMock(scenario) {
    const mock = new MockWebSocket(scenario);
    mock.onopen = () => this.onopen?.();
    mock.onmessage = (e) => {
      const raw = JSON.parse(e.data);
      const normalised = this._normaliseMockMessage(raw);
      this.onmessage?.({ data: JSON.stringify(normalised) });
    };
    mock.onclose = () => this.onclose?.();
    this._ws = mock;
  }

  _normaliseMockMessage(raw) {
    if (raw.type === "FULL_SYNC") {
      return {
        type:       "init",
        grid_size:  raw.gridSize,
        cell_res_m: 10.0,
        wind_speed: raw.stats?.windSpd ?? 0,
        wind_dir:   raw.stats?.windDir ?? 0,
        // Use "sparse" encoding so useSimulation knows arrays are plain JS values
        encoding:        "sparse",
        state_grid:      raw.grid,            // [{x,y,s}] — already in canonical shape
        vegetation_raw:  raw.vegetationGrid,  // plain number array → Uint8Array
        elevation_raw:   raw.elevationGrid,   // plain number array → Float32Array
      };
    }

    if (raw.type === "TICK_UPDATE") {
      return {
        type:        "tick",
        tick:        raw.stats?.tick ?? 0,
        changes:     raw.changes,
        burning:     raw.stats?.burning  ?? 0,
        burned:      raw.stats?.burned   ?? 0,
        burned_ha:   raw.stats?.burnedHa ?? 0,
        score:       raw.stats?.score    ?? 0,
        active_fire: (raw.stats?.burning ?? 0) > 0,
        sim_time_s:  0,
      };
    }

    return raw;
  }
}
