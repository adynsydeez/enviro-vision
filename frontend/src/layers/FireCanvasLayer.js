import L from 'leaflet';

/**
 * FireCanvasLayer — custom Leaflet layer that renders the fire grid onto a
 * full-map HTML5 Canvas using shadow glow effects.
 *
 * Canvas is added directly to the map container (not a pane) so it is never
 * affected by Leaflet's pane pan-transform. Cell positions are recomputed
 * from lat/lng on every rAF frame via map.latLngToContainerPoint(), which
 * always returns correct container-relative coordinates.
 *
 * Cell states:
 *   1 — Burning     orange glow, flicker
 *   2 — Burned      dark charcoal
 *   3 — Control line  blue
 *   4 — Watered     cyan
 */
const FireCanvasLayer = L.Layer.extend({
  initialize(gridRef, latLngBounds, gridSize) {
    this._gridRef  = gridRef;
    this._bounds   = L.latLngBounds(latLngBounds);
    this._gridSize = gridSize;
    this._canvas   = null;
    this._ctx      = null;
    this._frame    = null;
  },

  onAdd(map) {
    this._map = map;

    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
      position:      'absolute',
      top:           '0',
      left:          '0',
      pointerEvents: 'none',
      zIndex:        '400',
    });
    // Attach to the map container so pane transforms don't affect us
    map.getContainer().appendChild(canvas);
    this._canvas = canvas;
    this._ctx    = canvas.getContext('2d');

    this._resize();
    map.on('resize', this._resize, this);

    this._frame = requestAnimationFrame(() => this._loop());
  },

  onRemove(map) {
    cancelAnimationFrame(this._frame);
    map.off('resize', this._resize, this);
    this._canvas?.remove();
    this._canvas = null;
    this._ctx    = null;
  },

  _resize() {
    const { x, y } = this._map.getSize();
    this._canvas.width        = x;
    this._canvas.height       = y;
    this._canvas.style.width  = x + 'px';
    this._canvas.style.height = y + 'px';
  },

  _loop() {
    this._draw();
    this._frame = requestAnimationFrame(() => this._loop());
  },

  _draw() {
    if (!this._canvas || !this._map) return;

    const ctx = this._ctx;
    const map = this._map;
    const gs  = this._gridSize;

    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    if (this._gridRef.current.size === 0) return;

    // Recompute cell dimensions every frame — correct during pan/zoom animations
    const nw    = map.latLngToContainerPoint(this._bounds.getNorthWest());
    const se    = map.latLngToContainerPoint(this._bounds.getSouthEast());
    const cellW = (se.x - nw.x) / gs;
    const cellH = (se.y - nw.y) / gs;

    // Draw burned cells first (no glow), then burning on top (with glow)
    // to avoid glow being clipped by burned cells drawn after
    for (const [key, state] of this._gridRef.current) {
      if (state !== 2) continue;
      const comma = key.indexOf(',');
      const x = +key.slice(0, comma);
      const y = +key.slice(comma + 1);
      ctx.fillStyle = '#1c0800';
      ctx.fillRect(nw.x + x * cellW, nw.y + y * cellH, cellW + 0.5, cellH + 0.5);
    }

    for (const [key, state] of this._gridRef.current) {
      if (state === 2) continue;
      const comma = key.indexOf(',');
      const x = +key.slice(0, comma);
      const y = +key.slice(comma + 1);
      const px = nw.x + x * cellW;
      const py = nw.y + y * cellH;

      if (state === 1) {
        const flicker = 0.72 + Math.random() * 0.28;
        ctx.shadowBlur  = 14 * flicker;
        ctx.shadowColor = `rgba(249,115,22,${flicker})`;
        ctx.fillStyle   = `rgba(249,115,22,${flicker})`;
        ctx.fillRect(px, py, cellW + 0.5, cellH + 0.5);
        ctx.shadowBlur  = 0;
      } else if (state === 3) {
        ctx.fillStyle = 'rgba(59,130,246,0.85)';
        ctx.fillRect(px, py, cellW + 0.5, cellH + 0.5);
      } else if (state === 4) {
        ctx.fillStyle = 'rgba(14,165,233,0.85)';
        ctx.fillRect(px, py, cellW + 0.5, cellH + 0.5);
      }
    }
  },
});

export default FireCanvasLayer;
