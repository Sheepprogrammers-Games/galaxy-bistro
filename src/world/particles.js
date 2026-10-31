/**
 * Galaxy Hunter: Gourmet Odyssey - High Performance Particle Engine
 * 
 * Features:
 * - Object pooling system to eliminate Garbage Collection hitches at 60 FPS
 * - Specialized emitters & effect types:
 *   1. slashArc: Crescent melee swooshes (Plasma Chef Knife / Pan heavy swing)
 *   2. hitSparks: High-speed directional kinetic & electric sparks
 *   3. bloodSplatter: Alien blood & slime splatters with ground decal staining
 *   4. glowingSpores: Ambient floating bioluminescent spores with wave turbulence
 *   5. dashTrails: Ghost afterimage motion blur trails
 *   6. campfireEmbers: Fiery ascending embers with realistic flicker
 *   7. cookingSmoke: Culinary steam puffs, flavor aroma spirals, Michelin star sparks
 *   8. iceShards / magmaSplashes / damageNumbers
 * - Decal persistent ground layer (with max cap & graceful fadeout)
 */

export class Particle {
  constructor() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.ax = 0;
    this.ay = 0;
    this.friction = 0.98;
    this.gravity = 0;

    this.life = 1.0;
    this.maxLife = 1.0;
    this.size = 4;
    this.endSize = 0;
    this.color = '#ffffff';
    this.endColor = null;
    this.alpha = 1.0;
    this.rotation = 0;
    this.vRot = 0;

    this.type = 'circle'; // 'circle', 'spark', 'arc', 'trail', 'smoke', 'text', 'star'
    this.blendMode = 'source-over'; // 'source-over', 'lighter'
    this.text = '';
    this.fontSize = 14;

    // Arc specific
    this.arcStartAngle = 0;
    this.arcEndAngle = 0;
    this.arcRadius = 20;
    this.arcLineWidth = 4;

