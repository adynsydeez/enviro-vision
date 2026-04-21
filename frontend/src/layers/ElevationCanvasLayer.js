import BaseCanvasLayer from "./BaseCanvasLayer";

const ElevationCanvasLayer = BaseCanvasLayer.extend({
  initialize(elevationGridRef, bounds, gridSize) {
    BaseCanvasLayer.prototype.initialize.call(this, bounds, gridSize, {
      animated: false,
    });
    this._elevationGridRef = elevationGridRef;
  },

  _generateElevationGrid() {
    const gs = this._gridSize;
    const grid = new Float32Array(gs * gs); // flat array, like veg layer
    for (let i = 0; i < gs; i++) {
      for (let j = 0; j < gs; j++) {
        const base = 200 + Math.sin(i / 20) * 200 + Math.cos(j / 15) * 150;
        const noise = Math.sin(42 + i * 73.156 + j * 191.999) * 50;
        grid[i * gs + j] = Math.max(200, Math.min(950, base + noise));
      }
    }
    this._elevationGridRef.current = grid;
  },

  onAdd(map) {
    BaseCanvasLayer.prototype.onAdd.call(this, map);
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
    const gs = this._gridSize;
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

    // Compute dynamic range so any elevation dataset renders correctly
    let elMin = Infinity, elMax = -Infinity;
    for (let i = 0; i < gs * gs; i++) {
      if (grid[i] < elMin) elMin = grid[i];
      if (grid[i] > elMax) elMax = grid[i];
    }
    const elRange = elMax > elMin ? elMax - elMin : 1;

    for (let i = 0; i < gs * gs; i++) {
      const normalized = (grid[i] - elMin) / elRange;
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
