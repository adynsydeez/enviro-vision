import BaseCanvasLayer from './BaseCanvasLayer';
import { VEGETATION_TYPES } from '../data/vegetation-mapping';

// Pre-parse all veg colors to RGBA components once at module load.
const VEG_RGBA = {};
for (const [id, veg] of Object.entries(VEGETATION_TYPES)) {
  const hex = veg.color.replace('#', '');
  VEG_RGBA[id] = [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

export default BaseCanvasLayer.extend({
  initialize(vegGridRef, bounds, gridSize, activeGroups = null) {
    BaseCanvasLayer.prototype.initialize.call(this, bounds, gridSize, { animated: false });
    this._vegGridRef   = vegGridRef;
    this._activeGroups = activeGroups;
    this._offscreen    = null; // cached pre-rendered canvas
  },

  setActiveGroups(groups) {
    this._activeGroups = groups;
    this._offscreen = null; // invalidate cache
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

  // Build a gridSize×gridSize offscreen canvas from the veg grid — done once.
  _buildOffscreen() {
    const grid = this._vegGridRef.current;
    if (!grid) return null;
    const gs  = this._gridSize;
    const oc  = document.createElement('canvas');
    oc.width  = gs;
    oc.height = gs;
    const ctx = oc.getContext('2d');
    const img = ctx.createImageData(gs, gs);
    const d   = img.data;

    for (let i = 0; i < gs * gs; i++) {
      const typeId = grid[i];
      if (typeId === 0) continue;
      const rgba = VEG_RGBA[typeId];
      if (!rgba) continue;
      if (this._activeGroups) {
        const veg = VEGETATION_TYPES[typeId];
        if (!veg || !this._activeGroups.has(veg.group)) continue;
      }
      const p = i * 4;
      d[p]     = rgba[0];
      d[p + 1] = rgba[1];
      d[p + 2] = rgba[2];
      d[p + 3] = 255;
    }

    ctx.putImageData(img, 0, 0);
    return oc;
  },

  draw() {
    if (!this._canvas || !this._map || !this._vegGridRef.current) return;

    if (!this._offscreen) {
      this._offscreen = this._buildOffscreen();
      if (!this._offscreen) return;
    }

    const ctx = this._ctx;
    const map = this._map;
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    const nw = map.latLngToContainerPoint(this._bounds.getNorthWest());
    const se = map.latLngToContainerPoint(this._bounds.getSouthEast());

    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.drawImage(this._offscreen, nw.x, nw.y, se.x - nw.x, se.y - nw.y);
    ctx.restore();
  },
});
