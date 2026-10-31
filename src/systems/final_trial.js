// Galaxy Hunter: Gourmet Odyssey - 终极评鉴
// 集齐三星后开启的终局挑战：讨伐传奇异兽「虚空母龙」，
// 用它的心脏做出终极料理，接受米其林评审团的最终评定。

export const TRIAL_STATES = {
  LOCKED: 'locked',       // 未满三星
  AVAILABLE: 'available', // 可以开启
  HUNTING: 'hunting',     // Boss 已降临，讨伐中
  COOKING: 'cooking',     // Boss 已讨伐，等待终极料理
  COMPLETE: 'complete'    // 已通关
};

export const TRIAL_BOSS_ID = 'void_matriarch';
export const TRIAL_TROPHY_ID = 'void_matriarch_heart';

// Boss 的三个阶段：血量跌破阈值时进入下一阶段
export const BOSS_PHASES = [
  { at: 1.00, label: '苏醒', speedMult: 1.0, damageMult: 1.0, defense: 30 },
  { at: 0.66, label: '狂怒', speedMult: 1.22, damageMult: 1.18, defense: 24 },
  { at: 0.33, label: '崩解', speedMult: 1.45, damageMult: 1.35, defense: 16 }
];

/**
 * Boss 降临的坐标：地图正北方的空旷地带，远离营地安全区。
 */
export function getArenaPosition(map) {
  return { x: map.campPosition.x, y: Math.max(180, map.campPosition.y - 620) };
}

export function getTrialData(gameData) {
  if (!gameData.finalTrial) {
    gameData.finalTrial = { state: TRIAL_STATES.LOCKED, bossKills: 0, bestGrade: null };
  }
  return gameData.finalTrial;
}

/**
 * 根据星级与当前进度推导终极评鉴的可用状态。
 */
export function refreshTrialState(gameData) {
  const trial = getTrialData(gameData);
  if (trial.state === TRIAL_STATES.LOCKED && (gameData.michelinStars || 0) >= 3) {
    trial.state = TRIAL_STATES.AVAILABLE;
  }
  return trial.state;
}

export function currentPhase(hpRatio) {
  let phase = BOSS_PHASES[0];
  for (const p of BOSS_PHASES) {
    if (hpRatio <= p.at) phase = p;
  }
  return phase;
}

export function phaseIndex(hpRatio) {
  return BOSS_PHASES.indexOf(currentPhase(hpRatio));
}

/**
 * 讨伐 Boss 所需的强化程度参考，用于在面板上给玩家一个预期。
 */
export const TRIAL_BOSS_STATS = {
  hp: 2600,
  defense: 30,
  damage: 46,
  radius: 74
};

/**
 * 终局评定：把整局的经营成果折算成最终评价。
 */
export function evaluateFinalGrade(gameData, dishScore) {
  const rep = gameData.reputation || 0;
  const dishes = (gameData.cookedDishes || []).length;
  const discovered = (gameData.discoveredRecipes || []).length;

  const dishPart = Math.max(0, Math.min(100, dishScore || 0)) * 0.45;
  const repPart = Math.min(100, (rep / 600) * 100) * 0.25;
  const codexPart = Math.min(100, (discovered / 21) * 100) * 0.2;
  const volumePart = Math.min(100, (dishes / 30) * 100) * 0.1;

  const total = Math.round(dishPart + repPart + codexPart + volumePart);

  let grade = 'C';
  let title = '合格的野外厨师';
  if (total >= 92) { grade = 'S'; title = '宇宙食神 · 传奇认证'; }
  else if (total >= 82) { grade = 'A'; title = '银河名厨 · 三星主厨'; }
  else if (total >= 70) { grade = 'B'; title = '声名鹊起的星际料理人'; }

  return {
    total,
    grade,
    title,
    breakdown: [
      { label: '终极料理', value: Math.round(dishPart / 0.45), weight: '45%' },
      { label: '公会声望', value: Math.round(repPart / 0.25), weight: '25%' },
      { label: '食谱图鉴', value: Math.round(codexPart / 0.2), weight: '20%' },
      { label: '出餐总数', value: Math.round(volumePart / 0.1), weight: '10%' }
    ]
  };
}
