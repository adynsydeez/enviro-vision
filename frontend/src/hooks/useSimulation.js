// frontend/src/hooks/useSimulation.js
import { useEffect, useRef, useState, useCallback } from "react";
import pako from "pako";
import { SimulationClient } from "../services/SimulationClient";

const DEFAULT_STATS = {
  burning: 0,
  burned:  0,
  burnedHa: 0,
  score:   100,
  tick:    0,
  windDir: 0,
  windSpd: 0,
};

// ── Binary decompression helpers ──────────────────────────────────────────────

function decodeZlib(b64, TypedArray) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const raw   = pako.inflate(bytes);
  // pako may return a view into a larger SharedArrayBuffer with a non-zero byteOffset.
  // Slicing to a fresh buffer ensures TypedArray views (Float32Array etc.) are aligned.
  const buf   = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
  return new TypedArray(buf);
}

const decodeInt8    = (b64) => decodeZlib(b64, Int8Array);
const decodeUint8   = (b64) => decodeZlib(b64, Uint8Array);
const decodeFloat32 = (b64) => decodeZlib(b64, Float32Array);

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * gridRef.current    — Map<"x,y", state>   hot path, never in React state
 * burnAgeRef.current — Map<"x,y", number>  ticks a cell has been burning
 */
export function useSimulation(scenario) {
  const gridRef          = useRef(new Map());
  const burnAgeRef       = useRef(new Map());
  const vegGridRef       = useRef(null);
  const elevationGridRef = useRef(null);
  const clientRef        = useRef(null);
  const pausedRef        = useRef(false);

  const [stats,  setStats]  = useState(DEFAULT_STATS);
  const [status, setStatus] = useState(scenario ? "connecting" : "idle");
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!scenario) return;

    const client = new SimulationClient();
    clientRef.current = client;

    client.onopen = () => setStatus("running");
    client.onclose = () => setStatus("closed");

    client.onmessage = ({ data }) => {
      const msg = JSON.parse(data);

      // ── Init frame ──────────────────────────────────────────────────────────
      if (msg.type === "init") {
        gridRef.current.clear();
        burnAgeRef.current.clear();

        if (msg.encoding === "zlib+base64") {
          // Real backend: decompress binary arrays
          const stateArr = decodeInt8(msg.state);
          const gs = msg.grid_size;

          vegGridRef.current       = decodeUint8(msg.vegetation);
          elevationGridRef.current = decodeFloat32(msg.elevation);

          for (let y = 0; y < gs; y++) {
            for (let x = 0; x < gs; x++) {
              const s = stateArr[y * gs + x];
              if (s !== 0) {
                const key = `${x},${y}`;
                gridRef.current.set(key, s);
                if (s === 1) burnAgeRef.current.set(key, 0);
              }
            }
          }
        } else {
          // Mock (encoding === "sparse"): plain JS arrays, sparse grid
          if (msg.vegetation_raw) {
            vegGridRef.current = new Uint8Array(msg.vegetation_raw);
          }
          if (msg.elevation_raw) {
            elevationGridRef.current = new Float32Array(msg.elevation_raw);
          }
          for (const { x, y, s } of msg.state_grid ?? []) {
            const key = `${x},${y}`;
            gridRef.current.set(key, s);
            if (s === 1) burnAgeRef.current.set(key, 0);
          }
        }

        // Persist wind from init frame into stats
        setStats((prev) => ({
          ...prev,
          windDir: msg.wind_dir  ?? prev.windDir,
          windSpd: msg.wind_speed ?? prev.windSpd,
        }));
      }

      // ── Tick frame ──────────────────────────────────────────────────────────
      else if (msg.type === "tick") {
        const changed = new Set();

        for (const { x, y, s } of msg.changes ?? []) {
          const key = `${x},${y}`;
          changed.add(key);

          if (s === 0) {
            gridRef.current.delete(key);
            burnAgeRef.current.delete(key);
          } else {
            const prev = gridRef.current.get(key);
            gridRef.current.set(key, s);

            if (s === 1 && prev !== 1) {
              burnAgeRef.current.set(key, 0); // newly ignited
            } else if (s !== 1) {
              burnAgeRef.current.delete(key); // burned out or suppressed
            }
          }
        }

        // Increment age for cells that stayed burning this tick
        for (const [key, age] of burnAgeRef.current) {
          if (!changed.has(key)) burnAgeRef.current.set(key, age + 1);
        }

        setStats((prev) => ({
          burning:  msg.burning,
          burned:   msg.burned,
          burnedHa: msg.burned_ha,
          score:    msg.score,
          tick:     msg.tick,
          windDir:  prev.windDir,   // preserved from init
          windSpd:  prev.windSpd,
        }));
      }
    };

    client.connect(scenario);

    return () => client.close();
  }, [scenario]);

  // ── Control API ─────────────────────────────────────────────────────────────

  const interact = useCallback((tool, payload) => {
    clientRef.current?.send(JSON.stringify({ cmd: "interact", tool, ...payload }));
  }, []);

  const setWind = useCallback((dir, spd) => {
    clientRef.current?.setWind(dir, spd);
  }, []);

  const togglePause = useCallback(() => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    clientRef.current?.send(JSON.stringify({ cmd: next ? "pause" : "resume" }));
    setPaused(next);
  }, []);

  const start = useCallback(async () => {
    await clientRef.current?.start();
  }, []);

  return {
    gridRef,
    burnAgeRef,
    vegGridRef,
    elevationGridRef,
    stats,
    status,
    paused,
    interact,
    setWind,
    togglePause,
    start,
  };
}
