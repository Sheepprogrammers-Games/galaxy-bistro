// Galaxy Hunter: Gourmet Odyssey - 星历
// 生存天数里程碑、每日委托与当日异象，全部挂在宇宙日的推进上。

import { makeRng } from '../world/map.js';

// ================= 当日异象 =================

export const OMENS = [
  {
    id: 'calm',
    name: '风平浪静',
    nameEn: 'CALM SKIES',
    desc: '没有异常读数。适合按部就班地清委托。',
    color: '#94a3b8',
    weight: 26,
    effects: {}
  },
  {
    id: 'meteor',
    name: '流星雨',
    nameEn: 'METEOR SHOWER',
    desc: '碎屑带擦过大气层，资源点被砸得更松，每次采集多掉一份。',
    color: '#38bdf8',
    weight: 16,
    effects: { extraDrop: 1 }
  },
  {
    id: 'blood_moon',
    name: '血月',
    nameEn: 'BLOOD MOON',
    desc: '异兽今天格外暴躁：攻防都涨，但身上的星币翻倍。',
    color: '#ef4444',
    weight: 13,
    effects: { enemyPower: 1.25, creditMult: 2 }
  },
  {
    id: 'cold_snap',
    name: '极寒潮',
    nameEn: 'COLD SNAP',
    desc: '低温让人跑不快，却把冰晶类食材冻出了双份。',
    color: '#7dd3fc',
    weight: 13,
    effects: { speedMult: 0.88, frostBonus: 2 }
  },
  {
    id: 'spirit_tide',
    name: '灵潮',
    nameEn: 'SPIRIT TIDE',
    desc: '公会频道一整天都在讨论你。今天赚到的口碑多五成。',
    color: '#c084fc',
    weight: 12,
    effects: { repMult: 1.5 }
  },
  {
    id: 'long_night',
    name: '长夜',
    nameEn: 'ENDLESS NIGHT',
    desc: '恒星迟迟不升。夜行猎物翻倍出没，掉落也更丰厚。',
    color: '#818cf8',
    weight: 10,
    effects: { nightLength: 1.6, dropChance: 1.3 }
  },
  {
    id: 'gourmet_fair',
    name: '美食巡展',
    nameEn: 'GOURMET FAIR',
    desc: '评审团在附近落脚。今天出的每一道菜都算双份口碑。',
    color: '#f0c77c',
    weight: 10,
    effects: { dishRepMult: 2 }
  }
];

const omenById = new Map(OMENS.map(o => [o.id, o]));

/** 按权重掷当天的异象。同一天同一颗星球结果固定。 */
export function rollOmen(day, planetId = '') {
  let seed = day * 2654435761;
  for (let i = 0; i < planetId.length; i++) seed = (seed + planetId.charCodeAt(i) * (i + 7)) >>> 0;
  const rng = makeRng(seed >>> 0);

  const total = OMENS.reduce((a, o) => a + o.weight, 0);
  let pick = rng() * total;
  for (const o of OMENS) {
    pick -= o.weight;
    if (pick <= 0) return o.id;
  }
  return OMENS[0].id;
}

export function getOmen(gameData) {
  return omenById.get(gameData?.almanac?.omenId) || OMENS[0];
}

/** 取某项异象效果，没有该异象时返回默认值。 */
export function omenEffect(gameData, key, fallback = 1) {
  const e = getOmen(gameData).effects || {};
  return e[key] ?? fallback;
}

// ================= 生存天数里程碑 =================

export const DAY_MILESTONES = [
  { day: 2, name: '站稳脚跟', credits: 220, rep: 8, items: [['spore_herb', 3]] },
  { day: 3, name: '第一周期', credits: 360, rep: 14, items: [['zero_g_mushroom', 4]] },
  { day: 5, name: '荒野常客', credits: 600, rep: 26, items: [['pulsar_crystal_salt', 4], ['void_mint', 3]] },
  { day: 7, name: '一周生还', credits: 950, rep: 45, items: [['quantum_meat', 3]], weapon: 'boning_twin_blades' },
  { day: 10, name: '两位数', credits: 1400, rep: 70, items: [['sunfire_fruit', 3], ['comet_ice_crystal', 3]] },
  { day: 14, name: '半月不倒', credits: 2100, rep: 110, items: [['magma_tail', 2]], weapon: 'pulse_sidearm' },
  { day: 20, name: '老猎人', credits: 3200, rep: 170, items: [['crystal_bloom', 2], ['aurora_jelly', 4]] },
  { day: 30, name: '整月纪录', credits: 5000, rep: 260, items: [['void_wyrm_meat', 2]], weapon: 'meteor_cleaver' },
  { day: 50, name: '荒野活化石', credits: 9000, rep: 480, items: [['void_wyrm_meat', 4], ['crystal_bloom', 4]] }
];

/** 到日子且还没领的里程碑。 */
export function pendingMilestones(gameData) {
  const day = gameData?.dayCount || 1;
  const claimed = gameData?.almanac?.claimedDays || [];
  return DAY_MILESTONES.filter(m => day >= m.day && !claimed.includes(m.day));
}

export function milestoneStatus(gameData, milestone) {
  const day = gameData?.dayCount || 1;
  const claimed = (gameData?.almanac?.claimedDays || []).includes(milestone.day);
  if (claimed) return 'claimed';
  return day >= milestone.day ? 'ready' : 'locked';
}

/**
 * 领取一档里程碑。奖励直接进背包与账户，武器写进已拥有列表。
 */
