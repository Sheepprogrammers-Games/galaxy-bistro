import { assets } from "../core/assets.js";
import { getFilteredSprite } from "../core/sprite_cache.js";
import { drawBossGlyph, drawStunGlyph } from '../world/glyphs.js';
/**
 * Galaxy Hunter: Gourmet Odyssey
 * Base Creature Entity & AI State Machine
 * File: src/entities/creature.js
 */

// 无论护甲多高，至少这个比例的原始伤害会穿透。
const ARMOR_PIERCE_RATIO = 0.25;

// 营地生态的键。这里不引 map.js，免得两个模块互相 import。
const BIOMES_CAMP = 'stardust_camp';

export const CREATURE_STATES = {
  IDLE: 'IDLE',
  WANDER: 'WANDER',
  ALERT: 'ALERT',
  CHASE: 'CHASE',
  WINDUP: 'WINDUP',
  ATTACK: 'ATTACK',
  HURT: 'HURT',
  STUNNED: 'STUNNED',
  DEAD: 'DEAD'
};

export class Creature {
  constructor(config = {}) {
    // Basic Identifiers
    this.id = config.id || `creature_${Math.random().toString(36).substr(2, 9)}`;
    this.typeKey = config.typeKey || config.id || this.id;
    this.type = config.type || 'unknown_creature';
    this.name = config.name || 'Alien Creature';
    this.species = config.species || 'Fauna';
    this.category = config.category || 'herbivore'; // 'herbivore' | 'predator' | 'armored' | 'boss'
    this.biome = config.biome || 'shroom_forest';
    this.icon = config.icon || '👾';

    // Position & Physics
    this.x = config.x || 0;
    this.y = config.y || 0;
    this.spawnX = this.x;
    this.spawnY = this.y;
    this.vx = 0;
    this.vy = 0;
    this.radius = config.radius || 20;
    this.speed = config.speed || 100;
    this.chaseSpeed = config.chaseSpeed || this.speed * 1.35;
    this.wanderSpeed = config.wanderSpeed || this.speed * 0.55;
    this.knockbackResist = config.knockbackResist || 0.2; // 0 (none) to 1.0 (immune)

    // Facing & Direction
    this.facingAngle = config.facingAngle || Math.random() * Math.PI * 2;
    this.facingDir = 'E';

    // Combat Attributes
    this.maxHp = config.hp || 100;
    this.hp = this.maxHp;
    this.defense = config.defense || 0;
    this.poise = config.poise || 50;
    this.maxPoise = this.poise;
    this.contactDamage = config.contactDamage || 8;
    this.damage = config.damage || 15;

    // Sensory & AI Parameters
    this.provoked = false;
    this.provokeTimer = 0;
    this.aggroDuration = config.aggroDuration || 9.0;
    this.leashRange = config.leashRange || 460;
    this.playerInSafeZone = false;

    // 巢域生态：生成时由世界写入，离开后会持续掉血并自己往回走
    this.homeBiome = config.homeBiome || null;
    this.exileTimer = 0;
    this.exileTick = 0;
    this.homingTimer = 0;

    // 卡住检测：贴着安全区或障碍推不动时用来重掷目标
    this.stallTimer = 0;
    this.stallX = this.x;
    this.stallY = this.y;

    this.sightRange = config.sightRange || 220;
    this.attackRange = config.attackRange || 45;
    this.loseTargetRange = config.loseTargetRange || 360;
    this.patrolRadius = config.patrolRadius || 160;

    // Timing & Cooldowns
    this.state = CREATURE_STATES.IDLE;
    this.stateTimer = 0;
    this.stateDuration = config.idleTime || 2.0;
    this.wanderTarget = { x: this.x, y: this.y };
    this.attackCooldown = config.attackCooldown || 1.8;
    this.attackCooldownTimer = 0;
    this.windupDuration = config.windupDuration || 0.45;
    this.attackDuration = config.attackDuration || 0.35;
    this.stunDuration = config.stunDuration || 2.0;
    this.alertDuration = config.alertDuration || 0.6;
    this.fleeDuration = config.fleeDuration || 3.5;

    // Drops & Ingredients
    this.drops = config.drops || [
      { id: 'quantum_meat', name: 'Alien Meat', chance: 1.0, min: 1, max: 2 }
    ];

    // Visual & Animation State
    this.themeColor = config.themeColor || '#10b981';
    this.accentColor = config.accentColor || '#34d399';
    this.eyeColor = config.eyeColor || '#ef4444';
    this.spriteFilter = config.spriteFilter || 'none';
    this.animTime = Math.random() * 10;
    this.walkCycle = 0;
    this.flashWhiteTimer = 0;
    this.isDead = false;
    this.deathFade = 1.0;
    this.activeAttackHitbox = null;

    // Popups & Floating Combat Feedback
    this.damagePopups = []; // { text, x, y, vy, life, maxLife, color, isCrit, isStun }

    // Status Effects (Burn, Freeze, Poison, Shock)
    this.statusEffects = new Map();

    // Custom AI Hook (Overridden in specific monster types)
    this.customAi = config.customAi || null;
    this.customRender = config.customRender || null;
    // 有位图但画得不如矢量的物种，用这个跳过位图分支
    this.preferVector = config.preferVector === true;
    // 侧视剪影的物种要跟着朝向翻转，俯视旋转的不用
    this.sideView = config.sideView === true;
  }

