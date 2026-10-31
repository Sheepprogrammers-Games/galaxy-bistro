// Galaxy Hunter: Gourmet Odyssey - Michelin Star Bounty Guild System
// Provides 1-Star, 2-Star, and 3-Star hunting contracts & culinary delivery quests with credit & reputation rewards.

import { sound } from '../audio.js';
import { isRecipeUnlocked, getRecipeById, recipeUnlockRep } from './recipes.js';

export const BOUNTY_TYPES = {
  HUNT: 'hunt',
  GATHER: 'gather',
  COOK_DELIVERY: 'cook_delivery'
};

export const BOUNTY_TIERS = {
  ONE_STAR: 1,
  TWO_STAR: 2,
  THREE_STAR: 3
};

export const GUILD_BOUNTIES = [
  // ================= 1-STAR CONTRACTS (NOVICE HUNTER) =================
  {
    id: 'bounty_hare_hunt',
    tier: BOUNTY_TIERS.ONE_STAR,
    type: BOUNTY_TYPES.HUNT,
    title: '【初星委托】荧光电兔族群调控',
    titleEn: 'Electro-Hare Population Control',
    icon: '🐇⚡',
    desc: '荧光菌林的孢子电兔繁殖过剩，啃食了大量跳跳菇。消灭 3 只电兔并收集后腿肉。',
    targetId: 'spore_bunny',
    targetName: '孢子电兔',
    targetCount: 3,
    rewardCredits: 120,
    rewardRep: 35,
    reqReputation: 0
  },
  {
    id: 'bounty_spore_gather',
    tier: BOUNTY_TIERS.ONE_STAR,
    type: BOUNTY_TYPES.GATHER,
    title: '【初星委托】夜光菌草采摘行动',
    titleEn: 'Luminous Spore Herb Foraging',
    icon: '🌿✨',
    desc: '居酒屋调制高汤急需高品质荧光孢子香草。请在荒野采集 4 份香草。',
    targetId: 'spore_herb',
    targetName: '荧光孢子香草',
    targetCount: 4,
    rewardCredits: 100,
    rewardRep: 30,
    reqReputation: 0
  },
  {
    id: 'bounty_aurora_parfait_delivery',
    tier: BOUNTY_TIERS.ONE_STAR,
    type: BOUNTY_TYPES.COOK_DELIVERY,
    title: '【初星美食】波波的极光甜品心愿',
    titleEn: 'Blobby\'s Aurora Parfait Order',
    icon: '🍧🍮',
    desc: '为等离子史莱姆波波烹饪 1 份【猎户座极光芭菲】，满足其对冰晶甜品的极致渴望。',
    targetId: 'aurora_parfait',
    targetName: '猎户座极光芭菲',
    targetCount: 1,
    rewardCredits: 150,
    rewardRep: 45,
    reqReputation: 20
  },
  {
    id: 'bounty_shroom_gather',
    tier: BOUNTY_TIERS.ONE_STAR,
    type: BOUNTY_TYPES.GATHER,
    title: '【初星委托】零重力跳跳菇采集',
    titleEn: 'Zero-G Bouncy Mushroom Harvest',
    icon: '🍄🚀',
    desc: '收集 3 朵鲜嫩饱满的零重力跳跳菇，为野外营地补充基础主食素料。',
    targetId: 'zero_g_mushroom',
    targetName: '零重力跳跳菇',
    targetCount: 3,
    rewardCredits: 110,
    rewardRep: 30,
    reqReputation: 0
  },

  // ================= 2-STAR CONTRACTS (GOURMET ADVENTURER) =================
  {
    id: 'bounty_thunder_drake_hunt',
    tier: BOUNTY_TIERS.TWO_STAR,
    type: BOUNTY_TYPES.HUNT,
    title: '【二星讨伐】晶簇裂谷的雷鸣巨灵',
    titleEn: 'Crystalline Rift Thunder Golem Hunt',
    icon: '🗿⚡',
    desc: '雷鸣滚滚的高磁裂谷中，脉冲晶甲巨灵威胁着采盐矿道。击败 2 尊晶甲巨灵并截取高能雷霆翼肉。',
    targetId: 'crystal_golem',
    targetName: '脉冲晶甲巨灵',
    targetCount: 2,
    rewardCredits: 260,
    rewardRep: 80,
    reqReputation: 60
  },
  {
    id: 'bounty_plasma_squid_hunt',
    tier: BOUNTY_TIERS.TWO_STAR,
    type: BOUNTY_TYPES.HUNT,
    title: '【二星讨伐】菌林毒影：剧毒刺壳巨蜥',
    titleEn: 'Venom Lizard Shadow Hunt',
    icon: '🦎🧪',
    desc: '狩猎 1 只潜伏在荧光菌林深处的剧毒刺壳巨蜥，获取极品爽脆的等离子触手肉。',
    targetId: 'venom_lizard',
    targetName: '剧毒刺壳巨蜥',
    targetCount: 1,
    rewardCredits: 240,
    rewardRep: 75,
    reqReputation: 50
  },
  {
    id: 'bounty_thunder_platter_delivery',
    tier: BOUNTY_TIERS.TWO_STAR,
    type: BOUNTY_TYPES.COOK_DELIVERY,
    title: '【二星特供】露娜上尉的硬派龙肉扒',
    titleEn: 'Captain Luna\'s Thunder Platter',
    icon: '🥩⚡',
    desc: '巡航先锋露娜上尉急需一份【雷霆狂啸飞龙扒】来补充零重力巡逻耗损的元气！',
    targetId: 'thunder_platter',
    targetName: '雷霆狂啸飞龙扒',
    targetCount: 1,
    rewardCredits: 280,
    rewardRep: 90,
    reqReputation: 80
  },
  {
    id: 'bounty_frost_lotus_gather',
    tier: BOUNTY_TIERS.TWO_STAR,
    type: BOUNTY_TYPES.GATHER,
    title: '【二星采掘】极寒玄冰雪莲探幽',
    titleEn: 'Glacial Frost Lotus Expedition',
    icon: '🪷❄️',
    desc: '深入绝对零度冻原裂缝，采集 3 朵未凋零的玄冰寒霜雪莲。',
    targetId: 'frost_lotus',
    targetName: '玄冰寒霜雪莲',
    targetCount: 3,
    rewardCredits: 220,
    rewardRep: 70,
    reqReputation: 60
  },

  // ================= 3-STAR CONTRACTS (LEGENDARY MICHELIN MASTER) =================
  {
    id: 'bounty_magma_salamander_hunt',
    tier: BOUNTY_TIERS.THREE_STAR,
    type: BOUNTY_TYPES.HUNT,
    title: '【三星传奇】沸腾熔泉之主：炎火霸王熔螈',
    titleEn: 'Lord of Magma Springs: Tyrant Magma Wyrm',
    icon: '🦎🔥',
    desc: '地热核心栖息着百米级炎火霸王熔螈。击败霸王并斩取极品炙火尾肉！',
    targetId: 'magma_wyrm',
    targetName: '炎火霸王熔螈',
    targetCount: 1,
    rewardCredits: 500,
    rewardRep: 160,
    reqReputation: 140
  },
  {
    id: 'bounty_cryo_mammoth_hunt',
    tier: BOUNTY_TIERS.THREE_STAR,
    type: BOUNTY_TYPES.HUNT,
    title: '【三星传奇】冰河遗迹：极寒雪绒远古猛犸',
    titleEn: 'Glacial Remnant: Ancient Cryo-Mammoth',
    icon: '🦣❄️',
    desc: '挑战冻原之巅的太古猛犸巨兽，获取雪花霜降万年肋排！',
    targetId: 'frost_mammoth',
    targetName: '寒霜雪绒猛犸',
    targetCount: 1,
    rewardCredits: 520,
    rewardRep: 170,
    reqReputation: 160
  },
  {
    id: 'bounty_inspector_supreme_delivery',
    tier: BOUNTY_TIERS.THREE_STAR,
    type: BOUNTY_TYPES.COOK_DELIVERY,
    title: '【三星终极】米其林审查官 X 的终极评审',
    titleEn: 'Inspector X\'s Michelin 3-Star Grand Challenge',
    icon: '👑🌌',
    desc: '烹饪并呈递 1 份【银河创世至尊宴 (米其林特选)】，征服苛刻的匿名评审官，登顶银河三星荣耀！',
    targetId: 'cosmic_fusion_supreme',
    targetName: '银河创世至尊宴',
    targetCount: 1,
    rewardCredits: 888,
    rewardRep: 300,
    reqReputation: 200
  }
];

