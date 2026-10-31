/**
 * Galaxy Hunter: Gourmet Odyssey
 * Monster Types & Alien Wildlife Catalog
 * File: src/entities/monster_types.js
 */

import { Creature, CREATURE_STATES } from './creature.js';
import { EXTRA_MONSTERS } from './fauna_extra.js';

// 大型生物的躯干、头骨这些不随动画变化的层，按物种与配色烘焙一次
const BAKE_SCALE = 2;
const bakedBodies = new Map();

/**
 * 取得预烘焙的静态层。span 是以怪物半径为单位的绘制范围，
 * 回调在一个原点居中、单位与实时绘制一致的 context 里作画。
 */
function bakedLayer(self, tag, span, draw) {
  if (typeof document === 'undefined') return null;

  const r = self.radius;
  const key = `${self.typeKey || self.id}|${tag}|${self.themeColor}|${self.accentColor}|${self.eyeColor}|${r.toFixed(1)}`;
  const hit = bakedBodies.get(key);
  if (hit) return hit;

  const half = r * span;
  const size = Math.ceil(half * 2 * BAKE_SCALE);
  if (!(size > 0) || size > 2048) return null;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const bake = canvas.getContext('2d');
  if (!bake) return null;

  bake.scale(BAKE_SCALE, BAKE_SCALE);
  bake.translate(half, half);
  bake.lineJoin = 'round';
  bake.lineCap = 'round';
  draw(bake);

  const layer = { canvas, half };
  bakedBodies.set(key, layer);
  return layer;
}

/** 把烘焙好的静态层贴回世界坐标，原点对齐怪物中心。 */
function drawBaked(ctx, layer) {
  if (!layer) return;
  ctx.drawImage(layer.canvas, -layer.half, -layer.half, layer.half * 2, layer.half * 2);
}