  /**
   * Primary Update Loop
   */
  update(dt, player, worldMap = null, obstacles = [], projectiles = [], dropsList = [], particleSystem = null, audioSystem = null) {
    // 供渲染插值使用的上一固定步位置
    this.prevX = this.x;
    this.prevY = this.y;
    this.animTime += dt;
    this.stateTimer += dt;

    // Update Floating Damage Popups
    for (let i = this.damagePopups.length - 1; i >= 0; i--) {
      const pop = this.damagePopups[i];
      pop.life -= dt;
      pop.y += pop.vy * dt;
      pop.vy += 80 * dt; // gravity
      if (pop.life <= 0) {
        this.damagePopups.splice(i, 1);
      }
    }

    // Update Timers
    if (this.attackCooldownTimer > 0) this.attackCooldownTimer -= dt;
    if (this.flashWhiteTimer > 0) this.flashWhiteTimer -= dt;

    // Handle Status Effects
    this.updateStatusEffects(dt, particleSystem);

    // Dead Entity Update
    if (this.state === CREATURE_STATES.DEAD) {
      this.vx *= 0.82;
      this.vy *= 0.82;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.deathFade = Math.max(0, this.deathFade - dt * 1.2);
      if (this.deathFade <= 0) {
        this.isDead = true;
      }
      return;
    }

    this.updateAggro(dt, player, worldMap);
    this.updateHabitat(dt, worldMap, particleSystem);

    // Custom or Standard AI State Machine
    if (this.customAi && typeof this.customAi === 'function') {
      this.customAi(this, dt, player, projectiles, particleSystem, audioSystem);
    } else {
      this.updateStateMachine(dt, player, projectiles, particleSystem, audioSystem);
    }

    // 走出巢域时压过游荡目标，径直往回赶
    if (this.homingTimer > 0 && !this.provoked) {
      const dx = this.wanderTarget.x - this.x;
      const dy = this.wanderTarget.y - this.y;
      const d = Math.hypot(dx, dy);
      if (d > 6) {
        const sp = this.chaseSpeed || this.speed || 100;
        this.vx = (dx / d) * sp;
        this.vy = (dy / d) * sp;
      }
    }

    // Physics & Obstacle Collision Resolution
    this.resolvePhysics(dt, worldMap, obstacles);
    this.updateStall(dt);

    // Update Facing Direction
    if (Math.abs(this.vx) > 1 || Math.abs(this.vy) > 1) {
      this.facingAngle = Math.atan2(this.vy, this.vx);
    }
  }

