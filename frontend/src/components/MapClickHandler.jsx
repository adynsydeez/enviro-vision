// frontend/src/components/MapClickHandler.jsx
import { useEffect, useRef } from 'react';
import { useMapEvents } from 'react-leaflet';
import { getBounds, latlngToCell } from '../utils/geo';

const WATER_RADIUS   = 3;  
const EVAC_RADIUS    = 5;
const MAX_LINE_CELLS = 30; 
const HALF_THICK     = 1.2; 

// Returns all grid cells covered by a solid line from (x0,y0) to (x1,y1).
function getLineCells(x0, y0, x1, y1, gridSize) {
  const dx = x1 - x0, dy = y1 - y0;
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
  const maxX = Math.min(gridSize - 1, Math.max(x0, ex) + pad);
  const minY = Math.max(0, Math.min(y0, ey) - pad);
  const maxY = Math.min(gridSize - 1, Math.max(y0, ey) + pad);

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

export default function MapClickHandler({
  scenario,
  activeTool,
  cooldownUntil,
  gridRef,
  gridSize,
  interact,
  onWaterDrop,
  onControlLinePreview,
  onControlLineCommit,
}) {
  const startRef = useRef(null);

  const map = useMapEvents({
    click(e) {
      const bounds = getBounds(scenario.center, 5);

      if (activeTool === 'water') {
        if (Date.now() < (cooldownUntil.current?.water ?? 0)) return;
        const { x, y } = latlngToCell(e.latlng, bounds, gridSize);
        interact('water', { x, y });
        onWaterDrop();
        return;
      }

      if (activeTool === 'evac') {
        if (Date.now() < (cooldownUntil.current?.evac ?? 0)) return;
        const { x, y } = latlngToCell(e.latlng, bounds, gridSize);
        interact('evac', { x, y });
        onControlLineCommit('evac'); // Reuse commit for cooldown
        return;
      }

      if (activeTool === 'line' || activeTool === 'backburn') {
        const { x, y } = latlngToCell(e.latlng, bounds, gridSize);

        if (!startRef.current) {
          startRef.current = { x, y };
          onControlLinePreview(getLineCells(x, y, x, y, gridSize));
        } else {
          if (Date.now() < (cooldownUntil.current?.[activeTool] ?? 0)) return;
          
          interact(activeTool, { 
            x0: startRef.current.x, 
            y0: startRef.current.y, 
            x1: x, 
            y1: y 
          });
          
          startRef.current = null;
          onControlLinePreview(null);
          onControlLineCommit(activeTool);
        }
      }
    },

    mousemove(e) {
      if ((activeTool !== 'line' && activeTool !== 'backburn') || !startRef.current) return;
      const bounds = getBounds(scenario.center, 5);
      const { x, y } = latlngToCell(e.latlng, bounds, gridSize);
      onControlLinePreview(getLineCells(startRef.current.x, startRef.current.y, x, y, gridSize));
    },
  });

  useEffect(() => {
    if (activeTool !== 'line' && activeTool !== 'backburn') {
      startRef.current = null;
      onControlLinePreview?.(null);
    }
  }, [activeTool, onControlLinePreview]);

  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = activeTool ? 'crosshair' : '';
    return () => { container.style.cursor = ''; };
  }, [activeTool, map]);

  return null;
}
