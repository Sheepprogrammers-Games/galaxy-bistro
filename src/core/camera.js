/**
 * Galaxy Hunter: Gourmet Odyssey - 2D Smooth Lerp Camera & Screen Shake System
 * Handles smooth target tracking, world bounding (2400x1800), and trauma-based screen shakes.
 */

export class Camera {
  /**
   * @param {number} viewportWidth - Width of screen / canvas viewport
   * @param {number} viewportHeight - Height of screen / canvas viewport
   * @param {number} [worldWidth=2400] - Total world map pixel width
   * @param {number} [worldHeight=1800] - Total world map pixel height
   */
  constructor(viewportWidth = 800, viewportHeight = 600, worldWidth = 2400, worldHeight = 1800) {
    this.screenWidth = viewportWidth;
    this.screenHeight = viewportHeight;
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    // View distance is exposed as a player-facing percentage. A larger value
    // shows more world, so the canvas zoom is its reciprocal.
    this.minViewDistance = 85;
    this.maxViewDistance = 140;
    this.viewDistance = 100;
    this.zoom = 1;

    // Camera top-left position in world space
    this.x = 0;
    this.y = 0;

    // Target to track
    this.target = null;

    // Smoothness / lerp speed factor
    this.lerpSpeed = 0.28;

    // Screen Shake / Trauma System
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeElapsed = 0;
    this.shakePhaseX = 0;
    this.shakePhaseY = 0;
    this.shakeFreqX = 48;
    this.shakeFreqY = 41;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.shakeTimer = 0;
  }

  follow(target) {
    this.target = target;
    if (target) {
      this.x = target.x - this.viewportWidth / 2;
      this.y = target.y - this.viewportHeight / 2;
      this.clampToWorld();
    }
  }

  setViewDistance(value = 100) {
    const numericValue = Number(value);
    const clamped = Math.max(
      this.minViewDistance,
      Math.min(this.maxViewDistance, Number.isFinite(numericValue) ? numericValue : 100)
    );

    this.viewDistance = Math.round(clamped / 5) * 5;
    this.zoom = 100 / this.viewDistance;
    this.updateViewportDimensions();

    if (this.target) {
      this.x = this.target.x - this.viewportWidth / 2;
      this.y = this.target.y - this.viewportHeight / 2;
    }
    this.clampToWorld();
    return this.viewDistance;
  }

  updateViewportDimensions() {
    this.viewportWidth = this.screenWidth / this.zoom;
    this.viewportHeight = this.screenHeight / this.zoom;
  }

  addTrauma(amount = 0.2) {
    this.shake(amount * 18, 0.25);
  }

  shake(intensity = 8, duration = 0.25) {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
    this.shakeTimer = this.shakeDuration;
    this.shakeElapsed = 0;
    // 每次震动换一组相位与频率，连续受击不会看出重复
    this.shakePhaseX = Math.random() * Math.PI * 2;
    this.shakePhaseY = Math.random() * Math.PI * 2;
    this.shakeFreqX = 42 + Math.random() * 16;
    this.shakeFreqY = 37 + Math.random() * 16;
  }

  update(dt = 1 / 60, targetOverride = null) {
    const target = targetOverride || this.target;

    // 供渲染插值使用的上一固定步位置
    this.prevX = this.x;
    this.prevY = this.y;

    if (target) {
      const targetX = target.x - this.viewportWidth / 2;
      const targetY = target.y - this.viewportHeight / 2;

      // Smooth frame-rate independent lerp
      const t = 1 - Math.pow(1 - this.lerpSpeed, dt * 60);
      this.x += (targetX - this.x) * t;
      this.y += (targetY - this.y) * t;
    }

    // World bounds clamping
    this.clampToWorld();

    // 屏幕震动：用两个衰减的正弦振荡代替逐帧随机取点。
    // 逐帧随机在 60fps 下是高频噪点，看起来是画面在抖而不是被打中。
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      this.shakeElapsed += dt;

      const traumaRatio = Math.max(0, this.shakeTimer / this.shakeDuration);
      const falloff = traumaRatio * traumaRatio;
      const currentIntensity = this.shakeIntensity * falloff;
      const t = this.shakeElapsed;

      this.shakeOffsetX = Math.sin(t * this.shakeFreqX + this.shakePhaseX) * currentIntensity;
      this.shakeOffsetY = Math.sin(t * this.shakeFreqY + this.shakePhaseY) * currentIntensity * 0.78;

      if (this.shakeTimer <= 0) {
        this.shakeIntensity = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
      }
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }
  }

  clampToWorld() {
    const maxX = Math.max(0, this.worldWidth - this.viewportWidth);
    const maxY = Math.max(0, this.worldHeight - this.viewportHeight);

    // 非有限值会自我传染：一旦写进 x，之后每次插值都还是 NaN。
    // 退回跟随目标，没有目标就退回上一帧。
    if (!Number.isFinite(this.x)) {
      const fx = this.target && Number.isFinite(this.target.x) ? this.target.x - this.viewportWidth / 2 : this.prevX;
      this.x = Number.isFinite(fx) ? fx : 0;
    }
    if (!Number.isFinite(this.y)) {
      const fy = this.target && Number.isFinite(this.target.y) ? this.target.y - this.viewportHeight / 2 : this.prevY;
      this.y = Number.isFinite(fy) ? fy : 0;
    }

    this.x = Math.max(0, Math.min(maxX, this.x));
    this.y = Math.max(0, Math.min(maxY, this.y));
  }

  resize(width, height) {
    this.screenWidth = width;
    this.screenHeight = height;
    this.updateViewportDimensions();
    this.clampToWorld();
  }

  getBounds() {
    return {
      left: this.x,
      top: this.y,
      right: this.x + this.viewportWidth,
      bottom: this.y + this.viewportHeight,
      width: this.viewportWidth,
      height: this.viewportHeight
    };
  }

  isInView(worldX, worldY, width = 0, height = 0, padding = 64) {
    return (
      worldX + width >= this.x - padding &&
      worldX <= this.x + this.viewportWidth + padding &&
      worldY + height >= this.y - padding &&
      worldY <= this.y + this.viewportHeight + padding
    );
  }

  worldToScreen(worldX, worldY) {
    return {
      x: (worldX - this.x) * this.zoom + this.shakeOffsetX,
      y: (worldY - this.y) * this.zoom + this.shakeOffsetY
    };
  }

  screenToWorld(screenX, screenY) {
    return {
      x: (screenX - this.shakeOffsetX) / this.zoom + this.x,
      y: (screenY - this.shakeOffsetY) / this.zoom + this.y
    };
  }
}