  /**
   * Generic Sensory AI State Machine
   */
  updateStateMachine(dt, player, projectiles, particleSystem, audioSystem) {
    const distToPlayer = player ? Math.hypot(player.x - this.x, player.y - this.y) : Infinity;

    switch (this.state) {
      case CREATURE_STATES.IDLE:
        this.vx *= 0.8;
        this.vy *= 0.8;

        // Sensory Detection
        if (player && player.state !== 'dead' && distToPlayer <= this.sightRange) {
          this.enterAlert(player, audioSystem);
        } else if (this.stateTimer >= this.stateDuration) {
          this.enterWander();
        }
        break;

      case CREATURE_STATES.WANDER:
        this.walkCycle += dt * 8;
        const dxW = this.wanderTarget.x - this.x;
        const dyW = this.wanderTarget.y - this.y;
        const distW = Math.hypot(dxW, dyW);

        if (distW > 8) {
          this.vx = (dxW / distW) * this.wanderSpeed;
          this.vy = (dyW / distW) * this.wanderSpeed;
        } else {
          this.enterIdle(1.5 + Math.random() * 2.0);
        }

        // Check for player while wandering
        if (player && player.state !== 'dead' && distToPlayer <= this.sightRange) {
          this.enterAlert(player, audioSystem);
        }
        break;

      case CREATURE_STATES.ALERT:
        this.vx *= 0.7;
        this.vy *= 0.7;
        if (player) {
          this.facingAngle = Math.atan2(player.y - this.y, player.x - this.x);
        }

        if (this.stateTimer >= this.alertDuration) {
          if (this.category === 'herbivore') {
            this.enterFlee(player);
          } else {
            this.enterChase();
          }
        }
        break;

      case CREATURE_STATES.CHASE:
        this.walkCycle += dt * 14;
        if (!player || player.state === 'dead' || distToPlayer > this.loseTargetRange) {
          this.enterIdle(2.0);
          break;
        }

        // Steer towards player
        const dxC = player.x - this.x;
        const dyC = player.y - this.y;
        const distC = Math.hypot(dxC, dyC);
        this.facingAngle = Math.atan2(dyC, dxC);

        if (distC <= this.attackRange && this.attackCooldownTimer <= 0) {
          this.enterWindup(player);
        } else if (distC <= this.attackRange) {
          // 贴上了但还在冷却：绕着走。保留冲刺速度会一路冲过头再折返，看着就是左右鬼畜
          if (!this.strafeSide) this.strafeSide = Math.random() < 0.5 ? 1 : -1;
          const sp = this.wanderSpeed || this.speed * 0.5;
          this.vx = -(dyC / distC) * sp * this.strafeSide;
          this.vy = (dxC / distC) * sp * this.strafeSide;
        } else {
          this.vx = (dxC / distC) * this.chaseSpeed;
          this.vy = (dyC / distC) * this.chaseSpeed;
        }
        break;

      case CREATURE_STATES.WINDUP:
        this.vx *= 0.6;
        this.vy *= 0.6;
        if (player) {
          this.facingAngle = Math.atan2(player.y - this.y, player.x - this.x);
        }

        // Telegraph particles
        if (particleSystem && Math.random() < 0.25) {
          particleSystem.spawnAttackTelegraph(this.x, this.y, this.facingAngle, '#ef4444');
        }

        if (this.stateTimer >= this.windupDuration) {
          this.executeAttack(player, projectiles, particleSystem, audioSystem);
        }
        break;

      case CREATURE_STATES.ATTACK:
        if (this.stateTimer >= this.attackDuration) {
          this.activeAttackHitbox = null;
          this.attackCooldownTimer = this.attackCooldown;
          this.enterChase();
        }
        break;

      case CREATURE_STATES.HURT:
        this.vx *= 0.88;
        this.vy *= 0.88;
        if (this.stateTimer >= 0.25) {
          if (this.category === 'herbivore') {
            this.enterFlee(player);
          } else {
            this.enterChase();
          }
        }
        break;

      case CREATURE_STATES.STUNNED:
        this.vx *= 0.75;
        this.vy *= 0.75;
        this.activeAttackHitbox = null;

        // Spawn stun dizzy stars
        if (particleSystem && Math.random() < 0.15) {
          particleSystem.spawnStunStars(this.x, this.y - this.radius - 8);
        }

        if (this.stateTimer >= this.stunDuration) {
          this.enterIdle(0.5);
        }
        break;
    }
  }

  /**
   * Enter Idle State
   */
  enterIdle(duration = 2.0) {
    this.state = CREATURE_STATES.IDLE;
    this.stateTimer = 0;
    this.stateDuration = duration;
    this.activeAttackHitbox = null;
  }

  /**
   * Pick random wander coordinate in patrol radius
   */
  enterWander() {
    this.state = CREATURE_STATES.WANDER;
    this.stateTimer = 0;
    const angle = Math.random() * Math.PI * 2;
    const dist = 40 + Math.random() * (this.patrolRadius - 40);
    this.wanderTarget = {
      x: this.spawnX + Math.cos(angle) * dist,
      y: this.spawnY + Math.sin(angle) * dist
    };
  }

  /**
   * 只有被玩家攻击过（且仇恨未过期）的非草食生物才会主动交战。
   */
  canEngage() {
    if (this.category === 'herbivore') return true; // 草食动物进入的是逃跑分支
    // 终局 Boss 是主动来找你的，不适用"不打它就不打你"
    if (this.alwaysHostile) return !this.playerInSafeZone;
    return this.provoked && !this.playerInSafeZone;
  }

  /**
   * 仇恨维持与脱战判定：离得太远、被拉出巢域太远、玩家进入营地安全区
   * 或仇恨计时结束，都会放弃追击。
   */
  updateAggro(dt, player, worldMap) {
    this.playerInSafeZone = Boolean(
      player && worldMap && typeof worldMap.isInsideCampSafeZone === 'function'
      && worldMap.isInsideCampSafeZone(player.x, player.y)
    );

    if (this.provokeTimer > 0) {
      this.provokeTimer -= dt;
    }

    // 常驻敌对的目标只在玩家进入安全区时收手，不受仇恨计时与巢域限制
    if (this.alwaysHostile) {
      if (this.playerInSafeZone) {
        this.activeAttackHitbox = null;
      } else {
        this.provoked = true;
        this.provokeTimer = this.aggroDuration;
      }
      return;
    }

    if (!this.provoked) return;

    const distToPlayer = player ? Math.hypot(player.x - this.x, player.y - this.y) : Infinity;
    const homeDist = Math.hypot(this.x - this.spawnX, this.y - this.spawnY);

    if (
      this.provokeTimer <= 0
      || !player
      || player.state === 'dead'
      || distToPlayer > this.loseTargetRange
      || homeDist > this.leashRange
      || this.playerInSafeZone
    ) {
      this.loseAggro();
    }
  }

