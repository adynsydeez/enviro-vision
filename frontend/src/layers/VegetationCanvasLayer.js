import BaseCanvasLayer from './BaseCanvasLayer';
import { VEGETATION_TYPES } from '../data/vegetation-mapping';

export default BaseCanvasLayer.extend({
  initialize(vegGridRef, bounds, gridSize, activeGroups = null) {
    BaseCanvasLayer.prototype.initialize.call(this, bounds, gridSize, { animated: false });
    this._vegGridRef  = vegGridRef;
    this._activeGroups = activeGroups; // null = show all groups
  },

  // Call this to filter which classification groups are visible
  setActiveGroups(groups) {
    this._activeGroups = groups; // Set<string> or null
    this.redraw();
  },

  onAdd(map) {
    BaseCanvasLayer.prototype.onAdd.call(this, map);
    map.on('moveend zoomend', this.redraw, this);
  },

  onRemove(map) {
    map.off('moveend zoomend', this.redraw, this);
    BaseCanvasLayer.prototype.onRemove.call(this, map);
  },

  draw() {
    if (!this._canvas || !this._map || !this._vegGridRef.current) return;
    const ctx  = this._ctx;
    const map  = this._map;
    const gs   = this._gridSize;
    const grid = this._vegGridRef.current;

    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    ctx.save();
    ctx.globalAlpha = 0.35; // Semi-transparent overlay, similar to fire layer

    const nw    = map.latLngToContainerPoint(this._bounds.getNorthWest());
    const se    = map.latLngToContainerPoint(this._bounds.getSouthEast());
    const cellW = (se.x - nw.x) / gs;
    const cellH = (se.y - nw.y) / gs;

    for (let y = 0; y < gs; y++) {
      for (let x = 0; x < gs; x++) {
        const typeId = grid[y * gs + x];
        if (typeId === 0) continue;

        const veg = VEGETATION_TYPES[typeId];
        if (!veg) continue;

        // Skip if this group is not in the active set
        if (this._activeGroups && !this._activeGroups.has(veg.group)) continue;

        ctx.fillStyle = veg.color;
        // Slight overdraw to avoid sub-pixel gaps during zoom
        ctx.fillRect(nw.x + x * cellW, nw.y + y * cellH, cellW + 0.5, cellH + 0.5);
      }
    }
    ctx.restore();
  },
});
