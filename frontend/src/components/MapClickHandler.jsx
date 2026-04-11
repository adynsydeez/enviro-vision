// frontend/src/components/MapClickHandler.jsx
import { useEffect } from 'react';
import { useMapEvents } from 'react-leaflet';
import { getBounds, latlngToCell } from '../utils/geo';
import { GRID_SIZE } from '../services/MockWebSocket';

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

      // Apply 3×3 water drop — only convert burning (state 1) cells
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const cx = Math.max(0, Math.min(GRID_SIZE - 1, x + dx));
          const cy = Math.max(0, Math.min(GRID_SIZE - 1, y + dy));
          const key = `${cx},${cy}`;
          if (gridRef.current.get(key) === 1) {
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