  /**
   * 巢域检查：待在别的生态区会持续掉血，并把游荡目标改成自己的地盘。
   * 追击玩家时照样掉血，但不会立刻掉头，血掉够了才会撤。
   */
  updateHabitat(dt, worldMap, particleSystem) {
    if (this.homingTimer > 0) this.homingTimer -= dt;
    if (!this.homeBiome || this.homeBiome === BIOMES_CAMP || !worldMap?.getBiomeAt) return;

    const here = worldMap.getBiomeAt(this.x, this.y);
    // 营地安全区不算别人的地盘，异兽本来就进不去
    const away = here !== this.homeBiome && here !== BIOMES_CAMP;

    if (!away) {
      this.exileTimer = 0;
      this.exileTick = 0;
      return;
    }

    this.exileTimer += dt;
    // 越境后先给一秒缓冲，之后每秒扣一次
    if (this.exileTimer < 1) return;

    this.exileTick += dt;
    if (this.exileTick >= 1) {
      this.exileTick -= 1;
      const bite = Math.max(2, Math.round(this.maxHp * 0.04));
      this.hp -= bite;
      this.addDamagePopup(`-${bite}`, '#7dd3fc');
      particleSystem?.spawnFrostSparkle?.(this.x, this.y, '#7dd3fc');

      if (this.hp <= 0) {
        this.hp = 0;
        this.state = CREATURE_STATES.DEAD;
        this.stateTimer = 0;
        return;
      }
      // 血被环境啃掉一半就放弃追人，先保命
      if (this.provoked && this.hp < this.maxHp * 0.5) this.loseAggro();
    }

    // 每隔一会儿把目标重设回巢域方向
    if (this.homingTimer <= 0 && !this.provoked) {
      this.homingTimer = 1.4;
      this.wanderTarget = { x: this.spawnX, y: this.spawnY };
      if (this.state !== CREATURE_STATES.STUNNED && this.state !== CREATURE_STATES.HURT) {
        this.state = CREATURE_STATES.WANDER;
        this.stateTimer = 0;
      }
    }
  }

  /**
   * 目标被安全区或障碍挡死时，AI 会一直朝同一个方向推而走不动。
   * 位移长时间接近零就换一个目标，避免永久卡在边界上。
   */
  updateStall(dt) {
    if (this.state === CREATURE_STATES.DEAD
      || this.state === CREATURE_STATES.STUNNED
      || this.state === CREATURE_STATES.ATTACK
      || this.state === CREATURE_STATES.WINDUP) {
      this.stallTimer = 0;
      this.stallX = this.x;
      this.stallY = this.y;
      return;
    }

    const moved = Math.hypot(this.x - this.stallX, this.y - this.stallY);
    if (moved > 8) {
      this.stallTimer = 0;
      this.stallX = this.x;
      this.stallY = this.y;
      return;
    }

    // 站着发呆不算卡住，只算那些明明想走却走不掉的
    const wantsToMove = Math.hypot(this.vx, this.vy) > 12
      || this.state === CREATURE_STATES.WANDER
      || this.state === CREATURE_STATES.CHASE;
    if (!wantsToMove) {
      this.stallTimer = 0;
      return;
    }

    this.stallTimer += dt;
    if (this.stallTimer < 1.2) return;

    this.stallTimer = 0;
    this.stallX = this.x;
    this.stallY = this.y;
    this.homingTimer = 0;

    // 沿卡住方向的切线绕出去，再挑一个新目标
    const cx = this.spawnX - this.x;
    const cy = this.spawnY - this.y;
    const base = Math.hypot(cx, cy) > 1 ? Math.atan2(cy, cx) : Math.random() * Math.PI * 2;
    const side = Math.random() < 0.5 ? 1 : -1;
    const angle = base + side * (Math.PI * 0.45 + Math.random() * Math.PI * 0.3);
    const dist = 90 + Math.random() * 90;
    this.wanderTarget = { x: this.x + Math.cos(angle) * dist, y: this.y + Math.sin(angle) * dist };
    this.vx = Math.cos(angle) * (this.wanderSpeed || 40);
    this.vy = Math.sin(angle) * (this.wanderSpeed || 40);
    if (this.state === CREATURE_STATES.CHASE) this.loseAggro();
    this.state = CREATURE_STATES.WANDER;
    this.stateTimer = 0;
  }

