const clamp01 = (value) => Math.max(0, Math.min(1, value));
const easeOutCubic = (value) => 1 - Math.pow(1 - clamp01(value), 3);

/**
 * 按比例提亮颜色，支持 #rgb / #rrggbb / rgb() / rgba() 三种写法。
 */
const brightenColor = (color, factor) => {
  if (typeof color !== 'string') return color;
  const scale = (channel) => Math.max(0, Math.min(255, Math.round(channel * factor)));

  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const digits = hex[1];
    const full = digits.length === 3 ? digits.split('').map((d) => d + d).join('') : digits;
    const r = scale(parseInt(full.slice(0, 2), 16));
    const g = scale(parseInt(full.slice(2, 4), 16));
    const b = scale(parseInt(full.slice(4, 6), 16));
    return `rgb(${r}, ${g}, ${b})`;
  }

  const rgb = color.trim().match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1].split(',').map((p) => parseFloat(p));
    if (parts.length >= 3) {
      const [r, g, b] = parts;
      const a = parts.length > 3 ? parts[3] : 1;
      return `rgba(${scale(r)}, ${scale(g)}, ${scale(b)}, ${a})`;
    }
  }

  return color;
};

/**
 * 递归提亮整套调色板，字符串与字符串数组都能处理。
 */
const brightenPalette = (palette, factor) => {
  const result = {};
  for (const [key, value] of Object.entries(palette)) {
    result[key] = Array.isArray(value)
      ? value.map((shade) => brightenColor(shade, factor))
      : brightenColor(value, factor);
  }
  return result;
};

const CHARACTER_PALETTES = {
  normal: {
    outline: '#07141c',
    suit: ['#111d29', '#263b48', '#536b72'],
    armor: ['#69777a', '#d6e0dc', '#f7faf6'],
    joint: ['#101c27', '#52646a'],
    boot: ['#0a151e', '#263945', '#687b80'],
    accent: '#f4ad3f',
    accentDark: '#994d1d',
    visor: '#55ead6',
    visorDark: '#063a47'
  },
  ghost: {
    outline: 'rgba(7, 46, 56, 0.88)',
    suit: ['rgba(13, 91, 105, 0.78)', 'rgba(35, 196, 199, 0.9)', 'rgba(184, 255, 239, 0.92)'],
    armor: ['rgba(24, 114, 127, 0.8)', 'rgba(74, 222, 204, 0.92)', 'rgba(225, 255, 249, 0.94)'],
    joint: ['rgba(10, 76, 89, 0.88)', 'rgba(66, 217, 207, 0.96)'],
    boot: ['rgba(8, 55, 69, 0.86)', 'rgba(27, 152, 164, 0.94)', 'rgba(128, 244, 231, 0.95)'],
    accent: 'rgba(151, 255, 221, 0.94)',
    accentDark: 'rgba(17, 122, 132, 0.9)',
    visor: 'rgba(211, 255, 248, 0.98)',
    visorDark: 'rgba(12, 115, 130, 0.92)'
  }
};

// 受击闪白用提亮后的调色板顶替滤镜，绘制成本为零。
CHARACTER_PALETTES.hurt = brightenPalette(CHARACTER_PALETTES.normal, 2);

// 各主厨的体型与随身标识。scale 直接乘在整个模型上，
// crest 决定头顶配件，rig 决定背后挂的是什么家伙。
const CHEF_BUILDS = {
  default: { scale: 1, crest: 'blade', gear: 'twin_knife' },
  nova: { scale: 1, crest: 'blade', gear: 'twin_knife' },
  ember: { scale: 0.96, crest: 'flame', gear: 'wok' },
  lumen: { scale: 0.93, crest: 'wreath', gear: 'tray' },
  grim: { scale: 1.14, crest: 'tusk', gear: 'cleaver' },
  echo: { scale: 0.97, crest: 'ring', gear: 'orbs' }
};

/**
 * Galaxy Hunter: Gourmet Odyssey
 * Player Entity & Combat Control System
 * File: src/entities/player.js
 */

export const PLAYER_STATES = {
  IDLE: 'idle',
  RUN: 'run',
  SLASH1: 'slash1',
  SLASH2: 'slash2',
  SLASH3: 'slash3',
  HEAVY_STRIKE: 'heavy_strike',
  PARRY_GUARD: 'parry_guard',
  DASH: 'dash',
  HURT: 'hurt',
  DEAD: 'dead'
};

export class Player {
  constructor(x = 0, y = 0) {
    // Position and Physics
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = 20;
    this.baseSpeed = 250;
    this.speed = 250;
    this.moveAcceleration = 34;
    this.moveBraking = 30;

    // Orientation & Facing (8 directions + continuous angle)
    this.facingAngle = 0; // radians (0 = East)
    this.aimAngle = 0; // 最新的瞄准方向，攻击锁定朝向期间仍持续更新
    this.visualFacingAngle = 0;
    this.facingDir = 'E'; // 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'
    this.spriteFacingSide = 1;
    this.spriteFlipScale = 1;
    this.turnLean = 0;
    this.moveInput = { x: 0, y: 0 };

    // Vitals
    this.maxHp = 100;
    this.hp = 100;
    this.maxStamina = 100;
    this.stamina = 100;
    this.staminaRegenRate = 30; // stamina/sec
    this.staminaRegenDelay = 0; // delay after stamina consumption

    // State Machine
    this.state = PLAYER_STATES.IDLE;
    this.stateTimer = 0;
    this.stateDuration = 0;

    // Combat & Combo System
    this.comboStep = 0; // 0, 1, 2, 3
    this.comboBufferTime = 0; // Window to queue next attack
    this.comboResetTimer = 0; // Timer before combo resets to 0
    this.attackHitbox = null;
    this.hitEntitiesThisAttack = new Set();

    // Parry System (0.2s Perfect Parry Window)
    this.parryDuration = 0.45; // Total guard pose time
    this.perfectParryWindow = 0.20; // First 0.2s is perfect deflect
    this.isParrying = false;
    this.parryFlashTimer = 0;

    // Dash Mechanics
    this.dashDuration = 0.22;
    this.dashSpeed = 460;
    this.dashCost = 22;
    this.dashCooldown = 0.35;
    this.dashCooldownTimer = 0;
    this.dashTrailTimer = 0;
    this.ghostTrails = []; // Afterimage effects

    // Heavy Strike Mechanics
    this.heavyStrikeCost = 35;
    this.heavyWindup = 0.32;
    this.heavyDuration = 0.65;
    this.heavyChargeLevel = 0;

    // Invulnerability & Damage Feedback
    this.invulnerable = false;
    this.invulnerableTimer = 0;
    this.hurtDuration = 0.28;
    this.flashWhiteTimer = 0;

    // Animation & Visual State
    this.animFrame = 0;
    this.animTime = 0;
    this.walkCycle = 0;
    this.moveBlend = 0;
    this.footstepTimer = 0;
    this.footstepSide = 1;
    this.weaponSwingAngle = 0;
    this.weaponSwingRadius = 32;

    // 枪口闪光与后坐的剩余时长，开火时由主循环置位
    this.muzzleTimer = 0;
    this.recoilTimer = 0;
    this.recoilDuration = 0.14;
    this.poseScaleX = 1;
    this.poseScaleY = 1;
    this.poseRotation = 0;
    this.poseOffsetX = 0;
    this.poseOffsetY = 0;

    // Articulated gait state. These values ease in and out independently so a
    // start or stop settles through the limbs instead of snapping the sprite.
    this.strideLag = 0;
    this.headLag = 0;
    this.gaitTravel = 0;
    this.gaitNearLift = 0;
    this.gaitFarLift = 0;
    this.gaitHipSway = 0;
    this.stepLiftVisual = 0;

    // Equipment & Weapon Setup
    this.weapon = {
      name: 'Plasma Chef Knife',
      type: 'plasma_blade',
      model: 'chef_knife',
      baseDamage: 22,
      critChance: 0.15,
      critMultiplier: 1.8,
      color: '#38bdf8',
      glowColor: '#0284c7'
    };

    this.shield = {
      name: 'Anti-Gravity Skillet',
      color: '#f59e0b',
      glowColor: '#d97706'
    };

    // Buffs and Stats Tracking
    this.buffs = new Map(); // id -> { duration, speedMult, attackMult, staminaRegenMult }
    this.stats = {
      kills: 0,
      damageDealt: 0,
      perfectParries: 0,
      damageTaken: 0
    };
  }

  /**
   * Reset / Respawn player
   */
  respawn(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.hp = this.maxHp;
    this.stamina = this.maxStamina;
    this.state = PLAYER_STATES.IDLE;
    this.stateTimer = 0;
    this.stateDuration = 0;
    this.invulnerable = false;
    this.invulnerableTimer = 0;
    this.comboStep = 0;
    this.comboBufferTime = 0;
    this.comboResetTimer = 0;
    this.staminaRegenDelay = 0;
    this.isParrying = false;
    this.attackHitbox = null;
    this.flashWhiteTimer = 0;
    this.hitEntitiesThisAttack.clear();
    this.visualFacingAngle = this.facingAngle;
    this.spriteFacingSide = Math.cos(this.facingAngle) < 0 ? -1 : 1;
    this.spriteFlipScale = this.spriteFacingSide;
    this.turnLean = 0;
    this.moveBlend = 0;
    this.footstepTimer = 0;
    this.footstepSide = 1;
    this.dashTrailTimer = 0;
    this.ghostTrails.length = 0;
    this.poseScaleX = 1;
    this.poseScaleY = 1;
    this.poseRotation = 0;
    this.poseOffsetX = 0;
    this.poseOffsetY = 0;
    this.strideLag = 0;
    this.headLag = 0;
    this.gaitTravel = 0;
    this.gaitNearLift = 0;
    this.gaitFarLift = 0;
    this.gaitHipSway = 0;
    this.stepLiftVisual = 0;
  }

  /**
   * Add temporary buff from cooked culinary dishes
   */
  applyBuff(buffId, { duration = 60, speedMult = 1.0, attackMult = 1.0, staminaRegenMult = 1.0, damageResist = 0.0 }) {
    this.buffs.set(buffId, {
      duration,
      speedMult,
      attackMult,
      staminaRegenMult,
      damageResist,
      timer: duration
    });
  }

  /**
   * Calculate current aggregate buffs
   */
  getBuffMultipliers() {
    let speedMult = 1.0;
    let attackMult = 1.0;
    let staminaRegenMult = 1.0;
    let damageResist = 0.0;

    for (const [id, buff] of this.buffs.entries()) {
      speedMult *= buff.speedMult;
      attackMult *= buff.attackMult;
      staminaRegenMult *= buff.staminaRegenMult;
      damageResist = Math.min(0.75, damageResist + (buff.damageResist || 0));
    }

    return { speedMult, attackMult, staminaRegenMult, damageResist };
  }

  /**
   * Primary Update Loop
   */
  update(dt, input, worldBounds = null, obstacles = [], particleSystem = null, audioSystem = null) {
    // 供渲染插值使用的上一固定步位置
    this.prevX = this.x;
    this.prevY = this.y;
    this.animTime += dt;

    // Update Buff Timers
    for (const [id, buff] of this.buffs.entries()) {
      buff.timer -= dt;
      if (buff.timer <= 0) {
        this.buffs.delete(id);
      }
    }

    const { speedMult, staminaRegenMult } = this.getBuffMultipliers();
    this.speed = this.baseSpeed * speedMult;

    // Handle Timers
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= dt;
    if (this.muzzleTimer > 0) this.muzzleTimer -= dt;
    if (this.recoilTimer > 0) this.recoilTimer -= dt;
    if (this.flashWhiteTimer > 0) this.flashWhiteTimer -= dt;
    if (this.parryFlashTimer > 0) this.parryFlashTimer -= dt;

    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      if (this.invulnerableTimer <= 0) {
        this.invulnerable = false;
      }
    }

    // Stamina Regeneration (delayed after consumption)
    if (this.staminaRegenDelay > 0) {
      this.staminaRegenDelay -= dt;
    } else if (this.state !== PLAYER_STATES.DASH && this.state !== PLAYER_STATES.HEAVY_STRIKE && this.stamina < this.maxStamina) {
      this.stamina = Math.min(this.maxStamina, this.stamina + this.staminaRegenRate * staminaRegenMult * dt);
    }

