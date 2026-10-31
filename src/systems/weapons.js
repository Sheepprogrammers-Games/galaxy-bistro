// Galaxy Hunter: Gourmet Odyssey - 武器
// 近战武器改写挥击数值，枪械改走投射物分支。军械商按口碑上架，星币购买。

export const WEAPON_KIND = { MELEE: 'melee', RANGED: 'ranged' };

export const WEAPONS = [
  {
    id: 'plasma_chef_knife',
    model: 'chef_knife',
    name: '等离子主厨刀',
    nameEn: 'PLASMA CHEF KNIFE',
    kind: WEAPON_KIND.MELEE,
    desc: '公会配发的标配。轻快、顺手，连段收刀干净。',
    damage: 22,
    critChance: 0.15,
    critMultiplier: 1.8,
    color: '#38bdf8',
    glowColor: '#0284c7',
    cost: 0,
    reqRep: 0
  },
  {
    id: 'boning_twin_blades',
    model: 'twin_blades',
    name: '双刃剔骨刀',
    nameEn: 'TWIN BONING BLADES',
    kind: WEAPON_KIND.MELEE,
    desc: '一手一把的短刃。单下伤害低，但出手快、暴击高，适合缠斗。',
    damage: 17,
    critChance: 0.34,
    critMultiplier: 2.0,
    color: '#a3e635',
    glowColor: '#4d7c0f',
    cost: 620,
    reqRep: 60
  },
  {
    id: 'meteor_cleaver',
    model: 'cleaver',
    name: '陨铁重斩刀',
    nameEn: 'METEORITE CLEAVER',
    kind: WEAPON_KIND.MELEE,
    desc: '半米长的陨铁厚背刀。挥得慢，但每一下都能顺着甲缝劈进去。',
    damage: 38,
    critChance: 0.1,
    critMultiplier: 2.2,
    armorPierce: 0.22,
    color: '#f59e0b',
    glowColor: '#b45309',
    cost: 1450,
    reqRep: 160
  },

  // --- 枪械：按 J / 左键开火，消耗耐力，有射速限制 ---
  {
    id: 'pulse_sidearm',
    model: 'sidearm',
    name: '脉冲手枪',
    nameEn: 'PULSE SIDEARM',
    kind: WEAPON_KIND.RANGED,
    desc: '压缩等离子弹丸。射速快、后坐小，是拉开距离的第一把枪。',
    damage: 14,
    critChance: 0.12,
    critMultiplier: 1.7,
    shots: 1,
    spread: 0.03,
    projectileSpeed: 720,
    range: 460,
    fireCooldown: 0.24,
    staminaCost: 4,
    color: '#22d3ee',
    glowColor: '#0e7490',
    cost: 900,
    reqRep: 90
  },
  {
    id: 'stardust_scatter',
    model: 'scattergun',
    name: '星尘霰弹枪',
    nameEn: 'STARDUST SCATTERGUN',
    kind: WEAPON_KIND.RANGED,
    desc: '一次泼出五颗星尘弹丸。散得开，贴脸打全中，远了几乎全空。',
    damage: 11,
    critChance: 0.14,
    critMultiplier: 1.8,
    shots: 5,
    spread: 0.3,
    projectileSpeed: 620,
    range: 250,
    fireCooldown: 0.62,
    staminaCost: 11,
    color: '#fbbf24',
    glowColor: '#b45309',
    cost: 1700,
    reqRep: 200
  },
  {
    id: 'antimatter_rifle',
    model: 'rifle',
    name: '反物质步枪',
    nameEn: 'ANTIMATTER RIFLE',
    kind: WEAPON_KIND.RANGED,
    desc: '一发穿三只。装填慢得让人心慌，但没有什么甲挡得住它。',
    damage: 46,
    critChance: 0.2,
    critMultiplier: 2.1,
    shots: 1,
    spread: 0,
    pierce: 3,
    armorPierce: 0.35,
    projectileSpeed: 1150,
    range: 780,
    fireCooldown: 0.95,
    staminaCost: 17,
    color: '#c084fc',
    glowColor: '#6d28d9',
    cost: 3200,
    reqRep: 340
  }
];

