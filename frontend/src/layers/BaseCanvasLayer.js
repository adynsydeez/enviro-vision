import L from 'leaflet';

export default L.Layer.extend({
  initialize(bounds, gridSize) {
    this._bounds = L.latLngBounds(bounds);
    this._gridSize = gridSize;
    this._canvas = null;
    this._ctx = null;
    this._frame = null;
    this._lastTime = null;
  },

  onAdd(map) {
    this._map = map;
    const canvas = document.createElement('canvas');
    Object.assign(canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      pointerEvents: 'none',
      zIndex: '400',
    });
    map.getContainer().appendChild(canvas);
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._resize();
    map.on('resize', this._resize, this);
    this._lastTime = performance.now();
    this._frame = requestAnimationFrame((t) => this._loop(t));
  },

  onRemove(map) {
    cancelAnimationFrame(this._frame);
    map.off('resize', this._resize, this);
    this._canvas?.remove();
    this._canvas = null;
    this._ctx = null;
  },

  _resize() {
    const { x, y } = this._map.getSize();
    this._canvas.width = x;
    this._canvas.height = y;
    this._canvas.style.width = x + 'px';
    this._canvas.style.height = y + 'px';
  },

  _loop(now) {
    const dt = Math.min((now - this._lastTime) / 1000, 0.05);
    this._lastTime = now;
    this.draw(dt);
    this._frame = requestAnimationFrame((t) => this._loop(t));
  },

  draw(dt) {
    // To be implemented by subclasses
  }
});
