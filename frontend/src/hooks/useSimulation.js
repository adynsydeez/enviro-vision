import { useEffect, useRef, useState, useCallback } from "react";
import { unzlibSync } from "fflate";

const DEFAULT_STATS = {
  burning: 0,
  burned: 0,
  burnedHa: 0,
  score: 100,
  tick: 0,
  windDir: 0,
  windSpd: 0,
};

function decodeBinaryArray(base64Data, dtype) {
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const decompressed = unzlibSync(bytes);
  if (dtype === "int8") return new Int8Array(decompressed.buffer);
  if (dtype === "float32") return new Float32Array(decompressed.buffer);
  return decompressed;
}

export function useSimulation(scenario) {
  const gridRef = useRef(new Map());
  const burnAgeRef = useRef(new Map());
  const vegGridRef = useRef(null);
  const elevationGridRef = useRef(null);
  const wsRef = useRef(null);
  const pausedRef = useRef(true);

  const [stats, setStats] = useState(DEFAULT_STATS);
  const [status, setStatus] = useState(scenario ? "connecting" : "idle");
  const [paused, setPaused] = useState(true);
  const [gridSize, setGridSize] = useState(0);

  const processStateGrid = (stateArray, size) => {
    const changed = new Set();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const s = stateArray[y * size + x];
        if (s === 0) continue;
        const key = `${x},${y}`;
        changed.add(key);
        const prev = gridRef.current.get(key);
        gridRef.current.set(key, s);
        if (s === 1 && prev !== 1) {
          burnAgeRef.current.set(key, 0);
        } else if (s !== 1) {
          burnAgeRef.current.delete(key);
        }
      }
    }
    // Clean up keys that are now 0
    for (const [key, val] of gridRef.current) {
      if (!changed.has(key)) {
        gridRef.current.delete(key);
        burnAgeRef.current.delete(key);
      }
    }
  };

  useEffect(() => {
    if (!scenario) return;

    let ws = null;

    const startBackend = async () => {
      try {
        const resp = await fetch(`/api/simulation/start/${scenario.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            origin_lon: scenario.center[1],
            origin_lat: scenario.center[0],
            size_m: 5000, // Default 5km
            wind_speed: 10,
            wind_dir: 45,
            cell_res_m: 5.0,
            burn_duration: 14
          })
        });
        
        if (!resp.ok) throw new Error("Failed to start simulation");
        
        const data = await resp.json();
        const gs = data.grid_size;
        setGridSize(gs);

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        ws = new WebSocket(`${protocol}//${host}/ws/simulation/stream?scenario_id=${scenario.id}`);
        wsRef.current = ws;

        ws.onopen = () => setStatus("running");
        ws.onmessage = ({ data: msgData }) => {
          try {
            const msg = JSON.parse(msgData);
            if (msg.type === "init") {
              console.log("Simulation Init:", msg);
              gridRef.current.clear();
              burnAgeRef.current.clear();
              if (msg.flammability) {
                vegGridRef.current = decodeBinaryArray(msg.flammability, msg.dtype_flammability);
              }
              if (msg.elevation) {
                elevationGridRef.current = decodeBinaryArray(msg.elevation, msg.dtype_elevation);
              }
              if (msg.state) {
                const stateArr = decodeBinaryArray(msg.state, msg.dtype_state);
                processStateGrid(stateArr, msg.grid_size || gs);
              }
            } else if (msg.type === "tick") {
              if (msg.state) {
                const stateArr = decodeBinaryArray(msg.state, msg.dtype_state);
                processStateGrid(stateArr, msg.grid_size || gs);
              }
              // Increment age for burning cells that stayed burning
              for (const [key, age] of burnAgeRef.current) {
                burnAgeRef.current.set(key, age + 1);
              }
              setStats(prev => ({
                ...prev,
                tick: msg.tick,
                burning: msg.burning_count,
                burned: msg.burned_count,
                burnedHa: (msg.burned_count * 0.0025).toFixed(2), // 5m cells = 25sqm = 0.0025 ha
                active_fire: msg.active_fire
              }));
            }
          } catch (err) {
            console.error("Error processing WebSocket message:", err, msgData.slice(0, 100));
          }
        };
        ws.onclose = () => setStatus("closed");
      } catch (err) {
        console.error(err);
        setStatus("error");
      }
    };

    startBackend();

    return () => ws?.close();
  }, [scenario]);

  const interact = useCallback((tool, payload) => {
    wsRef.current?.send(JSON.stringify({ cmd: "interact", tool, ...payload }));
  }, []);

  const setWind = useCallback((dir, spd) => {
    wsRef.current?.send(JSON.stringify({ cmd: "set_env", wind_speed: spd, wind_dir: dir }));
  }, []);

  const togglePause = useCallback(() => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    wsRef.current?.send(JSON.stringify({ cmd: next ? "pause" : "resume" }));
    setPaused(next);
  }, []);

  const start_sim = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ cmd: "start" }));
  }, []);

  return {
    gridRef,
    burnAgeRef,
    vegGridRef,
    elevationGridRef,
    gridSize,
    stats,
    status,
    paused,
    interact,
    setWind,
    togglePause,
    start: start_sim,
  };
}