  /**
   * 放弃仇恨，回到巢域附近游荡。
   */
  loseAggro() {
    this.provoked = false;
    this.provokeTimer = 0;
    this.activeAttackHitbox = null;

    const hostile = this.state === CREATURE_STATES.ALERT
      || this.state === CREATURE_STATES.CHASE
      || this.state === CREATURE_STATES.WINDUP
      || this.state === CREATURE_STATES.ATTACK;

    if (hostile && this.category !== 'herbivore') {
      this.enterIdle(1.0 + Math.random() * 1.5);
    }
  }

  /**
   * 记录来自玩家的攻击，开启仇恨计时。
   */
  provoke() {
    this.provoked = true;
    this.provokeTimer = this.aggroDuration;
  }

  /**
   * Enter Alert (Exclamation point trigger)
   */
  enterAlert(player, audioSystem) {
    if (!this.canEngage()) return;
    this.state = CREATURE_STATES.ALERT;
    this.stateTimer = 0;
    if (audioSystem && audioSystem.playAlert) audioSystem.playAlert();
  }

  /**
   * Enter Chase Mode
   */
  enterChase() {
    if (!this.canEngage()) {
      this.enterIdle(1.0 + Math.random() * 1.5);
      return;
    }
    this.state = CREATURE_STATES.CHASE;
    this.stateTimer = 0;
  }

  /**
   * Enter Flee Mode (Herbivores panicked running)
   */
  enterFlee(player) {
    this.state = CREATURE_STATES.CHASE; // Reuses chase speed with inverted target
    this.stateTimer = 0;
    if (player) {
      const awayAngle = Math.atan2(this.y - player.y, this.x - player.x);
      this.vx = Math.cos(awayAngle) * (this.chaseSpeed * 1.2);
      this.vy = Math.sin(awayAngle) * (this.chaseSpeed * 1.2);
      this.facingAngle = awayAngle;
    }
  }

  /**
   * Attack Windup Preparation
   */
  enterWindup(player) {
    this.state = CREATURE_STATES.WINDUP;
    this.stateTimer = 0;
  }

  /**
   * Execute Creature Attack
   */
  executeAttack(player, projectiles, particleSystem, audioSystem) {
    this.state = CREATURE_STATES.ATTACK;
    this.stateTimer = 0;

    // Melee lunge
    const lungeSpeed = 160;
    this.vx = Math.cos(this.facingAngle) * lungeSpeed;
    this.vy = Math.sin(this.facingAngle) * lungeSpeed;

    // Create Active Damage Hitbox
    this.activeAttackHitbox = {
      type: 'circle',
      x: this.x + Math.cos(this.facingAngle) * (this.radius + 12),
      y: this.y + Math.sin(this.facingAngle) * (this.radius + 12),
      radius: this.radius * 0.9,
      damage: this.damage,
      knockback: 180,
      attacker: this,
      isParriable: true
    };

    if (audioSystem && audioSystem.playMonsterBite) audioSystem.playMonsterBite();
  }

  /**
   * Take Damage Method
   */
  takeDamage(amount, sourceAngle, knockbackForce = 120, isCrit = false, isHeavy = false, attacker = null, audioSystem = null, particleSystem = null, dropsList = []) {
    if (this.state === CREATURE_STATES.DEAD) return;

    this.provoke();

    // 护甲走扣减，但保底放过四分之一的原始伤害。纯扣减会让高防御变体
    // 把轻击压到每次 1 点，血量又有成百上千，观感就是打不死。
    const armor = isHeavy ? Math.floor(this.defense * 0.3) : this.defense;
    // 破甲涂层升级会抬高保底穿透比例
    const pierceRatio = ARMOR_PIERCE_RATIO + (attacker?.armorPierceBonus || 0);
    const pierceFloor = Math.ceil(amount * Math.min(0.6, pierceRatio));
    let effectiveDmg = Math.max(pierceFloor, Math.round(amount - armor));
    if (isCrit) effectiveDmg = Math.round(effectiveDmg * 1.5);
    effectiveDmg = Math.max(1, effectiveDmg);

    this.hp -= effectiveDmg;
    this.flashWhiteTimer = 0.20;

    // Knockback
    const kFactor = 1.0 - this.knockbackResist;
    this.vx = Math.cos(sourceAngle) * (knockbackForce * kFactor);
    this.vy = Math.sin(sourceAngle) * (knockbackForce * kFactor);

    // Add Animated Damage Popup Number
    this.addDamagePopup(`-${effectiveDmg}`, isCrit ? '#f59e0b' : '#ffffff', isCrit);

    // Poise damage calculation
    this.poise -= isHeavy ? 35 : 15;
    if (this.poise <= 0) {
      this.poise = this.maxPoise;
      this.stun(this.stunDuration);
      this.addDamagePopup('STAGGER!', '#38bdf8', false, true);
    } else if (this.state !== CREATURE_STATES.STUNNED && this.state !== CREATURE_STATES.WINDUP) {
      this.state = CREATURE_STATES.HURT;
      this.stateTimer = 0;
    }

    // Audio & Particle FX
    if (audioSystem && audioSystem.playMonsterHurt) audioSystem.playMonsterHurt();
    if (particleSystem && particleSystem.spawnHitSparks) {
      particleSystem.spawnHitSparks(this.x, this.y, sourceAngle, this.themeColor);
    }

    // Death check
    if (this.hp <= 0) {
      this.die(dropsList, particleSystem, audioSystem);
    }
  }

