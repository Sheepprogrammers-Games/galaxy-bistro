/**
 * Galaxy Hunter: Gourmet Odyssey - Game Engine Core
 * Handles 60 FPS fixed-timestep requestAnimationFrame loop, keyboard / mouse / touch input maps,
 * high-DPI canvas scaling, and game lifecycle management.
 */

export class Engine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} [options]
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });

    // Target timestep: 60Hz (approx 16.66ms per update)
    this.targetFps = options.targetFps || 60;
    this.fixedDeltaTime = 1 / this.targetFps;
    this.maxFrameSkip = 5;

    // Loop Timing
    this.isRunning = false;
    this.isPaused = false;
    this.animationFrameId = null;
    this.lastTime = 0;
    this.accumulator = 0;
    this.totalTime = 0;
    this.fps = 60;
    this.fpsUpdateTimer = 0;
    this.frameCount = 0;

    // Callbacks
    this.updateCallback = null;
    this.renderCallback = null;

    // 命中顿帧
    this.hitstopTimer = 0;
    this.hitstopScale = 0.08;

    // Canvas & Viewport
    this.width = canvas.width || 1280;
    this.height = canvas.height || 720;
    this.dpr = window.devicePixelRatio || 1;

    // Input States
    this.input = {
      // Directional movement vector: { x: -1..1, y: -1..1 }
      moveX: 0,
      moveY: 0,

      // Held key states: Set<string>
      keysDown: new Set(),
      // Single-frame triggers (cleared after each update)
      keysJustPressed: new Set(),
      keysJustReleased: new Set(),

      // Specific Action Flags
      isAttackPressed: false,
      isAttackDown: false,
      isDashPressed: false,
      isDashDown: false,
      isHeavyAttackPressed: false,
      isParryPressed: false,
      isParryDown: false,
      isCampPressed: false,
      isSkillPressed: false,
      isBackpackPressed: false,
      isMapPressed: false,
      isInteractPressed: false,
      isPausePressed: false,

      // Mouse & Pointer state
      mouse: {
        screenX: 0,
        screenY: 0,
        worldX: 0,
        worldY: 0,
        hasPosition: false,
        isDown: false,
        isRightDown: false,
        justClicked: false,
        justRightClicked: false
      },

      // Touch / Virtual Joystick state
      touch: {
        active: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        dirX: 0,
        dirY: 0,
        moved: false
      }
    };

    this._boundLoop = this._loop.bind(this);
    this._bindEvents();
    this.resize();
  }

  getInput() {
    return this.input;
  }

  // ==========================================
  // LIFECYCLE MANAGEMENT
  // ==========================================

  setUpdateCallback(fn) {
    this.updateCallback = fn;
  }

  setRenderCallback(fn) {
    this.renderCallback = fn;
  }

  /**
   * 触发一次命中顿帧。多次触发取最长的一次，避免连击叠加成长时间卡顿。
   */
  addHitstop(duration = 0.05, scale = 0.08) {
    this.hitstopTimer = Math.max(this.hitstopTimer, duration);
    this.hitstopScale = scale;
  }

  start(updateFn = null, renderFn = null) {
    if (updateFn) this.updateCallback = updateFn;
    if (renderFn) this.renderCallback = renderFn;
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.animationFrameId = requestAnimationFrame(this._boundLoop);
  }

  stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  pause() {
    this.isPaused = true;
    this._clearHeldInput();
  }

  resume() {
    if (!this.isRunning) {
      this.start();
      return;
    }
    this.isPaused = false;
    this.lastTime = performance.now();
  }

  togglePause() {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
    return this.isPaused;
  }

  // ==========================================
  // MAIN GAME LOOP (Fixed Delta Time)
  // ==========================================

  _loop(currentTime) {
    if (!this.isRunning) return;

    let frameDelta = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Clamp huge time spikes (e.g. tab unfocused) to avoid spiral of death
    if (frameDelta > 0.25) frameDelta = 0.25;

    // 命中顿帧：短暂把游戏时间压慢，让打击有停顿感，渲染照常推进
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= frameDelta;
      frameDelta *= this.hitstopScale;
    }

    // FPS Meter
    this.frameCount++;
    this.fpsUpdateTimer += frameDelta;
    if (this.fpsUpdateTimer >= 0.5) {
      this.fps = Math.round((this.frameCount / this.fpsUpdateTimer));
      this.frameCount = 0;
      this.fpsUpdateTimer = 0;
    }

    if (!this.isPaused) {
      this.accumulator += frameDelta;
      this.totalTime += frameDelta;

      let steps = 0;
      while (this.accumulator >= this.fixedDeltaTime && steps < this.maxFrameSkip) {
        // Compute combined directional input
        this._updateInputVectors();

        // Run Fixed Physics & Game Update
        if (this.updateCallback) {
          this.updateCallback(this.fixedDeltaTime, this.totalTime);
        }

        // Clear one-shot key triggers
        this.input.keysJustPressed.clear();
        this.input.keysJustReleased.clear();
        this.input.isAttackPressed = false;
        this.input.isDashPressed = false;
        this.input.isHeavyAttackPressed = false;
        this.input.isParryPressed = false;
        this.input.isCampPressed = false;
        this.input.isSkillPressed = false;
        this.input.isBackpackPressed = false;
        this.input.isMapPressed = false;
        this.input.isInteractPressed = false;
        this.input.isPausePressed = false;
        this.input.mouse.justClicked = false;
        this.input.mouse.justRightClicked = false;

        this.accumulator -= this.fixedDeltaTime;
        steps++;
      }
    }

    // Render Interpolated Frame
    if (this.renderCallback) {
      const alpha = Math.max(0, Math.min(1, this.accumulator / this.fixedDeltaTime));
      this.renderCallback(this.ctx, alpha);
    }

    this.animationFrameId = requestAnimationFrame(this._boundLoop);
  }

  // ==========================================
  // INPUT HANDLING
  // ==========================================

  _bindEvents() {
    // Keyboard Listeners
    window.addEventListener('keydown', (e) => {
      // Don't capture inputs if user is typing in an input field
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return;
      }

      const code = e.code;
      if (!this.input.keysDown.has(code)) {
        this.input.keysJustPressed.add(code);
        this._handleActionJustPressed(code);
      }
      this.input.keysDown.add(code);

      // Prevent default page scroll on game controls
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyS', 'KeyA', 'KeyD'].includes(code)) {
        e.preventDefault();
      }
    });

    window.addEventListener('keyup', (e) => {
      const code = e.code;
      this.input.keysDown.delete(code);
      this.input.keysJustReleased.add(code);
      this._handleActionJustReleased(code);
    });

    // Mouse Listeners
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.input.mouse.screenX = e.clientX - rect.left;
      this.input.mouse.screenY = e.clientY - rect.top;
      this.input.mouse.hasPosition = true;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.input.mouse.screenX = e.clientX - rect.left;
      this.input.mouse.screenY = e.clientY - rect.top;
      this.input.mouse.hasPosition = true;

      if (e.button === 0) {
        this.input.mouse.isDown = true;
        this.input.mouse.justClicked = true;
        this.input.isAttackPressed = true;
        this.input.isAttackDown = true;
      } else if (e.button === 2) {
        this.input.mouse.isRightDown = true;
        this.input.mouse.justRightClicked = true;
        this.input.isParryPressed = true;
        this.input.isParryDown = true;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.input.mouse.isDown = false;
        this.input.isAttackDown = false;
      } else if (e.button === 2) {
        this.input.mouse.isRightDown = false;
        this.input.isParryDown = false;
      }
    });

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    // Touch Listeners for Mobile / Tablets
    this.canvas.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        this.input.touch.active = true;
        this.input.touch.startX = touch.clientX - rect.left;
        this.input.touch.startY = touch.clientY - rect.top;
        this.input.touch.currentX = this.input.touch.startX;
        this.input.touch.currentY = this.input.touch.startY;
        this.input.touch.moved = false;
        this.input.mouse.screenX = this.input.touch.startX;
        this.input.mouse.screenY = this.input.touch.startY;
        this.input.mouse.hasPosition = true;
        this.input.mouse.justClicked = true;
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0 && this.input.touch.active) {
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        this.input.touch.currentX = touch.clientX - rect.left;
        this.input.touch.currentY = touch.clientY - rect.top;

        const dx = this.input.touch.currentX - this.input.touch.startX;
        const dy = this.input.touch.currentY - this.input.touch.startY;
        const dist = Math.hypot(dx, dy);
        const maxDist = 60;
        if (dist > 8) this.input.touch.moved = true;

        if (dist > 5) {
          const clamped = Math.min(dist, maxDist);
          this.input.touch.dirX = (dx / dist) * (clamped / maxDist);
          this.input.touch.dirY = (dy / dist) * (clamped / maxDist);
        } else {
          this.input.touch.dirX = 0;
          this.input.touch.dirY = 0;
        }
      }
    }, { passive: false });

    window.addEventListener('touchend', () => {
      if (this.input.touch.active && !this.input.touch.moved) {
        this.input.isAttackPressed = true;
        this.input.isAttackDown = false;
      }
      this.input.touch.active = false;
      this.input.touch.dirX = 0;
      this.input.touch.dirY = 0;
      this.input.touch.moved = false;
    });

    // A touch can be interrupted by an OS gesture, notification shade, or
    // browser navigation without firing touchend. Treat it like a release so
    // the virtual joystick cannot leave movement latched forever.
    window.addEventListener('touchcancel', () => {
      this.input.touch.active = false;
      this.input.touch.dirX = 0;
      this.input.touch.dirY = 0;
      this.input.touch.moved = false;
    }, { passive: false });

    // Keyboard keyup is not guaranteed when the tab loses focus. Reset all
    // held controls on focus/visibility changes to prevent a permanently
    // pressed direction or action from freezing the player state.
    const clearHeldInput = () => this._clearHeldInput();
    window.addEventListener('blur', clearHeldInput);
    window.addEventListener('pagehide', clearHeldInput);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') clearHeldInput();
      });
    }

    // Window Resize Handling
    window.addEventListener('resize', () => {
      this.resize();
    });
  }

  _handleActionJustPressed(code) {
    switch (code) {
      case 'KeyJ':
        this.input.isAttackPressed = true;
        this.input.isAttackDown = true;
        break;
      case 'KeyK':
        this.input.isDashPressed = true;
        this.input.isDashDown = true;
        break;
      case 'KeyH':
        this.input.isHeavyAttackPressed = true;
        break;
      case 'Space':
        this.input.isParryPressed = true;
        this.input.isParryDown = true;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.input.isParryPressed = true;
        this.input.isParryDown = true;
        break;
      case 'KeyE':
        this.input.isCampPressed = true;
        this.input.isInteractPressed = true;
        break;
      case 'KeyF':
        this.input.isSkillPressed = true;
        break;
      case 'KeyB':
        this.input.isBackpackPressed = true;
        break;
      case 'KeyM':
        this.input.isMapPressed = true;
        break;
      case 'Escape':
      case 'KeyP':
        this.input.isPausePressed = true;
        break;
    }
  }

  _handleActionJustReleased(code) {
    switch (code) {
      case 'KeyJ':
        this.input.isAttackDown = false;
        break;
      case 'KeyK':
        this.input.isDashDown = false;
        break;
      case 'ShiftLeft':
      case 'ShiftRight':
        this.input.isParryDown = false;
        break;
      case 'Space':
        this.input.isParryDown = false;
        break;
    }
  }

  _clearHeldInput() {
    const input = this.input;
    input.keysDown.clear();
    input.keysJustPressed.clear();
    input.keysJustReleased.clear();
    input.moveX = 0;
    input.moveY = 0;
    input.isAttackPressed = false;
    input.isAttackDown = false;
    input.isDashPressed = false;
    input.isDashDown = false;
    input.isHeavyAttackPressed = false;
    input.isParryPressed = false;
    input.isParryDown = false;
    input.isCampPressed = false;
    input.isSkillPressed = false;
    input.isBackpackPressed = false;
    input.isMapPressed = false;
    input.isInteractPressed = false;
    input.isPausePressed = false;
    input.mouse.isDown = false;
    input.mouse.isRightDown = false;
    input.mouse.justClicked = false;
    input.mouse.justRightClicked = false;
    input.touch.active = false;
    input.touch.dirX = 0;
    input.touch.dirY = 0;
    input.touch.moved = false;
  }

  _updateInputVectors() {
    let x = 0;
    let y = 0;

    // Keyboard Movement (WASD & Arrow Keys)
    if (this.input.keysDown.has('KeyW') || this.input.keysDown.has('ArrowUp')) y -= 1;
    if (this.input.keysDown.has('KeyS') || this.input.keysDown.has('ArrowDown')) y += 1;
    if (this.input.keysDown.has('KeyA') || this.input.keysDown.has('ArrowLeft')) x -= 1;
    if (this.input.keysDown.has('KeyD') || this.input.keysDown.has('ArrowRight')) x += 1;

    // If Touch Joystick is active, blend touch vector
    if (this.input.touch.active && (this.input.touch.dirX !== 0 || this.input.touch.dirY !== 0)) {
      x = this.input.touch.dirX;
      y = this.input.touch.dirY;
    } else if (x !== 0 && y !== 0) {
      // Normalize diagonal keyboard movement
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
    }

    this.input.moveX = x;
    this.input.moveY = y;
  }

  /**
   * Resizes canvas to fill its container or screen with high pixel crispness.
   */
  resize() {
    const parent = this.canvas.parentElement || document.body;
    this.width = parent.clientWidth || window.innerWidth;
    this.height = parent.clientHeight || window.innerHeight;

    this.dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    // Scale canvas context for crisp high-DPI rendering
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.scale(this.dpr, this.dpr);
    this.ctx.imageSmoothingEnabled = false; // Crisp pixel art look
  }
}