export class BountyManager {
  constructor(gameState) {
    this.gameState = gameState;
    if (!this.gameState.activeBounties) {
      this.gameState.activeBounties = [];
    }
    if (!this.gameState.completedBountyIds) {
      this.gameState.completedBountyIds = [];
    }
    if (!this.gameState.michelinStars) {
      this.gameState.michelinStars = 0;
    }
  }

  /**
   * 送餐委托要求的那道菜必须已经在图鉴里，否则接了也做不出来。
   */
  isOfferable(bounty) {
    if (bounty.type !== BOUNTY_TYPES.COOK_DELIVERY) return true;
    return isRecipeUnlocked(this.gameState, bounty.targetId);
  }

  getAvailableBounties(tier = null) {
    const currentRep = this.gameState.reputation || 0;
    const completedIds = this.gameState.completedBountyIds || [];

    return GUILD_BOUNTIES.filter(b => {
      if (tier && b.tier !== tier) return false;
      if (b.reqReputation > currentRep) return false;
      if (!this.isOfferable(b)) return false;
      return true;
    }).map(b => {
      const activeObj = this.gameState.activeBounties.find(ab => ab.id === b.id);
      const isCompleted = completedIds.includes(b.id);
      return {
        ...b,
        isActive: !!activeObj,
        isCompleted: isCompleted,
        currentProgress: activeObj ? activeObj.progress : (isCompleted ? b.targetCount : 0),
        canClaim: activeObj ? activeObj.progress >= b.targetCount : false
      };
    });
  }

