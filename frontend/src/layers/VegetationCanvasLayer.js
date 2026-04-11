import BaseCanvasLayer from './BaseCanvasLayer';
import { VEGETATION_COLORS } from '../data/vegetation-mapping';

export default BaseCanvasLayer.extend({
  initialize(vegGridRef, bounds, gridSize) {
    BaseCanvasLayer.prototype.initialize.call(this, bounds, gridSize);
    this._vegGridRef = vegGridRef;
  },

  draw() {
    if (!this._canvas || !this._map || !this._vegGridRef.current) return;
    const ctx = this._ctx;
    const map = this._map;
    const gs = this._gridSize;
    const grid = this._vegGridRef.current;

    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    ctx.save();
    ctx.globalAlpha = 0.35; // Semi-transparent overlay

    const nw = map.latLngToContainerPoint(this._bounds.getNorthWest());
    const se = map.latLngToContainerPoint(this._bounds.getSouthEast());
    const cellW = (se.x - nw.x) / gs;
    const cellH = (se.y - nw.y) / gs;

    for (let y = 0; y < gs; y++) {
      for (let x = 0; x < gs; x++) {
        const typeId = grid[y * gs + x];
        if (typeId === 0) continue;

        const color = VEGETATION_COLORS[typeId];
        if (!color) continue;

        ctx.fillStyle = color;
        // Fill slightly overlapping cells to avoid gap artifacts during zoom
        ctx.fillRect(nw.x + x * cellW, nw.y + y * cellH, cellW + 0.5, cellH + 0.5);
      }
    }
    ctx.restore();
  }
});