export function claimMilestone(gameData, day) {
  const m = DAY_MILESTONES.find(x => x.day === day);
  if (!m) return { ok: false, msg: '没有这一档奖励。' };
  if (milestoneStatus(gameData, m) !== 'ready') return { ok: false, msg: '这档奖励现在还领不了。' };

  ensureAlmanac(gameData);
  gameData.almanac.claimedDays.push(day);
  gameData.credits = (gameData.credits || 0) + m.credits;
  gameData.reputation = (gameData.reputation || 0) + m.rep;

  const gained = [];
  for (const [id, n] of m.items || []) {
    gameData.inventory[id] = (gameData.inventory[id] || 0) + n;
    gained.push({ id, count: n });
  }

  let weapon = null;
  if (m.weapon && !(gameData.ownedWeapons || []).includes(m.weapon)) {
    gameData.ownedWeapons.push(m.weapon);
    weapon = m.weapon;
  }

  return { ok: true, milestone: m, gained, weapon };
}

// ================= 每日委托 =================

const DAILY_POOL = [
  { id: 'gather_any', verb: '采集', text: n => `采集 ${n} 份任意食材`, min: 6, max: 14, credits: 30, rep: 2 },
  { id: 'hunt_any', verb: '猎杀', text: n => `猎杀 ${n} 只异兽`, min: 3, max: 8, credits: 42, rep: 3 },
  { id: 'cook_any', verb: '烹饪', text: n => `完成 ${n} 道料理`, min: 1, max: 3, credits: 70, rep: 5 },
  { id: 'smash_any', verb: '开路', text: n => `打碎 ${n} 处障碍`, min: 3, max: 7, credits: 34, rep: 2 },
  { id: 'walk_any', verb: '踏勘', text: n => `在荒野走过 ${n} 米`, min: 400, max: 1200, credits: 0.06, rep: 0.006 },
  { id: 'crate_any', verb: '补给', text: n => `从补给箱取走 ${n} 件物资`, min: 2, max: 5, credits: 46, rep: 3 }
];

/** 按当天种子抽三条委托，同一天重开游戏拿到的是同一批。 */
export function rollDailies(day, planetId = '') {
  let seed = day * 40503 + 7717;
  for (let i = 0; i < planetId.length; i++) seed = (seed + planetId.charCodeAt(i) * (i + 3)) >>> 0;
  const rng = makeRng(seed >>> 0);

  const pool = [...DAILY_POOL];
  const picked = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const idx = Math.floor(rng() * pool.length);
    const def = pool.splice(idx, 1)[0];
    const target = Math.round(def.min + rng() * (def.max - def.min));
    picked.push({
      id: def.id,
      goal: target,
      progress: 0,
      claimed: false,
      credits: Math.max(20, Math.round(target * def.credits)),
      rep: Math.max(2, Math.round(target * def.rep))
    });
  }
  return picked;
}

export function dailyLabel(task) {
  const def = DAILY_POOL.find(d => d.id === task.id);
  return def ? { verb: def.verb, text: def.text(task.goal) } : { verb: '委托', text: task.id };
}

/** 推进一条每日委托的计数。 */
export function trackDaily(gameData, id, amount = 1) {
  ensureAlmanac(gameData);
  let changed = false;
  for (const t of gameData.almanac.dailies) {
    if (t.id !== id || t.claimed) continue;
    const before = t.progress;
    t.progress = Math.min(t.goal, t.progress + amount);
    if (t.progress !== before) changed = true;
  }
  return changed;
}

export function dailyReady(gameData) {
  return (gameData?.almanac?.dailies || []).filter(t => !t.claimed && t.progress >= t.goal);
}

export function claimDaily(gameData, id) {
  ensureAlmanac(gameData);
  const t = gameData.almanac.dailies.find(x => x.id === id);
  if (!t) return { ok: false, msg: '没有这条委托。' };
  if (t.claimed) return { ok: false, msg: '这条已经领过了。' };
  if (t.progress < t.goal) return { ok: false, msg: `还差 ${t.goal - t.progress}。` };

  t.claimed = true;
  gameData.credits = (gameData.credits || 0) + t.credits;
  gameData.reputation = (gameData.reputation || 0) + t.rep;
  return { ok: true, task: t };
}

// ================= 存档接口 =================

export function ensureAlmanac(gameData) {
  if (!gameData) return null;
  if (!gameData.almanac || typeof gameData.almanac !== 'object') gameData.almanac = {};
  const a = gameData.almanac;
  if (!Array.isArray(a.claimedDays)) a.claimedDays = [];
  if (!Array.isArray(a.dailies)) a.dailies = [];
  if (!Number.isFinite(a.dailyDay)) a.dailyDay = 0;
  if (typeof a.omenId !== 'string') a.omenId = 'calm';
  if (!Number.isFinite(a.omenDay)) a.omenDay = 0;
  if (!Number.isFinite(a.walked)) a.walked = 0;
  return a;
}

/**
 * 翻到新的一天：重掷异象与三条委托。同一天重复调用不会重置进度。
 */
export function rollNewDay(gameData, planetId = '') {
  const a = ensureAlmanac(gameData);
  const day = gameData.dayCount || 1;
  let rolled = false;

  if (a.omenDay !== day) {
    a.omenId = rollOmen(day, planetId);
    a.omenDay = day;
    rolled = true;
  }
  if (a.dailyDay !== day) {
    a.dailies = rollDailies(day, planetId);
    a.dailyDay = day;
    rolled = true;
  }
  return rolled ? { omen: getOmen(gameData), dailies: a.dailies } : null;
}

/** 星历按钮上要不要挂感叹号。 */
export function almanacAlerts(gameData) {
  return pendingMilestones(gameData).length + dailyReady(gameData).length;
}
