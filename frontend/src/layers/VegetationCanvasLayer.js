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
  initialize(vegGridRef, bounds, gridSize, scenarioId, activeGroups = null) {
    BaseCanvasLayer.prototype.initialize.call(this, bounds, gridSize, { animated: false });
    this._vegGridRef   = vegGridRef;
    this._gridSize     = gridSize;
    this._scenarioId   = scenarioId;
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
    if (!this._vegGridRef.current) {
      this._loadFromCSV();
    }
    map.on('moveend zoomend', this.redraw, this);
  },

  onRemove(map) {
    map.off('moveend zoomend', this.redraw, this);
    BaseCanvasLayer.prototype.onRemove.call(this, map);
  },

  // Build a gridSize×gridSize offscreen canvas from the veg grid — done once.
  async _loadFromCSV() {
    try {
      const response = await fetch(`/data/cropped_fuel_types_${this._scenarioId}.csv`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const text = await response.text();
      const lines = text.trim().split('\n').slice(1);
      
      const gs = this._gridSize;
      const grid = new Uint8Array(gs * gs);
      
      // Mapping lon/lat to grid cells requires knowing the bounds.
      const leafletBounds = this._bounds;
      const sw = leafletBounds.getSouthWest();
      const ne = leafletBounds.getNorthEast();
      
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length < 3) continue;
        const [lon, lat, code] = parts;
        const llon = parseFloat(lon);
        const llat = parseFloat(lat);
        const ccode = parseInt(code);
        
        const gx = Math.floor(((llon - sw.lng) / (ne.lng - sw.lng)) * gs);
        const gy = Math.floor(((ne.lat - llat) / (ne.lat - sw.lat)) * gs);
        
        if (gx >= 0 && gx < gs && gy >= 0 && gy < gs) {
          grid[gy * gs + gx] = ccode;
        }
      }
      
      this._vegGridRef.current = grid;
      this._offscreen = this._buildOffscreen();
      this.redraw();
    } catch (err) {
      console.error("Failed to load vegetation from CSV", err);
    }
  },

  // Build a gridSize×gridSize offscreen canvas from the veg grid — done once.
  _buildOffscreen() {
    const grid = this._vegGridRef.current;
    const gs = parseInt(this._gridSize);
    if (!grid || isNaN(gs) || gs <= 0) return null;

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
