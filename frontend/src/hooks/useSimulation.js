import { useEffect, useRef, useState, useCallback } from 'react';
import { MockWebSocket } from '../services/MockWebSocket';

const DEFAULT_STATS = { burning: 0, burned: 0, burnedHa: 0, score: 100, tick: 0 };

/**
 * Manages the simulation WebSocket (mock or real) for a given scenario.
 *
 * gridRef.current  — Map<"x,y", state>  updated directly, never triggers re-renders.
 *                    Read by FireCanvasLayer on every rAF frame.
 * stats            — React state, only updates on each WS tick (every 500ms).
 *                    Used by the stats overlay panel.
 *
 * To switch from mock to real backend:
 *   Replace `new MockWebSocket(scenario)` with `new WebSocket(url)` — nothing else changes.
 */
export function useSimulation(scenario) {
  const gridRef = useRef(new Map());
  const wsRef   = useRef(null);

  const [stats,  setStats]  = useState(DEFAULT_STATS);
  const [status, setStatus] = useState('idle'); // idle | connecting | running | closed

  useEffect(() => {
    if (!scenario) return;

    gridRef.current.clear();
    setStats(DEFAULT_STATS);
    setStatus('connecting');

    const ws = new MockWebSocket(scenario);
    wsRef.current = ws;

    ws.onopen = () => setStatus('running');

    ws.onmessage = ({ data }) => {
      const msg = JSON.parse(data);

      if (msg.type === 'FULL_SYNC') {
        gridRef.current.clear();
        for (const { x, y, s } of msg.grid) {
          gridRef.current.set(`${x},${y}`, s);
        }
      } else if (msg.type === 'TICK_UPDATE') {
        for (const { x, y, s } of msg.changes) {
          if (s === 0) gridRef.current.delete(`${x},${y}`);
          else         gridRef.current.set(`${x},${y}`, s);
        }
      }

      if (msg.stats) setStats(msg.stats);
    };

    ws.onclose = () => setStatus('closed');

    return () => ws.close();
  }, [scenario]);

  /** Send a tool interaction to the simulation. */
  const interact = useCallback((tool, x, y) => {
    wsRef.current?.send(JSON.stringify({ tool, x, y }));
  }, []);

  return { gridRef, stats, status, interact };
}
