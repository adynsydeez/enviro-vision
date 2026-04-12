import BaseCanvasLayer from './BaseCanvasLayer';

/**
 * WindCanvasLayer — animated wind streak lines covering the full map canvas.
 *
 * Performance design:
 *  - Downwind vector cached on setWind(), not recomputed every frame.
 *  - Batch arrays pre-allocated; reused each frame (no per-frame GC).
 *  - Streaks sorted into ALPHA_BUCKETS groups → one stroke() per bucket
 *    instead of one per streak (400 draw calls → ≤10).
 *  - shadowBlur set once per frame, not per streak.
 *  - lineWidth set once per frame.
 *
 * API:
 *   setWind(dir, spd)  — update wind direction (degrees FROM) and speed (km/h)
 */

const STREAK_COUNT  = 400;
const ALPHA_BUCKETS = 10;

const WindCanvasLayer = BaseCanvasLayer.extend({
  initialize(options = {}) {
    BaseCanvasLayer.prototype.initialize.call(
      this,
      [[-90, -180], [90, 180]],
      1,
      { animated: true }
    );
    this._windDir = options.windDir ?? 45;
    this._windSpd = options.windSpd ?? 30;
    this._streaks = Array.from({ length: STREAK_COUNT }, () => ({
      x: 0, y: 0, life: 0, maxLife: 1, speed: 0, length: 0, active: false,
    }));
    // Flat number arrays per bucket: [x0,y0,x1,y1, ...] — reused every frame.
    this._batches = Array.from({ length: ALPHA_BUCKETS }, () => []);
    this._updateWindVec();
  },

  setWind(dir, spd) {
    this._windDir = dir;
    this._windSpd = spd;
    this._updateWindVec();
  },

  // Cache trig — only runs when wind changes, not every frame.
  _updateWindVec() {
    const rad  = ((this._windDir + 180) % 360) * Math.PI / 180;
    this._dwx  = Math.sin(rad);
    this._dwy  = -Math.cos(rad);
  },

  _resize() {
    BaseCanvasLayer.prototype._resize.call(this);
    for (const s of this._streaks) s.active = false;
  },

  _spawnStreak(s) {
    const c = this._canvas;
    if (!c) return;
    s.x       = Math.random() * c.width;
    s.y       = Math.random() * c.height;
    s.life    = Math.random() * 0.4; // stagger phase so streaks don't pulse in sync
    s.maxLife = 0.6 + Math.random() * 0.7;
    const t   = this._windSpd / 100;
    s.speed   = 45 + t * 180; // 45–225 px/s
    s.length  = 18 + t * 42;  // 18–60 px
    s.active  = true;
  },

  draw(dt = 0.016) {
    const ctx = this._ctx;
    const c   = this._canvas;
    if (!ctx || !c) return;

    ctx.clearRect(0, 0, c.width, c.height);
    if (this._windSpd < 1) return;

    const dwx     = this._dwx;
    const dwy     = this._dwy;
    const alpha   = 0.55 + Math.min(this._windSpd / 100, 1) * 0.35;
    const batches = this._batches;

    // Reset batch arrays without re-allocating.
    for (let b = 0; b < ALPHA_BUCKETS; b++) batches[b].length = 0;

    // Update every streak and sort into an alpha bucket.
    for (const s of this._streaks) {
      if (!s.active || s.life >= s.maxLife) {
        this._spawnStreak(s);
        if (!s.active) continue;
      }

      s.x    += dwx * s.speed * dt;
      s.y    += dwy * s.speed * dt;
      s.life += dt;

      const t = s.life / s.maxLife;
      const a = Math.sin(t * Math.PI) * alpha;
      if (a < 0.02) continue;

      // Bucket index: map [0, alpha] → [0, ALPHA_BUCKETS-1].
      const b    = Math.min((a / alpha * ALPHA_BUCKETS) | 0, ALPHA_BUCKETS - 1);
      const segs = batches[b];
      segs.push(s.x, s.y, s.x - dwx * s.length, s.y - dwy * s.length);
    }

    // One-time state for all strokes.
    ctx.lineWidth   = 1.5;
    ctx.shadowBlur  = 4;
    ctx.shadowColor = 'rgba(103,232,249,0.25)';

    // One beginPath+stroke per bucket (≤10 draw calls for 400 streaks).
    for (let b = 0; b < ALPHA_BUCKETS; b++) {
      const segs = batches[b];
      if (!segs.length) continue;
      // Use the bucket midpoint as the representative alpha for this group.
      const a = ((b + 0.5) / ALPHA_BUCKETS) * alpha;
      ctx.strokeStyle = `rgba(103,232,249,${a.toFixed(2)})`;
      ctx.beginPath();
      for (let i = 0; i < segs.length; i += 4) {
        ctx.moveTo(segs[i],     segs[i + 1]);
        ctx.lineTo(segs[i + 2], segs[i + 3]);
      }
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
  },
});

export default WindCanvasLayer;
