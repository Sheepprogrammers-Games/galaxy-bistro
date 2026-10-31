// Galaxy Hunter: Gourmet Odyssey - 新手引导
// 一条按顺序推进的任务链。每步由世界里的实际动作触发，不拦输入、不弹窗。

export const TUTORIAL_STEPS = [
  {
    id: 'walk',
    title: '先动起来',
    hint: 'WASD 移动，Shift 冲刺',
    goal: 260,
    unit: '米',
    credits: 60,
    tip: '按住 Shift 会消耗耐力，耐力条在头顶。'
  },
  {
    id: 'gather',
    title: '采一份食材',
    hint: '走到资源点旁，按 E 或直接攻击',
    goal: 1,
    unit: '份',
    credits: 80,
    tip: '资源点脚下有一圈虚线，名牌上写着能采到什么。'
  },
  {
    id: 'hunt',
    title: '猎到第一只异兽',
    hint: '左键攻击，Shift 冲刺闪避',
    goal: 1,
    unit: '只',
    credits: 120,
    tip: '护甲高的猎物按 H 破甲，普通攻击会被弹开。'
  },
  {
    id: 'camp',
    title: '回星尘营地',
    hint: '按 V 打开测绘图，点营地图标就能传送',
    goal: 1,
    unit: '次',
    credits: 60,
    tip: '营地是安全区，异兽进不来。'
  },
  {
    id: 'cook',
    title: '做出第一道料理',
    hint: '走到灶台按 E，或直接按 C',
    goal: 1,
    unit: '道',
    credits: 160,
    tip: '切、拌、烤三种手法各有加分项，摆盘也算分。'
  },
  {
    id: 'eat',
    title: '尝一口自己的手艺',
    hint: '按 B 打开行囊，在「已烹饪料理」里享用',
    goal: 1,
    unit: '道',
    credits: 100,
    tip: '料理的增益有时限，出发前再吃效率最高。'
  },
  {
    id: 'bounty',
    title: '接一份米其林悬赏',
    hint: '按 Q 打开悬赏榜',
    goal: 1,
    unit: '份',
    credits: 120,
    tip: '猎杀类悬赏会把目标标在地图和雷达上。'
  },
  {
    id: 'bounty_done',
    title: '交付这份悬赏',
    hint: '完成后在野外直接点目标领取，或回营地交付',
    goal: 1,
    unit: '份',
    credits: 260,
    tip: '口碑够了会自动解锁新食谱和新星球。'
  },
  {
    id: 'upgrade',
    title: '在星尘工坊强化一次',
    hint: '按 G 打开工坊',
    goal: 1,
    unit: '次',
    credits: 200,
    tip: '工坊的强化是永久的，死亡也不会掉。'
  }
];

export const TUTORIAL_BONUS = { credits: 800, rep: 40 };

export function ensureTutorial(gameData) {
  if (!gameData) return null;
  if (!gameData.tutorial || typeof gameData.tutorial !== 'object') gameData.tutorial = {};
  const t = gameData.tutorial;
  if (!Number.isFinite(t.step)) t.step = 0;
  if (!Number.isFinite(t.progress)) t.progress = 0;
  if (typeof t.done !== 'boolean') t.done = false;
  if (typeof t.skipped !== 'boolean') t.skipped = false;
  if (typeof t.collapsed !== 'boolean') t.collapsed = false;
  return t;
}

export function currentStep(gameData) {
  const t = ensureTutorial(gameData);
  if (t.done || t.skipped) return null;
  return TUTORIAL_STEPS[t.step] || null;
}

export function isActive(gameData) {
  const t = ensureTutorial(gameData);
  return !t.done && !t.skipped;
}

/**
 * 上报一次动作。只有当前这一步认这个 id 才会计数，
 * 计满就发奖并跳到下一步。
 */
export function reportTutorial(gameData, id, amount = 1) {
  const t = ensureTutorial(gameData);
  if (t.done || t.skipped) return null;

  const step = TUTORIAL_STEPS[t.step];
  if (!step || step.id !== id) return null;

  t.progress = Math.min(step.goal, t.progress + amount);
  if (t.progress < step.goal) return { advanced: false, step };

  gameData.credits = (gameData.credits || 0) + step.credits;
  t.step += 1;
  t.progress = 0;

  if (t.step >= TUTORIAL_STEPS.length) {
    t.done = true;
    gameData.credits = (gameData.credits || 0) + TUTORIAL_BONUS.credits;
    gameData.reputation = (gameData.reputation || 0) + TUTORIAL_BONUS.rep;
    return { advanced: true, step, finished: true };
  }

  return { advanced: true, step, next: TUTORIAL_STEPS[t.step] };
}

export function skipTutorial(gameData) {
  const t = ensureTutorial(gameData);
  t.skipped = true;
  return t;
}

export function toggleCollapsed(gameData) {
  const t = ensureTutorial(gameData);
  t.collapsed = !t.collapsed;
  return t.collapsed;
}