  acceptBounty(bountyId) {
    if (this.gameState.activeBounties.length >= 3) {
      return { success: false, msg: '悬赏槽位已满（最多同时接取 3 个合约）！' };
    }

    const bounty = GUILD_BOUNTIES.find(b => b.id === bountyId);
    if (!bounty) {
      return { success: false, msg: '未找到该悬赏！' };
    }

    if (this.gameState.activeBounties.some(b => b.id === bountyId)) {
      return { success: false, msg: '该悬赏已在进行中！' };
    }

    if (!this.isOfferable(bounty)) {
      const recipe = getRecipeById(bounty.targetId);
      const need = recipe ? recipeUnlockRep(recipe) : 0;
      return {
        success: false,
        msg: need > 0
          ? `【${bounty.targetName}】还没进图鉴，口碑到 ${need} 才会解锁。`
          : `【${bounty.targetName}】还没进图鉴，先在灶台做出一次。`
      };
    }

    let initialProgress = 0;
    // For gather quests, check if player already has some in inventory
    if (bounty.type === BOUNTY_TYPES.GATHER) {
      initialProgress = Math.min(bounty.targetCount, this.gameState.inventory[bounty.targetId] || 0);
    }

    this.gameState.activeBounties.push({
      id: bounty.id,
      progress: initialProgress,
      targetCount: bounty.targetCount,
      acceptedAt: Date.now()
    });

    sound.playSparkle();
    return { success: true, msg: `已成功接取委托：${bounty.title}！` };
  }

  abandonBounty(bountyId) {
    const idx = this.gameState.activeBounties.findIndex(b => b.id === bountyId);
    if (idx !== -1) {
      this.gameState.activeBounties.splice(idx, 1);
      return { success: true, msg: '已放弃委托。' };
    }
    return { success: false, msg: '未找到该活动委托。' };
  }

