// frontend/src/services/SimulationClient.js
import { MockWebSocket } from "./MockWebSocket";

const API_URL = import.meta.env.VITE_API_URL;
// Derive WS URL from API_URL if VITE_WS_URL is absent, so the two vars stay in sync.
const WS_URL  = import.meta.env.VITE_WS_URL || API_URL?.replace(/^http/, "ws");
const USE_MOCK = !API_URL;

/**
 * Unified simulation client.
 *
 * Real backend flow:
 *   1. client.connect(scenario)  → POST /simulation/create (returns session_id)
 *                                → open WebSocket with ?session_id=<id>
 *   2. WebSocket sends "init" frame automatically
 *   3. client.start()            → POST /simulation/start?session_id=<id>
 *   4. WebSocket streams "tick" frames
 *
 * Mock fallback (when VITE_API_URL is not set, or backend unreachable):
 *   Wraps MockWebSocket and normalises its messages to the canonical protocol.
 *
 * Exposes: onopen, onmessage, onclose callbacks + send(), setWind(), close(), start()
 */
export class SimulationClient {
  constructor() {
    this.onopen          = null;
    this.onmessage       = null;
    this.onclose         = null;
    this._ws             = null;
    this._mock           = USE_MOCK;
    this._sessionId      = null;
    this._connectPromise = null;
    this._closed         = false;
  }

  async connect(scenario) {
    this._connectPromise = this._doConnect(scenario);
    await this._connectPromise;
  }

  async _doConnect(scenario) {
    if (this._mock) {
      this._connectMock(scenario);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);

    try {
      const res = await fetch(`${API_URL}/simulation/create`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ scenario_id: scenario.id }),
        signal:  controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`/simulation/create → ${res.status}`);
      const data = await res.json();
      this._sessionId = data.session_id;
    } catch (err) {
      clearTimeout(timer);
      console.warn("Real backend unavailable, falling back to mock:", err.message);
      this._mock = true;
      this._connectMock(scenario);
      return;
    }

    const ws = new WebSocket(`${WS_URL}/ws/simulation/stream?session_id=${this._sessionId}`);
    ws.onopen    = () => this.onopen?.();
    ws.onmessage = (e) => this.onmessage?.({ data: e.data });
    ws.onclose   = () => this.onclose?.();
    this._ws = ws;
  }

  async start() {
    // Ensure connect() has completed — it may have switched _mock to true on backend failure
    await this._connectPromise;
    if (this._mock) {
      this._ws?.send(JSON.stringify({ action: "start" }));
      return;
    }
    const res = await fetch(`${API_URL}/simulation/start?session_id=${this._sessionId}`, { method: "POST" });
    if (!res.ok) throw new Error(`/simulation/start → ${res.status}`);
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
    this._closed = true;
    this._ws?.close();
  }

  // ── Mock normalisation ────────────────────────────────────────────────────

  _connectMock(scenario) {
    if (this._closed) return; // Abort if this client was already closed (StrictMode cleanup)
    this._ws?.close(); // close any existing connection before replacing
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
