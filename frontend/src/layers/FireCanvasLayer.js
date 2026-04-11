import L from 'leaflet';

/**
 * FireCanvasLayer — custom Leaflet layer that renders the fire grid onto a
 * full-map HTML5 Canvas using shadow glow effects, plus Option-1 ember drift
 * particles that float in the downwind direction as a wind cue.
 *
 * Cell states:
 *   1 — Burning     orange glow, flicker + ember particles
 *   2 — Burned      dark charcoal
 *   3 — Control line  blue
 *   4 — Watered     cyan
 */

const MAX_PARTICLES = 600;

const FireCanvasLayer = L.Layer.extend({
  initialize(gridRef, burnAgeRef, latLngBounds, gridSize) {
    this._gridRef    = gridRef;
    this._burnAgeRef = burnAgeRef;
    this._bounds     = L.latLngBounds(latLngBounds);
    this._gridSize   = gridSize;
    this._canvas     = null;
    this._ctx        = null;
    this._frame      = null;
    this._particles  = [];
    this._windDir    = 0;   // degrees FROM (meteorological)
    this._windSpd    = 0;   // km/h
    this._effects    = true;
    this._lastTime   = null;
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
    map.getContainer().appendChild(canvas);
    this._canvas = canvas;
    this._ctx    = canvas.getContext('2d');

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
    this._ctx    = null;
    this._particles = [];
  },

  setWind(windDir, windSpd) {
    this._windDir = windDir;
    this._windSpd = windSpd;
  },

  setEffects(enabled) {
    this._effects = enabled;
    if (!enabled) this._particles = [];
  },

  _resize() {
    const { x, y } = this._map.getSize();
    this._canvas.width        = x;
    this._canvas.height       = y;
    this._canvas.style.width  = x + 'px';
    this._canvas.style.height = y + 'px';
  },

  _loop(now) {
    const dt = Math.min((now - this._lastTime) / 1000, 0.05); // seconds, capped at 50ms
    this._lastTime = now;
    this._draw(dt);
    this._frame = requestAnimationFrame((t) => this._loop(t));
  },

  // Downwind unit vector (direction fire/embers are pushed toward)
  _downwindVec() {
    const rad = ((this._windDir + 180) % 360) * Math.PI / 180;
    return { x: Math.sin(rad), y: -Math.cos(rad) };
  },

  _draw(dt) {
    if (!this._canvas || !this._map) return;

    const ctx = this._ctx;
    const map = this._map;
    const gs  = this._gridSize;

    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    if (this._gridRef.current.size === 0) return;

    // Cell pixel dimensions — recomputed each frame (correct during pan/zoom)
    const nw    = map.latLngToContainerPoint(this._bounds.getNorthWest());
    const se    = map.latLngToContainerPoint(this._bounds.getSouthEast());
    const cellW = (se.x - nw.x) / gs;
    const cellH = (se.y - nw.y) / gs;

    // ── Pass 1: burned cells (no glow) ──────────────────────────────────────
    for (const [key, state] of this._gridRef.current) {
      if (state !== 2) continue;
      const comma = key.indexOf(',');
      const x = +key.slice(0, comma);
      const y = +key.slice(comma + 1);
      ctx.fillStyle = 'rgba(28,8,0,0.7)';
      ctx.fillRect(nw.x + x * cellW, nw.y + y * cellH, cellW + 0.5, cellH + 0.5);
    }

    // ── Pass 2: burning / control / watered cells ───────────────────────────
    const burningCells = [];

    for (const [key, state] of this._gridRef.current) {
      if (state === 2) continue;
      const comma = key.indexOf(',');
      const x = +key.slice(0, comma);
      const y = +key.slice(comma + 1);
      const px = nw.x + x * cellW;
      const py = nw.y + y * cellH;

      if (state === 1) {
        const age = this._burnAgeRef.current.get(key) ?? 0;
        const t   = Math.min(age / 14, 1);
        const g   = Math.floor(140 * (1 - t) + 20 * t);
        if (this._effects) {
          const flicker = 0.5 + Math.random() * 0.2;
          ctx.shadowBlur  = 14 * (flicker + 0.3);
          ctx.shadowColor = `rgba(249,${g},22,${flicker + 0.2})`;
          ctx.fillStyle   = `rgba(249,${g},22,${flicker})`;
          ctx.fillRect(px, py, cellW + 0.5, cellH + 0.5);
          ctx.shadowBlur  = 0;
          burningCells.push({ px: px + cellW * 0.5, py: py + cellH * 0.5 });
        } else {
          ctx.fillStyle = `rgba(249,${g},22,0.65)`;
          ctx.fillRect(px, py, cellW + 0.5, cellH + 0.5);
        }
      } else if (state === 3) {
        ctx.fillStyle = 'rgba(59,130,246,0.65)';
        ctx.fillRect(px, py, cellW + 0.5, cellH + 0.5);
      } else if (state === 4) {
        ctx.fillStyle = 'rgba(14,165,233,0.65)';
        ctx.fillRect(px, py, cellW + 0.5, cellH + 0.5);
      }
    }

    // ── Ember particle system (effects only) ────────────────────────────────
    if (this._effects && this._windSpd > 2 && burningCells.length > 0) {
      this._spawnParticles(burningCells, cellW, cellH, dt);
      this._updateAndDrawParticles(ctx, dt);
    }
  },

  _spawnParticles(burningCells, cellW, cellH, dt) {
    // Spawn rate scales with wind speed and fire size
    const rate    = Math.min(this._windSpd / 10, 6) * burningCells.length;
    const toSpawn = Math.floor(rate * dt + Math.random());

    for (let i = 0; i < toSpawn && this._particles.length < MAX_PARTICLES; i++) {
      const cell   = burningCells[Math.floor(Math.random() * burningCells.length)];
      const dw     = this._downwindVec();
      const spd    = (this._windSpd / 20) * (cellW * 0.8 + Math.random() * cellW * 1.2);
      const spread = (Math.random() - 0.5) * 0.7; // lateral scatter

      this._particles.push({
        x:       cell.px + (Math.random() - 0.5) * cellW,
        y:       cell.py + (Math.random() - 0.5) * cellH,
        vx:      dw.x * spd + (-dw.y) * spread * spd,
        vy:      dw.y * spd + ( dw.x) * spread * spd,
        life:    1.0,                                        // 1 = fresh, 0 = dead
        decay:   0.6 + Math.random() * 0.8,                 // lifetime varies
        size:    1.5 + Math.random() * 2.5,
        hue:     Math.random() < 0.6 ? 28 : 45,             // orange or amber
      });
    }
  },

  _updateAndDrawParticles(ctx, dt) {
    const alive = [];

    for (const p of this._particles) {
      p.x    += p.vx * dt;
      p.y    += p.vy * dt;
      p.life -= p.decay * dt;
      if (p.life <= 0) continue;

      const alpha = p.life * 0.9;
      const r     = p.size * (0.5 + p.life * 0.5); // shrink as it fades

      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.shadowBlur  = r * 3;
      ctx.shadowColor = `hsla(${p.hue},100%,60%,${alpha})`;
      ctx.fillStyle   = `hsla(${p.hue},100%,70%,${alpha})`;
      ctx.fill();
      ctx.shadowBlur  = 0;

      alive.push(p);
    }

    this._particles = alive;
  },
});

export default FireCanvasLayer;
