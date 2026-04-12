import BaseCanvasLayer from "./BaseCanvasLayer";

const ElevationCanvasLayer = BaseCanvasLayer.extend({
  initialize(elevationGridRef, bounds, gridSize, scenarioId) {
    BaseCanvasLayer.prototype.initialize.call(this, bounds, gridSize, {
      animated: false,
    });
    this._elevationGridRef = elevationGridRef;
    this._gridSize = gridSize;
    this._scenarioId = scenarioId;
  },

  async _loadFromCSV() {
    try {
      const response = await fetch(`/data/cropped_elevation_${this._scenarioId}.csv`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const text = await response.text();
      const lines = text.trim().split('\n').slice(1);
      
      const gs = this._gridSize;
      const grid = new Float32Array(gs * gs);
      
      const leafletBounds = this._bounds;
      const sw = leafletBounds.getSouthWest();
      const ne = leafletBounds.getNorthEast();
      
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length < 3) continue;
        const [lon, lat, elev] = parts;
        const llon = parseFloat(lon);
        const llat = parseFloat(lat);
        const eelev = parseFloat(elev);
        
        const gx = Math.floor(((llon - sw.lng) / (ne.lng - sw.lng)) * gs);
        const gy = Math.floor(((ne.lat - llat) / (ne.lat - sw.lat)) * gs);
        
        if (gx >= 0 && gx < gs && gy >= 0 && gy < gs) {
          grid[gy * gs + gx] = eelev;
        }
      }
      
      this._elevationGridRef.current = grid;
      this.redraw();
    } catch (err) {
      console.error("Failed to load elevation from CSV", err);
    }
  },

  onAdd(map) {
    BaseCanvasLayer.prototype.onAdd.call(this, map);
    if (!this._elevationGridRef.current) {
      this._loadFromCSV();
    }
    map.on("moveend zoomend", this.redraw, this);
  },

  onRemove(map) {
    map.off("moveend zoomend", this.redraw, this);
    BaseCanvasLayer.prototype.onRemove.call(this, map);
  },

  _getColor(normalized) {
    if (normalized < 0.2) return [0, 102, 204];
    if (normalized < 0.35) return [0, 170, 255];
    if (normalized < 0.5) return [0, 221, 0];
    if (normalized < 0.7) return [255, 221, 0];
    return [255, 136, 0];
  },

  draw() {
    if (!this._canvas || !this._map || !this._elevationGridRef.current) return;

    const ctx = this._ctx;
    const map = this._map;
    const gs = parseInt(this._gridSize);
    if (isNaN(gs) || gs <= 0) return;

    const grid = this._elevationGridRef.current;

    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    const nw = map.latLngToContainerPoint(this._bounds.getNorthWest());
    const se = map.latLngToContainerPoint(this._bounds.getSouthEast());

    // Build an offscreen image the same way the veg layer does —
    // one pixel per grid cell, then stretch onto the canvas.
    const oc = document.createElement("canvas");
    oc.width = gs;
    oc.height = gs;
    const octx = oc.getContext("2d");
    const img = octx.createImageData(gs, gs);
    const d = img.data;

    for (let i = 0; i < gs * gs; i++) {
      const normalized = (grid[i] - 200) / 750;
      const [r, g, b] = this._getColor(normalized);
      const p = i * 4;
      d[p] = r;
      d[p + 1] = g;
      d[p + 2] = b;
      d[p + 3] = 255;
    }

    octx.putImageData(img, 0, 0);

    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.drawImage(oc, nw.x, nw.y, se.x - nw.x, se.y - nw.y);
    ctx.restore();
  },
});

export default ElevationCanvasLayer;
