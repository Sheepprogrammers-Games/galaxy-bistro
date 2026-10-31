// Galaxy Hunter: Gourmet Odyssey - 星球定义
// 一颗星球 = 四个象限的生态配比 + 专属动物区系 + 环境特性 + 解锁门槛。
// fauna 覆盖生态区默认的怪物池，signature 是只在这颗星球出现的物种。

import { BIOMES } from './map.js';

export const PLANETS = [
  {
    id: 'gliese_9',
    name: '格里泽-9 母星',
    nameEn: 'GLIESE-9 HOMEWORLD',
    desc: '四种生态均匀分布的温和星球，公会新人的第一站。',
    // 象限顺序：西北 / 东北 / 西南 / 东南
    quadrants: [BIOMES.FOREST, BIOMES.CRYSTAL, BIOMES.MAGMA, BIOMES.TUNDRA],
    difficulty: 1.0,
    rewardMult: 1.0,
    unlockRep: 0,
    travelCost: 0,
    accent: '#5cd5bd',

    // 环境特性：直接改写玩法手感与画面色调
    traits: {
      label: '温和重力',
      note: '标准重力与光照，没有额外环境负担。',
      gravity: 1.0,
      obstacleDensity: 1.0,
      nightLength: 1.0,
      tint: null,
      // 地表配色偏移：母星是基准，不动
      terrain: null,
      // 只有这颗星球才有的地标障碍
      landmark: null,
      landmarkCount: 0,
      exclusiveNode: null,
      exclusiveIngredient: null
    },

    // 各生态区在这颗星球上的常见物种
    fauna: {
      [BIOMES.FOREST]: ['spore_bunny', 'spore_bunny', 'glide_ray', 'venom_lizard'],
      [BIOMES.CRYSTAL]: ['crystal_golem', 'spine_urchin', 'venom_lizard', 'spore_bunny'],
      [BIOMES.MAGMA]: ['magma_wyrm', 'cinder_hound', 'venom_lizard', 'spore_bunny'],
      [BIOMES.TUNDRA]: ['frost_mammoth', 'glide_ray', 'crystal_golem', 'venom_lizard']
    },
    signature: null
  },
  {
    id: 'hephaestus_4',
    name: '赫菲斯托斯-4 熔核带',
    nameEn: 'HEPHAESTUS-4 MOLTEN BELT',
    desc: '半颗星球都在燃烧。炎火系食材遍地，但这里的异兽也被熔岩淬炼过。',
    quadrants: [BIOMES.MAGMA, BIOMES.MAGMA, BIOMES.CRYSTAL, BIOMES.FOREST],
    difficulty: 1.45,
    rewardMult: 1.4,
    unlockRep: 180,
    travelCost: 400,
    accent: '#f97316',

    traits: {
      label: '低重力 · 高热',
      note: '重力只有母星的七成，跑得更快也更飘；地表遍布熔岩裂缝。',
      gravity: 0.78,
      obstacleDensity: 1.25,
      nightLength: 0.7,
      tint: 'rgba(249, 115, 22, 0.1)',
      // 所有生态区都被熔岩烤过一遍：色相推向橙红，明度压低
      terrain: { hue: -26, sat: 1.35, light: 0.86 },
      landmark: 'ember_vent',
      landmarkCount: 26,
      exclusiveNode: 'HEPHAESTUS_HONEY',
      exclusiveIngredient: 'hephaestus_core_honey'
    },

    fauna: {
      [BIOMES.MAGMA]: ['cinder_hound', 'magma_wyrm', 'magnetar_beetle', 'cinder_hound'],
      [BIOMES.CRYSTAL]: ['magnetar_beetle', 'prism_crab', 'crystal_golem', 'spine_urchin'],
      [BIOMES.FOREST]: ['cinder_hound', 'spine_urchin', 'venom_lizard', 'glide_ray'],
      [BIOMES.TUNDRA]: ['magnetar_beetle', 'frost_mammoth', 'crystal_golem', 'venom_lizard']
    },
    signature: 'magnetar_beetle'
  },
  {
    id: 'ceto_7',
    name: '刻托-7 冰晶环带',
    nameEn: 'CETO-7 GLACIAL RING',
    desc: '恒星死去后残留的冻结世界。最稀有的低温食材，也最要命的猎物。',
    quadrants: [BIOMES.TUNDRA, BIOMES.TUNDRA, BIOMES.CRYSTAL, BIOMES.MAGMA],
    difficulty: 1.9,
    rewardMult: 1.85,
    unlockRep: 420,
    travelCost: 1100,
    accent: '#7dd3fc',

    traits: {
      label: '高重力 · 长夜',
      note: '重力偏高，移动更沉；恒星已死，夜晚长得离谱，虚空生物在夜里活跃。',
      gravity: 1.22,
      obstacleDensity: 0.8,
      nightLength: 1.6,
      tint: 'rgba(125, 211, 252, 0.1)',
      // 恒星已死，一切都被冻住：色相推向青蓝，去饱和并提亮
      terrain: { hue: 34, sat: 0.62, light: 1.22 },
      landmark: 'void_spire',
      landmarkCount: 22,
      exclusiveNode: 'CETO_VOID_ROE',
      exclusiveIngredient: 'ceto_void_roe'
    },

    fauna: {
      [BIOMES.TUNDRA]: ['frost_mammoth', 'void_tendril', 'prism_crab', 'frost_mammoth'],
      [BIOMES.CRYSTAL]: ['prism_crab', 'void_tendril', 'crystal_golem', 'spine_urchin'],
      [BIOMES.MAGMA]: ['void_tendril', 'magma_wyrm', 'prism_crab', 'cinder_hound'],
      [BIOMES.FOREST]: ['void_tendril', 'glide_ray', 'spine_urchin', 'venom_lizard']
    },
    signature: 'void_tendril'
  }
];