  claimBounty(bountyId) {
    const activeIdx = this.gameState.activeBounties.findIndex(b => b.id === bountyId);
    if (activeIdx === -1) {
      return { success: false, msg: '未处于进行中的委托！' };
    }

    const activeObj = this.gameState.activeBounties[activeIdx];
    const bounty = GUILD_BOUNTIES.find(b => b.id === bountyId);

    if (activeObj.progress < bounty.targetCount) {
      return { success: false, msg: `委托目标尚未完成 (${activeObj.progress}/${bounty.targetCount})！` };
    }

    // For gather & delivery, consume items from inventory if required
    if (bounty.type === BOUNTY_TYPES.GATHER) {
      if ((this.gameState.inventory[bounty.targetId] || 0) < bounty.targetCount) {
        return { success: false, msg: `背包中的 ${bounty.targetName} 数量不足！` };
      }
      this.gameState.inventory[bounty.targetId] -= bounty.targetCount;
    } else if (bounty.type === BOUNTY_TYPES.COOK_DELIVERY) {
      // Find and remove the cooked dish from bag
      const dishIdx = (this.gameState.cookedDishes || []).findIndex(d => d.id === bounty.targetId);
      if (dishIdx === -1) {
        return { success: false, msg: `尚未烹饪好目标料理：${bounty.targetName}！` };
      }
      this.gameState.cookedDishes.splice(dishIdx, 1);
    }

    // Remove from active & mark completed
    this.gameState.activeBounties.splice(activeIdx, 1);
    if (!this.gameState.completedBountyIds.includes(bounty.id)) {
      this.gameState.completedBountyIds.push(bounty.id);
    }

    // Add rewards
    this.gameState.credits = (this.gameState.credits || 0) + bounty.rewardCredits;
    this.gameState.reputation = (this.gameState.reputation || 0) + bounty.rewardRep;

    // Check Michelin star promotion
    let starPromoted = false;
    if (bounty.tier === 1 && this.gameState.michelinStars < 1 && this.gameState.reputation >= 60) {
      this.gameState.michelinStars = 1;
      starPromoted = true;
    } else if (bounty.tier === 2 && this.gameState.michelinStars < 2 && this.gameState.reputation >= 150) {
      this.gameState.michelinStars = 2;
      starPromoted = true;
    } else if (bounty.tier === 3 && this.gameState.michelinStars < 3 && this.gameState.reputation >= 300) {
      this.gameState.michelinStars = 3;
      starPromoted = true;
    }

    if (starPromoted) {
      sound.playStarFanfare();
    } else {
      sound.playCoin();
    }

    return {
      success: true,
      rewardCredits: bounty.rewardCredits,
      rewardRep: bounty.rewardRep,
      starPromoted,
      michelinStars: this.gameState.michelinStars,
      msg: `委托完成！获得 +${bounty.rewardCredits} 信用点，+${bounty.rewardRep} 猎人声望！${starPromoted ? ' 荣获米其林星级晋升！' : ''}`
    };
  }

  // Event handlers
  onCreatureSlain(creatureType) {
    this.gameState.activeBounties.forEach(ab => {
      const bounty = GUILD_BOUNTIES.find(b => b.id === ab.id);
      if (bounty && bounty.type === BOUNTY_TYPES.HUNT && bounty.targetId === creatureType) {
        ab.progress = Math.min(bounty.targetCount, ab.progress + 1);
      }
    });
  }

  onItemGathered(itemId, count = 1) {
    this.gameState.activeBounties.forEach(ab => {
      const bounty = GUILD_BOUNTIES.find(b => b.id === ab.id);
      if (bounty && bounty.type === BOUNTY_TYPES.GATHER && bounty.targetId === itemId) {
        ab.progress = Math.min(bounty.targetCount, (this.gameState.inventory[itemId] || 0));
      }
    });
  }

  onDishCooked(dishResult) {
    this.gameState.activeBounties.forEach(ab => {
      const bounty = GUILD_BOUNTIES.find(b => b.id === ab.id);
      if (bounty && bounty.type === BOUNTY_TYPES.COOK_DELIVERY && bounty.targetId === dishResult.id) {
        ab.progress = Math.min(bounty.targetCount, ab.progress + 1);
      }
    });
  }

  // Compatibility names used by the world controller.
  checkGatherProgress(itemId, count = 1) {
    this.onItemGathered(itemId, count);
  }

  checkHuntProgress(creatureType) {
    this.onCreatureSlain(creatureType);
  }

  getActiveBountiesDetailed() {
    return this.gameState.activeBounties.map(ab => {
      const def = GUILD_BOUNTIES.find(b => b.id === ab.id);
      if (!def) return null;
      return {
        ...def,
        currentProgress: ab.progress,
        isReadyToClaim: ab.progress >= def.targetCount
      };
    }).filter(Boolean);
  }
}