export const DEFAULT_WEAPON_ID = WEAPONS[0].id;

const byId = new Map(WEAPONS.map(w => [w.id, w]));

export function getWeapon(id) {
  return byId.get(id) || WEAPONS[0];
}

export function getActiveWeapon(gameData) {
  return getWeapon(gameData?.weaponId || DEFAULT_WEAPON_ID);
}

export function ownsWeapon(gameData, id) {
  return (gameData?.ownedWeapons || []).includes(id);
}

/** 上架状态：口碑不够时锁着，够了但没买则显示价格。 */
export function weaponStatus(gameData, weapon) {
  const rep = gameData?.reputation || 0;
  if (ownsWeapon(gameData, weapon.id)) return { owned: true, locked: false, reason: '' };
  if (rep < weapon.reqRep) {
    return { owned: false, locked: true, reason: `口碑达到 ${weapon.reqRep}`, progress: rep, need: weapon.reqRep };
  }
  const afford = (gameData?.credits || 0) >= weapon.cost;
  return { owned: false, locked: false, afford, reason: afford ? '' : `还差 ${weapon.cost - (gameData.credits || 0)} 星币` };
}

/**
 * 购买武器。成功时扣星币并写进已拥有列表。
 */
export function buyWeapon(gameData, id) {
  const weapon = getWeapon(id);
  const st = weaponStatus(gameData, weapon);
  if (st.owned) return { ok: false, msg: '已经拥有这把武器。' };
  if (st.locked) return { ok: false, msg: `${weapon.name} 尚未上架：${st.reason}。` };
  if (!st.afford) return { ok: false, msg: `星币不足，${st.reason}。` };

  gameData.credits -= weapon.cost;
  if (!Array.isArray(gameData.ownedWeapons)) gameData.ownedWeapons = [];
  gameData.ownedWeapons.push(id);
  return { ok: true, msg: `已购入【${weapon.name}】。`, weapon };
}

/**
 * 把武器数值写进玩家实体。枪械额外挂 ranged 描述，
 * 主循环据此走投射物分支而不是挥刀。
 */
export function equipWeapon(player, weapon) {
  if (!player || !weapon) return;

  player.weapon = {
    name: weapon.name,
    type: weapon.id,
    kind: weapon.kind,
    model: weapon.model || 'chef_knife',
    baseDamage: weapon.damage,
    critChance: weapon.critChance,
    critMultiplier: weapon.critMultiplier,
    color: weapon.color,
    glowColor: weapon.glowColor
  };

  player.weaponArmorPierce = weapon.armorPierce || 0;
  player.ranged = weapon.kind === WEAPON_KIND.RANGED
    ? {
      shots: weapon.shots || 1,
      spread: weapon.spread || 0,
      speed: weapon.projectileSpeed || 700,
      range: weapon.range || 400,
      cooldown: weapon.fireCooldown || 0.3,
      staminaCost: weapon.staminaCost || 5,
      pierce: weapon.pierce || 1,
      color: weapon.color
    }
    : null;
}

/** 图鉴与商店里显示的一行数值摘要。 */
export function weaponSummary(weapon) {
  if (weapon.kind === WEAPON_KIND.RANGED) {
    const rate = (1 / (weapon.fireCooldown || 0.3)).toFixed(1);
    return [
      ['伤害', weapon.damage],
      ['弹丸', weapon.shots],
      ['射速', `${rate}/s`],
      ['射程', weapon.range],
      ['耐力', weapon.staminaCost]
    ];
  }
  return [
    ['伤害', weapon.damage],
    ['暴击', `${Math.round(weapon.critChance * 100)}%`],
    ['暴伤', `${weapon.critMultiplier}x`],
    ['破甲', `${Math.round((weapon.armorPierce || 0) * 100)}%`]
  ];
}
