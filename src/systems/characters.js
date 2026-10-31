// Galaxy Hunter: Gourmet Odyssey - Playable Chef Roster
// 五名可切换主厨：各自的基础属性、厨艺特长、主动技能与外观配色。

export const SKILL_KIND = {
  BLINK_SLASH: 'blink_slash',
  NOVA_BURST: 'nova_burst',
  FROST_WARD: 'frost_ward',
  QUAKE_STOMP: 'quake_stomp',
  TIME_RIFT: 'time_rift'
};

export const UNLOCK_KIND = {
  FREE: 'free',
  REPUTATION: 'reputation',
  DISHES: 'dishes',
  CREDITS: 'credits',
  TRIAL: 'trial'
};

/**
 * stats 直接顶替 baseStats，kitchen 是四个工位的评分倍率，
 * palette 覆盖角色模型的配色，skill 描述一个主动技能。
 */
export const CHARACTERS = [
  {
    id: 'nova',
    name: '诺瓦',
    en: 'NOVA',
    title: '首席刀锋',
    role: '均衡 / BALANCED',
    bio: '从米其林三星后厨叛逃的执刀人，把整个银河当成自己的备料台。刀快，人也快。',
    stats: { maxHp: 120, attack: 22, speed: 250, staminaRegen: 15, elemResist: 0, nightVision: 100, lootMagnet: 80, defense: 0, critChance: 5 },
    kitchen: { knife: 1.1, heat: 1.0, season: 1.0, plating: 1.0 },
    kitchenNote: '刀工评分 +10%',
    palette: { suit: ['#111d29', '#263b48', '#536b72'], armor: ['#69777a', '#d6e0dc', '#f7faf6'], accent: '#f4ad3f', accentDark: '#994d1d', visor: '#55ead6', visorDark: '#063a47' },
    theme: '#55ead6',
    skill: {
      kind: SKILL_KIND.BLINK_SLASH,
      name: '星裂斩',
      en: 'RIFT SLASH',
      cooldown: 9,
      stamina: 18,
      desc: '朝面向瞬移一段距离，沿途撕开一道刀痕，对经过的敌人造成 180% 攻击力伤害。',
      params: { distance: 190, damageMult: 1.8, width: 46 }
    },
    unlock: { kind: UNLOCK_KIND.FREE, label: '初始主厨' }
  },
  {
    id: 'ember',
    name: '炽羽',
    en: 'EMBER',
    title: '爆炒之手',
    role: '爆发 / BURST',
    bio: '在恒星表面练出的火候感。她说，任何食材只要够热，都会自己交代最好的一面。',
    stats: { maxHp: 96, attack: 30, speed: 246, staminaRegen: 14, elemResist: 25, nightVision: 100, lootMagnet: 80, defense: 0, critChance: 8 },
    kitchen: { knife: 1.0, heat: 1.15, season: 1.0, plating: 1.0 },
    kitchenNote: '火候评分 +15%',
    palette: { suit: ['#2a0f10', '#57211c', '#8f4231'], armor: ['#8a4a32', '#f0c4a0', '#fff1e0'], accent: '#ff7a3c', accentDark: '#a52f10', visor: '#ffca55', visorDark: '#6d2c05' },
    theme: '#ff8a4c',
    skill: {
      kind: SKILL_KIND.NOVA_BURST,
      name: '烈焰爆炒',
      en: 'FLASH WOK',
      cooldown: 12,
      stamina: 24,
      desc: '以自身为中心引爆一圈热浪，范围内敌人受到 220% 攻击力伤害并被击退。',
      params: { radius: 168, damageMult: 2.2, knockback: 320 }
    },
    unlock: { kind: UNLOCK_KIND.REPUTATION, value: 60, label: '口碑达到 60' }
  },
  {
    id: 'lumen',
    name: '露蔓',
    en: 'LUMEN',
    title: '摆盘诗人',
    role: '续航 / SUSTAIN',
    bio: '相信一道菜的最后一笔比前面所有工序都重要。走路很轻，收刀更轻。',
    stats: { maxHp: 112, attack: 19, speed: 274, staminaRegen: 22, elemResist: 10, nightVision: 130, lootMagnet: 110, defense: 4, critChance: 6 },
    kitchen: { knife: 1.0, heat: 1.0, season: 1.0, plating: 1.18 },
    kitchenNote: '摆盘评分 +18%',
    palette: { suit: ['#161436', '#2f2f63', '#5f5f9c'], armor: ['#6f6fae', '#dcd8ff', '#fbf7ff'], accent: '#c39bff', accentDark: '#5b3aa0', visor: '#a5f3ff', visorDark: '#243f6b' },
    theme: '#c39bff',
    skill: {
      kind: SKILL_KIND.FROST_WARD,
      name: '凝霜护盘',
      en: 'FROST WARD',
      cooldown: 14,
      stamina: 16,
      desc: '张开一层霜盾，4 秒内减免 60% 伤害、耐力回复翻倍，并推开靠近的敌人。',
      params: { duration: 4, resist: 0.6, staminaMult: 2, pushRadius: 120, pushForce: 240 }
    },
    unlock: { kind: UNLOCK_KIND.DISHES, value: 5, label: '累计出餐 5 道' }
  },
  {
    id: 'grim',
    name: '格里姆',
    en: 'GRIM',
    title: '荒野猎手',
    role: '坦克 / BULWARK',
    bio: '在四个生态区都埋过陷阱的老饕。他的菜谱只有一句：先按住它，再谈味道。',
    stats: { maxHp: 168, attack: 25, speed: 222, staminaRegen: 13, elemResist: 18, nightVision: 90, lootMagnet: 96, defense: 18, critChance: 4 },
    kitchen: { knife: 1.0, heat: 1.0, season: 1.12, plating: 1.0 },
    kitchenNote: '调味评分 +12%',
    palette: { suit: ['#12200f', '#2a3d1c', '#4f6b39'], armor: ['#5d6b45', '#cfd8b6', '#f3f6e6'], accent: '#9ad14a', accentDark: '#41631d', visor: '#d8ff8f', visorDark: '#2b4413' },
    theme: '#9ad14a',
    skill: {
      kind: SKILL_KIND.QUAKE_STOMP,
      name: '沉岩踏',
      en: 'QUAKE STOMP',
      cooldown: 13,
      stamina: 22,
      desc: '重踏地面，震开周围敌人并让它们僵直 1.6 秒，同时为自己回复 12% 生命。',
      params: { radius: 190, damageMult: 1.2, stun: 1.6, knockback: 380, healPct: 0.12 }
    },
    unlock: { kind: UNLOCK_KIND.REPUTATION, value: 140, label: '口碑达到 140' }
  },
  {
    id: 'echo',
    name: '回声',
    en: 'ECHO',
    title: '分子料理师',
    role: '控场 / CONTROL',
    bio: '把时间当调味料用。她端上来的菜，你会觉得自己已经吃过一次了。',
    stats: { maxHp: 104, attack: 24, speed: 258, staminaRegen: 17, elemResist: 12, nightVision: 150, lootMagnet: 140, defense: 2, critChance: 20 },
    kitchen: { knife: 1.06, heat: 1.06, season: 1.06, plating: 1.06 },
    kitchenNote: '四项工位评分各 +6%',
    palette: { suit: ['#0f2226', '#17454a', '#2c7a78'], armor: ['#2f8c86', '#b9f5ea', '#eafff9'], accent: '#4ff0c8', accentDark: '#0d6b58', visor: '#f5a3ff', visorDark: '#4c1a63' },
    theme: '#4ff0c8',
    skill: {
      kind: SKILL_KIND.TIME_RIFT,
      name: '时缝',
      en: 'TIME RIFT',
      cooldown: 16,
      stamina: 20,
      desc: '撕开一道时缝，5 秒内让屏幕内所有敌人减速至四成，自身移动速度提升 30%。',
      params: { duration: 5, radius: 520, enemySlow: 0.4, selfSpeed: 1.3 }
    },
    unlock: { kind: UNLOCK_KIND.TRIAL, label: '完成终极评鉴' }
  }
];