    // Decal creation flag
    this.leavesDecal = false;
    this.decalColor = '';
  }

  reset() {
    this.active = false;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.ax = 0;
    this.ay = 0;
    this.friction = 0.98;
    this.gravity = 0;
    this.life = 1.0;
    this.maxLife = 1.0;
    this.size = 4;
    this.endSize = 0;
    this.color = '#ffffff';
    this.endColor = null;
    this.alpha = 1.0;
    this.rotation = 0;
    this.vRot = 0;
    this.type = 'circle';
    this.blendMode = 'source-over';
    this.text = '';
    this.fontSize = 14;
    this.arcStartAngle = 0;
    this.arcEndAngle = 0;
    this.arcRadius = 20;
    this.arcLineWidth = 4;
    this.leavesDecal = false;
    this.decalColor = '';
  }

  update(dt, decalCallback) {
    if (!this.active) return;

    this.life -= dt;
    if (this.life <= 0) {
      if (this.leavesDecal && decalCallback) {
        decalCallback(this.x, this.y, this.size * 1.5, this.decalColor || this.color);
      }
      this.active = false;
      return;
    }

    // Apply physics
    this.vx += this.ax * dt;
    this.vy += (this.ay + this.gravity) * dt;
    this.vx *= Math.pow(this.friction, dt * 60);
    this.vy *= Math.pow(this.friction, dt * 60);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.vRot * dt;

    // Calculate normalized progress (1 -> 0)
    const progress = this.life / this.maxLife;

    // Turbulence for spore / smoke
    if (this.type === 'spore') {
      this.x += Math.sin(this.life * 6 + this.y * 0.05) * 12 * dt;
    } else if (this.type === 'smoke') {
      this.x += Math.cos(this.life * 4 + this.x * 0.05) * 8 * dt;
    }
  }

  render(ctx, camera) {
    if (!this.active) return;

    const rx = this.x - camera.x;
    const ry = this.y - camera.y;

    // Viewport cull check
    const margin = 50;
    if (
      rx < -margin ||
      rx > camera.viewportWidth + margin ||
      ry < -margin ||
      ry > camera.viewportHeight + margin
    ) {
      return;
    }

    const progress = Math.max(0, Math.min(1, this.life / this.maxLife));
    const currentSize = this.endSize + (this.size - this.endSize) * progress;
    const currentAlpha = this.alpha * progress;

    if (currentAlpha <= 0 || currentSize <= 0) return;

    ctx.save();
    ctx.globalAlpha = currentAlpha;
    if (this.blendMode) {
      ctx.globalCompositeOperation = this.blendMode;
    }

    if (this.type === 'circle') {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(rx, ry, currentSize, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'spark') {
      // Stretched spark line in direction of velocity
      ctx.strokeStyle = this.color;
      ctx.lineWidth = Math.max(1, currentSize);
      ctx.beginPath();
      ctx.moveTo(rx, ry);
      ctx.lineTo(rx - this.vx * 0.05, ry - this.vy * 0.05);
      ctx.stroke();
    } else if (this.type === 'spore') {
      // Glowing soft circle with halo
      const grad = ctx.createRadialGradient(rx, ry, 0, rx, ry, currentSize * 2);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.4, this.color);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(rx, ry, currentSize * 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'arc') {
      // Sword slash crescent arc
      ctx.translate(rx, ry);
      ctx.rotate(this.rotation);
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.arcLineWidth * progress;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, this.arcRadius, this.arcStartAngle, this.arcEndAngle);
      ctx.stroke();
    } else if (this.type === 'smoke') {
      // Soft fading cloudy puff
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(rx, ry, currentSize, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.type === 'star') {
      // 4-point star glint
      ctx.translate(rx, ry);
      ctx.rotate(this.rotation);
      ctx.fillStyle = this.color;
      const s = currentSize;
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.3, -s * 0.3);
      ctx.lineTo(s, 0);
      ctx.lineTo(s * 0.3, s * 0.3);
      ctx.lineTo(0, s);
      ctx.lineTo(-s * 0.3, s * 0.3);
      ctx.lineTo(-s, 0);
      ctx.lineTo(-s * 0.3, -s * 0.3);
      ctx.closePath();
      ctx.fill();
    } else if (this.type === 'text') {
      ctx.fillStyle = this.color;
      ctx.font = `bold ${this.fontSize}px 'Segoe UI', sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 3;
      ctx.strokeText(this.text, rx, ry);
      ctx.fillText(this.text, rx, ry);
    }

    ctx.restore();
  }
}

/**
 * High-performance particle engine managing pooling and custom emitter triggers
 */
export class ParticleSystem {
  constructor(poolSize = 1200) {
    this.poolSize = poolSize;
    this.pool = [];
    for (let i = 0; i < poolSize; i++) {
      this.pool.push(new Particle());
    }

    // Decals layer (splattered stains on ground)
    this.decals = [];
    this.maxDecals = 80;

    this.addDecal = this.addDecal.bind(this);
  }

  /**
   * Acquire an inactive particle from pool
   */
  _spawn() {
    for (let i = 0; i < this.poolSize; i++) {
      if (!this.pool[i].active) {
        this.pool[i].reset();
        this.pool[i].active = true;
        return this.pool[i];
      }
    }
    // If pool is full, reuse oldest
    const recycled = this.pool[0];
    recycled.reset();
    recycled.active = true;
    return recycled;
  }

  /**
   * Add a persistent ground decal (stain/scorch)
   */
  addDecal(x, y, radius, color) {
    if (this.decals.length >= this.maxDecals) {
      this.decals.shift(); // Remove oldest decal
    }
    this.decals.push({
      x,
      y,
      radius: Math.max(3, Math.min(18, radius)),
      color,
      alpha: 0.7,
      maxLife: 25.0,
      life: 25.0
    });
  }

  // ==========================================
  // Specialized Emitters
  // ==========================================

  /**
   * Melee Weapon Slash Arc (Plasma blade swoosh / Skillet heavy swing)
   */
  slashArc(x, y, angle, radius = 45, color = '#38bdf8', arcSpan = Math.PI * 0.75) {
    const p = this._spawn();
    p.x = x;
    p.y = y;
    p.type = 'arc';
    p.color = color;
    p.blendMode = 'lighter';
    p.rotation = angle;
    p.arcRadius = radius;
    p.arcStartAngle = -arcSpan / 2;
    p.arcEndAngle = arcSpan / 2;
    p.arcLineWidth = 8;
    p.life = 0.18;
    p.maxLife = 0.18;

    // Also spawn a few micro sparks along the blade edge
    for (let i = 0; i < 4; i++) {
      const spark = this._spawn();
      const sparkAngle = angle + (Math.random() - 0.5) * arcSpan;
      spark.x = x + Math.cos(sparkAngle) * radius;
      spark.y = y + Math.sin(sparkAngle) * radius;
      spark.vx = Math.cos(sparkAngle) * 80 + (Math.random() - 0.5) * 40;
      spark.vy = Math.sin(sparkAngle) * 80 + (Math.random() - 0.5) * 40;
      spark.type = 'spark';
      spark.color = '#ffffff';
      spark.blendMode = 'lighter';
      spark.size = 3;
      spark.life = 0.2 + Math.random() * 0.15;
      spark.maxLife = spark.life;
    }
  }

  /**
   * Hit Sparks on creature impact / weapon strike
   */
  hitSparks(x, y, count = 12, color = '#fef08a', speed = 220, spread = Math.PI * 2) {
    for (let i = 0; i < count; i++) {
      const p = this._spawn();
      const ang = Math.random() * spread;
      const spd = (0.4 + Math.random() * 0.6) * speed;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd;
      p.friction = 0.90;
      p.type = 'spark';
      p.color = color;
      p.blendMode = 'lighter';
      p.size = 2 + Math.random() * 2.5;
      p.life = 0.25 + Math.random() * 0.25;
      p.maxLife = p.life;
    }

    // Central flash glint
    const star = this._spawn();
    star.x = x;
    star.y = y;
    star.type = 'star';
    star.color = '#ffffff';
    star.blendMode = 'lighter';
    star.size = 14;
    star.endSize = 0;
    star.life = 0.12;
    star.maxLife = 0.12;
  }

  /**
   * Alien Blood / Slime Splatters with ground decal staining
   */
  bloodSplatter(x, y, color = '#06d6a0', count = 14) {
    for (let i = 0; i < count; i++) {
      const p = this._spawn();
      const ang = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 160;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd;
      p.gravity = 140; // falls to ground
      p.friction = 0.92;
      p.type = 'circle';
      p.color = color;
      p.size = 3.5 + Math.random() * 3.5;
      p.endSize = 1;
      p.life = 0.35 + Math.random() * 0.3;
      p.maxLife = p.life;

      // 50% chance to leave ground decal stain
      if (Math.random() < 0.5) {
        p.leavesDecal = true;
        p.decalColor = color;
      }
    }
  }

  /**
   * Bioluminescent floating spores (Mushroom forest / Crystal Rift)
   */
  glowingSpores(x, y, count = 5, color = '#06d6a0') {
    for (let i = 0; i < count; i++) {
      const p = this._spawn();
      p.x = x + (Math.random() - 0.5) * 40;
      p.y = y + (Math.random() - 0.5) * 40;
      p.vx = (Math.random() - 0.5) * 15;
      p.vy = -18 - Math.random() * 25; // gently rise
      p.friction = 0.99;
      p.type = 'spore';
      p.color = color;
      p.blendMode = 'lighter';
      p.size = 2.5 + Math.random() * 2.5;
      p.endSize = 0.5;
      p.life = 1.8 + Math.random() * 1.5;
      p.maxLife = p.life;
    }
  }

  /**
   * Dash Ghost Trail (Player dodge roll afterimage / motion blur)
   */
  dashTrails(x, y, radius = 18, color = 'rgba(56, 189, 248, 0.6)') {
    const p = this._spawn();
    p.x = x;
    p.y = y;
    p.type = 'circle';
    p.color = color;
    p.blendMode = 'lighter';
    p.size = radius;
    p.endSize = radius * 0.4;
    p.alpha = 0.65;
    p.life = 0.22;
    p.maxLife = 0.22;
  }

  /**
   * Campfire Embers (Rising fiery sparks)
   */
  campfireEmbers(x, y, count = 3) {
    for (let i = 0; i < count; i++) {
      const p = this._spawn();
      p.x = x + (Math.random() - 0.5) * 20;
      p.y = y + (Math.random() - 0.5) * 8;
      p.vx = (Math.random() - 0.5) * 25;
      p.vy = -45 - Math.random() * 45;
      p.friction = 0.98;
      p.type = 'circle';
      p.color = Math.random() > 0.4 ? '#f59e0b' : '#ef4444';
      p.blendMode = 'lighter';
      p.size = 2 + Math.random() * 2;
      p.endSize = 0.5;
      p.life = 0.8 + Math.random() * 0.8;
      p.maxLife = p.life;
    }
  }

  /**
   * Cooking Steam & Flavor Sparks (Gourmet Camp Cooking)
   */
  cookingSmoke(x, y, count = 2, isFlavorStar = false) {
    for (let i = 0; i < count; i++) {
      const p = this._spawn();
      p.x = x + (Math.random() - 0.5) * 16;
      p.y = y;
      p.vx = (Math.random() - 0.5) * 20;
      p.vy = -30 - Math.random() * 30;
      p.friction = 0.97;

      if (isFlavorStar) {
        p.type = 'star';
        p.color = ['#fbbf24', '#f472b6', '#a78bfa', '#38bdf8'][Math.floor(Math.random() * 4)];
        p.blendMode = 'lighter';
        p.size = 7 + Math.random() * 5;
        p.endSize = 2;
        p.vRot = 3.0;
        p.life = 1.2 + Math.random() * 0.6;
      } else {
        p.type = 'smoke';
        p.color = 'rgba(241, 245, 249, 0.4)';
        p.blendMode = 'source-over';
        p.size = 8 + Math.random() * 6;
        p.endSize = 22 + Math.random() * 10;
        p.life = 1.4 + Math.random() * 0.8;
      }
      p.maxLife = p.life;
    }
  }

  /**
   * Floating Combat Damage Numbers & Loot notifications
   */
  floatingText(x, y, text, color = '#fef08a', fontSize = 15) {
    const p = this._spawn();
    p.x = x;
    p.y = y;
    p.vx = (Math.random() - 0.5) * 20;
    p.vy = -65;
    p.friction = 0.94;
    p.type = 'text';
    p.text = text;
    p.color = color;
    p.fontSize = fontSize;
    p.blendMode = 'source-over';
    p.life = 0.85;
    p.maxLife = 0.85;
  }

  /**
   * Magma Bubbles Burst
   */
  magmaBurst(x, y, count = 8) {
    for (let i = 0; i < count; i++) {
      const p = this._spawn();
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 100;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd - 30;
      p.gravity = 120;
      p.type = 'circle';
      p.color = '#f97316';
      p.blendMode = 'lighter';
      p.size = 3 + Math.random() * 3;
      p.life = 0.5 + Math.random() * 0.3;
      p.maxLife = p.life;
    }
  }

  /**
   * Cryo Ice Shards
   */
  iceShards(x, y, count = 10) {
    for (let i = 0; i < count; i++) {
      const p = this._spawn();
      const ang = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 120;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd;
      p.friction = 0.92;
      p.type = 'spark';
      p.color = '#bae6fd';
      p.blendMode = 'lighter';
      p.size = 3;
      p.life = 0.35 + Math.random() * 0.25;
      p.maxLife = p.life;
    }
  }

  // Gameplay-facing compatibility emitters. Entity modules use descriptive
  // effect names while this engine keeps a smaller set of pooled primitives.
  spawnSlashArc(x, y, angle, comboStep = 1) {
    const color = comboStep >= 3 ? '#f59e0b' : '#38bdf8';
    this.slashArc(x, y, angle, 40 + comboStep * 5, color);
  }

  spawnHitSparks(x, y, sourceAngle = 0, color = '#fef08a') {
    this.hitSparks(x, y, 10, color, 190, Math.PI * 2);
  }

  spawnCreatureDeathBurst(x, y, color = '#06d6a0') {
    this.bloodSplatter(x, y, color, 16);
    this.glowingSpores(x, y, 8, color);
  }

  spawnPlayerDeathBurst(x, y) {
    this.hitSparks(x, y, 24, '#f0c77c', 240);
    this.glowingSpores(x, y, 12, '#5cd5bd');
  }

  spawnSporePuff(x, y, color = '#86efac') {
    this.glowingSpores(x, y, 5, color);
  }

  spawnVenomDrip(x, y) {
    const particle = this._spawn();
    particle.x = x;
    particle.y = y;
    particle.vx = (Math.random() - 0.5) * 18;
    particle.vy = 24 + Math.random() * 24;
    particle.gravity = 90;
    particle.type = 'circle';
    particle.color = '#a855f7';
    particle.blendMode = 'lighter';
    particle.size = 3;
    particle.life = 0.45;
    particle.maxLife = particle.life;
  }

  spawnChargeSparkles(x, y, color = '#38bdf8') {
    this.hitSparks(x, y, 4, color, 75);
  }

  spawnFlameEmber(x, y) {
    this.campfireEmbers(x, y, 2);
  }

  spawnFrostSparkle(x, y, color = '#93c5fd') {
    this.glowingSpores(x, y, 2, color);
  }

  spawnShockwave(x, y, radius = 80, color = '#38bdf8') {
    const particle = this._spawn();
    particle.x = x;
    particle.y = y;
    particle.type = 'arc';
    particle.color = color;
    particle.blendMode = 'lighter';
    particle.arcRadius = radius;
    particle.arcStartAngle = 0;
    particle.arcEndAngle = Math.PI * 2;
    particle.arcLineWidth = 5;
    particle.size = 1;
    particle.life = 0.36;
    particle.maxLife = particle.life;
  }

  spawnAttackTelegraph(x, y, angle, color = '#ef4444') {
    const distance = 18;
    this.hitSparks(
      x + Math.cos(angle) * distance,
      y + Math.sin(angle) * distance,
      2,
      color,
      50,
      Math.PI * 2
    );
  }

  spawnStunStars(x, y) {
    for (let i = 0; i < 3; i++) {
      const particle = this._spawn();
      const angle = (i / 3) * Math.PI * 2;
      particle.x = x + Math.cos(angle) * 10;
      particle.y = y + Math.sin(angle) * 4;
      particle.vx = Math.cos(angle) * 12;
      particle.vy = -18;
      particle.type = 'star';
      particle.color = '#f0c77c';
      particle.blendMode = 'lighter';
      particle.size = 4;
      particle.vRot = 3;
      particle.life = 0.55;
      particle.maxLife = particle.life;
    }
  }

  spawnShieldGlint(x, y, color = '#f59e0b') {
    const particle = this._spawn();
    particle.x = x + (Math.random() - 0.5) * 28;
    particle.y = y + (Math.random() - 0.5) * 28;
    particle.type = 'star';
    particle.color = color;
    particle.blendMode = 'lighter';
    particle.size = 5;
    particle.life = 0.28;
    particle.maxLife = particle.life;
  }

  spawnFootstepDust(x, y, angle, side = 1) {
    const backX = -Math.cos(angle);
    const backY = -Math.sin(angle);
    const sideX = -Math.sin(angle) * side;
    const sideY = Math.cos(angle) * side;

    for (let i = 0; i < 2; i++) {
      const particle = this._spawn();
      particle.x = x + backX * 7 + sideX * (5 + i * 2) + (Math.random() - 0.5) * 3;
      particle.y = y + backY * 7 + sideY * (5 + i * 2) + (Math.random() - 0.5) * 3;
      particle.vx = backX * (15 + Math.random() * 12) + sideX * (Math.random() - 0.5) * 10;
      particle.vy = backY * (15 + Math.random() * 12) + sideY * (Math.random() - 0.5) * 10;
      particle.friction = 0.9;
      particle.type = 'smoke';
      particle.color = 'rgba(148, 163, 184, 0.32)';
      particle.size = 3 + Math.random() * 2;
      particle.endSize = 7 + Math.random() * 3;
      particle.alpha = 0.45;
      particle.life = 0.24 + Math.random() * 0.1;
      particle.maxLife = particle.life;
    }
  }

  spawnDashBurst(x, y, angle) {
    this.dashTrails(x, y, 20, 'rgba(56, 189, 248, 0.7)');
    this.hitSparks(x - Math.cos(angle) * 12, y - Math.sin(angle) * 12, 7, '#38bdf8', 120);
  }

  spawnParrySpark(x, y, sourceAngle) {
    this.hitSparks(x, y, 14, '#f59e0b', 240, Math.PI * 2);
  }

  // ==========================================
  // Update & Render Cycle
  // ==========================================

  update(dt) {
    // 1. Update active particles
    for (let i = 0; i < this.poolSize; i++) {
      if (this.pool[i].active) {
        this.pool[i].update(dt, this.addDecal);
      }
    }

    // 2. Update persistent ground decals
    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      d.life -= dt;
      if (d.life <= 0) {
        this.decals.splice(i, 1);
      } else {
        d.alpha = Math.max(0, d.life / d.maxLife * 0.6);
      }
    }
  }

  /**
   * Render ground decals (under entities)
   */
  renderDecals(ctx, camera) {
    if (this.decals.length === 0) return;

    ctx.save();
    for (const d of this.decals) {
      const rx = d.x - camera.x;
      const ry = d.y - camera.y;
      if (
        rx >= -30 && rx <= camera.viewportWidth + 30 &&
        ry >= -30 && ry <= camera.viewportHeight + 30
      ) {
        ctx.globalAlpha = d.alpha;
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.arc(rx, ry, d.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /**
   * Render all active particles (over entities)
   */
  render(ctx, camera) {
    for (let i = 0; i < this.poolSize; i++) {
      if (this.pool[i].active) {
        this.pool[i].render(ctx, camera);
      }
    }
  }
}

// Global Singleton Instance for easy cross-module access
export const particles = new ParticleSystem(1200);