  /**
   * Stun Creature (e.g. from Perfect Parry or Posture Break)
   */
  stun(duration = 2.0) {
    this.state = CREATURE_STATES.STUNNED;
    this.stateTimer = 0;
    this.stunDuration = duration;
    this.activeAttackHitbox = null;
  }

  /**
   * Creature Death & Ingredient Loot Spawning
   */
  die(dropsList = [], particleSystem = null, audioSystem = null) {
    this.state = CREATURE_STATES.DEAD;
    this.hp = 0;
    this.activeAttackHitbox = null;

    if (audioSystem && audioSystem.playMonsterDeath) audioSystem.playMonsterDeath();
    if (particleSystem && particleSystem.spawnCreatureDeathBurst) {
      particleSystem.spawnCreatureDeathBurst(this.x, this.y, this.themeColor);
    }

    // Roll Drops Table
    if (this.drops && this.drops.length > 0 && dropsList) {
      for (const dropItem of this.drops) {
        if (Math.random() <= (dropItem.chance ?? 1.0)) {
          const count = Math.floor(Math.random() * ((dropItem.max || 1) - (dropItem.min || 1) + 1)) + (dropItem.min || 1);
          for (let i = 0; i < count; i++) {
            const scatterAngle = Math.random() * Math.PI * 2;
            const scatterDist = 18 + Math.random() * 32;
            dropsList.push({
              id: dropItem.id,
              name: dropItem.name,
              icon: dropItem.icon || '🥩',
              x: this.x + Math.cos(scatterAngle) * scatterDist,
              y: this.y + Math.sin(scatterAngle) * scatterDist,
              vx: Math.cos(scatterAngle) * 60,
              vy: Math.sin(scatterAngle) * 60,
              life: 45.0, // persists 45s on ground
              bobOffset: Math.random() * 10
            });
          }
        }
      }
    }
  }

  /**
   * Add Floating Damage Number
   */
  addDamagePopup(text, color = '#ffffff', isCrit = false, isStun = false) {
    this.damagePopups.push({
      text,
      x: this.x + (Math.random() * 16 - 8),
      y: this.y - this.radius - 10,
      vy: isCrit ? -110 : -75,
      life: 0.85,
      maxLife: 0.85,
      color,
      isCrit,
      isStun
    });
  }

  /**
   * Status Effect Manager (Burn, Poison, Freeze)
   */
  applyStatus(type, { duration = 4.0, dps = 5, slowMult = 0.5 }) {
    this.statusEffects.set(type, {
      duration,
      dps,
      slowMult,
      timer: duration,
      tickTimer: 0
    });
  }

  updateStatusEffects(dt, particleSystem) {
    for (const [type, effect] of this.statusEffects.entries()) {
      effect.timer -= dt;
      effect.tickTimer += dt;

      if (effect.tickTimer >= 0.5) {
        effect.tickTimer = 0;
        const tickDmg = Math.round(effect.dps * 0.5);
        this.hp -= tickDmg;
        this.addDamagePopup(`-${tickDmg}`, type === 'burn' ? '#ef4444' : '#10b981');
        if (this.hp <= 0) this.die();
      }

      if (effect.timer <= 0) {
        this.statusEffects.delete(type);
      }
    }
  }

