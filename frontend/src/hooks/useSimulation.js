import { useEffect, useRef, useState, useCallback } from 'react';
import { MockWebSocket } from '../services/MockWebSocket';

const DEFAULT_STATS = { burning: 0, burned: 0, burnedHa: 0, score: 100, tick: 0, windDir: 0, windSpd: 0 };

/**
 * gridRef.current    — Map<"x,y", state>   hot path, no React
 * burnAgeRef.current — Map<"x,y", number>  ticks a cell has been burning
 *                      incremented each tick for every burning cell that
 *                      didn't appear in changes (i.e. kept burning).
 *                      Used by FireCanvasLayer to interpolate orange→red.
 */
export function useSimulation(scenario) {
  const gridRef    = useRef(new Map());
  const burnAgeRef = useRef(new Map());
  const wsRef      = useRef(null);
  const pausedRef  = useRef(false);

  const [stats,  setStats]  = useState(DEFAULT_STATS);
  const [status, setStatus] = useState('idle');
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!scenario) return;

    gridRef.current.clear();
    burnAgeRef.current.clear();
    setStats(DEFAULT_STATS);
    setStatus('connecting');
    setPaused(false);
    pausedRef.current = false;

    const ws = new MockWebSocket(scenario);
    wsRef.current = ws;

    ws.onopen = () => setStatus('running');

    ws.onmessage = ({ data }) => {
      const msg = JSON.parse(data);

      if (msg.type === 'FULL_SYNC') {
        gridRef.current.clear();
        burnAgeRef.current.clear();
        for (const { x, y, s } of msg.grid) {
          const key = `${x},${y}`;
          gridRef.current.set(key, s);
          if (s === 1) burnAgeRef.current.set(key, 0);
        }
      } else if (msg.type === 'TICK_UPDATE') {
        const changed = new Set();

        for (const { x, y, s } of msg.changes) {
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
              burnAgeRef.current.delete(key); // burned out or other state
            }
          }
        }

        // Increment age for burning cells that stayed burning this tick
        for (const [key, age] of burnAgeRef.current) {
          if (!changed.has(key)) burnAgeRef.current.set(key, age + 1);
        }
      }

      if (msg.stats) setStats(msg.stats);
    };

    ws.onclose = () => setStatus('closed');

    return () => ws.close();
  }, [scenario]);

  const interact = useCallback((tool, x, y) => {
    wsRef.current?.send(JSON.stringify({ tool, x, y }));
  }, []);

  const setWind = useCallback((dir, spd) => {
    wsRef.current?.setWind(dir, spd);
  }, []);

  const togglePause = useCallback(() => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    wsRef.current?.send(JSON.stringify({ action: next ? 'pause' : 'resume' }));
    setPaused(next);
  }, []);

  return { gridRef, burnAgeRef, stats, status, paused, interact, setWind, togglePause };
}