    // Combo Reset Window
    if (this.comboResetTimer > 0) {
      this.comboResetTimer -= dt;
      if (this.comboResetTimer <= 0 && this.isStateFinished()) {
        this.comboStep = 0;
      }
    }

    // Update Ghost Trails
    for (let i = this.ghostTrails.length - 1; i >= 0; i--) {
      const trail = this.ghostTrails[i];
      trail.alpha -= dt * 3.5;
      if (trail.alpha <= 0) {
        this.ghostTrails.splice(i, 1);
      }
    }

    // Dead State Check
    if (this.state === PLAYER_STATES.DEAD) {
      this.stateTimer += dt;
      const deadDamping = Math.exp(-9.75 * dt);
      this.vx *= deadDamping;
      this.vy *= deadDamping;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.updatePose(dt);
      return;
    }

    // Handle Active State Transitions & Physics
    this.stateTimer += dt;
    this.handleStateLogic(dt, input, particleSystem, audioSystem);

    // Movement & Collision Resolution
    this.resolveMovementAndCollisions(dt, worldBounds, obstacles);

    // Update 8-directional facing from angle
    this.updateFacingDirection();
    this.updateVisualFacing(dt);
    this.updatePose(dt);
  }

  updateVisualFacing(dt) {
    let angleDelta = this.facingAngle - this.visualFacingAngle;
    angleDelta = Math.atan2(Math.sin(angleDelta), Math.cos(angleDelta));

    const turnBlend = 1 - Math.exp(-22 * dt);
    this.visualFacingAngle += angleDelta * turnBlend;

    // Hold the last horizontal side around north/south headings. This avoids
    // rapid sprite mirroring while still allowing a squash-through turn.
    const horizontalFacing = Math.cos(this.visualFacingAngle);
    if (horizontalFacing > 0.24) this.spriteFacingSide = 1;
    if (horizontalFacing < -0.24) this.spriteFacingSide = -1;

    const flipBlend = 1 - Math.exp(-24 * dt);
    this.spriteFlipScale += (this.spriteFacingSide - this.spriteFlipScale) * flipBlend;

    const targetLean = Math.max(-0.12, Math.min(0.12, angleDelta * 0.11));
    const leanBlend = 1 - Math.exp(-18 * dt);
    this.turnLean += (targetLean - this.turnLean) * leanBlend;
  }

  updatePose(dt) {
    const speedRatio = clamp01(Math.hypot(this.vx, this.vy) / Math.max(1, this.speed));
    const moveBlendTarget = this.state === PLAYER_STATES.RUN ? speedRatio : 0;
    const moveBlendRate = moveBlendTarget > this.moveBlend ? 22 : 18;
    this.moveBlend += (moveBlendTarget - this.moveBlend) * (1 - Math.exp(-moveBlendRate * dt));

    // Drive cadence from actual post-collision travel. This keeps feet still
    // when the player is pressing into a wall and scales step rate naturally.
    if (this.state === PLAYER_STATES.RUN && speedRatio > 0.015) {
      this.walkCycle += Math.hypot(this.vx, this.vy) * 0.062 * dt;
    }

    const stride = Math.sin(this.walkCycle);
    const gaitTravelTarget = -Math.cos(this.walkCycle) * this.moveBlend;
    const nearLiftTarget = Math.pow(Math.max(0, stride), 0.72) * this.moveBlend;
    const farLiftTarget = Math.pow(Math.max(0, -stride), 0.72) * this.moveBlend;
    const hipSwayTarget = stride * 1.15 * this.moveBlend;
    const gaitBlend = 1 - Math.exp(-24 * dt);
    this.gaitTravel += (gaitTravelTarget - this.gaitTravel) * gaitBlend;
    this.gaitNearLift += (nearLiftTarget - this.gaitNearLift) * gaitBlend;
    this.gaitFarLift += (farLiftTarget - this.gaitFarLift) * gaitBlend;
    this.gaitHipSway += (hipSwayTarget - this.gaitHipSway) * gaitBlend;

    const supportRise = Math.abs(stride) * this.moveBlend;
    const footPlant = (1 - Math.abs(stride)) * this.moveBlend;
    let targetScaleX = 1 + footPlant * 0.008;
    let targetScaleY = 1 - footPlant * 0.006;
    let targetRotation = this.turnLean + stride * 0.012 * this.moveBlend * this.spriteFacingSide;
    let targetOffsetX = Math.sin(this.walkCycle) * 0.45 * this.moveBlend;
    let targetOffsetY = Math.sin(this.animTime * 3) * 0.9 * (1 - this.moveBlend) - supportRise * 2.1;

    const duration = Math.max(0.001, this.stateDuration);
    const progress = clamp01(this.stateTimer / duration);
    const facingX = Math.cos(this.visualFacingAngle);
    const facingY = Math.sin(this.visualFacingAngle);
    const side = this.spriteFacingSide || 1;

    if (
      this.state === PLAYER_STATES.SLASH1 ||
      this.state === PLAYER_STATES.SLASH2 ||
      this.state === PLAYER_STATES.SLASH3
    ) {
      const combo = Math.max(1, this.comboStep);
      const anticipation = 1 - easeOutCubic(progress / 0.18);
      const swingPhase = clamp01((progress - 0.08) / 0.7);
      const swing = Math.sin(swingPhase * Math.PI);
      const travel = (4 + combo * 2.2) * swing - 3 * anticipation;
      targetScaleX = 1 + (0.08 + combo * 0.025) * swing;
      targetScaleY = 1 + 0.05 * anticipation - (0.035 + combo * 0.01) * swing;
      targetRotation = this.turnLean + side * (-0.13 * anticipation + (0.12 + combo * 0.035) * swing);
      targetOffsetX = facingX * travel;
      targetOffsetY = facingY * travel - swing * (2 + combo * 0.7);
    } else if (this.state === PLAYER_STATES.HEAVY_STRIKE) {
      const windupEnd = this.heavyWindup / this.heavyDuration;
      if (progress < windupEnd) {
        const windup = easeOutCubic(progress / windupEnd);
        targetScaleX = 1 + windup * 0.12;
        targetScaleY = 1 - windup * 0.13;
        targetRotation = this.turnLean - side * windup * 0.18;
        targetOffsetX = -facingX * windup * 5;
        targetOffsetY = 4 * windup - facingY * windup * 4;
      } else {
        const release = 1 - clamp01((progress - windupEnd) / 0.34);
        targetScaleX = 1 + release * 0.18;
        targetScaleY = 1 - release * 0.16;
        targetRotation = this.turnLean + side * release * 0.24;
        targetOffsetX = facingX * release * 11;
        targetOffsetY = facingY * release * 11 - release * 2;
      }
    } else if (this.state === PLAYER_STATES.PARRY_GUARD) {
      const brace = Math.sin(Math.min(1, progress * 1.6) * Math.PI * 0.5);
      targetScaleX = 0.93 + brace * 0.02;
      targetScaleY = 1.06 - brace * 0.02;
      targetRotation = this.turnLean - side * 0.07;
      targetOffsetX = -facingX * 4;
      targetOffsetY = -facingY * 4 + 1;
    } else if (this.state === PLAYER_STATES.DASH) {
      const burst = Math.sin(progress * Math.PI);
      targetScaleX = 1.16 + burst * 0.11;
      targetScaleY = 0.88 - burst * 0.07;
      targetRotation = this.turnLean + side * stride * 0.02;
      targetOffsetX = facingX * (4 + burst * 5);
      targetOffsetY = facingY * (4 + burst * 5) - 2;
    } else if (this.state === PLAYER_STATES.HURT) {
      const recoil = Math.sin(progress * Math.PI);
      const shake = Math.sin(progress * Math.PI * 5) * (1 - progress);
      targetScaleX = 0.94 + recoil * 0.02;
      targetScaleY = 1.06 - recoil * 0.02;
      targetRotation = this.turnLean - side * recoil * 0.17;
      targetOffsetX = shake * 2.5;
      targetOffsetY = recoil * 2;
    } else if (this.state === PLAYER_STATES.DEAD) {
      targetScaleX = 1.08;
      targetScaleY = 0.7;
      targetRotation = side * 0.34;
      targetOffsetY = 8;
    }

    const poseRate = this.state === PLAYER_STATES.IDLE || this.state === PLAYER_STATES.RUN ? 14 : 23;
    const poseBlend = 1 - Math.exp(-poseRate * dt);
    this.poseScaleX += (targetScaleX - this.poseScaleX) * poseBlend;
    this.poseScaleY += (targetScaleY - this.poseScaleY) * poseBlend;
    this.poseRotation += (targetRotation - this.poseRotation) * poseBlend;
    this.poseOffsetX += (targetOffsetX - this.poseOffsetX) * poseBlend;
    this.poseOffsetY += (targetOffsetY - this.poseOffsetY) * poseBlend;

    // Torso and head follow the gait at different rates, producing a small
    // counter-rotation without deforming the silhouette.
    this.strideLag += (this.gaitTravel - this.strideLag) * (1 - Math.exp(-10 * dt));
    this.headLag += (this.strideLag - this.headLag) * (1 - Math.exp(-6 * dt));
    this.stepLiftVisual = Math.max(this.gaitNearLift, this.gaitFarLift);
  }

  /**
   * Determine 8-direction cardinal string from facing angle
   */
  /**
   * 挥砍与重击一旦发动就锁定朝向。否则松开鼠标后朝向会被移动方向覆盖，
   * 判定框跟着转向，出现瞄着敌人却砍空的情况。
   */
  isAttackCommitted() {
    return this.state === PLAYER_STATES.SLASH1
      || this.state === PLAYER_STATES.SLASH2
      || this.state === PLAYER_STATES.SLASH3
      || this.state === PLAYER_STATES.HEAVY_STRIKE;
  }

  updateFacingDirection() {
    let deg = (this.facingAngle * (180 / Math.PI)) % 360;
    if (deg < 0) deg += 360;

    if (deg >= 337.5 || deg < 22.5) this.facingDir = 'E';
    else if (deg >= 22.5 && deg < 67.5) this.facingDir = 'SE';
    else if (deg >= 67.5 && deg < 112.5) this.facingDir = 'S';
    else if (deg >= 112.5 && deg < 157.5) this.facingDir = 'SW';
    else if (deg >= 157.5 && deg < 202.5) this.facingDir = 'W';
    else if (deg >= 202.5 && deg < 247.5) this.facingDir = 'NW';
    else if (deg >= 247.5 && deg < 292.5) this.facingDir = 'N';
    else this.facingDir = 'NE';
  }

  /**
   * Check if current non-interruptible action state is complete
   */
  isStateFinished() {
    return this.stateTimer >= this.stateDuration;
  }

  /**
   * State Machine Logic
   */
  handleStateLogic(dt, input, particleSystem, audioSystem) {
    switch (this.state) {
      case PLAYER_STATES.IDLE:
      case PLAYER_STATES.RUN:
        this.handleMoveAndActionInput(dt, input, particleSystem, audioSystem);
        break;

      case PLAYER_STATES.SLASH1:
      case PLAYER_STATES.SLASH2:
      case PLAYER_STATES.SLASH3:
        this.updateSlashState(dt, input, particleSystem, audioSystem);
        break;

      case PLAYER_STATES.HEAVY_STRIKE:
        this.updateHeavyStrikeState(dt, input, particleSystem, audioSystem);
        break;

      case PLAYER_STATES.PARRY_GUARD:
        this.updateParryState(dt, input, particleSystem, audioSystem);
        break;

      case PLAYER_STATES.DASH:
        this.updateDashState(dt, particleSystem);
        break;

      case PLAYER_STATES.HURT:
        this.vx *= Math.exp(-7.7 * dt);
        this.vy *= Math.exp(-7.7 * dt);
        if (this.isStateFinished()) {
          this.setState(PLAYER_STATES.IDLE);
        }
        break;
    }
  }

  /**
   * Movement and Action handling when player is in neutral IDLE/RUN state
   */
  handleMoveAndActionInput(dt, input, particleSystem, audioSystem) {
    if (!input) {
      this.moveInput.x = 0;
      this.moveInput.y = 0;
      this.vx = 0;
      this.vy = 0;
      this.setState(PLAYER_STATES.IDLE);
      return;
    }

    // Engine exposes a normalized moveX/moveY vector. Keep the directional
    // aliases for older callers and controller integrations.
    let mx = Number.isFinite(input.moveX) ? input.moveX : 0;
    let my = Number.isFinite(input.moveY) ? input.moveY : 0;
    if (!Number.isFinite(input.moveX)) {
      if (input.left) mx -= 1;
      if (input.right) mx += 1;
    }
    if (!Number.isFinite(input.moveY)) {
      if (input.up) my -= 1;
      if (input.down) my += 1;
    }

    // Gamepad analog input fallback
    if (input.axes && (Math.abs(input.axes.x) > 0.15 || Math.abs(input.axes.y) > 0.15)) {
      mx = input.axes.x;
      my = input.axes.y;
    }

    const len = Math.hypot(mx, my);
    if (len > 0) {
      mx /= len;
      my /= len;
      this.moveInput.x = mx;
      this.moveInput.y = my;

      const targetVx = mx * this.speed;
      const targetVy = my * this.speed;
      const reversing = this.vx * targetVx + this.vy * targetVy < 0;
      const acceleration = reversing ? this.moveAcceleration * 1.75 : this.moveAcceleration;
      const accelerationBlend = 1 - Math.exp(-acceleration * dt);
      this.vx += (targetVx - this.vx) * accelerationBlend;
      this.vy += (targetVy - this.vy) * accelerationBlend;

      const speedRatio = clamp01(Math.hypot(this.vx, this.vy) / Math.max(1, this.speed));
      this.footstepTimer -= dt;
      if (speedRatio > 0.28 && this.footstepTimer <= 0) {
        this.footstepSide *= -1;
        this.footstepTimer = 0.34 - speedRatio * 0.075;
        if (audioSystem && audioSystem.playFootstep) {
          audioSystem.playFootstep({
            pitch: 78 + speedRatio * 10 + this.footstepSide * 3,
            volume: 0.3 + speedRatio * 0.16
          });
        }
        if (particleSystem && particleSystem.spawnFootstepDust) {
          particleSystem.spawnFootstepDust(this.x, this.y, this.facingAngle, this.footstepSide);
        }
      }

      // Update facing angle from movement if not aiming with mouse
      if (!input.pointerAim) {
        this.aimAngle = Math.atan2(my, mx);
        if (!this.isAttackCommitted()) this.facingAngle = this.aimAngle;
      }
      this.setState(PLAYER_STATES.RUN);
    } else {
      this.moveInput.x = 0;
      this.moveInput.y = 0;
      const brakeBlend = 1 - Math.exp(-this.moveBraking * dt);
      this.vx += (0 - this.vx) * brakeBlend;
      this.vy += (0 - this.vy) * brakeBlend;
      if (Math.hypot(this.vx, this.vy) < 0.35) {
        this.vx = 0;
        this.vy = 0;
      }
      this.footstepTimer = Math.min(this.footstepTimer, 0.08);
      this.setState(PLAYER_STATES.IDLE);
    }

    // Pointer Aim Override (e.g. mouse crosshair or right thumbstick)
    if (input.pointerAim) {
      this.aimAngle = Math.atan2(input.pointerAim.y - this.y, input.pointerAim.x - this.x);
      if (!this.isAttackCommitted()) this.facingAngle = this.aimAngle;
    }

    const dashPressed = Boolean(input.dashPressed || input.isDashPressed);
    const heavyAttackPressed = Boolean(input.heavyAttackPressed || input.isHeavyAttackPressed);
    const attackPressed = Boolean(input.attackPressed || input.isAttackPressed);
    const parryPressed = Boolean(input.parryPressed || input.isParryPressed);
    const guardHeld = Boolean(input.guardHeld || input.isParryDown);

    // Dash Action
    if (dashPressed && this.dashCooldownTimer <= 0 && this.stamina >= this.dashCost) {
      this.startDash(mx, my, particleSystem, audioSystem);
      return;
    }

    // Heavy Attack Action
    if (heavyAttackPressed && this.stamina >= this.heavyStrikeCost) {
      this.startHeavyStrike(particleSystem, audioSystem);
      return;
    }

    // Light Attack (Slash Combo)
    if (attackPressed) {
      this.startSlashCombo(particleSystem, audioSystem);
      return;
    }

    // Parry / Guard Action
    if (parryPressed || guardHeld) {
      this.startParryGuard(particleSystem, audioSystem);
      return;
    }
  }

  /**
   * Start 3-Hit Slash Combo
   */
  startSlashCombo(particleSystem, audioSystem) {
    // 每一段起手时重新对准当前瞄准方向，连段中途仍可换目标。
    if (Number.isFinite(this.aimAngle)) this.facingAngle = this.aimAngle;

    if (this.comboStep === 0 || this.comboStep >= 3) {
      this.comboStep = 1;
    } else {
      this.comboStep += 1;
    }

    let stateKey = PLAYER_STATES.SLASH1;
    let duration = 0.26;
    let forwardImpulse = 90;

    if (this.comboStep === 2) {
      stateKey = PLAYER_STATES.SLASH2;
      duration = 0.28;
      forwardImpulse = 110;
    } else if (this.comboStep === 3) {
      stateKey = PLAYER_STATES.SLASH3;
      duration = 0.36;
      forwardImpulse = 160;
    }

    this.setState(stateKey, duration);
    this.comboResetTimer = duration + 0.35; // Window to link next combo
    this.hitEntitiesThisAttack.clear();

    // Slight lunge forward in facing direction
    this.vx = Math.cos(this.facingAngle) * forwardImpulse;
    this.vy = Math.sin(this.facingAngle) * forwardImpulse;

    // Audio Trigger
    if (audioSystem && audioSystem.playSlash) {
      audioSystem.playSlash(this.comboStep);
    }

    // Particle Swish
    if (particleSystem && particleSystem.spawnSlashArc) {
      particleSystem.spawnSlashArc(this.x, this.y, this.facingAngle, this.comboStep);
    }
  }

  /**
   * Update Slash State & Active Hitboxes
   */
  updateSlashState(dt, input, particleSystem, audioSystem) {
    // Decelerate lunge
    this.vx *= Math.exp(-9.05 * dt);
    this.vy *= Math.exp(-9.05 * dt);

    const progress = this.stateTimer / this.stateDuration;
    const { attackMult } = this.getBuffMultipliers();

    // Active hitbox window: between 15% and 75% of animation
    if (progress >= 0.15 && progress <= 0.75) {
      let dmg = this.weapon.baseDamage * attackMult;
      let reach = 54;
      let arc = Math.PI * 0.75;
      let knockback = 140;

      if (this.comboStep === 2) {
        dmg *= 1.25;
        reach = 58;
        arc = Math.PI * 0.85;
        knockback = 180;
      } else if (this.comboStep === 3) {
        dmg *= 1.85;
        reach = 66;
        arc = Math.PI * 1.1;
        knockback = 280;
      }

      // 判定扇形以角色为圆心，和绘制出的弧线共用同一组参数，
      // 避免看得到打不到。方向由 startAngle / endAngle 约束。
      this.attackHitbox = {
        type: 'arc',
        x: this.x,
        y: this.y,
        radius: reach,
        startAngle: this.facingAngle - arc / 2,
        endAngle: this.facingAngle + arc / 2,
        facingAngle: this.facingAngle,
        damage: dmg,
        knockback,
        isCrit: Math.random() < this.weapon.critChance,
        comboStep: this.comboStep,
        source: 'player'
      };
    } else {
      this.attackHitbox = null;
    }

    // Allow combo queuing in late recovery frames
    if (input && (input.attackPressed || input.isAttackPressed) && progress > 0.55 && this.comboStep < 3) {
      this.startSlashCombo(particleSystem, audioSystem);
      return;
    }

    if (this.isStateFinished()) {
      this.attackHitbox = null;
      this.setState(PLAYER_STATES.IDLE);
    }
  }

  /**
   * Start Heavy Strike (High Damage Ground Cleaver)
   */
  startHeavyStrike(particleSystem, audioSystem) {
    if (Number.isFinite(this.aimAngle)) this.facingAngle = this.aimAngle;
    this.consumeStamina(this.heavyStrikeCost);
    this.setState(PLAYER_STATES.HEAVY_STRIKE, this.heavyDuration);
    this.hitEntitiesThisAttack.clear();
    this.heavyChargeLevel = 0;
    this.vx = 0;
    this.vy = 0;

    if (audioSystem && audioSystem.playCharge) {
      audioSystem.playCharge();
    }
  }

  /**
   * Update Heavy Strike Execution
   */
  updateHeavyStrikeState(dt, input, particleSystem, audioSystem) {
    const progress = this.stateTimer / this.stateDuration;
    const { attackMult } = this.getBuffMultipliers();

    // Windup charging phase
    if (this.stateTimer < this.heavyWindup) {
      this.heavyChargeLevel = this.stateTimer / this.heavyWindup;
      this.vx *= Math.exp(-24 * dt);
      this.vy *= Math.exp(-24 * dt);

      if (particleSystem && particleSystem.spawnChargeSparkles) {
        particleSystem.spawnChargeSparkles(this.x, this.y, '#38bdf8');
      }
      this.attackHitbox = null;
    } else {
      // Release Smash Phase (around 0.35s ~ 0.55s)
      if (progress >= 0.45 && progress <= 0.70) {
        const smashReach = 58;
        const baseDmg = this.weapon.baseDamage * 3.2 * attackMult;

        this.attackHitbox = {
          type: 'circle',
          x: this.x + Math.cos(this.facingAngle) * 32,
          y: this.y + Math.sin(this.facingAngle) * 32,
          radius: smashReach,
          damage: baseDmg,
          knockback: 420,
          isHeavy: true,
          armorBreak: true,
          stunDuration: 1.2,
          isCrit: true,
          source: 'player'
        };

        if (this.stateTimer - dt < this.heavyWindup) {
          // Trigger Ground Slam Impact FX
          if (audioSystem && audioSystem.playHeavySmash) audioSystem.playHeavySmash();
          if (particleSystem && particleSystem.spawnShockwave) {
            particleSystem.spawnShockwave(this.attackHitbox.x, this.attackHitbox.y, smashReach * 1.4, '#38bdf8');
          }
        }
      } else {
        this.attackHitbox = null;
      }
    }

    if (this.isStateFinished()) {
      this.attackHitbox = null;
      this.setState(PLAYER_STATES.IDLE);
    }
  }

  /**
   * Start Perfect Parry Guard Mode
   */
  startParryGuard(particleSystem, audioSystem) {
    this.setState(PLAYER_STATES.PARRY_GUARD, this.parryDuration);
    this.isParrying = true;
    this.vx *= 0.3;
    this.vy *= 0.3;

    if (audioSystem && audioSystem.playGuardUp) {
      audioSystem.playGuardUp();
    }
  }

  /**
   * Update Parry Guard State
   */
  updateParryState(dt, input, particleSystem, audioSystem) {
    this.vx *= Math.exp(-13.4 * dt);
    this.vy *= Math.exp(-13.4 * dt);

    // Visual shimmer during 0.2s perfect window
    if (this.stateTimer <= this.perfectParryWindow) {
      if (particleSystem && Math.random() < 0.3) {
        particleSystem.spawnShieldGlint(this.x, this.y, '#f59e0b');
      }
    }

    if (this.isStateFinished()) {
      this.isParrying = false;
      this.setState(PLAYER_STATES.IDLE);
    }
  }

  /**
   * Start Dash (I-Frame Flash Step)
   */
  startDash(mx, my, particleSystem, audioSystem) {
    this.consumeStamina(this.dashCost);
    this.dashCooldownTimer = this.dashCooldown;
    this.setState(PLAYER_STATES.DASH, this.dashDuration);
    this.invulnerable = true;
    this.invulnerableTimer = this.dashDuration;

    // Dash vector
    let dashDirX = mx;
    let dashDirY = my;
    if (dashDirX === 0 && dashDirY === 0) {
      dashDirX = Math.cos(this.facingAngle);
      dashDirY = Math.sin(this.facingAngle);
    }

    this.vx = dashDirX * this.dashSpeed;
    this.vy = dashDirY * this.dashSpeed;

    this.addGhostTrail(0.86, '#5eead4');
    this.dashTrailTimer = 0.045;

    if (audioSystem && audioSystem.playDash) {
      audioSystem.playDash();
    }
    if (particleSystem && particleSystem.spawnDashBurst) {
      particleSystem.spawnDashBurst(this.x, this.y, this.facingAngle);
    }
  }

  /**
   * Update Dash State
   */
  updateDashState(dt, particleSystem) {
    this.dashTrailTimer -= dt;
    if (this.dashTrailTimer <= 0) {
      this.addGhostTrail(0.68, '#38bdf8');
      this.dashTrailTimer += 0.045;
    }

    if (this.isStateFinished()) {
      this.setState(PLAYER_STATES.IDLE);
    }
  }

  addGhostTrail(alpha, color) {
    this.ghostTrails.push({
      x: this.x,
      y: this.y,
      facingAngle: this.visualFacingAngle,
      facingSide: this.spriteFacingSide,
      flipScale: this.spriteFlipScale,
      scaleX: this.poseScaleX,
      scaleY: this.poseScaleY,
      rotation: this.poseRotation,
      offsetX: this.poseOffsetX,
      offsetY: this.poseOffsetY,
      gaitTravel: this.gaitTravel,
      gaitNearLift: this.gaitNearLift,
      gaitFarLift: this.gaitFarLift,
      gaitHipSway: this.gaitHipSway,
      strideLag: this.strideLag,
      headLag: this.headLag,
      moveBlend: this.moveBlend,
      animTime: this.animTime,
      state: PLAYER_STATES.DASH,
      alpha,
      color
    });
    if (this.ghostTrails.length > 9) this.ghostTrails.shift();
  }

  /**
   * Consume stamina and set recharge delay
   */
  consumeStamina(amount) {
    this.stamina = Math.max(0, this.stamina - amount);
    this.staminaRegenDelay = 0.75; // 0.75s delay before regen starts
  }

  /**
   * Switch State Helper
   */
  setState(newState, duration = 0) {
    if (this.state === newState && this.stateDuration === duration) return;

    // Clear state-owned hitboxes/flags when an action is interrupted (for
    // example by damage or death). Leaving these active can make the player
    // appear frozen even though the neutral state has resumed.
    if (this.state === PLAYER_STATES.PARRY_GUARD && newState !== PLAYER_STATES.PARRY_GUARD) {
      this.isParrying = false;
    }
    if (
      (this.state === PLAYER_STATES.SLASH1 ||
        this.state === PLAYER_STATES.SLASH2 ||
        this.state === PLAYER_STATES.SLASH3 ||
        this.state === PLAYER_STATES.HEAVY_STRIKE) &&
      newState !== this.state
    ) {
      this.attackHitbox = null;
    }

    this.state = newState;
    this.stateTimer = 0;
    this.stateDuration = duration;
  }

  /**
   * Take Damage and handle Parry / Deflect Calculations
   * @returns {Object} result details: { success, parried, perfect, damageDealt, attackerStunned }
   */
  takeDamage(amount, sourceAngle = 0, knockbackForce = 120, isParriable = true, attacker = null, audioSystem = null, particleSystem = null) {
    // 击退角度一旦是 NaN，速度和坐标会被污染，跟随的相机再也回不来
    if (!Number.isFinite(sourceAngle)) sourceAngle = 0;
    if (!Number.isFinite(knockbackForce)) knockbackForce = 120;
    // 1. Invulnerable / Dash check
    if (this.invulnerable || this.state === PLAYER_STATES.DEAD) {
      return { success: false, ignored: true };
    }

    const { damageResist } = this.getBuffMultipliers();

    // 2. Parry Guard Check
    if (this.state === PLAYER_STATES.PARRY_GUARD && isParriable) {
      // 2a. PERFECT PARRY WINDOW (<= 0.20s)
      if (this.stateTimer <= this.perfectParryWindow) {
        this.stats.perfectParries += 1;
        this.parryFlashTimer = 0.25;
        this.invulnerableTimer = 0.35;
        this.invulnerable = true;

        // Restore some stamina reward
        this.stamina = Math.min(this.maxStamina, this.stamina + 25);

        // Deflect sound and massive golden shockwave
        if (audioSystem && audioSystem.playParrySuccess) audioSystem.playParrySuccess();
        if (particleSystem && particleSystem.spawnParrySpark) {
          particleSystem.spawnParrySpark(this.x, this.y, sourceAngle);
        }

        // Stun the monster attacker if provided!
        if (attacker && typeof attacker.stun === 'function') {
          attacker.stun(2.5); // 2.5s stun!
        }

        return {
          success: true,
          parried: true,
          perfect: true,
          attackerStunned: true,
          damageDealt: 0
        };
      } else {
        // 2b. Standard Guard (Mitigate 75% damage, consume stamina)
        const mitigatedDmg = Math.round(amount * 0.25 * (1 - damageResist));
        this.consumeStamina(20);
        this.hp = Math.max(0, this.hp - mitigatedDmg);
        this.flashWhiteTimer = 0.15;

        // Slight pushback
        this.vx = Math.cos(sourceAngle) * (knockbackForce * 0.4);
        this.vy = Math.sin(sourceAngle) * (knockbackForce * 0.4);

        if (audioSystem && audioSystem.playGuardBlock) audioSystem.playGuardBlock();

        if (this.hp <= 0) {
          this.die(audioSystem, particleSystem);
        }

        return {
          success: true,
          parried: true,
          perfect: false,
          damageDealt: mitigatedDmg
        };
      }
    }

    // 3. Normal Damage Application
    const actualDamage = Math.max(1, Math.round(amount * (1 - damageResist)));
    this.hp = Math.max(0, this.hp - actualDamage);
    this.stats.damageTaken += actualDamage;
    this.flashWhiteTimer = 0.22;
    this.invulnerableTimer = 0.45;
    this.invulnerable = true;

    // Apply Knockback
    this.vx = Math.cos(sourceAngle) * knockbackForce;
    this.vy = Math.sin(sourceAngle) * knockbackForce;

    if (this.hp <= 0) {
      this.die(audioSystem, particleSystem);
    } else {
      this.setState(PLAYER_STATES.HURT, this.hurtDuration);
      if (audioSystem && audioSystem.playPlayerHurt) audioSystem.playPlayerHurt();
    }

    return {
      success: true,
      parried: false,
      perfect: false,
      damageDealt: actualDamage
    };
  }

  /**
   * Player Death
   */
  die(audioSystem, particleSystem) {
    this.setState(PLAYER_STATES.DEAD);
    this.hp = 0;
    this.isParrying = false;
    this.attackHitbox = null;
    this.moveInput.x = 0;
    this.moveInput.y = 0;
    if (audioSystem && audioSystem.playPlayerDeath) audioSystem.playPlayerDeath();
    if (particleSystem && particleSystem.spawnPlayerDeathBurst) {
      particleSystem.spawnPlayerDeathBurst(this.x, this.y);
    }
  }

  /**
   * Physics, Boundary and Obstacle Collision Resolution
   */
  resolveMovementAndCollisions(dt, worldBounds, obstacles) {
    const safeDt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
    const colliders = Array.isArray(obstacles) ? obstacles : [];

    // Recover first if a save, spawn, or a large knockback left the player
    // inside an obstacle. The fallback normal in _getObstacleCorrection also
    // handles the exact-center case where a regular normalized vector is 0.
    this._depenetrateFromObstacles(colliders, worldBounds);

    // Substep fast movement (especially dash/knockback) so it cannot tunnel
    // through a thin obstacle. Resolve X and Y independently to preserve
    // natural wall sliding instead of cancelling both axes at once.
    const distance = Math.hypot(this.vx * safeDt, this.vy * safeDt);
    const maxStepDistance = Math.max(4, this.radius * 0.5);
    const substeps = Math.max(1, Math.min(16, Math.ceil(distance / maxStepDistance)));
    const stepDt = safeDt / substeps;

    for (let step = 0; step < substeps; step += 1) {
      const dx = this.vx * stepDt;
      if (Math.abs(dx) > 0.0001) {
        const candidateX = this.x + dx;
        if (this._isBlockedAt(candidateX, this.y, colliders)) {
          this.vx = 0;
        } else {
          this.x = candidateX;
        }
      }

      const dy = this.vy * stepDt;
      if (Math.abs(dy) > 0.0001) {
        const candidateY = this.y + dy;
        if (this._isBlockedAt(this.x, candidateY, colliders)) {
          this.vy = 0;
        } else {
          this.y = candidateY;
        }
      }

      this._depenetrateFromObstacles(colliders, worldBounds);
    }

    // World Bounds Clamping. Clear only the component that hit a bound so a
    // player can still move along the edge.
    if (worldBounds) {
      const boundaryInsets = this._getBoundaryInsets(worldBounds, colliders);
      const minX = worldBounds.minX + this.radius + boundaryInsets.left;
      const maxX = worldBounds.maxX - this.radius - boundaryInsets.right;
      const minY = worldBounds.minY + this.radius + boundaryInsets.top;
      const maxY = worldBounds.maxY - this.radius - boundaryInsets.bottom;
      const nextX = Math.max(minX, Math.min(maxX, this.x));
      const nextY = Math.max(minY, Math.min(maxY, this.y));
      if (nextX !== this.x) this.vx = 0;
      if (nextY !== this.y) this.vy = 0;
      this.x = nextX;
      this.y = nextY;
    }
  }

  _getBoundaryInsets(worldBounds, obstacles) {
    const insets = { left: 0, right: 0, top: 0, bottom: 0 };
    if (!worldBounds) return insets;

    for (const obstacle of obstacles) {
      if (obstacle?.type !== 'boundary' || this._getObstacleShape(obstacle) !== 'rect') continue;
      const halfW = Math.max(0, Number(obstacle.width) * 0.5);
      const halfH = Math.max(0, Number(obstacle.height) * 0.5);
      if (!Number.isFinite(halfW) || !Number.isFinite(halfH)) continue;

      const leftEdge = obstacle.x - halfW;
      const rightEdge = obstacle.x + halfW;
      const topEdge = obstacle.y - halfH;
      const bottomEdge = obstacle.y + halfH;
      if (obstacle.width < obstacle.height) {
        if (leftEdge <= worldBounds.minX + 0.001) insets.left = Math.max(insets.left, obstacle.width);
        if (rightEdge >= worldBounds.maxX - 0.001) insets.right = Math.max(insets.right, obstacle.width);
      } else {
        if (topEdge <= worldBounds.minY + 0.001) insets.top = Math.max(insets.top, obstacle.height);
        if (bottomEdge >= worldBounds.maxY - 0.001) insets.bottom = Math.max(insets.bottom, obstacle.height);
      }
    }

    return insets;
  }

  _getObstacleShape(obstacle) {
    if (!obstacle) return null;
    if (obstacle.shape === 'circle' || obstacle.shape === 'rect') return obstacle.shape;
    if (obstacle.type === 'circle' || obstacle.type === 'rect') return obstacle.type;
    return null;
  }

  _isBlockedAt(x, y, obstacles) {
    return obstacles.some((obstacle) => this._getObstacleCorrection(obstacle, x, y));
  }

  _depenetrateFromObstacles(obstacles, worldBounds = null) {
    // A few passes are enough for adjacent obstacles while keeping this cheap
    // for the fixed-timestep loop.
    for (let pass = 0; pass < 8; pass += 1) {
      let moved = false;
      for (const obstacle of obstacles) {
        const correction = this._getObstacleCorrection(obstacle, this.x, this.y);
        if (!correction) continue;
        this.x += correction.x;
        this.y += correction.y;
        moved = true;
      }
      if (!moved) break;
    }

    // Procedural props can overlap one another. Sequential projection may
    // oscillate in that case, so sample a nearby free point as a final escape
    // hatch. This also repairs old saves created before collision was active.
    if (this._isBlockedAt(this.x, this.y, obstacles)) {
      const recovery = this._findNearbyFreePosition(obstacles, worldBounds);
      if (recovery) {
        this.x = recovery.x;
        this.y = recovery.y;
      }
    }
  }

  _findNearbyFreePosition(obstacles, worldBounds = null) {
    const boundaryInsets = this._getBoundaryInsets(worldBounds, obstacles);
    const minX = worldBounds ? worldBounds.minX + this.radius + boundaryInsets.left : -Infinity;
    const maxX = worldBounds ? worldBounds.maxX - this.radius - boundaryInsets.right : Infinity;
    const minY = worldBounds ? worldBounds.minY + this.radius + boundaryInsets.top : -Infinity;
    const maxY = worldBounds ? worldBounds.maxY - this.radius - boundaryInsets.bottom : Infinity;
    const baseAngle = Math.atan2(this.vy, this.vx);
    const angleCount = 16;

    for (let ring = 1; ring <= 18; ring += 1) {
      const distance = Math.max(this.radius * 1.5, ring * this.radius * 1.5);
      for (let index = 0; index < angleCount; index += 1) {
        const angle = baseAngle + (index / angleCount) * Math.PI * 2;
        const x = Math.max(minX, Math.min(maxX, this.x + Math.cos(angle) * distance));
        const y = Math.max(minY, Math.min(maxY, this.y + Math.sin(angle) * distance));
        if (!this._isBlockedAt(x, y, obstacles)) return { x, y };
      }
    }

    return null;
  }

  _getObstacleCorrection(obstacle, x, y) {
    // 纯装饰的地表物件不参与碰撞，踩上去就过
    if (obstacle?.noCollide) return null;
    const shape = this._getObstacleShape(obstacle);
    // 有些障碍的可视外形（如蘑菇伞盖）远大于实际占地，用 collisionRadius 单独描述
    const blockRadius = Number.isFinite(obstacle.collisionRadius)
      ? obstacle.collisionRadius
      : obstacle.radius;

    if (shape === 'circle' && Number.isFinite(blockRadius)) {
      const dx = x - obstacle.x;
      const dy = y - obstacle.y;
      const minDist = this.radius + Math.max(0, blockRadius);
      const dist = Math.hypot(dx, dy);
      if (dist >= minDist) return null;

      if (dist > 0.0001) {
        const push = minDist - dist;
        return { x: (dx / dist) * push, y: (dy / dist) * push };
      }

      // Exact-center overlap has no usable normal. Prefer current movement,
      // then a deterministic axis so the player can always escape.
      const fallbackLength = Math.hypot(this.vx, this.vy) || 1;
      return {
        x: (this.vx / fallbackLength || 1) * minDist,
        y: (this.vy / fallbackLength) * minDist
      };
    }

    if (shape === 'rect' && Number.isFinite(obstacle.width) && Number.isFinite(obstacle.height)) {
      // Map rectangles are stored by center, matching their renderer.
      // 矩形障碍也可以让实际占地小于可视外形
      const halfW = Math.max(0, (obstacle.collisionWidth ?? obstacle.width) * 0.5);
      const halfH = Math.max(0, (obstacle.collisionHeight ?? obstacle.height) * 0.5);
      const left = obstacle.x - halfW;
      const right = obstacle.x + halfW;
      const top = obstacle.y - halfH;
      const bottom = obstacle.y + halfH;
      const closestX = Math.max(left, Math.min(x, right));
      const closestY = Math.max(top, Math.min(y, bottom));
      const dx = x - closestX;
      const dy = y - closestY;
      const distance = Math.hypot(dx, dy);

      if (distance > 0.0001) {
        if (distance >= this.radius) return null;
        const push = this.radius - distance;
        return { x: (dx / distance) * push, y: (dy / distance) * push };
      }

      // The center is inside the rectangle (or exactly on a corner). Choose
      // the nearest exit face, including the player's radius.
      const inside = x >= left && x <= right && y >= top && y <= bottom;
      if (inside) {
        const exits = [
          { distance: x - left, x: -(x - left + this.radius), y: 0 },
          { distance: right - x, x: right - x + this.radius, y: 0 },
          { distance: y - top, x: 0, y: -(y - top + this.radius) },
          { distance: bottom - y, x: 0, y: bottom - y + this.radius }
        ];
        exits.sort((a, b) => a.distance - b.distance);
        return { x: exits[0].x, y: exits[0].y };
      }

      // Corner contact can produce a zero-length closest-point vector.
      const fallbackX = x - obstacle.x;
      const fallbackY = y - obstacle.y;
      const fallbackLength = Math.hypot(fallbackX, fallbackY) || 1;
      return {
        x: (fallbackX / fallbackLength) * this.radius,
        y: (fallbackY / fallbackLength) * this.radius
      };
    }

    return null;
  }

  /**
   * Get Hurtbox for enemy detection
   */
  getHurtbox() {
    return {
      type: 'circle',
      x: this.x,
      y: this.y,
      radius: this.radius
    };
  }

  /**
   * Get Current Active Attack Hitbox (if any)
   */
  getAttackHitbox() {
    return this.attackHitbox;
  }

  /**
   * High-Fidelity Canvas 2D Procedural Rendering
   */
  draw(ctx, camera) {
    const screenX = this.x - (camera ? camera.x : 0);
    const screenY = this.y - (camera ? camera.y : 0);
    const characterRig = this.buildCharacterRig();

    ctx.save();

    // 1. Draw full character afterimages during a dash.
    for (const trail of this.ghostTrails) {
      const trailScreenX = trail.x - (camera ? camera.x : 0);
      const trailScreenY = trail.y - (camera ? camera.y : 0);
      ctx.save();
      ctx.globalAlpha = trail.alpha * 0.42;
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(trailScreenX + trail.offsetX, trailScreenY + trail.offsetY);
      ctx.rotate(trail.rotation);
      ctx.scale(trail.scaleX, trail.scaleY);
      this.drawCharacterModel(ctx, this.buildCharacterRig(trail), { ghost: true });
      ctx.restore();
    }

    // 2. Ground contact, facing marker and crisp character shadow.
    const visualAngle = this.visualFacingAngle;
    const markerX = screenX + Math.cos(visualAngle) * (this.radius + 15);
    const markerY = screenY + Math.sin(visualAngle) * (this.radius + 11);

    ctx.save();
    ctx.strokeStyle = 'rgba(92, 213, 189, 0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 11, this.radius * 1.45, this.radius * 0.48, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Separate foot shadows make planted and lifted feet readable. The old
    // single oval stayed rigid under the character and reinforced the cutout
    // look even while the upper image was moving.
    const drawFootShadow = (foot, lift, isNear) => {
      ctx.save();
      ctx.fillStyle = `rgba(3, 9, 14, ${(0.34 - lift * 0.21).toFixed(3)})`;
      ctx.beginPath();
      ctx.ellipse(
        screenX + this.poseOffsetX + foot.x,
        screenY + 12,
        10 - lift * 2.8,
        3.5 - lift * 0.8,
        isNear ? 0.04 : -0.04,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.restore();
    };
    drawFootShadow(characterRig.farLeg.toe, this.gaitFarLift, false);
    drawFootShadow(characterRig.nearLeg.toe, this.gaitNearLift, true);

    ctx.save();
    ctx.translate(markerX, markerY);
    ctx.rotate(visualAngle);
    ctx.fillStyle = 'rgba(92, 213, 189, 0.68)';
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-5, -4.5);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-5, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 3. Parry Aegis Shield Aura
    if (this.state === PLAYER_STATES.PARRY_GUARD) {
      ctx.save();
      const isPerfect = this.stateTimer <= this.perfectParryWindow;
      ctx.strokeStyle = isPerfect ? '#f59e0b' : '#38bdf8';
      ctx.lineWidth = isPerfect ? 4 : 2;
      ctx.shadowColor = isPerfect ? '#fbbf24' : '#0284c7';
      ctx.shadowBlur = isPerfect ? 16 : 8;

      ctx.beginPath();
      const guardAngle = this.facingAngle;
      const guardCenterX = screenX + this.poseOffsetX;
      const guardCenterY = screenY - 38 + this.poseOffsetY;
      ctx.arc(guardCenterX, guardCenterY, this.radius + 18, guardAngle - Math.PI * 0.4, guardAngle + Math.PI * 0.4);
      ctx.stroke();

      // Energy hexagon shield lattice
      ctx.fillStyle = isPerfect ? 'rgba(245, 158, 11, 0.25)' : 'rgba(56, 189, 248, 0.15)';
      ctx.fill();
      ctx.restore();
    }

    // 4. Draw Player Character (Chef Hunter in Sci-Fi Suit)
    ctx.save();
    ctx.translate(screenX + this.poseOffsetX, screenY + this.poseOffsetY);
    ctx.rotate(this.poseRotation);
    ctx.scale(this.poseScaleX, this.poseScaleY);

    if (this.invulnerable && Math.floor(this.animTime * 25) % 2 === 0) {
      ctx.globalAlpha = 0.52;
    }

    this.drawCharacterModel(ctx, characterRig, { hurt: this.flashWhiteTimer > 0 });

    // 5. Draw Weapon (Plasma Chef Knife / Skillet)
    this.drawWeapon(ctx);

    ctx.restore(); // Character translation restore

    // 6. Attack Slash Arc Render FX
    if (this.attackHitbox && this.attackHitbox.type === 'arc') {
      this.drawSlashArcFX(ctx, screenX, screenY);
    } else if (this.attackHitbox && this.attackHitbox.type === 'circle') {
      this.drawHeavySmashFX(ctx, screenX, screenY);
    }

    // 7. Overhead HUD (Stamina bar & Parry indicator)
    this.drawOverheadHUD(ctx, screenX, screenY);

    ctx.restore();
  }

  buildCharacterRig(pose = this) {
    const getNumber = (key, fallback) => Number.isFinite(pose[key]) ? pose[key] : fallback;
    const facingAngle = Number.isFinite(pose.visualFacingAngle)
      ? pose.visualFacingAngle
      : getNumber('facingAngle', this.visualFacingAngle);
    const facingX = Math.cos(facingAngle);
    const facingY = Math.sin(facingAngle);
    const facingSide = pose.facingSide || pose.spriteFacingSide || (facingX < 0 ? -1 : 1);
    const travel = getNumber('gaitTravel', this.gaitTravel);
    const nearLift = getNumber('gaitNearLift', this.gaitNearLift);
    const farLift = getNumber('gaitFarLift', this.gaitFarLift);
    const hipSway = getNumber('gaitHipSway', this.gaitHipSway);
    const strideLag = getNumber('strideLag', this.strideLag);
    const headLag = getNumber('headLag', this.headLag);
    const moveBlend = clamp01(getNumber('moveBlend', this.moveBlend));
    const animTime = getNumber('animTime', this.animTime);
    const state = pose.state || this.state;
    const bodyY = Math.sin(animTime * 2.3) * 0.55 * (1 - moveBlend)
      - Math.max(nearLift, farLift) * 1.35;
    const profile = Math.abs(facingX);
    const bodyX = hipSway * 0.42 - strideLag * facingSide * 0.45;
    const strideAxisX = facingX * 12 + facingSide * (1 - profile) * 4.2;
    const strideAxisY = facingY * 3.6;
    const legSpread = 6.8 - profile * 2.2;

    const makeLeg = (isNear) => {
      const phase = isNear ? travel : -travel;
      const lift = isNear ? nearLift : farLift;
      const depthSide = isNear ? 1 : -1;
      const hip = {
        x: bodyX + depthSide * legSpread * facingSide,
        y: -42 + bodyY
      };
      const ankle = {
        x: hip.x + strideAxisX * phase,
        y: 7.5 + strideAxisY * phase - lift * 9.5
      };
      const knee = {
        x: (hip.x + ankle.x) * 0.5
          + depthSide * facingSide * (2.4 + lift * 5.5)
          + facingX * phase * 1.8,
        y: -17.5 + bodyY * 0.35 - lift * 4 + facingY * phase * 1.2
      };
      const toe = {
        x: ankle.x + facingSide * (6.5 + profile * 3.2),
        y: ankle.y + 2.8 + Math.max(0, -phase * facingY) * 1.1
      };
      return { hip, knee, ankle, toe, phase, lift, isNear };
    };

    const makeArm = (isNear) => {
      const phase = isNear ? -travel : travel;
      const depthSide = isNear ? 1 : -1;
      const shoulder = {
        x: bodyX + depthSide * 17 * facingSide,
        y: -70 + bodyY * 0.82
      };
      const armAxisX = facingX * 8.5 + facingSide * (1 - profile) * 3;
      const elbow = {
        x: shoulder.x + armAxisX * phase + depthSide * facingSide * 1.2,
        y: -51 + bodyY * 0.72 + facingY * phase * 2
      };
      const hand = {
        x: elbow.x + armAxisX * phase * 0.72 + depthSide * facingSide * 1.5,
        y: -33.5 + bodyY * 0.58 - Math.abs(phase) * 1.4
      };
      return { shoulder, elbow, hand, phase, isNear };
    };

    const nearArm = makeArm(true);
    const farArm = makeArm(false);
    const isSlash = state === PLAYER_STATES.SLASH1
      || state === PLAYER_STATES.SLASH2
      || state === PLAYER_STATES.SLASH3;
    const usesActionHands = isSlash
      || state === PLAYER_STATES.HEAVY_STRIKE
      || state === PLAYER_STATES.PARRY_GUARD;

    const grip = this.ranged && !usesActionHands ? this.firearmGrip() : null;
    if (grip) {
      // 双手锁在枪的两个握点上，肘部外撇形成端枪的夹角
      nearArm.hand.x = grip.front.x;
      nearArm.hand.y = grip.front.y;
      nearArm.elbow.x = (nearArm.shoulder.x + nearArm.hand.x) * 0.5 - facingSide * 5;
      nearArm.elbow.y = (nearArm.shoulder.y + nearArm.hand.y) * 0.5 + 7;

      farArm.hand.x = grip.rear.x;
      farArm.hand.y = grip.rear.y;
      farArm.elbow.x = (farArm.shoulder.x + farArm.hand.x) * 0.5 + facingSide * 3;
      farArm.elbow.y = (farArm.shoulder.y + farArm.hand.y) * 0.5 + 6;
    }

    if (usesActionHands) {
      const guard = state === PLAYER_STATES.PARRY_GUARD;
      const handDistance = guard ? 29 : 24 + (state === PLAYER_STATES.SLASH3 ? 6 : 0);
      const handHeight = guard ? -41 : -43;
      nearArm.hand.x = facingX * handDistance;
      nearArm.hand.y = handHeight + facingY * (guard ? 21 : 15);
      nearArm.elbow.x = (nearArm.shoulder.x + nearArm.hand.x) * 0.5 - facingY * facingSide * 4;
      nearArm.elbow.y = (nearArm.shoulder.y + nearArm.hand.y) * 0.5 + 4;

      farArm.hand.x = facingX * (guard ? 15 : 8) - facingSide * 3;
      farArm.hand.y = -49 + facingY * (guard ? 10 : 6);
      farArm.elbow.x = (farArm.shoulder.x + farArm.hand.x) * 0.5 + facingY * facingSide * 3;
      farArm.elbow.y = (farArm.shoulder.y + farArm.hand.y) * 0.5 + 5;
    }

    return {
      facingAngle,
      facingX,
      facingY,
      facingSide,
      profile,
      bodyX,
      bodyY,
      torsoRotation: -strideLag * 0.035,
      headRotation: (headLag - strideLag) * 0.052,
      headX: bodyX - headLag * facingSide * 0.55 + facingX * 1.4,
      headY: -91 + bodyY * 0.68,
      nearLeg: makeLeg(true),
      farLeg: makeLeg(false),
      nearArm,
      farArm,
      state,
      usesActionHands,
      grip
    };
  }

  /**
   * 枪身的锚点与两个握点，都在角色局部坐标系里。
   * 绘制与手臂摆位共用同一份，枪才不会脱手。
   */
  firearmGrip() {
    const model = this.weapon.model || 'sidearm';
    const angle = Number.isFinite(this.aimAngle) ? this.aimAngle : this.visualFacingAngle;
    const facingLeft = Math.cos(angle) < 0;
    const flip = facingLeft ? -1 : 1;
    const kick = this.recoilTimer > 0 ? this.recoilTimer / this.recoilDuration : 0;
    const back = kick * (model === 'rifle' ? 7 : model === 'scattergun' ? 6 : 4);

    const bulk = model === 'sidearm' ? 1.24 : model === 'scattergun' ? 1.12 : 1;
    const originX = Math.cos(angle) * 16;
    const originY = -51 + Math.sin(angle) * 11;
    const rot = angle - kick * 0.22;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);

    // 枪身局部坐标 → 角色坐标。y 轴在朝左时翻转，与绘制里的 scale(1,-1) 一致
    const toLocal = (lx, ly) => {
      const bx = (lx - back / bulk) * bulk;
      const by = ly * bulk * flip;
      return { x: originX + bx * cos - by * sin, y: originY + bx * sin + by * cos };
    };

    // 前手扶护木，后手握把，按枪型分别取点
    const pts = model === 'rifle'
      ? { front: [14, 5], rear: [-9, 3], muzzle: [48, 0] }
      : model === 'scattergun'
        ? { front: [12, 6], rear: [-6, 3], muzzle: [34, 0] }
        : { front: [8, 2], rear: [-4, 6], muzzle: [24, 0] };

    return {
      angle: rot,
      facingLeft,
      bulk,
      back,
      origin: { x: originX, y: originY },
      front: toLocal(...pts.front),
      rear: toLocal(...pts.rear),
      muzzle: toLocal(...pts.muzzle)
    };
  }

  /** 换主厨时替换制服配色，受击闪白的提亮版本一并重算。 */
  setPalette(overrides) {
    if (!overrides) {
      this.paletteSet = null;
      return;
    }
    const normal = { ...CHARACTER_PALETTES.normal, ...overrides };
    this.paletteSet = { normal, hurt: brightenPalette(normal, 2) };
  }

  /**
   * 记下当前主厨的身份，模型据此挑头饰、背挂与体型，
   * 五个人在场上一眼能分开。
   */
  setCharacterLook(character) {
    this.chefId = character?.id || null;
    this.chefTheme = character?.theme || '#5cd5bd';
    this.chefBuild = CHEF_BUILDS[this.chefId] || CHEF_BUILDS.default;
  }

  _characterPalette(ghost = false, hurt = false) {
    if (ghost) return CHARACTER_PALETTES.ghost;
    const set = this.paletteSet || CHARACTER_PALETTES;
    return hurt ? set.hurt : set.normal;
  }

  _drawCapsule(ctx, start, end, width, shades, outline) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length < 0.001) return;

    const nx = -dy / length;
    const ny = dx / length;
    const midX = (start.x + end.x) * 0.5;
    const midY = (start.y + end.y) * 0.5;
    const radius = width * 0.5;
    const gradient = ctx.createLinearGradient(
      midX - nx * radius,
      midY - ny * radius,
      midX + nx * radius,
      midY + ny * radius
    );
    gradient.addColorStop(0, shades[0]);
    gradient.addColorStop(0.43, shades[1]);
    gradient.addColorStop(0.72, shades[2] || shades[1]);
    gradient.addColorStop(1, shades[0]);

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = outline;
    ctx.lineWidth = width + 2.6;
    ctx.stroke();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.restore();
  }

  _drawJoint(ctx, point, radius, shades, outline) {
    const gradient = ctx.createRadialGradient(
      point.x - radius * 0.35,
      point.y - radius * 0.38,
      0.5,
      point.x,
      point.y,
      radius
    );
    gradient.addColorStop(0, shades[1]);
    gradient.addColorStop(0.58, shades[0]);
    gradient.addColorStop(1, outline);
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _pointOnSegment(start, end, t) {
    return {
      x: start.x + (end.x - start.x) * t,
      y: start.y + (end.y - start.y) * t
    };
  }

  _drawLeg(ctx, leg, palette, near = false) {
    this._drawCapsule(ctx, leg.hip, leg.knee, near ? 12.2 : 11.3, palette.suit, palette.outline);
    this._drawCapsule(
      ctx,
      this._pointOnSegment(leg.hip, leg.knee, 0.12),
      this._pointOnSegment(leg.hip, leg.knee, 0.68),
      near ? 10.8 : 9.8,
      palette.armor,
      palette.outline
    );
    this._drawJoint(ctx, leg.hip, near ? 6.2 : 5.6, palette.joint, palette.outline);
    this._drawJoint(ctx, leg.knee, near ? 5.6 : 5.1, palette.joint, palette.outline);
    this._drawCapsule(ctx, leg.knee, leg.ankle, near ? 10.8 : 9.9, palette.suit, palette.outline);
    this._drawCapsule(
      ctx,
      this._pointOnSegment(leg.knee, leg.ankle, 0.24),
      this._pointOnSegment(leg.knee, leg.ankle, 0.77),
      near ? 9.5 : 8.8,
      palette.armor,
      palette.outline
    );
    this._drawJoint(ctx, leg.ankle, near ? 4.8 : 4.4, palette.joint, palette.outline);
    this._drawCapsule(ctx, leg.ankle, leg.toe, near ? 11.2 : 10.4, palette.boot, palette.outline);

    ctx.save();
    ctx.strokeStyle = palette.accent;
    ctx.globalAlpha = near ? 0.9 : 0.62;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(leg.ankle.x, leg.ankle.y + 3.5);
    ctx.lineTo(leg.toe.x, leg.toe.y + 3.5);
    ctx.stroke();
    ctx.restore();
  }

  _drawArm(ctx, arm, palette, near = false) {
    this._drawCapsule(ctx, arm.shoulder, arm.elbow, near ? 10.8 : 10, palette.suit, palette.outline);
    this._drawCapsule(
      ctx,
      this._pointOnSegment(arm.shoulder, arm.elbow, 0.08),
      this._pointOnSegment(arm.shoulder, arm.elbow, 0.52),
      near ? 10.2 : 9.3,
      palette.armor,
      palette.outline
    );
    this._drawJoint(ctx, arm.shoulder, near ? 6.5 : 5.8, palette.armor, palette.outline);
    this._drawJoint(ctx, arm.elbow, near ? 5 : 4.6, palette.joint, palette.outline);
    this._drawCapsule(ctx, arm.elbow, arm.hand, near ? 9.2 : 8.5, palette.suit, palette.outline);
    this._drawCapsule(
      ctx,
      this._pointOnSegment(arm.elbow, arm.hand, 0.34),
      this._pointOnSegment(arm.elbow, arm.hand, 0.76),
      near ? 8.2 : 7.6,
      palette.armor,
      palette.outline
    );
    this._drawJoint(ctx, arm.hand, near ? 4.8 : 4.3, palette.joint, palette.outline);
  }

  _drawBackpack(ctx, rig, palette) {
    const x = rig.bodyX - rig.facingSide * 2;
    const y = -77 + rig.bodyY * 0.82;

    ctx.save();
    ctx.strokeStyle = palette.outline;
    ctx.lineCap = 'round';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(x - rig.facingSide * 14, y + 7);
    ctx.lineTo(x - rig.facingSide * 27, y - 17);
    ctx.stroke();
    ctx.strokeStyle = palette.accentDark;
    ctx.lineWidth = 3.5;
    ctx.stroke();

    const panX = x - rig.facingSide * 15;
    const panY = y + 8;
    const panGradient = ctx.createRadialGradient(panX - 4, panY - 5, 1, panX, panY, 16);
    panGradient.addColorStop(0, palette.armor[2]);
    panGradient.addColorStop(0.24, palette.armor[0]);
    panGradient.addColorStop(1, palette.outline);
    ctx.fillStyle = panGradient;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(panX, panY, 15.5, 13.5, -0.16 * rig.facingSide, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = palette.accent;
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(panX, panY, 11.5, 9.5, -0.16 * rig.facingSide, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    const packGradient = ctx.createLinearGradient(x - 20, y, x + 20, y);
    packGradient.addColorStop(0, palette.outline);
    packGradient.addColorStop(0.42, palette.suit[1]);
    packGradient.addColorStop(0.72, palette.suit[2]);
    packGradient.addColorStop(1, palette.suit[0]);
    ctx.fillStyle = packGradient;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.roundRect(x - 19, y - 8, 38, 41, 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.roundRect(x - 14, y + 15, 28, 5, 2.5);
    ctx.fill();
    ctx.fillStyle = palette.visorDark;
    ctx.beginPath();
    ctx.roundRect(x - 11, y - 3, 22, 13, 4);
    ctx.fill();
    ctx.strokeStyle = palette.visor;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.restore();
  }

  _drawTorso(ctx, rig, palette) {
    const x = rig.bodyX;
    const y = rig.bodyY;
    ctx.save();
    ctx.translate(x, -42 + y);
    ctx.rotate(rig.torsoRotation);

    const torsoGradient = ctx.createLinearGradient(-22, -20, 22, -20);
    torsoGradient.addColorStop(0, palette.armor[0]);
    torsoGradient.addColorStop(0.35, palette.armor[1]);
    torsoGradient.addColorStop(0.68, palette.armor[2]);
    torsoGradient.addColorStop(1, palette.suit[0]);
    ctx.fillStyle = torsoGradient;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-13, 2);
    ctx.bezierCurveTo(-19, -7, -22, -19, -18, -30);
    ctx.quadraticCurveTo(0, -39, 18, -30);
    ctx.bezierCurveTo(22, -19, 19, -7, 13, 2);
    ctx.quadraticCurveTo(0, 8, -13, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const chestGradient = ctx.createLinearGradient(-12, -26, 13, -10);
    chestGradient.addColorStop(0, palette.suit[0]);
    chestGradient.addColorStop(0.6, palette.suit[1]);
    chestGradient.addColorStop(1, palette.suit[2]);
    ctx.fillStyle = chestGradient;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-12, -25);
    ctx.lineTo(0, -30);
    ctx.lineTo(12, -25);
    ctx.lineTo(9, -8);
    ctx.lineTo(0, -4);
    ctx.lineTo(-9, -8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-15, -20);
    ctx.quadraticCurveTo(0, -10, 15, -20);
    ctx.stroke();
    ctx.fillStyle = palette.visor;
    ctx.strokeStyle = palette.visorDark;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, -18, 4.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = palette.suit[0];
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.roundRect(-15, -1, 30, 10, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = palette.accent;
    ctx.fillRect(-2.5, 0.5, 5, 7);
    ctx.restore();
  }

  _drawHead(ctx, rig, palette, ghost = false) {
    this._drawCapsule(
      ctx,
      { x: rig.bodyX, y: -78 + rig.bodyY * 0.72 },
      { x: rig.headX, y: rig.headY + 9 },
      9,
      palette.suit,
      palette.outline
    );

    ctx.save();
    ctx.translate(rig.headX, rig.headY);
    ctx.rotate(rig.headRotation);

    const toqueGradient = ctx.createRadialGradient(-3, -21, 1, 0, -17, 15);
    toqueGradient.addColorStop(0, palette.armor[2]);
    toqueGradient.addColorStop(0.65, palette.armor[1]);
    toqueGradient.addColorStop(1, palette.armor[0]);
    ctx.fillStyle = toqueGradient;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1.7;
    for (const lobe of [[-8, -16, 7], [0, -20, 8], [8, -16, 7]]) {
      ctx.beginPath();
      ctx.arc(lobe[0], lobe[1], lobe[2], 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    const helmetGradient = ctx.createRadialGradient(-6, -7, 2, 0, 0, 18);
    helmetGradient.addColorStop(0, palette.armor[2]);
    helmetGradient.addColorStop(0.52, palette.armor[1]);
    helmetGradient.addColorStop(0.82, palette.armor[0]);
    helmetGradient.addColorStop(1, palette.outline);
    ctx.fillStyle = helmetGradient;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 17.5, 18.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const frontVisibility = clamp01(0.55 + rig.facingY * 0.38);
    const visorX = rig.facingX * 5.2;
    const visorY = 1.5 + rig.facingY * 2.8;
    const visorWidth = 10.5 + frontVisibility * 6.5;
    const visorGradient = ctx.createLinearGradient(visorX - visorWidth, visorY - 5, visorX + visorWidth, visorY + 5);
    visorGradient.addColorStop(0, palette.visorDark);
    visorGradient.addColorStop(0.42, palette.visor);
    visorGradient.addColorStop(0.72, palette.visor);
    visorGradient.addColorStop(1, palette.visorDark);
    ctx.fillStyle = visorGradient;
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1.8;
    if (!ghost) {
      ctx.shadowColor = palette.visor;
      ctx.shadowBlur = 5;
    }
    ctx.beginPath();
    ctx.ellipse(visorX, visorY, visorWidth, 6.3, rig.facingX * rig.facingY * 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(
      visorX - rig.facingSide * 1.2,
      visorY - 0.7,
      Math.max(3, visorWidth - 3.5),
      3.8,
      rig.facingX * rig.facingY * 0.06,
      Math.PI * 1.12,
      Math.PI * 1.72
    );
    ctx.stroke();

    ctx.fillStyle = palette.accent;
    ctx.strokeStyle = palette.accentDark;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(-rig.facingSide * 13.5, 1, 4.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  _drawNeutralKnife(ctx, rig, palette) {
    if (rig.usesActionHands || rig.grip || rig.state === PLAYER_STATES.DEAD) return;
    const hand = rig.nearArm.hand;
    ctx.save();
    ctx.translate(hand.x, hand.y);
    ctx.rotate(-rig.facingSide * 0.48 + rig.facingY * 0.1);
    ctx.fillStyle = palette.suit[0];
    ctx.strokeStyle = palette.outline;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(-2.8, -2, 5.6, 11, 2);
    ctx.fill();
    ctx.stroke();

    const bladeGradient = ctx.createLinearGradient(-5, 8, 6, 24);
    bladeGradient.addColorStop(0, palette.armor[0]);
    bladeGradient.addColorStop(0.48, palette.armor[2]);
    bladeGradient.addColorStop(1, palette.armor[0]);
    ctx.fillStyle = bladeGradient;
    ctx.beginPath();
    ctx.moveTo(-4.5, 8);
    ctx.lineTo(5, 8);
    ctx.lineTo(3.2, 25);
    ctx.lineTo(-1.2, 21);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = palette.visor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(3.7, 10);
    ctx.lineTo(2.6, 22);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Vector-built volume model. Every limb is a two-bone chain with separate
   * joints, so the silhouette changes through an actual step instead of
   * deforming or rotating a flat character image.
   */
  drawCharacterModel(ctx, rig, options = {}) {
    const ghost = Boolean(options.ghost);
    const palette = this._characterPalette(ghost, Boolean(options.hurt));
    const build = this.chefBuild || CHEF_BUILDS.default;

    // 体型缩放以脚底为支点，缩放后仍然站在同一条地平线上
    const scaled = build.scale !== 1;
    if (scaled) {
      ctx.save();
      ctx.scale(build.scale, build.scale);
    }

    this._drawBackpack(ctx, rig, palette);
    this._drawLeg(ctx, rig.farLeg, palette, false);
    this._drawArm(ctx, rig.farArm, palette, false);
    this._drawTorso(ctx, rig, palette);
    this._drawHead(ctx, rig, palette, ghost);
    this._drawLeg(ctx, rig.nearLeg, palette, true);
    this._drawArm(ctx, rig.nearArm, palette, true);
    this._drawNeutralKnife(ctx, rig, palette);
    if (!ghost) this._drawChefCrest(ctx, rig, palette);
    if (scaled) ctx.restore();
  }

  /**
   * 主厨专属的头顶配件与背后家伙，五个人的剪影据此区分。
   */
  _drawChefCrest(ctx, rig, palette) {
    const build = this.chefBuild || CHEF_BUILDS.default;
    const theme = this.chefTheme || palette.visor;
    const side = rig.facingSide;
    const hx = rig.headX ?? rig.bodyX ?? 0;
    const hy = (rig.headY ?? -86) - 12;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // --- 头顶配件 ---
    if (build.crest === 'blade') {
      // 交叉的两根刀簪
      ctx.strokeStyle = palette.armor[2];
      ctx.lineWidth = 2.6;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(hx - s * 9, hy + 4);
        ctx.lineTo(hx + s * 10, hy - 9);
        ctx.stroke();
      }
      ctx.fillStyle = theme;
      ctx.beginPath();
      ctx.arc(hx, hy - 2, 2.6, 0, Math.PI * 2);
      ctx.fill();
    } else if (build.crest === 'flame') {
      // 三簇火焰羽冠，随呼吸抖动
      const t = this.animTime * 7;
      for (let i = -1; i <= 1; i++) {
        const h = 12 + Math.sin(t + i * 1.4) * 3;
        ctx.fillStyle = i === 0 ? '#fde68a' : theme;
        ctx.beginPath();
        ctx.moveTo(hx + i * 6.5, hy + 4);
        ctx.quadraticCurveTo(hx + i * 6.5 + 4, hy - h * 0.4, hx + i * 6.5, hy - h);
        ctx.quadraticCurveTo(hx + i * 6.5 - 4, hy - h * 0.4, hx + i * 6.5, hy + 4);
        ctx.fill();
      }
    } else if (build.crest === 'wreath') {
      // 环绕头顶的花环
      ctx.strokeStyle = theme;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(hx, hy + 1, 12, 4.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#fde68a';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + this.animTime * 0.6;
        ctx.beginPath();
        ctx.arc(hx + Math.cos(a) * 12, hy + 1 + Math.sin(a) * 4.6, 2.1, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (build.crest === 'tusk') {
      // 兽牙护额
      ctx.fillStyle = '#e7e5e4';
      ctx.strokeStyle = palette.outline;
      ctx.lineWidth = 1.4;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(hx + s * 7, hy + 8);
        ctx.quadraticCurveTo(hx + s * 15, hy + 1, hx + s * 12, hy - 8);
        ctx.quadraticCurveTo(hx + s * 9, hy + 1, hx + s * 7, hy + 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = theme;
      ctx.fillRect(hx - 9, hy + 6, 18, 3);
    } else if (build.crest === 'ring') {
      // 悬浮的分子环
      const t = this.animTime * 1.6;
      ctx.strokeStyle = theme;
      ctx.lineWidth = 1.8;
      ctx.globalAlpha = 0.85;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.ellipse(hx, hy - 3, 13 - i * 4, 4.4 + Math.sin(t + i) * 1.6, i * 0.6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = theme;
      ctx.beginPath();
      ctx.arc(hx + Math.cos(t * 2) * 13, hy - 3 + Math.sin(t * 2) * 4.4, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- 背后的家伙 ---
    // 端着枪的时候厨具收进背包，免得看着像同时握了两样东西
    if (rig.grip) {
      ctx.restore();
      return;
    }

    const gx = (rig.bodyX ?? 0) - side * 24;
    const gy = -62 + (rig.bodyY ?? 0) * 0.8;

    if (build.gear === 'twin_knife') {
      ctx.strokeStyle = palette.armor[1];
      ctx.lineWidth = 3.4;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(gx - s * 3, gy + 12);
        ctx.lineTo(gx + s * 8, gy - 14);
        ctx.stroke();
      }
    } else if (build.gear === 'wok') {
      // 深口炒锅，带一根长柄
      ctx.fillStyle = '#1c1917';
      ctx.strokeStyle = theme;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(gx, gy, 13, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = palette.accentDark;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(gx + side * 12, gy - 4);
      ctx.lineTo(gx + side * 26, gy - 15);
      ctx.stroke();
    } else if (build.gear === 'tray') {
      // 摆盘托盘与三只小碟
      ctx.fillStyle = palette.armor[1];
      ctx.strokeStyle = theme;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(gx, gy, 15, 6.5, -0.2 * side, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = theme;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.arc(gx + i * 7, gy - 3, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (build.gear === 'cleaver') {
      // 宽刃剁刀
      ctx.fillStyle = palette.armor[1];
      ctx.strokeStyle = palette.outline;
      ctx.lineWidth = 2;
      ctx.save();
      ctx.translate(gx, gy);
      ctx.rotate(-side * 0.5);
      ctx.beginPath();
      ctx.rect(-9, -16, 18, 22);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = theme;
      ctx.fillRect(-3, 6, 6, 14);
      ctx.restore();
    } else if (build.gear === 'orbs') {
      // 三颗绕着背包转的悬浮球
      const t = this.animTime * 1.9;
      for (let i = 0; i < 3; i++) {
        const a = t + (i / 3) * Math.PI * 2;
        const ox = gx + Math.cos(a) * 15;
        const oy = gy + Math.sin(a) * 7;
        ctx.globalAlpha = 0.45 + Math.sin(a) * 0.3;
        ctx.fillStyle = theme;
        ctx.beginPath();
        ctx.arc(ox, oy, 3.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  /**
   * Draw Weapon & Dynamic Slash Animations
   */
  drawWeapon(ctx) {
    // 枪械常驻在手上，朝瞄准方向端着；近战只在出招帧显形
    if (this.ranged) {
      this.drawFirearm(ctx);
      return;
    }

    const isSlash =
      this.state === PLAYER_STATES.SLASH1 ||
      this.state === PLAYER_STATES.SLASH2 ||
      this.state === PLAYER_STATES.SLASH3;
    if (!isSlash && this.state !== PLAYER_STATES.HEAVY_STRIKE && this.state !== PLAYER_STATES.PARRY_GUARD) {
      return;
    }

    const angle = this.visualFacingAngle;
    let weaponX = Math.cos(angle) * 24;
    let weaponY = -43 + Math.sin(angle) * 15;
    let bladeAngle = angle + Math.PI / 4;

    if (this.state === PLAYER_STATES.PARRY_GUARD) {
      ctx.save();
      ctx.translate(Math.cos(angle) * 29, -41 + Math.sin(angle) * 21);
      ctx.rotate(angle);
      ctx.fillStyle = '#172033';
      ctx.strokeStyle = this.stateTimer <= this.perfectParryWindow ? '#fbbf24' : '#7dd3fc';
      ctx.lineWidth = 3;
      ctx.shadowColor = this.stateTimer <= this.perfectParryWindow ? '#f59e0b' : '#38bdf8';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.ellipse(0, 0, 15, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#475569';
      ctx.fillRect(-5, -2, 10, 4);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(-24, -2.5, 12, 5);
      ctx.restore();
      return;
    }

    if (this.state === PLAYER_STATES.SLASH1) {
      bladeAngle = angle - Math.PI / 3 + (this.stateTimer / this.stateDuration) * Math.PI * 0.9;
    } else if (this.state === PLAYER_STATES.SLASH2) {
      bladeAngle = angle + Math.PI / 2 - (this.stateTimer / this.stateDuration) * Math.PI * 1.0;
    } else if (this.state === PLAYER_STATES.SLASH3) {
      bladeAngle = angle - Math.PI * 0.7 + (this.stateTimer / this.stateDuration) * Math.PI * 1.4;
      weaponX += Math.cos(angle) * 6;
      weaponY += Math.sin(angle) * 6;
    } else if (this.state === PLAYER_STATES.HEAVY_STRIKE) {
      if (this.stateTimer < this.heavyWindup) {
        bladeAngle = angle - Math.PI * 0.8;
      } else {
        bladeAngle = angle + Math.PI * 0.6;
      }
    }

    ctx.save();
    ctx.translate(weaponX, weaponY);
    ctx.rotate(bladeAngle);
    this.drawMeleeBlade(ctx);
    ctx.restore();

    // 双持的副手刃反向落后半拍，形成剪刀式的交叉
    if (this.weapon.model === 'twin_blades') {
      ctx.save();
      ctx.translate(weaponX * 0.42, weaponY + 6);
      ctx.rotate(bladeAngle - Math.PI * 0.62);
      ctx.globalAlpha = 0.9;
      this.drawMeleeBlade(ctx, 0.86);
      ctx.restore();
    }
  }

  /** 近战刀身。原点在握把底，刃尖朝 -y。 */
  drawMeleeBlade(ctx, scale = 1) {
    const model = this.weapon.model || 'chef_knife';
    const color = this.weapon.color || '#38bdf8';
    const glow = this.weapon.glowColor || '#0ea5e9';
    if (scale !== 1) ctx.scale(scale, scale);

    ctx.fillStyle = '#334155';
    ctx.shadowColor = glow;

    if (model === 'twin_blades') {
      // 短柄细刃，长度只有主厨刀的六成
      ctx.fillRect(-2, -1, 4, 9);
      ctx.fillStyle = color;
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.moveTo(-3, -2);
      ctx.lineTo(-1.2, -20);
      ctx.lineTo(3.4, -2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-0.8, -17, 1.6, 14);
    } else if (model === 'cleaver') {
      // 长握把 + 方头厚背，刀背一条暗色配重
      ctx.fillRect(-3, -2, 6, 16);
      ctx.fillStyle = color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(-8, -6);
      ctx.lineTo(-8, -34);
      ctx.lineTo(9, -36);
      ctx.lineTo(9, -6);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = glow;
      ctx.fillRect(6, -35, 3, 29);
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.75;
      ctx.fillRect(-7, -33, 2, 26);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillRect(-2.5, -1, 5, 11);
      ctx.fillStyle = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(-4, -2);
      ctx.lineTo(0, -31);
      ctx.lineTo(5, -2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1, -27, 2, 23);
    }

    ctx.shadowBlur = 0;
  }

  /**
   * 枪械。原点移到持枪的手，整体旋到瞄准方向后按侧视轮廓画，
   * 开火时枪身后座并在枪口叠一层闪光。
   */
  drawFirearm(ctx) {
    const model = this.weapon.model || 'sidearm';
    const color = this.weapon.color || '#22d3ee';
    const glow = this.weapon.glowColor || '#0e7490';
    const angle = Number.isFinite(this.aimAngle) ? this.aimAngle : this.visualFacingAngle;
    const facingLeft = Math.cos(angle) < 0;

    const kick = this.recoilTimer > 0 ? this.recoilTimer / this.recoilDuration : 0;
    const back = kick * (model === 'rifle' ? 7 : model === 'scattergun' ? 6 : 4);

    ctx.save();
    ctx.translate(Math.cos(angle) * 16, -51 + Math.sin(angle) * 11);
    ctx.rotate(angle);
    if (facingLeft) ctx.scale(1, -1);
    ctx.translate(-back, 0);
    ctx.rotate(-kick * 0.22);
    // 短枪按比例放大，免得在暗背景里糊成一团
    const bulk = model === 'sidearm' ? 1.24 : model === 'scattergun' ? 1.12 : 1;
    ctx.scale(bulk, bulk);

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.4;

    let muzzleX = 0;
    if (model === 'scattergun') {
      // 双管，粗短，下方挂一根木质护木
      muzzleX = 34;
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(-10, -4, 22, 9);
      ctx.strokeRect(-10, -4, 22, 9);
      ctx.fillStyle = '#52525b';
      ctx.fillRect(10, -5, 24, 4.4);
      ctx.fillRect(10, 0.4, 24, 4.4);
      ctx.strokeRect(10, -5, 24, 9.8);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(4, 4, 18, 4);
      ctx.fillStyle = '#292524';
      ctx.beginPath();
      ctx.moveTo(-10, 1);
      ctx.lineTo(-22, 11);
      ctx.lineTo(-17, 13);
      ctx.lineTo(-6, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (model === 'rifle') {
      // 长枪管 + 弹匣 + 光学镜，整体压低瘦长
      muzzleX = 48;
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(-14, -4, 30, 9);
      ctx.strokeRect(-14, -4, 30, 9);
      ctx.fillStyle = '#52525b';
      ctx.fillRect(16, -2.6, 32, 5.2);
      ctx.strokeRect(16, -2.6, 32, 5.2);
      ctx.fillStyle = color;
      ctx.fillRect(40, -1, 8, 2);
      ctx.fillStyle = '#27272a';
      ctx.fillRect(-4, -10, 16, 5);
      ctx.strokeRect(-4, -10, 16, 5);
      ctx.fillStyle = glow;
      ctx.fillRect(-2, 5, 8, 12);
      ctx.strokeRect(-2, 5, 8, 12);
      ctx.fillStyle = '#292524';
      ctx.beginPath();
      ctx.moveTo(-14, 0);
      ctx.lineTo(-27, 9);
      ctx.lineTo(-22, 12);
      ctx.lineTo(-10, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // 手枪：短枪管，握把明显
      muzzleX = 24;
      ctx.fillStyle = '#3f3f46';
      ctx.fillRect(-7, -5, 18, 9);
      ctx.strokeRect(-7, -5, 18, 9);
      ctx.fillStyle = '#52525b';
      ctx.fillRect(11, -3, 13, 5);
      ctx.strokeRect(11, -3, 13, 5);
      ctx.fillStyle = color;
      ctx.fillRect(18, -1.6, 6, 3.2);
      ctx.fillStyle = '#292524';
      ctx.beginPath();
      ctx.moveTo(-7, 2);
      ctx.lineTo(-13, 14);
      ctx.lineTo(-6, 15);
      ctx.lineTo(-1, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 沿机匣的一道能量描线，暗处也能认出枪的轮廓
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(model === 'rifle' ? -13 : model === 'scattergun' ? -9 : -6, -5.6, model === 'rifle' ? 28 : 20, 1.6);
    ctx.globalAlpha = 1;

    if (this.muzzleTimer > 0) {
      const f = Math.max(0, Math.min(1, this.muzzleTimer / 0.07));
      const len = (model === 'scattergun' ? 24 : model === 'rifle' ? 20 : 14) * (0.55 + f * 0.45);
      // 由外到内三层实心多边形叠出辉光，避开 shadowBlur
      const cone = (spread, reach, fill, alpha) => {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.moveTo(muzzleX - 2, -spread);
        ctx.lineTo(muzzleX + reach, 0);
        ctx.lineTo(muzzleX - 2, spread);
        ctx.closePath();
        ctx.fill();
      };
      cone(10 * f, len * 1.15, glow, f * 0.5);
      cone(6 * f, len, color, f);
      cone(2.6 * f, len * 0.55, '#ffffff', f);
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // 两只手压在枪上，握点与手臂末端是同一组坐标
    const grip = this.firearmGrip();
    const palette = this._characterPalette(false, this.flashWhiteTimer > 0);
    for (const h of [grip.rear, grip.front]) {
      ctx.beginPath();
      ctx.arc(h.x, h.y, 5.2, 0, Math.PI * 2);
      ctx.fillStyle = Array.isArray(palette.armor) ? palette.armor[0] : palette.armor;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = palette.outline;
      ctx.stroke();
    }
  }

  /**
   * Draw Neon Plasma Slash Arc Visuals
   */
  drawSlashArcFX(ctx, screenX, screenY) {
    const box = this.attackHitbox;
    const progress = this.stateTimer / this.stateDuration;

    ctx.save();
    ctx.strokeStyle = this.comboStep === 3 ? '#f59e0b' : (this.weapon.color || '#38bdf8');
    ctx.lineWidth = this.comboStep === 3 ? 5 : 3;
    ctx.shadowColor = this.comboStep === 3 ? '#fbbf24' : (this.weapon.glowColor || '#0284c7');
    ctx.shadowBlur = 12;
    ctx.globalAlpha = 1.0 - progress * 0.6;

    ctx.beginPath();
    ctx.arc(screenX, screenY, box.radius, box.startAngle, box.endAngle);
    ctx.stroke();

    // Inner blade trail
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(screenX, screenY, box.radius * 0.88, box.startAngle + 0.1, box.endAngle - 0.1);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw Heavy Smash Visual FX
   */
  drawHeavySmashFX(ctx, screenX, screenY) {
    const box = this.attackHitbox;
    const hitScreenX = screenX + Math.cos(this.facingAngle) * 32;
    const hitScreenY = screenY + Math.sin(this.facingAngle) * 32;

    ctx.save();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#0284c7';
    ctx.shadowBlur = 18;

    ctx.beginPath();
    ctx.arc(hitScreenX, hitScreenY, box.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Shockwave Cross Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hitScreenX - box.radius * 0.8, hitScreenY);
    ctx.lineTo(hitScreenX + box.radius * 0.8, hitScreenY);
    ctx.moveTo(hitScreenX, hitScreenY - box.radius * 0.8);
    ctx.lineTo(hitScreenX, hitScreenY + box.radius * 0.8);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw Mini Overhead Stamina & Status
   */
  drawOverheadHUD(ctx, screenX, screenY) {
    // Stamina Bar (Only when depleted)
    if (this.stamina < this.maxStamina) {
      const barWidth = 28;
      const barHeight = 4;
      const barX = screenX - barWidth / 2;
      const barY = screenY + this.radius + 6;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

      const fillPct = this.stamina / this.maxStamina;
      ctx.fillStyle = '#10b981'; // Green stamina
      if (fillPct < 0.3) ctx.fillStyle = '#ef4444'; // Red warning
      ctx.fillRect(barX, barY, barWidth * fillPct, barHeight);
    }
  }
}