  /**
   * Physics & Obstacle Collision
   */
  resolvePhysics(dt, worldMap, obstacles) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    if (obstacles && obstacles.length > 0) {
      for (const obs of obstacles) {
        if (obs.noCollide) continue;
        if (obs.type === 'circle') {
          const dx = this.x - obs.x;
          const dy = this.y - obs.y;
          const dist = Math.hypot(dx, dy);
          const minDist = this.radius + (Number.isFinite(obs.collisionRadius) ? obs.collisionRadius : obs.radius);
          if (dist < minDist && dist > 0.001) {
            const push = minDist - dist;
            this.x += (dx / dist) * push;
            this.y += (dy / dist) * push;
          }
        }
      }
    }
  }

  /**
   * Get Hurtbox
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
   * Canvas 2D Procedural Rendering
   */
  draw(ctx, camera, player = null) {
    const screenX = this.x - (camera ? camera.x : 0);
    const screenY = this.y - (camera ? camera.y : 0);

    ctx.save();
    ctx.globalAlpha = this.deathFade;

    // 1. Drop Shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + this.radius * 0.8, this.radius * 1.05, this.radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Custom Render or Default Creature Body
    ctx.save();
    ctx.translate(screenX, screenY);

    // 倒地时压扁并沉下去，比单纯淡出更像"被打倒"
    if (this.state === CREATURE_STATES.DEAD) {
      const collapse = 1 - this.deathFade;
      ctx.translate(0, collapse * this.radius * 0.42);
      ctx.scale(1 + collapse * 0.22, 1 - collapse * 0.46);
    }

    const spriteFilter = this.spriteFilter && this.spriteFilter !== 'none' ? this.spriteFilter : '';
    const flashFilter = this.flashWhiteTimer > 0 ? ' brightness(220%)' : '';
    const tint = `${spriteFilter}${flashFilter}`.trim();

    const typeKey = this.typeKey || this.id;
    const monsterImg = assets.getImage(typeKey);
    const isFacingLeft = Math.cos(this.facingAngle) < 0;

    if (monsterImg && !this.preferVector) {
      // 变体染色与闪白走预烘焙缓存，避免每帧触发 canvas 滤镜通道。
      const sprite = getFilteredSprite(monsterImg, tint) || monsterImg;
      ctx.save();
      if (isFacingLeft) {
        ctx.scale(-1, 1);
      }
      const bob = (this.state === CREATURE_STATES.WANDER || this.state === CREATURE_STATES.CHASE)
        ? Math.sin(this.walkCycle) * 3
        : Math.sin(this.animTime * 4) * 1.5;
      const spriteW = this.radius * 2.8;
      const spriteH = this.radius * 2.8;
      ctx.drawImage(sprite, -spriteW / 2, -spriteH / 2 + bob, spriteW, spriteH);
      ctx.restore();
    } else {
      // 矢量生物不走 ctx.filter：变体染色在生成时已经烤进配色，
      // 受击闪白改用一层白色叠加，避免每帧触发画布滤镜通道。
      if (this.customRender && typeof this.customRender === 'function') {
        if (this.sideView && isFacingLeft) {
          ctx.save();
          ctx.scale(-1, 1);
          this.customRender(this, ctx, screenX, screenY);
          ctx.restore();
        } else {
          this.customRender(this, ctx, screenX, screenY);
        }
      } else {
        this.drawDefaultCreature(ctx);
      }
      if (this.flashWhiteTimer > 0) {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 1.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    ctx.restore();

    // 3. Overhead Alert / Stun / Warning Icons
    this.drawStateIndicators(ctx, screenX, screenY);

    // 4. Overhead HP Bar
    this.drawHPBar(ctx, screenX, screenY);

    // 4b. 靠近时浮出名牌，非 boss 也能一眼认出是什么、要不要破甲
    if (player && this.state !== CREATURE_STATES.DEAD) {
      const dist = Math.hypot(player.x - this.x, player.y - this.y);
      if (dist < 230) this.drawNameplate(ctx, screenX, screenY, Math.min(1, (230 - dist) / 60));
    }

    // 5. Floating Damage Numbers
    this.drawDamagePopups(ctx, camera);

    ctx.restore();
  }

  /**
   * Default Base Creature Rendering
   */
  drawDefaultCreature(ctx) {
    const bob = Math.sin(this.animTime * 4) * 2;

    // Body
    ctx.fillStyle = this.themeColor;
    ctx.beginPath();
    ctx.arc(0, bob, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Spines / Plates
    ctx.fillStyle = this.accentColor;
    ctx.beginPath();
    ctx.arc(0, bob - this.radius * 0.3, this.radius * 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    const eyeOffsetX = Math.cos(this.facingAngle) * (this.radius * 0.45);
    const eyeOffsetY = Math.sin(this.facingAngle) * (this.radius * 0.45) + bob;
    ctx.fillStyle = this.eyeColor;
    ctx.beginPath();
    ctx.arc(eyeOffsetX, eyeOffsetY, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  /** Draw state indicators and the red attack telegraph. */
  drawStateIndicators(ctx, screenX, screenY) {
    if (this.state === CREATURE_STATES.ALERT) {
      ctx.save();
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = '#ef4444';
      ctx.shadowColor = '#f87171';
      ctx.shadowBlur = 8;
      ctx.textAlign = 'center';
      ctx.fillText('!', screenX, screenY - this.radius - 16);
      ctx.restore();
    } else if (this.state === CREATURE_STATES.STUNNED) {
      drawStunGlyph(ctx, screenX, screenY - this.radius - 12, 12, '#f0c77c', this.animTime * 5);
    } else if (this.state === CREATURE_STATES.WINDUP) {
      // Red Danger Circle Telegraph
      ctx.save();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(screenX, screenY, this.attackRange, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  /**
   * Draw Creature Overhead HP Bar & Name
   */
  drawHPBar(ctx, screenX, screenY) {
    if (this.state === CREATURE_STATES.DEAD) return;

    const barWidth = Math.max(34, this.radius * 1.8);
    const barHeight = 4.5;
    const barX = screenX - barWidth / 2;
    const barY = screenY - this.radius - 12;

    // Background track
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

    // HP Fill
    const fillPct = Math.max(0, this.hp / this.maxHp);
    ctx.fillStyle = fillPct > 0.4 ? '#10b981' : fillPct > 0.2 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(barX, barY, barWidth * fillPct, barHeight);

    // Boss or Elite Header
    if (this.category === 'boss') {
      ctx.save();
      ctx.font = 'bold 11px sans-serif';
      ctx.fillStyle = '#fbbf24';
      ctx.textAlign = 'center';
      const label = String(this.name || 'ELITE');
      const labelWidth = ctx.measureText(label).width;
      drawBossGlyph(ctx, screenX - labelWidth / 2 - 9, barY - 8, 10, '#fbbf24');
      ctx.fillText(label, screenX + 5, barY - 4);
      ctx.restore();
    }
  }

  /**
   * 悬浮名牌：物种名 + 威胁提示。boss 头顶已有专属标题，这里跳过。
   */
  drawNameplate(ctx, screenX, screenY, fade) {
    if (this.category === 'boss') return;

    const label = String(this.name || '异兽').replace(/\s*\(.*\)$/, '');
    // 护甲高到轻击会被弹开时，直接把破甲提示写在名字下面
    const needBreak = (this.defense || 0) >= 12;
    const sub = needBreak
      ? `护甲 ${this.defense} · 按 H 破甲`
      : (this.category === 'herbivore' ? '温和 · 不主动攻击' : `攻击 ${Math.round(this.damage || 0)}`);

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 11px "PingFang SC", "Microsoft YaHei", sans-serif';
    const nameW = ctx.measureText(label).width;
    ctx.font = '9px "PingFang SC", sans-serif';
    const subW = ctx.measureText(sub).width;

    const w = Math.max(nameW, subW) + 18;
    const h = 30;
    const bx = screenX - w / 2;
    // 贴到画面顶边时改挂到脚下，否则名牌会被裁掉
    const above = screenY - this.radius - 26 - h;
    const below = screenY + this.radius + 26;
    const flipped = above < 6;
    const by = flipped ? below : above;

    ctx.fillStyle = 'rgba(8, 18, 26, 0.86)';
    ctx.strokeStyle = needBreak ? 'rgba(251, 191, 36, 0.8)' : 'rgba(165, 203, 207, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, w, h, 5);
    else ctx.rect(bx, by, w, h);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = 'bold 11px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#f5efdf';
    ctx.fillText(label, screenX, by + 10);

    ctx.font = '9px "PingFang SC", sans-serif';
    ctx.fillStyle = needBreak ? '#fbbf24' : (this.category === 'herbivore' ? '#86efac' : '#94a3b8');
    ctx.fillText(sub, screenX, by + 22);

    // 指向本体的小尖角，名牌翻到下面时尖角也翻过来
    const tipBase = flipped ? by : by + h;
    const tipY = flipped ? by - 5 : by + h + 5;
    ctx.fillStyle = 'rgba(8, 18, 26, 0.86)';
    ctx.beginPath();
    ctx.moveTo(screenX - 4, tipBase);
    ctx.lineTo(screenX, tipY);
    ctx.lineTo(screenX + 4, tipBase);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw Floating Bouncing Damage Popups
   */
  drawDamagePopups(ctx, camera) {
    for (const pop of this.damagePopups) {
      const sx = pop.x - (camera ? camera.x : 0);
      const sy = pop.y - (camera ? camera.y : 0);
      const remain = Math.max(0, Math.min(1, pop.life / pop.maxLife));
      const age = 1 - remain;

      // 弹出时先快速放大回弹，末段才淡出，读起来更有打击感
      const popIn = age < 0.16 ? age / 0.16 : 1;
      const overshoot = 1 + Math.sin(Math.min(1, popIn) * Math.PI) * 0.28;
      const scale = (pop.isCrit ? 1.18 : 1) * overshoot;
      const alpha = remain > 0.42 ? 1 : remain / 0.42;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(sx, sy);
      ctx.scale(scale, scale);
      ctx.font = pop.isCrit ? 'bold 16px sans-serif' : 'bold 13px sans-serif';
      ctx.fillStyle = pop.color;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
      ctx.shadowBlur = 4;
      ctx.textAlign = 'center';
      ctx.fillText(pop.text, 0, 0);
      ctx.restore();
    }
  }
}