const byId = new Map(PLANETS.map(p => [p.id, p]));

export function getPlanet(id) {
  return byId.get(id) || PLANETS[0];
}

export function getCurrentPlanetId(gameData) {
  return gameData?.currentPlanet || PLANETS[0].id;
}

export function getCurrentPlanet(gameData) {
  return getPlanet(getCurrentPlanetId(gameData));
}

/**
 * 星球是否已解锁：看公会声望。
 */
export function isPlanetUnlocked(gameData, planet) {
  return (gameData?.reputation || 0) >= planet.unlockRep;
}

/** 是否已经落过地。落过一次就永久记进存档。 */
export function hasVisited(gameData, planet) {
  const id = typeof planet === 'string' ? planet : planet.id;
  if (id === PLANETS[0].id) return true;
  return (gameData?.visitedPlanets || []).includes(id);
}

/** 本次跃迁要付的星币。开航道只收一次，之后往返免费。 */
export function travelFeeFor(gameData, planet) {
  return hasVisited(gameData, planet) ? 0 : (planet.travelCost || 0);
}

/**
 * 能否现在跃迁过去：已解锁、不是当前所在、星币够开航道的钱。
 */
export function canTravelTo(gameData, planet) {
  if (!isPlanetUnlocked(gameData, planet)) return { ok: false, reason: `需要 ${planet.unlockRep} 声望` };
  if (getCurrentPlanetId(gameData) === planet.id) return { ok: false, reason: '已在此星球' };
  const fee = travelFeeFor(gameData, planet);
  if ((gameData.credits || 0) < fee) return { ok: false, reason: `需要 ${fee} 星币` };
  return { ok: true, reason: '', fee };
}

/**
 * 统计一颗星球上能采到哪些生态区的食材，用于在星图上标注独占资源。
 */
export function planetBiomeSummary(planet) {
  const labels = {
    [BIOMES.FOREST]: '荧光菌林',
    [BIOMES.CRYSTAL]: '晶簇裂谷',
    [BIOMES.MAGMA]: '熔岩温泉',
    [BIOMES.TUNDRA]: '绝对冻原'
  };
  const counts = new Map();
  for (const b of planet.quadrants) counts.set(b, (counts.get(b) || 0) + 1);
  return [...counts.entries()].map(([b, n]) => ({ biome: b, label: labels[b] || b, count: n }));
}

/**
 * 这颗星球上某个生态区会刷哪些物种，没配就退回默认池。
 */
export function planetFauna(planet, biome, fallback) {
  return planet?.fauna?.[biome] || fallback || [];
}

/**
 * 每次落地生成一个新的世界种子，同一颗星球每趟的地貌与刷怪都不同。
 */
export function rollWorldSeed() {
  return Math.floor(Math.random() * 1e9);
}
