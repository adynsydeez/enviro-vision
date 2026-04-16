// frontend/src/components/MapClickHandler.jsx
import { useEffect, useRef } from 'react';
import { useMapEvents } from 'react-leaflet';
import { getBounds, latlngToCell } from '../utils/geo';
import { GRID_SIZE } from '../constants';

const WATER_RADIUS   = 3;  // must match MockWebSocket constant
const MAX_LINE_CELLS = 30; // max length in cells along longest dimension
const HALF_THICK     = 1.2; // roughly 3 cells wide, ensures solid diagonals

// Returns all grid cells covered by a solid line from (x0,y0) to (x1,y1).
// Uses distance-to-segment rasterisation so diagonal lines fill solidly.
// Clamps the end point so the segment is at most MAX_LINE_CELLS long.
function getLineCells(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  // Use Chebyshev distance (max of dx/dy) for the limit so it's 30 cells in any dir
  const distMax = Math.max(Math.abs(dx), Math.abs(dy));

  let ex = x1, ey = y1;
  if (distMax > MAX_LINE_CELLS) {
    const scale = MAX_LINE_CELLS / distMax;
    ex = Math.round(x0 + dx * scale);
    ey = Math.round(y0 + dy * scale);
  }

  const ldx   = ex - x0, ldy = ey - y0;
  const llen2 = ldx * ldx + ldy * ldy;

  const pad  = 2;
  const minX = Math.max(0, Math.min(x0, ex) - pad);
  const maxX = Math.min(GRID_SIZE - 1, Math.max(x0, ex) + pad);
  const minY = Math.max(0, Math.min(y0, ey) - pad);
  const maxY = Math.min(GRID_SIZE - 1, Math.max(y0, ey) + pad);

  const cells = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      let d;
      if (llen2 === 0) {
        d = Math.sqrt((x - x0) ** 2 + (y - y0) ** 2);
      } else {
        const t = Math.max(0, Math.min(1, ((x - x0) * ldx + (y - y0) * ldy) / llen2));
        d = Math.sqrt((x - (x0 + t * ldx)) ** 2 + (y - (y0 + t * ldy)) ** 2);
      }
      if (d <= HALF_THICK) cells.push({ x, y });
    }
  }
  return cells;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function MapClickHandler({
  scenario,
  activeTool,
  cooldownUntil,
  gridRef,
  interact,
  onWaterDrop,
  onControlLinePreview,
  onControlLineCommit,
}) {
  const clStartRef = useRef(null); // {x, y} grid coords of the first click

  const map = useMapEvents({
    click(e) {
      const bounds = getBounds(scenario.center, 5);

      // ── Water drop ──────────────────────────────────────────────────────────
      if (activeTool === 'water') {
        if (Date.now() < (cooldownUntil.current?.water ?? 0)) return;
        const { x, y } = latlngToCell(e.latlng, bounds, GRID_SIZE);

        // Optimistic 5×5 circular water drop — mirrors MockWebSocket._handleInteraction
        for (let dy = -WATER_RADIUS; dy <= WATER_RADIUS; dy++) {
          for (let dx = -WATER_RADIUS; dx <= WATER_RADIUS; dx++) {
            if (dx * dx + dy * dy > WATER_RADIUS * WATER_RADIUS) continue;
            const cx = Math.max(0, Math.min(GRID_SIZE - 1, x + dx));
            const cy = Math.max(0, Math.min(GRID_SIZE - 1, y + dy));
            const key = `${cx},${cy}`;
            const cur = gridRef.current.get(key) ?? 0;
            if (cur <= 2) gridRef.current.set(key, 4); // unburned, burning, burned
          }
        }
        interact('water', { x, y });
        onWaterDrop();
        return;
      }

      // ── Control line (two-click) ────────────────────────────────────────────
      if (activeTool === 'line') {
        const { x, y } = latlngToCell(e.latlng, bounds, GRID_SIZE);

        if (!clStartRef.current) {
          // Phase 1: record start
          clStartRef.current = { x, y };
          // Seed the preview with the single start point so the overlay appears
          onControlLinePreview(getLineCells(x, y, x, y));
        } else {
          // Phase 2: commit — check cooldown before placing
          if (Date.now() < (cooldownUntil.current?.line ?? 0)) return;
          const cells = getLineCells(clStartRef.current.x, clStartRef.current.y, x, y);

          // Optimistic render: write state 3 directly into the grid
          for (const { x: cx, y: cy } of cells) {
            const key = `${cx},${cy}`;
            const cur = gridRef.current.get(key) ?? 0;
            if (cur <= 2) gridRef.current.set(key, 3); // unburned, burning, burned
          }

          interact('control_line', { cells });
          clStartRef.current = null;
          onControlLinePreview(null);
          onControlLineCommit();
        }
      }
    },

    mousemove(e) {
      if (activeTool !== 'line' || !clStartRef.current) return;
      const bounds = getBounds(scenario.center, 5);
      const { x, y } = latlngToCell(e.latlng, bounds, GRID_SIZE);
      onControlLinePreview(getLineCells(clStartRef.current.x, clStartRef.current.y, x, y));
    },
  });

  // Clear pending start when the tool is deselected / changed
  useEffect(() => {
    if (activeTool !== 'line') {
      clStartRef.current = null;
      onControlLinePreview?.(null);
    }
  }, [activeTool]); // eslint-disable-line react-hooks/exhaustive-deps

  // Crosshair cursor while a tool is armed
  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = activeTool ? 'crosshair' : '';
    return () => { container.style.cursor = ''; };
  }, [activeTool, map]);

  return null;
}
