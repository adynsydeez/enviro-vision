// frontend/src/components/MapClickHandler.jsx
import { useEffect } from 'react';
import { useMapEvents } from 'react-leaflet';
import { getBounds, latlngToCell } from '../utils/geo';
import { GRID_SIZE } from '../services/MockWebSocket';

const WATER_RADIUS = 3; // must match MockWebSocket constant

export default function MapClickHandler({
  scenario,
  activeTool,
  cooldownUntil,
  gridRef,
  interact,
  onWaterDrop,
}) {
  const map = useMapEvents({
    click(e) {
      if (activeTool !== 'water') return;
      if (Date.now() < cooldownUntil.current) return;

      const bounds = getBounds(scenario.center, 5);
      const { x, y } = latlngToCell(e.latlng, bounds, GRID_SIZE);

      // Optimistic 5×5 circular water drop — mirrors MockWebSocket._handleInteraction
      for (let dy = -WATER_RADIUS; dy <= WATER_RADIUS; dy++) {
        for (let dx = -WATER_RADIUS; dx <= WATER_RADIUS; dx++) {
          if (dx * dx + dy * dy > WATER_RADIUS * WATER_RADIUS) continue;
          const cx = Math.max(0, Math.min(GRID_SIZE - 1, x + dx));
          const cy = Math.max(0, Math.min(GRID_SIZE - 1, y + dy));
          const key = `${cx},${cy}`;
          const cur = gridRef.current.get(key) ?? 0;
          if (cur === 0 || cur === 1) {
            gridRef.current.set(key, 4);
          }
        }
      }

      // Notify backend / mock simulation (fire and forget)
      interact('water', x, y);

      // Start cooldown in parent
      onWaterDrop();
    },
  });

  // Crosshair cursor while a tool is armed
  useEffect(() => {
    const container = map.getContainer();
    container.style.cursor = activeTool ? 'crosshair' : '';
    return () => {
      container.style.cursor = '';
    };
  }, [activeTool, map]);

  return null;
}