export const MONSTER_TYPES = {
  // 1. Spore Bunny (Docile Herbivore)
  SPORE_BUNNY: {
    id: 'spore_bunny',
    name: '孢子电兔 (Spore Bunny)',
    species: 'Lepus Lumina',
    category: 'herbivore',
    biome: 'shroom_forest',
    icon: '🐰✨',
    hp: 45,
    defense: 0,
    speed: 130,
    chaseSpeed: 230, // Panicked sprint speed
    wanderSpeed: 60,
    radius: 14,
    poise: 20,
    sightRange: 190,
    loseTargetRange: 320,
    knockbackResist: 0.1,
    contactDamage: 0,
    damage: 0,
    themeColor: '#4ade80',
    accentColor: '#86efac',
    eyeColor: '#f43f5e',
    drops: [
      { id: 'electro_hare_leg', name: '孢子电兔后腿', icon: '🥩', chance: 1.0, min: 1, max: 2 },
      { id: 'spore_herb', name: '荧光孢子香草', icon: '✨', chance: 0.75, min: 1, max: 3 }
    ],
    // Custom AI: Grazing and Panicked Hopping Away
    customAi: (self, dt, player, projectiles, particleSystem, audioSystem) => {
      const distToPlayer = player ? Math.hypot(player.x - self.x, player.y - self.y) : Infinity;

      switch (self.state) {
        case CREATURE_STATES.IDLE:
          self.vx *= 0.8;
          self.vy *= 0.8;
          if (player && player.state !== 'dead' && distToPlayer <= self.sightRange) {
            self.enterAlert(player, audioSystem);
          } else if (self.stateTimer >= self.stateDuration) {
            self.enterWander();
          }
          break;

        case CREATURE_STATES.WANDER:
          self.walkCycle += dt * 9;
          const dxW = self.wanderTarget.x - self.x;
          const dyW = self.wanderTarget.y - self.y;
          const distW = Math.hypot(dxW, dyW);
          if (distW > 8) {
            self.vx = (dxW / distW) * self.wanderSpeed;
            self.vy = (dyW / distW) * self.wanderSpeed;
          } else {
            self.enterIdle(1.0 + Math.random() * 2.0);
          }
          if (player && player.state !== 'dead' && distToPlayer <= self.sightRange) {
            self.enterAlert(player, audioSystem);
          }
          break;

        case CREATURE_STATES.ALERT:
          self.vx *= 0.6;
          self.vy *= 0.6;
          if (self.stateTimer >= self.alertDuration) {
            self.state = CREATURE_STATES.CHASE; // Fleeing
          }
          break;

        case CREATURE_STATES.CHASE: // Fleeing mode for herbivore
          self.walkCycle += dt * 18;
          if (!player || player.state === 'dead' || distToPlayer > self.loseTargetRange) {
            self.enterIdle(1.5);
            break;
          }

          // Run in exact opposite direction
          const awayAngle = Math.atan2(self.y - player.y, self.x - player.x);
          self.vx = Math.cos(awayAngle) * self.chaseSpeed;
          self.vy = Math.sin(awayAngle) * self.chaseSpeed;
          self.facingAngle = awayAngle;

          // Puff of spores while running
          if (particleSystem && Math.random() < 0.25) {
            particleSystem.spawnSporePuff(self.x, self.y, '#86efac');
          }
          break;

        case CREATURE_STATES.HURT:
        case CREATURE_STATES.STUNNED:
          self.vx *= 0.85;
          self.vy *= 0.85;
          if (self.stateTimer >= (self.state === CREATURE_STATES.STUNNED ? self.stunDuration : 0.2)) {
            self.state = CREATURE_STATES.CHASE; // Immediate panic run
          }
          break;
      }
    },
    // Custom Procedural Render
    customRender: (self, ctx) => {
      const hopY = Math.abs(Math.sin(self.walkCycle)) * -6;

      // Bunny Body (Fluffy & Glowing)
      ctx.fillStyle = '#bbf7d0';
      ctx.shadowColor = '#4ade80';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.ellipse(0, hopY, self.radius, self.radius * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Long Antenna Ears
      const earAngle = Math.sin(self.animTime * 6) * 0.2;
      ctx.fillStyle = '#86efac';
      ctx.beginPath();
      ctx.ellipse(-4, hopY - 14, 3, 9, -0.2 + earAngle, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(4, hopY - 14, 3, 9, 0.2 + earAngle, 0, Math.PI * 2);
      ctx.fill();

      // Glowing Ear Tips
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(-5, hopY - 21, 2.5, 0, Math.PI * 2);
      ctx.arc(5, hopY - 21, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Cute Eyes
      const eyeX = Math.cos(self.facingAngle) * 5;
      const eyeY = Math.sin(self.facingAngle) * 3 + hopY - 2;
      ctx.fillStyle = '#e11d48';
      ctx.beginPath();
      ctx.arc(eyeX, eyeY, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Tail
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-Math.cos(self.facingAngle) * (self.radius - 2), hopY + 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // 2. Venom Lizard (Stealth Stalker & Poison Spitter)
  VENOM_LIZARD: {
    id: 'venom_lizard',
    name: '剧毒刺壳巨蜥 (Venom Lizard)',
    species: 'Varanus Venenum',
    category: 'predator',
    biome: 'shroom_forest',
    icon: '🦎🧪',
    hp: 125,
    defense: 3,
    speed: 105,
    chaseSpeed: 165,
    wanderSpeed: 50,
    radius: 20,
    poise: 45,
    sightRange: 240,
    attackRange: 160, // ranged spit range
    loseTargetRange: 380,
    knockbackResist: 0.35,
    contactDamage: 12,
    damage: 18,
    themeColor: '#84cc16',
    accentColor: '#a855f7',
    eyeColor: '#facc15',
    drops: [
      { id: 'quantum_meat', name: '量子恐龙肉排', icon: '🥩', chance: 1.0, min: 1, max: 2 },
      { id: 'plasma_tentacle', name: '等离子巨鱿触手', icon: '🧪', chance: 0.75, min: 1, max: 2 }
    ],
    // Custom AI: Camouflage stalking + Poison Spit Projectile
    customAi: (self, dt, player, projectiles, particleSystem, audioSystem) => {
      const distToPlayer = player ? Math.hypot(player.x - self.x, player.y - self.y) : Infinity;

      // Track Camouflage Stealth Alpha
      if (self.state === CREATURE_STATES.IDLE || self.state === CREATURE_STATES.WANDER) {
        self.stealthAlpha = Math.max(0.35, (self.stealthAlpha || 1.0) - dt * 1.5);
      } else {
        self.stealthAlpha = Math.min(1.0, (self.stealthAlpha || 0.35) + dt * 4.0);
      }

      switch (self.state) {
        case CREATURE_STATES.IDLE:
          self.vx *= 0.8;
          self.vy *= 0.8;
          if (player && player.state !== 'dead' && distToPlayer <= self.sightRange) {
            self.enterAlert(player, audioSystem);
          } else if (self.stateTimer >= self.stateDuration) {
            self.enterWander();
          }
          break;

        case CREATURE_STATES.WANDER:
          self.walkCycle += dt * 6;
          const dxW = self.wanderTarget.x - self.x;
          const dyW = self.wanderTarget.y - self.y;
          const distW = Math.hypot(dxW, dyW);
          if (distW > 8) {
            self.vx = (dxW / distW) * self.wanderSpeed;
            self.vy = (dyW / distW) * self.wanderSpeed;
          } else {
            self.enterIdle(1.5 + Math.random() * 2.0);
          }
          if (player && player.state !== 'dead' && distToPlayer <= self.sightRange) {
            self.enterAlert(player, audioSystem);
          }
          break;

        case CREATURE_STATES.ALERT:
          self.vx *= 0.7;
          self.vy *= 0.7;
          if (player) self.facingAngle = Math.atan2(player.y - self.y, player.x - self.x);
          if (self.stateTimer >= self.alertDuration) {
            self.enterChase();
          }
          break;

        case CREATURE_STATES.CHASE:
          self.walkCycle += dt * 12;
          if (!player || player.state === 'dead' || distToPlayer > self.loseTargetRange) {
            self.enterIdle(2.0);
            break;
          }

          const dxC = player.x - self.x;
          const dyC = player.y - self.y;
          const distC = Math.hypot(dxC, dyC);
          self.facingAngle = Math.atan2(dyC, dxC);

          // If in range and cooldown ready, start spitting venom or melee bite
          if (distC <= self.attackRange && self.attackCooldownTimer <= 0) {
            self.state = CREATURE_STATES.WINDUP;
            self.stateTimer = 0;
            self.windupDuration = distC < 50 ? 0.35 : 0.55;
            self.isRangedSpit = distC >= 50;
          } else if (distC <= self.attackRange) {
            // 已经贴上但还在冷却：横向绕步，避免保留冲刺速度冲过头再折返
            if (!self.strafeSide) self.strafeSide = Math.random() < 0.5 ? 1 : -1;
            const sp = self.wanderSpeed || self.speed * 0.5;
            self.vx = -(dyC / distC) * sp * self.strafeSide;
            self.vy = (dxC / distC) * sp * self.strafeSide;
          } else {
            self.vx = (dxC / distC) * self.chaseSpeed;
            self.vy = (dyC / distC) * self.chaseSpeed;
          }
          break;

        case CREATURE_STATES.WINDUP:
          self.vx *= 0.5;
          self.vy *= 0.5;
          if (player) self.facingAngle = Math.atan2(player.y - self.y, player.x - self.x);

          if (particleSystem && Math.random() < 0.3) {
            particleSystem.spawnVenomDrip(self.x + Math.cos(self.facingAngle) * 16, self.y + Math.sin(self.facingAngle) * 16);
          }

          if (self.stateTimer >= self.windupDuration) {
            self.state = CREATURE_STATES.ATTACK;
            self.stateTimer = 0;
            self.attackCooldownTimer = self.attackCooldown;

            if (self.isRangedSpit && projectiles) {
              // Fire Venom Spit Projectile
              projectiles.push({
                type: 'venom_spit',
                x: self.x + Math.cos(self.facingAngle) * 18,
                y: self.y + Math.sin(self.facingAngle) * 18,
                vx: Math.cos(self.facingAngle) * 220,
                vy: Math.sin(self.facingAngle) * 220,
                radius: 7,
                damage: 16,
                isParriable: true,
                attacker: self,
                life: 2.2,
                color: '#a855f7'
              });
              if (audioSystem && audioSystem.playSpit) audioSystem.playSpit();
            } else {
              // Melee tail whip / bite
              self.activeAttackHitbox = {
                type: 'circle',
                x: self.x + Math.cos(self.facingAngle) * (self.radius + 14),
                y: self.y + Math.sin(self.facingAngle) * (self.radius + 14),
                radius: self.radius * 1.1,
                damage: self.damage,
                knockback: 160,
                attacker: self,
                isParriable: true
              };
              if (audioSystem && audioSystem.playMonsterBite) audioSystem.playMonsterBite();
            }
          }
          break;

        case CREATURE_STATES.ATTACK:
          if (self.stateTimer >= 0.3) {
            self.activeAttackHitbox = null;
            self.enterChase();
          }
          break;

        case CREATURE_STATES.HURT:
        case CREATURE_STATES.STUNNED:
          self.vx *= 0.85;
          self.vy *= 0.85;
          if (self.stateTimer >= (self.state === CREATURE_STATES.STUNNED ? self.stunDuration : 0.25)) {
            self.enterChase();
          }
          break;
      }
    },
    // Custom Procedural Render
    customRender: (self, ctx) => {
      ctx.globalAlpha *= self.stealthAlpha || 1.0;
      const wiggle = Math.sin(self.walkCycle) * 0.15;

      // Reptile Body
      ctx.save();
      ctx.rotate(self.facingAngle);

      // Barbed Tail
      ctx.fillStyle = '#65a30d';
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.quadraticCurveTo(-26 + Math.sin(self.animTime * 8) * 4, 8 * wiggle, -34, 0);
      ctx.lineTo(-12, 4);
      ctx.closePath();
      ctx.fill();

      // Main Torso
      ctx.fillStyle = '#84cc16';
      ctx.beginPath();
      ctx.ellipse(0, 0, self.radius, self.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Spiny Armored Plates
      ctx.fillStyle = '#4d7c0f';
      for (let i = -10; i <= 10; i += 7) {
        ctx.beginPath();
        ctx.moveTo(i, -self.radius * 0.7);
        ctx.lineTo(i + 3, -self.radius * 1.1);
        ctx.lineTo(i + 6, -self.radius * 0.7);
        ctx.fill();
      }

      // Glowing Venom Sacs (Purple Bio-Chemicals)
      ctx.fillStyle = '#a855f7';
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(-2, -4, 4, 0, Math.PI * 2);
      ctx.arc(6, -4, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Sharp Slit Eyes
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.ellipse(12, -4, 3, 1.5, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.fillRect(12, -5, 1, 3);

      ctx.restore();
    }
  },

  // 3. Crystal Golem (Armored Tank & Shockwave Slammer)
  CRYSTAL_GOLEM: {
    id: 'crystal_golem',
    name: '脉冲晶甲巨灵 (Crystal Golem)',
    species: 'Lithos Electra',
    category: 'armored',
    biome: 'crystalline_rift',
    icon: '🗿⚡',
    hp: 190,
    defense: 16, // Heavy Armor (deflects normal light hits)
    speed: 75,
    chaseSpeed: 110,
    wanderSpeed: 45,
    radius: 28,
    poise: 90,
    sightRange: 210,
    attackRange: 70,
    loseTargetRange: 350,
    knockbackResist: 0.85, // Almost immune to knockback
    contactDamage: 18,
    damage: 32,
    themeColor: '#06b6d4',
    accentColor: '#38bdf8',
    eyeColor: '#e0e7ff',
    drops: [
      { id: 'pulsar_crystal_salt', name: '脉冲星高导晶盐', icon: '🧂', chance: 1.0, min: 2, max: 4 },
      { id: 'thunder_wing', name: '雷霆飞龙薄翼肉', icon: '⚡', chance: 0.65, min: 1, max: 2 },
      { id: 'crystal_bloom', name: '高维星核晶簇花', icon: '💎', chance: 0.4, min: 1, max: 1 }
    ],
    // Custom AI: Heavy Ground Slam Shockwaves
    customAi: (self, dt, player, projectiles, particleSystem, audioSystem) => {
      const distToPlayer = player ? Math.hypot(player.x - self.x, player.y - self.y) : Infinity;

      switch (self.state) {
        case CREATURE_STATES.IDLE:
          self.vx *= 0.8;
          self.vy *= 0.8;
          if (player && player.state !== 'dead' && distToPlayer <= self.sightRange) {
            self.enterAlert(player, audioSystem);
          } else if (self.stateTimer >= self.stateDuration) {
            self.enterWander();
          }
          break;

        case CREATURE_STATES.WANDER:
          self.walkCycle += dt * 5;
          const dxW = self.wanderTarget.x - self.x;
          const dyW = self.wanderTarget.y - self.y;
          const distW = Math.hypot(dxW, dyW);
          if (distW > 8) {
            self.vx = (dxW / distW) * self.wanderSpeed;
            self.vy = (dyW / distW) * self.wanderSpeed;
          } else {
            self.enterIdle(2.0 + Math.random() * 2.0);
          }
          if (player && player.state !== 'dead' && distToPlayer <= self.sightRange) {
            self.enterAlert(player, audioSystem);
          }
          break;

        case CREATURE_STATES.ALERT:
          self.vx *= 0.6;
          self.vy *= 0.6;
          if (self.stateTimer >= self.alertDuration) self.enterChase();
          break;

        case CREATURE_STATES.CHASE:
          self.walkCycle += dt * 8;
          if (!player || player.state === 'dead' || distToPlayer > self.loseTargetRange) {
            self.enterIdle(2.5);
            break;
          }

          const dxC = player.x - self.x;
          const dyC = player.y - self.y;
          const distC = Math.hypot(dxC, dyC);
          self.facingAngle = Math.atan2(dyC, dxC);

          if (distC <= self.attackRange && self.attackCooldownTimer <= 0) {
            self.state = CREATURE_STATES.WINDUP;
            self.stateTimer = 0;
            self.windupDuration = 0.65; // Long windup = perfect parry reward!
          } else if (distC <= self.attackRange) {
            // 已经贴上但还在冷却：横向绕步，避免保留冲刺速度冲过头再折返
            if (!self.strafeSide) self.strafeSide = Math.random() < 0.5 ? 1 : -1;
            const sp = self.wanderSpeed || self.speed * 0.5;
            self.vx = -(dyC / distC) * sp * self.strafeSide;
            self.vy = (dxC / distC) * sp * self.strafeSide;
          } else {
            self.vx = (dxC / distC) * self.chaseSpeed;
            self.vy = (dyC / distC) * self.chaseSpeed;
          }
          break;

        case CREATURE_STATES.WINDUP:
          self.vx *= 0.4;
          self.vy *= 0.4;

          // Charge up energy crystals
          if (particleSystem && Math.random() < 0.35) {
            particleSystem.spawnChargeSparkles(self.x, self.y - 12, '#38bdf8');
          }

          if (self.stateTimer >= self.windupDuration) {
            self.state = CREATURE_STATES.ATTACK;
            self.stateTimer = 0;
            self.attackCooldownTimer = 2.4;

            // Ground Slam Shockwave Ring Creation
            if (projectiles) {
              projectiles.push({
                type: 'shockwave',
                x: self.x,
                y: self.y,
                radius: 18,
                maxRadius: 85,
                growSpeed: 160,
                damage: 28,
                knockback: 260,
                isParriable: true,
                attacker: self,
                life: 0.55,
                color: '#06b6d4'
              });
            }

            if (audioSystem && audioSystem.playHeavySmash) audioSystem.playHeavySmash();
            if (particleSystem && particleSystem.spawnShockwave) {
              particleSystem.spawnShockwave(self.x, self.y, 85, '#06b6d4');
            }
          }
          break;

        case CREATURE_STATES.ATTACK:
          if (self.stateTimer >= 0.4) {
            self.enterChase();
          }
          break;

        case CREATURE_STATES.HURT:
        case CREATURE_STATES.STUNNED:
          self.vx *= 0.8;
          self.vy *= 0.8;
          if (self.stateTimer >= (self.state === CREATURE_STATES.STUNNED ? self.stunDuration : 0.2)) {
            self.enterChase();
          }
          break;
      }
    },
    // Custom Procedural Render
    customRender: (self, ctx) => {
      const bob = Math.sin(self.walkCycle) * 2.5;

      // Heavy Geo-Stone Body
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(0, bob, self.radius, 0, Math.PI * 2);
      ctx.fill();

      // Crystalline Armor Plates
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.moveTo(-18, bob - 14);
      ctx.lineTo(0, bob - 28);
      ctx.lineTo(18, bob - 14);
      ctx.lineTo(12, bob + 10);
      ctx.lineTo(-12, bob + 10);
      ctx.closePath();
      ctx.fill();

      // Floating Shoulder Crystals
      const float1 = Math.sin(self.animTime * 4) * 4;
      const float2 = Math.cos(self.animTime * 4) * 4;

      ctx.fillStyle = '#38bdf8';
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 10;

      // Left floating crystal
      ctx.beginPath();
      ctx.moveTo(-28, bob - 10 + float1);
      ctx.lineTo(-22, bob - 24 + float1);
      ctx.lineTo(-16, bob - 10 + float1);
      ctx.lineTo(-22, bob + 2 + float1);
      ctx.closePath();
      ctx.fill();

      // Right floating crystal
      ctx.beginPath();
      ctx.moveTo(28, bob - 10 + float2);
      ctx.lineTo(22, bob - 24 + float2);
      ctx.lineTo(16, bob - 10 + float2);
      ctx.lineTo(22, bob + 2 + float2);
      ctx.closePath();
      ctx.fill();

      // Core Heart (Pulsing Cyan Light)
      const corePulse = 0.8 + Math.sin(self.animTime * 6) * 0.2;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, bob - 2, 6 * corePulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  },

  // 4. Magma Wyrm (Boss/Elite Predator & Flame Breather)
  MAGMA_WYRM: {
    id: 'magma_wyrm',
    name: '炎火霸王熔螈 (Magma Wyrm)',
    species: 'Draco Vulcanis',
    category: 'boss',
    biome: 'magma_springs',
    icon: '🐉🔥',
    hp: 260,
    defense: 20,
    speed: 95,
    chaseSpeed: 180,
    wanderSpeed: 55,
    radius: 38,
    poise: 160,
    sightRange: 280,
    attackRange: 220,
    loseTargetRange: 460,
    knockbackResist: 0.95,
    contactDamage: 24,
    damage: 38,
    themeColor: '#ef4444',
    accentColor: '#f97316',
    eyeColor: '#fef08a',
    drops: [
      { id: 'magma_tail', name: '熔岩巨蜥炙尾肉', icon: '🥩🔥', chance: 1.0, min: 1, max: 2 },
      { id: 'sunfire_fruit', name: '地热炽阳炎果', icon: '🌋', chance: 0.7, min: 1, max: 2 },
      { id: 'void_wyrm_meat', name: '虚空神龙脊髓肉', icon: '🐉', chance: 0.18, min: 1, max: 1 }
    ],
    // Custom AI: Charge Dash + Fire Breath Cone Attack
    customAi: (self, dt, player, projectiles, particleSystem, audioSystem) => {
      const distToPlayer = player ? Math.hypot(player.x - self.x, player.y - self.y) : Infinity;

      switch (self.state) {
        case CREATURE_STATES.IDLE:
          self.vx *= 0.8;
          self.vy *= 0.8;
          if (player && player.state !== 'dead' && distToPlayer <= self.sightRange) {
            self.enterAlert(player, audioSystem);
          } else if (self.stateTimer >= self.stateDuration) {
            self.enterWander();
          }
          break;

        case CREATURE_STATES.WANDER:
          self.walkCycle += dt * 6;
          const dxW = self.wanderTarget.x - self.x;
          const dyW = self.wanderTarget.y - self.y;
          const distW = Math.hypot(dxW, dyW);
          if (distW > 12) {
            self.vx = (dxW / distW) * self.wanderSpeed;
            self.vy = (dyW / distW) * self.wanderSpeed;
          } else {
            self.enterIdle(1.5 + Math.random() * 2.0);
          }
          if (player && player.state !== 'dead' && distToPlayer <= self.sightRange) {
            self.enterAlert(player, audioSystem);
          }
          break;

        case CREATURE_STATES.ALERT:
          self.vx *= 0.6;
          self.vy *= 0.6;
          if (self.stateTimer >= self.alertDuration) self.enterChase();
          break;

        case CREATURE_STATES.CHASE:
          self.walkCycle += dt * 10;
          if (!player || player.state === 'dead' || distToPlayer > self.loseTargetRange) {
            self.enterIdle(2.0);
            break;
          }

          const dxC = player.x - self.x;
          const dyC = player.y - self.y;
          const distC = Math.hypot(dxC, dyC);
          self.facingAngle = Math.atan2(dyC, dxC);

          // Alternate between Charge Attack and Fire Breath
          if (distC <= self.attackRange && self.attackCooldownTimer <= 0) {
            self.state = CREATURE_STATES.WINDUP;
            self.stateTimer = 0;
            self.isChargeAttack = Math.random() < 0.5;
            self.windupDuration = self.isChargeAttack ? 0.55 : 0.75;
          } else if (distC <= self.attackRange) {
            // 已经贴上但还在冷却：横向绕步，避免保留冲刺速度冲过头再折返
            if (!self.strafeSide) self.strafeSide = Math.random() < 0.5 ? 1 : -1;
            const sp = self.wanderSpeed || self.speed * 0.5;
            self.vx = -(dyC / distC) * sp * self.strafeSide;
            self.vy = (dxC / distC) * sp * self.strafeSide;
          } else {
            self.vx = (dxC / distC) * self.chaseSpeed;
            self.vy = (dyC / distC) * self.chaseSpeed;
          }
          break;

        case CREATURE_STATES.WINDUP:
          self.vx *= 0.4;
          self.vy *= 0.4;
          if (player) self.facingAngle = Math.atan2(player.y - self.y, player.x - self.x);

          if (particleSystem && Math.random() < 0.4) {
            particleSystem.spawnFlameEmber(self.x + Math.cos(self.facingAngle) * 24, self.y + Math.sin(self.facingAngle) * 24);
          }

          if (self.stateTimer >= self.windupDuration) {
            self.state = CREATURE_STATES.ATTACK;
            self.stateTimer = 0;
            self.attackCooldownTimer = 2.8;

            if (self.isChargeAttack) {
              // Dash Charge
              const chargeSpd = 360;
              self.vx = Math.cos(self.facingAngle) * chargeSpd;
              self.vy = Math.sin(self.facingAngle) * chargeSpd;
              self.activeAttackHitbox = {
                type: 'circle',
                x: self.x,
                y: self.y,
                radius: self.radius * 1.2,
                damage: self.damage * 1.3,
                knockback: 320,
                isParriable: true,
                attacker: self
              };
              if (audioSystem && audioSystem.playDragonRoar) audioSystem.playDragonRoar();
            } else {
              // Fire Breath Cone (multiple fiery projectiles)
              if (projectiles) {
                for (let i = -2; i <= 2; i++) {
                  const spreadAngle = self.facingAngle + (i * Math.PI) / 12;
                  projectiles.push({
                    type: 'fire_breath',
                    x: self.x + Math.cos(self.facingAngle) * 28,
                    y: self.y + Math.sin(self.facingAngle) * 28,
                    vx: Math.cos(spreadAngle) * 260,
                    vy: Math.sin(spreadAngle) * 260,
                    radius: 9,
                    damage: 22,
                    isParriable: true,
                    attacker: self,
                    life: 1.6,
                    color: '#f97316'
                  });
                }
              }
              if (audioSystem && audioSystem.playFireBreath) audioSystem.playFireBreath();
            }
          }
          break;

        case CREATURE_STATES.ATTACK:
          if (self.isChargeAttack) {
            // Keep hitbox aligned during dash
            if (self.activeAttackHitbox) {
              self.activeAttackHitbox.x = self.x;
              self.activeAttackHitbox.y = self.y;
            }
            if (particleSystem && Math.random() < 0.4) {
              particleSystem.spawnFlameEmber(self.x, self.y);
            }
          }

          if (self.stateTimer >= 0.55) {
            self.activeAttackHitbox = null;
            self.enterChase();
          }
          break;

        case CREATURE_STATES.HURT:
        case CREATURE_STATES.STUNNED:
          self.vx *= 0.88;
          self.vy *= 0.88;
          if (self.stateTimer >= (self.state === CREATURE_STATES.STUNNED ? self.stunDuration : 0.2)) {
            self.enterChase();
          }
          break;
      }
    },
    // Custom Procedural Render
    preferVector: true,
    sideView: true,
    customRender: (self, ctx) => {
      const r = self.radius;
      const t = self.animTime;
      const step = Math.sin(self.walkCycle) * r * 0.22;
      const tail = Math.sin(t * 2.2);
      const breathe = Math.sin(t * 2.6) * r * 0.035;
      // 熔岩纹亮度随呼吸起伏，不用 shadowBlur
      const heat = 0.55 + Math.sin(t * 3.4) * 0.28;
      const jaw = Math.max(0, Math.sin(t * 1.6)) * r * 0.1;
      const rock = '#3f1210';
      const rockDark = '#1c0a09';
      const skin = self.themeColor;
      const lava = self.accentColor;

      ctx.save();
      ctx.translate(0, breathe);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // 长尾：三段渐细，末端带一簇火
      ctx.strokeStyle = rock;
      ctx.lineWidth = r * 0.3;
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, -r * 0.02);
      ctx.quadraticCurveTo(-r * 1.3, tail * r * 0.16, -r * 1.7, tail * r * 0.34);
      ctx.stroke();
      ctx.lineWidth = r * 0.16;
      ctx.beginPath();
      ctx.moveTo(-r * 1.66, tail * r * 0.32);
      ctx.quadraticCurveTo(-r * 2.0, tail * r * 0.5, -r * 2.2, tail * r * 0.26);
      ctx.stroke();
      ctx.globalAlpha = heat;
      ctx.fillStyle = lava;
      ctx.beginPath();
      ctx.moveTo(-r * 2.18, tail * r * 0.26);
      ctx.lineTo(-r * 2.56, tail * r * 0.1 - r * 0.16);
      ctx.lineTo(-r * 2.34, tail * r * 0.38);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      // 远侧两腿，压暗当作纵深
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = rockDark;
      ctx.lineWidth = r * 0.22;
      for (const [ox, phase] of [[-r * 0.34, -1], [r * 0.46, 1]]) {
        ctx.beginPath();
        ctx.moveTo(ox, r * 0.3);
        ctx.lineTo(ox + step * phase * 0.6, r * 0.62);
        ctx.lineTo(ox + step * phase, r * 0.96);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // 躯干、背甲、脖颈、头骨、角这些不随动画变化，烘焙一次后整层贴回
      const shell = bakedLayer(self, 'shell', 2.1, (b) => {
        const body = b.createLinearGradient(0, -r * 0.9, 0, r * 0.6);
        body.addColorStop(0, skin);
        body.addColorStop(0.5, rock);
        body.addColorStop(1, rockDark);
        b.fillStyle = body;
        b.beginPath();
        b.moveTo(-r * 0.78, r * 0.04);
        b.quadraticCurveTo(-r * 0.86, -r * 0.42, -r * 0.24, -r * 0.6);
        b.quadraticCurveTo(r * 0.44, -r * 0.82, r * 0.92, -r * 0.44);
        b.quadraticCurveTo(r * 1.16, -r * 0.06, r * 0.86, r * 0.32);
        b.quadraticCurveTo(r * 0.1, r * 0.6, -r * 0.78, r * 0.04);
        b.closePath();
        b.fill();
        b.strokeStyle = rockDark;
        b.lineWidth = 2.2;
        b.stroke();

        // 黑曜石背甲，一片片压着排
        b.fillStyle = rockDark;
        for (let i = 0; i < 5; i++) {
          const px = -r * 0.62 + i * r * 0.34;
          const py = -r * 0.5 + Math.abs(i - 2) * r * 0.06;
          b.beginPath();
          b.moveTo(px - r * 0.16, py + r * 0.2);
          b.lineTo(px, py - r * 0.08);
          b.lineTo(px + r * 0.18, py + r * 0.18);
          b.closePath();
          b.fill();
        }

        // 背脊火棘的岩石底
        for (let i = -2; i <= 2; i++) {
          const px = i * r * 0.32 - r * 0.05;
          const h = (1 - Math.abs(i) * 0.26) * r * 0.62;
          const base = -r * 0.56 + Math.abs(i) * r * 0.08;
          b.fillStyle = rockDark;
          b.beginPath();
          b.moveTo(px - r * 0.12, base);
          b.lineTo(px + r * 0.02, base - h);
          b.lineTo(px + r * 0.14, base);
          b.closePath();
          b.fill();
        }

        // 粗脖子接到头部
        b.fillStyle = rock;
        b.beginPath();
        b.moveTo(r * 0.5, -r * 0.6);
        b.quadraticCurveTo(r * 0.94, -r * 0.76, r * 1.18, -r * 0.6);
        b.lineTo(r * 1.12, -r * 0.04);
        b.quadraticCurveTo(r * 0.86, r * 0.06, r * 0.66, -r * 0.18);
        b.quadraticCurveTo(r * 0.54, -r * 0.34, r * 0.5, -r * 0.6);
        b.closePath();
        b.fill();
        b.strokeStyle = rockDark;
        b.lineWidth = 2;
        b.stroke();

        // 后掠的双角
        b.strokeStyle = rockDark;
        b.lineWidth = r * 0.16;
        b.beginPath();
        b.moveTo(r * 1.18, -r * 0.68);
        b.quadraticCurveTo(r * 1.08, -r * 0.96, r * 0.84, -r * 0.98);
        b.stroke();
        b.lineWidth = r * 0.12;
        b.beginPath();
        b.moveTo(r * 1.4, -r * 0.62);
        b.quadraticCurveTo(r * 1.4, -r * 0.88, r * 1.2, -r * 0.92);
        b.stroke();

        // 头骨：方吻、宽颧、下颌另画
        b.fillStyle = skin;
        b.beginPath();
        b.moveTo(r * 1.0, -r * 0.72);
        b.lineTo(r * 1.66, -r * 0.6);
        b.lineTo(r * 1.84, -r * 0.3);
        b.lineTo(r * 1.52, -r * 0.14);
        b.lineTo(r * 1.02, -r * 0.2);
        b.closePath();
        b.fill();
        b.strokeStyle = rockDark;
        b.lineWidth = 2;
        b.stroke();

        // 上颌獠牙
        b.fillStyle = '#fef3c7';
        for (const tx of [r * 1.3, r * 1.56]) {
          b.beginPath();
          b.moveTo(tx, -r * 0.2);
          b.lineTo(tx + r * 0.04, -r * 0.06);
          b.lineTo(tx + r * 0.09, -r * 0.2);
          b.closePath();
          b.fill();
        }

        // 眼：竖瞳
        b.fillStyle = self.eyeColor;
        b.beginPath();
        b.ellipse(r * 1.48, -r * 0.44, r * 0.13, r * 0.095, 0, 0, Math.PI * 2);
        b.fill();
        b.fillStyle = '#450a0a';
        b.beginPath();
        b.ellipse(r * 1.5, -r * 0.44, r * 0.032, r * 0.07, 0, 0, Math.PI * 2);
        b.fill();
      });

      if (shell) {
        drawBaked(ctx, shell);
      } else {
        ctx.fillStyle = rock;
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.1, r * 0.95, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 甲缝里透出的熔岩
      ctx.globalAlpha = heat;
      ctx.strokeStyle = lava;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-r * 0.62, -r * 0.16);
      ctx.lineTo(-r * 0.2, -r * 0.3);
      ctx.lineTo(r * 0.16, -r * 0.08);
      ctx.lineTo(r * 0.62, -r * 0.22);
      ctx.moveTo(-r * 0.36, r * 0.16);
      ctx.lineTo(r * 0.04, r * 0.24);
      ctx.lineTo(r * 0.48, r * 0.08);
      ctx.stroke();

      // 火棘的亮部随熔岩一起明灭
      ctx.fillStyle = lava;
      ctx.globalAlpha = heat * 0.9;
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) {
        const px = i * r * 0.32 - r * 0.05;
        const h = (1 - Math.abs(i) * 0.26) * r * 0.62;
        const base = -r * 0.56 + Math.abs(i) * r * 0.08;
        ctx.moveTo(px - r * 0.05, base - h * 0.2);
        ctx.lineTo(px + r * 0.02, base - h);
        ctx.lineTo(px + r * 0.08, base - h * 0.2);
      }
      ctx.fill();
      ctx.globalAlpha = 1;

      // 近侧两腿：粗壮的三段折线加爪
      ctx.strokeStyle = rock;
      ctx.lineWidth = r * 0.26;
      ctx.beginPath();
      for (const [ox, phase] of [[-r * 0.5, 1], [r * 0.6, -1]]) {
        ctx.moveTo(ox, r * 0.24);
        ctx.lineTo(ox - step * phase * 0.5, r * 0.6);
        ctx.lineTo(ox + step * phase, r * 0.98);
      }
      ctx.stroke();
      ctx.strokeStyle = '#fed7aa';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (const [ox, phase] of [[-r * 0.5, 1], [r * 0.6, -1]]) {
        for (let c = -1; c <= 1; c++) {
          ctx.moveTo(ox + step * phase, r * 0.98);
          ctx.lineTo(ox + step * phase + c * r * 0.12 + r * 0.1, r * 1.1);
        }
      }
      ctx.stroke();

      // 下颌，随呼吸微开
      ctx.fillStyle = rock;
      ctx.beginPath();
      ctx.moveTo(r * 1.04, -r * 0.14 + jaw);
      ctx.lineTo(r * 1.66, -r * 0.18 + jaw);
      ctx.lineTo(r * 1.52, r * 0.08 + jaw);
      ctx.lineTo(r * 1.04, r * 0.06 + jaw);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rockDark;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 下颌獠牙
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath();
      for (const tx of [r * 1.2, r * 1.46]) {
        ctx.moveTo(tx, r * 0.02 + jaw);
        ctx.lineTo(tx + r * 0.04, -r * 0.1 + jaw);
        ctx.lineTo(tx + r * 0.09, r * 0.02 + jaw);
      }
      ctx.fill();

      // 鼻孔漏出的余烬
      ctx.globalAlpha = heat * 0.8;
      ctx.fillStyle = lava;
      ctx.beginPath();
      ctx.arc(r * 1.78, -r * 0.34, r * 0.055, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.restore();
    }
  },

  // 5. Frost Mammoth (Large Neutral Giant & Ice Stomper)
  FROST_MAMMOTH: {
    id: 'frost_mammoth',
    name: '寒霜雪绒猛犸 (Frost Mammoth)',
    species: 'Mammuthus Glacies',
    category: 'armored',
    biome: 'cryo_tundra',
    icon: '🦣❄️',
    hp: 175,
    defense: 11,
    speed: 70,
    chaseSpeed: 130,
    wanderSpeed: 40,
    radius: 34,
    poise: 130,
    sightRange: 200,
    attackRange: 80,
    loseTargetRange: 380,
    knockbackResist: 0.90,
    contactDamage: 16,
    damage: 30,
    themeColor: '#93c5fd',
    accentColor: '#dbeafe',
    eyeColor: '#38bdf8',
    drops: [
      { id: 'frost_mammoth_rib', name: '极寒雪绒猛犸肋排', icon: '🥩❄️', chance: 1.0, min: 2, max: 3 },
      { id: 'comet_ice_crystal', name: '彗星冰晶碎', icon: '🧊', chance: 0.85, min: 1, max: 2 },
      { id: 'void_wyrm_meat', name: '虚空神龙脊髓肉', icon: '🐉', chance: 0.18, min: 1, max: 1 }
    ],
    // Custom AI: Peaceful wanderer until attacked -> Heavy Ice Stomp AOE
    customAi: (self, dt, player, projectiles, particleSystem, audioSystem) => {
      const distToPlayer = player ? Math.hypot(player.x - self.x, player.y - self.y) : Infinity;

      switch (self.state) {
        case CREATURE_STATES.IDLE:
          self.vx *= 0.8;
          self.vy *= 0.8;
          if (self.stateTimer >= self.stateDuration) {
            self.enterWander();
          }
          break;

        case CREATURE_STATES.WANDER:
          self.walkCycle += dt * 4;
          const dxW = self.wanderTarget.x - self.x;
          const dyW = self.wanderTarget.y - self.y;
          const distW = Math.hypot(dxW, dyW);
          if (distW > 10) {
            self.vx = (dxW / distW) * self.wanderSpeed;
            self.vy = (dyW / distW) * self.wanderSpeed;
          } else {
            self.enterIdle(2.5 + Math.random() * 3.0);
          }
          break;

        case CREATURE_STATES.ALERT:
          self.vx *= 0.6;
          self.vy *= 0.6;
          if (self.stateTimer >= self.alertDuration) self.enterChase();
          break;

        case CREATURE_STATES.CHASE:
          self.walkCycle += dt * 8;
          if (!player || player.state === 'dead' || distToPlayer > self.loseTargetRange) {
            self.enterIdle(3.0);
            break;
          }

          const dxC = player.x - self.x;
          const dyC = player.y - self.y;
          const distC = Math.hypot(dxC, dyC);
          self.facingAngle = Math.atan2(dyC, dxC);

          if (distC <= self.attackRange && self.attackCooldownTimer <= 0) {
            self.state = CREATURE_STATES.WINDUP;
            self.stateTimer = 0;
            self.windupDuration = 0.65;
          } else if (distC <= self.attackRange) {
            // 已经贴上但还在冷却：横向绕步，不再保留上一帧的冲刺速度
            const side = self.strafeSide || (self.strafeSide = Math.random() < 0.5 ? 1 : -1);
            self.vx = -(dyC / distC) * self.wanderSpeed * side;
            self.vy = (dxC / distC) * self.wanderSpeed * side;
          } else {
            self.vx = (dxC / distC) * self.chaseSpeed;
            self.vy = (dyC / distC) * self.chaseSpeed;
          }
          break;

        case CREATURE_STATES.WINDUP:
          self.vx *= 0.3;
          self.vy *= 0.3;

          // Ice frost particles gather
          if (particleSystem && Math.random() < 0.35) {
            particleSystem.spawnFrostSparkle(self.x, self.y, '#93c5fd');
          }

          if (self.stateTimer >= self.windupDuration) {
            self.state = CREATURE_STATES.ATTACK;
            self.stateTimer = 0;
            self.attackCooldownTimer = 2.6;

            // Ice Frost Stomp Shockwave
            if (projectiles) {
              projectiles.push({
                type: 'frost_stomp',
                x: self.x,
                y: self.y,
                radius: 20,
                maxRadius: 95,
                growSpeed: 170,
                damage: 26,
                knockback: 220,
                slowsPlayer: true,
                isParriable: true,
                attacker: self,
                life: 0.6,
                color: '#93c5fd'
              });
            }

            if (audioSystem && audioSystem.playMammothStomp) audioSystem.playMammothStomp();
            if (particleSystem && particleSystem.spawnShockwave) {
              particleSystem.spawnShockwave(self.x, self.y, 95, '#bfdbfe');
            }
          }
          break;

        case CREATURE_STATES.ATTACK:
          if (self.stateTimer >= 0.45) {
            self.enterChase();
          }
          break;

        case CREATURE_STATES.HURT:
        case CREATURE_STATES.STUNNED:
          self.vx *= 0.85;
          self.vy *= 0.85;
          if (self.stateTimer >= (self.state === CREATURE_STATES.STUNNED ? self.stunDuration : 0.2)) {
            self.enterChase(); // Retaliate immediately on hurt!
          }
          break;
      }
    },
    // Custom Procedural Render
    preferVector: true,
    sideView: true,
    customRender: (self, ctx) => {
      const r = self.radius;
      const step = Math.sin(self.walkCycle) * r * 0.2;
      const sway = Math.sin(self.walkCycle * 0.5) * r * 0.05;
      const breathe = Math.sin(self.animTime * 1.8) * r * 0.03;
      const dark = '#334155';
      const wool = self.themeColor;
      const light = self.accentColor;

      ctx.save();
      ctx.translate(0, breathe);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // 四条柱状腿，前后两对反相迈步
      ctx.strokeStyle = dark;
      ctx.lineWidth = r * 0.3;
      for (const [ox, phase, depth] of [[-r * 0.52, 1, 0.72], [r * 0.42, -1, 0.72], [-r * 0.34, -1, 1], [r * 0.56, 1, 1]]) {
        ctx.globalAlpha = depth < 1 ? 0.62 : 1;
        ctx.beginPath();
        ctx.moveTo(ox, r * 0.34);
        ctx.lineTo(ox + step * phase, r * 1.02);
        ctx.stroke();
        ctx.lineWidth = r * 0.34;
        ctx.beginPath();
        ctx.moveTo(ox + step * phase, r * 1.0);
        ctx.lineTo(ox + step * phase, r * 1.08);
        ctx.stroke();
        ctx.lineWidth = r * 0.3;
      }
      ctx.globalAlpha = 1;

      // 躯干、长毛、头部与象牙一次烘焙，只有腿和鼻子每帧重画
      const hide = bakedLayer(self, 'hide', 2.3, (b) => {
        // 躯干：肩峰最高，向臀部收窄，是猛犸的标志轮廓
        const body = b.createLinearGradient(0, -r * 1.05, 0, r * 0.5);
        body.addColorStop(0, light);
        body.addColorStop(0.45, wool);
        body.addColorStop(1, dark);
        b.fillStyle = body;
        b.beginPath();
        b.moveTo(-r * 0.92, r * 0.1);
        b.quadraticCurveTo(-r * 1.02, -r * 0.5, -r * 0.5, -r * 0.72);
        b.quadraticCurveTo(r * 0.05, -r * 1.06, r * 0.5, -r * 0.72);
        b.quadraticCurveTo(r * 0.96, -r * 0.46, r * 0.9, r * 0.16);
        b.quadraticCurveTo(r * 0.2, r * 0.52, -r * 0.92, r * 0.1);
        b.closePath();
        b.fill();
        b.strokeStyle = dark;
        b.lineWidth = 2;
        b.stroke();

        // 垂到腿上的长毛
        b.strokeStyle = light;
        b.lineWidth = 1.6;
        b.globalAlpha = 0.5;
        b.beginPath();
        for (let i = -4; i <= 4; i++) {
          const fx = i * r * 0.19;
          b.moveTo(fx, r * 0.16);
          b.lineTo(fx, r * 0.16 + r * (0.24 + (i % 2 ? 0.1 : 0)));
        }
        b.stroke();
        b.globalAlpha = 1;

        // 背脊的霜壳
        b.strokeStyle = '#e0f2fe';
        b.lineWidth = 2.2;
        b.globalAlpha = 0.7;
        b.beginPath();
        b.moveTo(-r * 0.66, -r * 0.62);
        b.quadraticCurveTo(r * 0.02, -r * 0.98, r * 0.52, -r * 0.66);
        b.stroke();
        b.globalAlpha = 1;

        // 小耳朵贴在头后侧
        b.fillStyle = dark;
        b.beginPath();
        b.ellipse(r * 0.54, -r * 0.38, r * 0.2, r * 0.28, 0.32, 0, Math.PI * 2);
        b.fill();
        b.strokeStyle = '#1e293b';
        b.lineWidth = 1.4;
        b.stroke();

        // 头：从肩峰前方伸出，比躯干低一截
        b.fillStyle = wool;
        b.beginPath();
        b.ellipse(r * 0.9, -r * 0.32, r * 0.48, r * 0.5, -0.16, 0, Math.PI * 2);
        b.fill();
        b.strokeStyle = dark;
        b.lineWidth = 2;
        b.stroke();

        // 头顶毛丘
        b.fillStyle = light;
        b.beginPath();
        b.ellipse(r * 0.88, -r * 0.7, r * 0.34, r * 0.2, -0.2, 0, Math.PI * 2);
        b.fill();

        // 后侧那根长牙压暗成纵深
        b.strokeStyle = '#bae6fd';
        b.lineWidth = r * 0.15;
        b.globalAlpha = 0.7;
        b.beginPath();
        b.moveTo(r * 0.88, r * 0.06);
        b.bezierCurveTo(r * 1.56, r * 0.44, r * 1.94, r * 0.06, r * 1.62, -r * 0.42);
        b.stroke();
        b.globalAlpha = 1;

        // 近侧长牙：向内旋，末端上翘
        b.strokeStyle = '#f0f9ff';
        b.lineWidth = r * 0.22;
        b.beginPath();
        b.moveTo(r * 1.06, -r * 0.04);
        b.bezierCurveTo(r * 1.78, r * 0.34, r * 2.16, -r * 0.06, r * 1.8, -r * 0.62);
        b.stroke();
        b.lineWidth = r * 0.1;
        b.beginPath();
        b.moveTo(r * 1.86, -r * 0.5);
        b.quadraticCurveTo(r * 1.94, -r * 0.7, r * 1.76, -r * 0.72);
        b.stroke();

        // 眼
        b.fillStyle = '#0f172a';
        b.beginPath();
        b.arc(r * 1.02, -r * 0.44, r * 0.1, 0, Math.PI * 2);
        b.fill();
        b.fillStyle = self.eyeColor;
        b.beginPath();
        b.arc(r * 1.04, -r * 0.46, r * 0.045, 0, Math.PI * 2);
        b.fill();
      });

      if (hide) {
        drawBaked(ctx, hide);
      } else {
        ctx.fillStyle = wool;
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.25, r, r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      // 象鼻：三段渐细，末端上卷
      ctx.strokeStyle = wool;
      ctx.lineWidth = r * 0.26;
      ctx.beginPath();
      ctx.moveTo(r * 1.06, -r * 0.16);
      ctx.quadraticCurveTo(r * 1.4, r * 0.24, r * 1.3, r * 0.62);
      ctx.stroke();
      ctx.lineWidth = r * 0.19;
      ctx.beginPath();
      ctx.moveTo(r * 1.3, r * 0.58);
      ctx.quadraticCurveTo(r * 1.2, r * 0.92, r * 1.44, r * 0.94 + sway);
      ctx.stroke();
      ctx.lineWidth = r * 0.12;
      ctx.beginPath();
      ctx.moveTo(r * 1.42, r * 0.94 + sway);
      ctx.quadraticCurveTo(r * 1.62, r * 0.9 + sway, r * 1.58, r * 0.68 + sway);
      ctx.stroke();

      // 短尾
      ctx.strokeStyle = dark;
      ctx.lineWidth = r * 0.1;
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, -r * 0.16);
      ctx.quadraticCurveTo(-r * 1.16, r * 0.02 + sway, -r * 1.1, r * 0.3 + sway);
      ctx.stroke();

      ctx.restore();
    }
  }
};

/**
 * Factory function to create a fully configured Creature instance
 */
Object.assign(MONSTER_TYPES, EXTRA_MONSTERS);

export function createMonster(typeKey, x = 0, y = 0, overrides = {}) {
  const normalizedKey = String(typeKey || '').toLowerCase();
  const template = MONSTER_TYPES[typeKey]
    || Object.values(MONSTER_TYPES).find(monster => monster.id === normalizedKey)
    || MONSTER_TYPES.SPORE_BUNNY;
  return new Creature({
    ...template,
    x,
    y,
    typeKey: template.id,
    ...overrides
  });
}
