// Galaxy Hunter: Gourmet Odyssey - 星尘工坊永久升级
// 星币在这里形成消费出口，玩家自选加点方向：猎装 / 补给 / 厨艺。

export const UPGRADE_TRACKS = {
  GEAR: 'gear',
  FIELD: 'field',
  CULINARY: 'culinary'
};

export const TRACK_META = {
  [UPGRADE_TRACKS.GEAR]: { name: '猎装', nameEn: 'COMBAT GEAR', icon: 'bolt' },
  [UPGRADE_TRACKS.FIELD]: { name: '补给', nameEn: 'FIELD KIT', icon: 'backpack' },
  [UPGRADE_TRACKS.CULINARY]: { name: '厨艺', nameEn: 'CULINARY', icon: 'dish' }
};

const COSTS = [220, 480, 950, 1800];

export const UPGRADES = [
  {
    id: 'plasma_edge',
    track: UPGRADE_TRACKS.GEAR,
    name: '等离子刀刃',
    nameEn: 'PLASMA EDGE',
    desc: '重铸厨刀的等离子锋面，每级提升基础伤害。',
    perLevel: 3,
    format: (v) => `基础伤害 +${v}`
  },
  {
    id: 'breach_coating',
    track: UPGRADE_TRACKS.GEAR,
    name: '破甲涂层',
    nameEn: 'BREACH COATING',
    desc: '刀身镀上穿甲涂层，无视更多护甲，专治重甲异兽。',
    perLevel: 0.05,
    format: (v) => `护甲穿透 +${Math.round(v * 100)}%`
  },
  {
    id: 'reinforced_suit',
    track: UPGRADE_TRACKS.FIELD,
    name: '强化护服',
    nameEn: 'REINFORCED SUIT',
    desc: '加厚野外作业服的缓冲层，每级提升最大生命。',
    perLevel: 15,
    format: (v) => `最大生命 +${v}`
  },
  {
    id: 'magnetic_pack',
    track: UPGRADE_TRACKS.FIELD,
    name: '磁力行囊',
    nameEn: 'MAGNETIC PACK',
    desc: '背包内置引力线圈，更远处的战利品会自己飞过来。',
    perLevel: 28,
    format: (v) => `拾取范围 +${v}`
  },
  {
    id: 'thermal_core',
    track: UPGRADE_TRACKS.CULINARY,
    name: '恒温灶芯',
    nameEn: 'THERMAL CORE',
    desc: '灶台加装恒温芯片，火候的合格区间更宽，更容易稳住。',
    perLevel: 2,
    format: (v) => `火候容差 +${v}°`
  },
  {
    id: 'insulated_case',
    track: UPGRADE_TRACKS.CULINARY,
    name: '保温食盒',
    nameEn: 'INSULATED CASE',
    desc: '料理的余温维持更久，饱食增益的持续时间随之延长。',
    perLevel: 0.15,
    format: (v) => `增益时长 +${Math.round(v * 100)}%`
  }
];

export const MAX_LEVEL = COSTS.length;

const byId = new Map(UPGRADES.map(u => [u.id, u]));

export function getUpgradeById(id) {
  return byId.get(id) || null;
}

function levels(gameState) {
  const data = gameState?.data || gameState || {};
  if (!data.upgrades) data.upgrades = {};
  return data.upgrades;
}

export function getUpgradeLevel(gameState, id) {
  const lv = levels(gameState)[id];
  return Number.isFinite(lv) ? Math.max(0, Math.min(MAX_LEVEL, lv)) : 0;
}

/**
 * 下一级的价格；已满级返回 null。
 */
export function getNextCost(gameState, id) {
  const lv = getUpgradeLevel(gameState, id);
  return lv >= MAX_LEVEL ? null : COSTS[lv];
}

/**
 * 某项升级当前累计的效果量。
 */
export function getUpgradeValue(gameState, id) {
  const def = byId.get(id);
  if (!def) return 0;
  return +(def.perLevel * getUpgradeLevel(gameState, id)).toFixed(4);
}

/**
 * 购买一级。价格不足或已满级返回 false。
 */
export function purchaseUpgrade(gameState, id) {
  const def = byId.get(id);
  if (!def) return false;

  const lv = getUpgradeLevel(gameState, id);
  if (lv >= MAX_LEVEL) return false;

  const cost = COSTS[lv];
  const data = gameState?.data || gameState;
  const credits = data.credits || 0;
  if (credits < cost) return false;

  // GameState 实例走 spendCredits 以便触发事件；纯数据对象直接扣。
  if (typeof gameState.spendCredits === 'function') {
    if (!gameState.spendCredits(cost)) return false;
  } else {
    data.credits = credits - cost;
  }

  levels(gameState)[id] = lv + 1;
  return true;
}

export function getUpgradeCosts() {
  return [...COSTS];
}

/**
 * 汇总所有升级对玩家的加成，供属性重算与各系统读取。
 */
export function getUpgradeBonuses(gameState) {
  return {
    attack: getUpgradeValue(gameState, 'plasma_edge'),
    armorPierce: getUpgradeValue(gameState, 'breach_coating'),
    maxHp: getUpgradeValue(gameState, 'reinforced_suit'),
    pickupRadius: getUpgradeValue(gameState, 'magnetic_pack'),
    heatTolerance: getUpgradeValue(gameState, 'thermal_core'),
    buffDuration: getUpgradeValue(gameState, 'insulated_case')
  };
}
