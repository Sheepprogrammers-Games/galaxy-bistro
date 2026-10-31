// Galaxy Hunter: Gourmet Odyssey - Chef Active Skills
// 每位主厨一个主动技能：结算伤害/位移/增益，并留下一段自绘特效。

import { SKILL_KIND } from './characters.js';

const FX_LIFE = {
  blink: 0.42,
  burst: 0.55,
  ward: 0.5,
  quake: 0.62,
  rift: 0.7
};

export class SkillRuntime {
  constructor() {
    this.cooldown = 0;
    this.cooldownMax = 1;
    this.fx = [];
    this.slowUntil = 0;
    this.slowFactor = 1;
  }

  reset(character) {
    this.cooldown = 0;
    this.cooldownMax = character?.skill?.cooldown || 1;
    this.fx.length = 0;
    this.slowUntil = 0;
    this.slowFactor = 1;
  }

  get ready() {
    return this.cooldown <= 0;
  }

  get chargePct() {
    if (this.cooldownMax <= 0) return 1;
    return Math.max(0, Math.min(1, 1 - this.cooldown / this.cooldownMax));
  }

  update(dt) {
    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += dt;
      if (f.t >= f.life) this.fx.splice(i, 1);
    }
    if (this.slowUntil > 0) {
      this.slowUntil -= dt;
      if (this.slowUntil <= 0) {
        this.slowUntil = 0;
        this.slowFactor = 1;
      }
    }
  }

  /** 时缝生效期间怪物的时间流速倍率。 */
  enemyTimeScale() {
    return this.slowUntil > 0 ? this.slowFactor : 1;
  }

  push(kind, data, life) {
    this.fx.push({ kind, t: 0, life, ...data });
  }

  render(ctx) {
    for (const f of this.fx) {
      const k = Math.max(0, 1 - f.t / f.life);
      ctx.save();
      if (f.kind === 'blink') this._drawBlink(ctx, f, k);
      else if (f.kind === 'burst') this._drawRing(ctx, f, k, f.color, 3);
      else if (f.kind === 'quake') this._drawRing(ctx, f, k, f.color, 2);
      else if (f.kind === 'ward') this._drawWard(ctx, f, k);
      else if (f.kind === 'rift') this._drawRift(ctx, f, k);
      ctx.restore();
    }
  }

  _drawBlink(ctx, f, k) {
    const nx = -Math.sin(f.angle);
    const ny = Math.cos(f.angle);
    const w = f.width * 0.5 * k;
    ctx.globalAlpha = k;
    const grad = ctx.createLinearGradient(f.x0, f.y0, f.x1, f.y1);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.45, f.color);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(f.x0 + nx * w, f.y0 + ny * w);
    ctx.lineTo(f.x1 + nx * w * 0.35, f.y1 + ny * w * 0.35);
    ctx.lineTo(f.x1 - nx * w * 0.35, f.y1 - ny * w * 0.35);
    ctx.lineTo(f.x0 - nx * w, f.y0 - ny * w);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = k * 0.9;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(f.x0, f.y0);
    ctx.lineTo(f.x1, f.y1);
    ctx.stroke();
  }

  _drawRing(ctx, f, k, color, rings) {
    const p = 1 - k;
    for (let i = 0; i < rings; i++) {
      const lag = i * 0.16;
      const t = Math.max(0, Math.min(1, (p - lag) / (1 - lag || 1)));
      if (t <= 0) continue;
      const r = f.radius * (0.25 + t * 0.85);
      ctx.globalAlpha = (1 - t) * 0.75;
      ctx.strokeStyle = color;
      ctx.lineWidth = 6 * (1 - t) + 1.5;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, r, r * 0.62, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = k * 0.35;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, f.radius * (1 - k) * 0.9, f.radius * (1 - k) * 0.56, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawWard(ctx, f, k) {
    const r = f.radius * (0.6 + (1 - k) * 0.5);
    ctx.globalAlpha = k * 0.8;
    ctx.strokeStyle = f.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + (1 - k) * 2.4;
      ctx.globalAlpha = k * 0.7;
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.arc(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r * 0.7, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawRift(ctx, f, k) {
    const p = 1 - k;
    ctx.globalAlpha = k * 0.55;
    ctx.strokeStyle = f.color;
    for (let i = 0; i < 3; i++) {
      const r = f.radius * (0.2 + p * 0.9) - i * 26;
      if (r <= 0) continue;
      ctx.lineWidth = 2.5 - i * 0.6;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, r, r * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = k * 0.9;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + p * 1.2;
      const r0 = 18 + p * 40;
      const r1 = r0 + 34;
      ctx.beginPath();
      ctx.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0 * 0.6);
      ctx.lineTo(f.x + Math.cos(a) * r1, f.y + Math.sin(a) * r1 * 0.6);
      ctx.stroke();
    }
  }
}

/**
 * 释放技能。ctxObj 需要 player / monsters / particles / audio / camera / map。
 * 返回 null 表示没打出去（冷却中或耐力不足）。
 */
export function castSkill(character, runtime, ctxObj) {
  const skill = character?.skill;
  if (!skill || !runtime.ready) return null;

  const { player } = ctxObj;
  if (skill.stamina && player.stamina < skill.stamina) {
    return { failed: 'stamina' };
  }

  const p = skill.params || {};
  let hits = 0;

  switch (skill.kind) {
    case SKILL_KIND.BLINK_SLASH:
      hits = castBlinkSlash(character, runtime, ctxObj, p);
      break;
    case SKILL_KIND.NOVA_BURST:
      hits = castRadial(character, runtime, ctxObj, p, 'burst');
      break;
    case SKILL_KIND.QUAKE_STOMP:
      hits = castRadial(character, runtime, ctxObj, p, 'quake');
      break;
    case SKILL_KIND.FROST_WARD:
      hits = castFrostWard(character, runtime, ctxObj, p);
      break;
    case SKILL_KIND.TIME_RIFT:
      hits = castTimeRift(character, runtime, ctxObj, p);
      break;
    default:
      return null;
  }

  if (skill.stamina) player.consumeStamina(skill.stamina);
  runtime.cooldownMax = skill.cooldown;
  runtime.cooldown = skill.cooldown;
  return { hits, name: skill.name };
}

function damageMonster(m, ctxObj, dmg, angle, knockback, isHeavy) {
  m.takeDamage(dmg, angle, knockback, false, isHeavy, ctxObj.player, ctxObj.audio, ctxObj.particles);
}

function castBlinkSlash(character, runtime, ctxObj, p) {
  const { player, map } = ctxObj;
  const angle = player.facingAngle;
  const x0 = player.x;
  const y0 = player.y;

  // 逐段试探落点，撞到障碍就停在最后一个可站位置
  let x1 = x0;
  let y1 = y0;
  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    const tx = x0 + Math.cos(angle) * (p.distance * i / steps);
    const ty = y0 + Math.sin(angle) * (p.distance * i / steps);
    if (tx < 20 || ty < 20 || (map && (tx > map.width - 20 || ty > map.height - 20))) break;
    if (player._isBlockedAt && player._isBlockedAt(tx, ty, map?.obstacles || [])) break;
    x1 = tx;
    y1 = ty;
  }

  player.x = x1;
  player.y = y1;
  player.prevX = x1;
  player.prevY = y1;
  if (player.addGhostTrail) {
    for (let i = 0; i < 4; i++) player.addGhostTrail(0.5 - i * 0.1, character.theme);
  }

  const dmg = Math.round((player.weapon?.baseDamage || 22) * p.damageMult);
  let hits = 0;
  for (const m of ctxObj.monsters) {
    if (m.state === 'DEAD') continue;
    const d = pointSegmentDistance(m.x, m.y, x0, y0, x1, y1);
    if (d <= p.width * 0.5 + m.radius) {
      damageMonster(m, ctxObj, dmg, angle, 200, false);
      hits++;
    }
  }

  runtime.push('blink', { x0, y0, x1, y1, angle, width: p.width, color: character.theme }, FX_LIFE.blink);
  ctxObj.particles?.spawnHitSparks?.(x1, y1, angle, character.theme);
  ctxObj.camera?.addTrauma?.(0.3);
  ctxObj.audio?.play?.('dash', { volume: 0.6 });
  return hits;
}

function castRadial(character, runtime, ctxObj, p, fxKind) {
  const { player } = ctxObj;
  const dmg = Math.round((player.weapon?.baseDamage || 22) * p.damageMult);
  let hits = 0;

  for (const m of ctxObj.monsters) {
    if (m.state === 'DEAD') continue;
    const d = Math.hypot(m.x - player.x, m.y - player.y);
    if (d > p.radius + m.radius) continue;
    const angle = Math.atan2(m.y - player.y, m.x - player.x);
    damageMonster(m, ctxObj, dmg, angle, p.knockback || 260, true);
    if (p.stun && m.stun) m.stun(p.stun);
    hits++;
  }

  if (p.healPct) {
    player.hp = Math.min(player.maxHp, player.hp + Math.round(player.maxHp * p.healPct));
  }

  runtime.push(fxKind, { x: player.x, y: player.y, radius: p.radius, color: character.theme },
    fxKind === 'quake' ? FX_LIFE.quake : FX_LIFE.burst);
  ctxObj.particles?.spawnShockwave?.(player.x, player.y, p.radius, character.theme);
  ctxObj.camera?.addTrauma?.(0.55);
  ctxObj.audio?.play?.('sword_heavy', { volume: 0.6 });
  return hits;
}

function castFrostWard(character, runtime, ctxObj, p) {
  const { player } = ctxObj;
  player.applyBuff('chef_ward', {
    duration: p.duration,
    speedMult: 1.0,
    attackMult: 1.0,
    staminaRegenMult: p.staminaMult,
    damageResist: p.resist
  });

  let hits = 0;
  for (const m of ctxObj.monsters) {
    if (m.state === 'DEAD') continue;
    const d = Math.hypot(m.x - player.x, m.y - player.y);
    if (d > p.pushRadius + m.radius) continue;
    const angle = Math.atan2(m.y - player.y, m.x - player.x);
    m.vx = Math.cos(angle) * p.pushForce;
    m.vy = Math.sin(angle) * p.pushForce;
    hits++;
  }

  runtime.push('ward', { x: player.x, y: player.y, radius: p.pushRadius, color: character.theme }, FX_LIFE.ward);
  ctxObj.particles?.spawnShieldGlint?.(player.x, player.y, character.theme);
  ctxObj.audio?.play?.('shield_parry', { volume: 0.5 });
  return hits;
}

function castTimeRift(character, runtime, ctxObj, p) {
  const { player } = ctxObj;
  runtime.slowUntil = p.duration;
  runtime.slowFactor = p.enemySlow;
  player.applyBuff('chef_rift', {
    duration: p.duration,
    speedMult: p.selfSpeed,
    attackMult: 1.0,
    staminaRegenMult: 1.0,
    damageResist: 0
  });

  let hits = 0;
  for (const m of ctxObj.monsters) {
    if (m.state === 'DEAD') continue;
    if (Math.hypot(m.x - player.x, m.y - player.y) <= p.radius) hits++;
  }

  runtime.push('rift', { x: player.x, y: player.y, radius: 260, color: character.theme }, FX_LIFE.rift);
  ctxObj.camera?.addTrauma?.(0.25);
  ctxObj.audio?.play?.('level_up', { volume: 0.45 });
  return hits;
}

function pointSegmentDistance(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 0.0001) return Math.hypot(px - x0, py - y0);
  let t = ((px - x0) * dx + (py - y0) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t));
}
