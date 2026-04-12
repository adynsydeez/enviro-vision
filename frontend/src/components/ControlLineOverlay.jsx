// Renders a canvas preview of the pending control line (start → cursor).
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { getBounds } from '../utils/geo';

export default function ControlLineOverlay({ previewCells, scenario, gridSize }) {
  const map = useMap();
  const canvasRef = useRef(null);
  const boundsRef = useRef(null);

  useEffect(() => {
    boundsRef.current = L.latLngBounds(getBounds(scenario.center, 5));

    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      pointerEvents: 'none',
      zIndex: '500',
    });
    map.getContainer().appendChild(canvas);
    canvasRef.current = canvas;

    const resize = () => {
      const { x, y } = map.getSize();
      canvas.width  = x;
      canvas.height = y;
      canvas.style.width  = x + 'px';
      canvas.style.height = y + 'px';
    };
    resize();
    map.on('resize', resize);

    return () => {
      canvas.remove();
      canvasRef.current = null;
      map.off('resize', resize);
    };
  }, [map, scenario]);

  useEffect(() => {
    const paint = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!previewCells || previewCells.length === 0 || !gridSize) return;

      const lb    = boundsRef.current;
      const nw    = map.latLngToContainerPoint(lb.getNorthWest());
      const se    = map.latLngToContainerPoint(lb.getSouthEast());
      const cellW = (se.x - nw.x) / gridSize;
      const cellH = (se.y - nw.y) / gridSize;
      const w     = Math.max(1, cellW) + 0.5;
      const h     = Math.max(1, cellH) + 0.5;

      ctx.fillStyle = 'rgba(59,130,246,0.6)';
      for (const { x, y } of previewCells) {
        ctx.fillRect(nw.x + x * cellW, nw.y + y * cellH, w, h);
      }

      ctx.strokeStyle = 'rgba(147,197,253,0.85)';
      ctx.lineWidth = 1;
      for (const { x, y } of previewCells) {
        ctx.strokeRect(nw.x + x * cellW + 0.5, nw.y + y * cellH + 0.5, w - 1, h - 1);
      }
    };

    paint();
    map.on('move zoom', paint);
    return () => map.off('move zoom', paint);
  }, [previewCells, map, gridSize]);

  return null;
}