export const DEFAULT_CHARACTER_ID = CHARACTERS[0].id;

export function getCharacter(id) {
  return CHARACTERS.find(c => c.id === id) || CHARACTERS[0];
}

export function getActiveCharacter(gameData) {
  return getCharacter(gameData?.characterId);
}

/** 解锁进度：返回 {unlocked, progress, need, label}，progress/need 用于画进度条。 */
export function unlockStatus(character, gameData) {
  const u = character.unlock;
  const owned = Array.isArray(gameData?.unlockedCharacters) && gameData.unlockedCharacters.includes(character.id);
  if (u.kind === UNLOCK_KIND.FREE || owned) {
    return { unlocked: true, progress: 1, need: 1, label: u.label };
  }

  let progress = 0;
  let need = u.value || 1;
  if (u.kind === UNLOCK_KIND.REPUTATION) progress = gameData?.reputation || 0;
  else if (u.kind === UNLOCK_KIND.CREDITS) progress = gameData?.credits || 0;
  else if (u.kind === UNLOCK_KIND.DISHES) progress = (gameData?.cookedDishes || []).length;
  else if (u.kind === UNLOCK_KIND.TRIAL) {
    need = 1;
    progress = gameData?.finalTrial?.state === 'completed' || gameData?.michelinStars >= 3 ? 1 : 0;
  }

  return { unlocked: progress >= need, progress, need, label: u.label };
}

/** 把达成条件的角色写进解锁列表，返回这次新解锁的角色。 */
export function refreshUnlocks(gameData) {
  if (!Array.isArray(gameData.unlockedCharacters)) gameData.unlockedCharacters = [DEFAULT_CHARACTER_ID];
  const fresh = [];
  for (const c of CHARACTERS) {
    if (gameData.unlockedCharacters.includes(c.id)) continue;
    if (unlockStatus(c, gameData).unlocked) {
      gameData.unlockedCharacters.push(c.id);
      fresh.push(c);
    }
  }
  return fresh;
}

/** 把当前角色的属性写进 baseStats，供 BuffManager 重算。 */
export function applyCharacterStats(gameData) {
  const c = getActiveCharacter(gameData);
  gameData.baseStats = { ...gameData.baseStats, ...c.stats };
  return c;
}

/** 厨房四项工位的角色加成倍率。 */
export function kitchenMultipliers(gameData) {
  return getActiveCharacter(gameData).kitchen;
}
