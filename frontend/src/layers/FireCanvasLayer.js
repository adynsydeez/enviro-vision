import BaseCanvasLayer from './BaseCanvasLayer';

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

const FireCanvasLayer = BaseCanvasLayer.extend({
  initialize(gridRef, burnAgeRef, bounds, gridSize) {
    BaseCanvasLayer.prototype.initialize.call(this, bounds, gridSize);
    this._gridRef = gridRef;
    this._burnAgeRef = burnAgeRef;
    this._particles = [];
    this._windDir = 0;   // degrees FROM (meteorological)
    this._windSpd = 0;   // km/h
    this._effects = true;
  },

  setWind(dir, spd) {
    this._windDir = dir;
    this._windSpd = spd;
  },

  setEffects(enabled) {
    this._effects = enabled;
    if (!enabled) this._particles = [];
  },

  // Downwind unit vector (direction fire/embers are pushed toward)
  _downwindVec() {
    const rad = ((this._windDir + 180) % 360) * Math.PI / 180;
    return { x: Math.sin(rad), y: -Math.cos(rad) };
  },

  draw(dt) {
    if (!this._canvas || !this._map) return;
    const ctx = this._ctx;
    const map = this._map;
    const gs = this._gridSize;

    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    if (this._gridRef.current.size === 0) return;

    // Cell pixel dimensions — recomputed each frame (correct during pan/zoom)
    const nw = map.latLngToContainerPoint(this._bounds.getNorthWest());
    const se = map.latLngToContainerPoint(this._bounds.getSouthEast());
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
        const t = Math.min(age / 14, 1);
        const g = Math.floor(140 * (1 - t) + 20 * t);
        if (this._effects) {
          const flicker = 0.5 + Math.random() * 0.2;
          ctx.shadowBlur = 14 * (flicker + 0.3);
          ctx.shadowColor = `rgba(249,${g},22,${flicker + 0.2})`;
          ctx.fillStyle = `rgba(249,${g},22,${flicker})`;
          ctx.fillRect(px, py, cellW + 0.5, cellH + 0.5);
          ctx.shadowBlur = 0;
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
    const rate = Math.min(this._windSpd / 10, 6) * burningCells.length;
    const toSpawn = Math.floor(rate * dt + Math.random());

    for (let i = 0; i < toSpawn && this._particles.length < MAX_PARTICLES; i++) {
      const cell = burningCells[Math.floor(Math.random() * burningCells.length)];
      const dw = this._downwindVec();
      const spd = (this._windSpd / 20) * (cellW * 0.8 + Math.random() * cellW * 1.2);
      const spread = (Math.random() - 0.5) * 0.7; // lateral scatter

      this._particles.push({
        x: cell.px + (Math.random() - 0.5) * cellW,
        y: cell.py + (Math.random() - 0.5) * cellH,
        vx: dw.x * spd + (-dw.y) * spread * spd,
        vy: dw.y * spd + (dw.x) * spread * spd,
        life: 1.0,                                        // 1 = fresh, 0 = dead
        decay: 0.6 + Math.random() * 0.8,                 // lifetime varies
        size: 1.5 + Math.random() * 2.5,
        hue: Math.random() < 0.6 ? 28 : 45,             // orange or amber
      });
    }
  },

  _updateAndDrawParticles(ctx, dt) {
    const alive = [];

    for (const p of this._particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= p.decay * dt;
      if (p.life <= 0) continue;

      const alpha = p.life * 0.9;
      const r = p.size * (0.5 + p.life * 0.5); // shrink as it fades

      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.shadowBlur = r * 3;
      ctx.shadowColor = `hsla(${p.hue},100%,60%,${alpha})`;
      ctx.fillStyle = `hsla(${p.hue},100%,70%,${alpha})`;
      ctx.fill();
      ctx.shadowBlur = 0;

      alive.push(p);
    }

    this._particles = alive;
  },
});

export default FireCanvasLayer;
