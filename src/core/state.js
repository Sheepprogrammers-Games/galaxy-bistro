/**
 * Galaxy Hunter: Gourmet Odyssey - Unified Game State Manager
 * Handles player stats, inventory, active culinary buffs, hunter rank,
 * bounties progression, event dispatcher, and LocalStorage auto-persistence.
 */

import {
  CHARACTERS, DEFAULT_CHARACTER_ID, refreshUnlocks, applyCharacterStats
} from '../systems/characters.js';
import { refreshRecipeUnlocks } from '../systems/recipes.js';
import { WEAPONS, DEFAULT_WEAPON_ID } from '../systems/weapons.js';
import { ensureAlmanac } from '../systems/almanac.js';
import { ensureTutorial } from '../systems/tutorial.js';

export const HUNTER_RANKS = [
  { rank: 0, title: '见习异星猎人 (Novice Hunter)', minRep: 0, perk: '解锁基础野外营地与切配台' },
  { rank: 1, title: '★ 荒野初级美食猎手 (1-Star Hunter)', minRep: 100, perk: '解锁等离子炙烤与中阶异兽追踪' },
  { rank: 2, title: '★★ 银河风味大师 (2-Star Master)', minRep: 300, perk: '解锁分子急冻料理与极地冻原深潜' },
  { rank: 3, title: '★★★ 宇宙食神传奇 (3-Star Michelin Legend)', minRep: 700, perk: '解锁远古神兽巅峰挑战与食神金冠' }
];

export class GameState {
  constructor() {
    this.saveKey = 'galaxy_hunter_gourmet_save_v1';
    this.listeners = new Map();

    // Default Initial State
    this.data = this.getDefaultState();

    // Auto-save interval handle
    this.autoSaveTimer = null;
  }

  /**
   * Generates a clean default state.
   */
  getDefaultState() {
    return {
      version: '1.0.0',
      timestamp: Date.now(),
      dayTime: 480, // Game time in minutes (0 - 1440, starts at 08:00 AM)
      dayCount: 1,

      // Player Base Stats
      player: {
        hp: 120,
        maxHp: 120,
        stamina: 100,
        maxStamina: 100,
        staminaRegenRate: 25, // per second
        atk: 18,
        def: 6,
        speed: 190, // px per second
        critRate: 0.1, // 10%
        critDmg: 1.5,
        invulnerableDuration: 0.35, // dash iframes
        position: { x: 1200, y: 900 }
      },

      // Economy & Progression
      hunterRank: 0,
      hunterExp: 0,
      credits: 150,
      reputation: 0,

      // Inventory Catalog: { [itemId: string]: count }
      inventory: {
        nebula_noodle: 3,
        quantum_meat: 2,
        antimatter_chili: 2,
        comet_ice_crystal: 3,
        pulsar_crystal_salt: 2,
        zero_g_mushroom: 3,
        aurora_jelly: 2,
        void_mint: 3
      },

      // Flat fields consumed by the field-cooking and bounty interfaces.
      // They sit alongside the richer player/codex data for backwards compatibility.
      baseStats: {
        maxHp: 120,
        attack: 22,
        speed: 250,
        staminaRegen: 15,
        elemResist: 0,
        nightVision: 100,
        lootMagnet: 80,
        defense: 0,
        critChance: 5
      },
      activeBounties: [],
      completedBountyIds: [],
      michelinStars: 0,
      upgrades: {},
      currentPlanet: 'gliese_9',
      visitedPlanets: ['gliese_9'],

      // 星历：里程碑领取记录、当日委托与异象
      almanac: { claimedDays: [], dailies: [], dailyDay: 0, omenId: 'calm', omenDay: 0, walked: 0 },
      // 新手引导的进度
      tutorial: { step: 0, progress: 0, done: false, skipped: false, collapsed: false },
      discoveredRecipes: [],

      // 武器库与当前配枪
      weaponId: DEFAULT_WEAPON_ID,
      ownedWeapons: [DEFAULT_WEAPON_ID],

      // 补给箱：按时间进货的库存与倒计时
      crateStock: [],
      crateTimer: 75,

      cookedDishes: [],

      // 留影台档案：出餐时自动拍下的成品盘缩略图，pinnedDishId 是贴在相框上的那张
      gallery: [],
      pinnedDishId: null,

      // 当前上场的主厨，以及已解锁的名单
      characterId: DEFAULT_CHARACTER_ID,
      unlockedCharacters: [DEFAULT_CHARACTER_ID],

      // Unlocked Recipe IDs
      unlockedRecipes: ['star_stirfry', 'crystal_skewer', 'shroom_soup'],

      // Active Culinary Buffs: Array<{ id, name, icon, desc, duration, maxDuration, effects: {} }>
      activeBuffs: [],

      // Bounty Quests State
      bounties: [
        {
          id: 'bounty_electro_rabbit',
          title: '电浆孢子兔调查',
          targetName: '孢子电兔',
          targetId: 'electro_rabbit',
          type: 'hunt',
          required: 3,
          current: 0,
          rewardCredits: 120,
          rewardRep: 35,
          stars: 1,
          status: 'active' // 'active' | 'completed' | 'claimed'
        },
        {
          id: 'bounty_magma_pepper',
          title: '反物质红椒采集',
          targetName: '反物质红椒',
          targetId: 'magma_pepper',
          type: 'gather',
          required: 4,
          current: 0,
          rewardCredits: 180,
          rewardRep: 50,
          stars: 1,
          status: 'active'
        },
        {
          id: 'bounty_crystal_pangolin',
          title: '晶簇裂谷穿山甲狩猎',
          targetName: '晶甲穿山甲',
          targetId: 'crystal_pangolin',
          type: 'hunt',
          required: 2,
          current: 0,
          rewardCredits: 350,
          rewardRep: 120,
          stars: 2,
          status: 'locked'
        }
      ],

      // Discovered creatures & ingredients codex
      codex: {
        discoveredCreatures: ['electro_rabbit'],
        discoveredIngredients: ['shroom_zero_g', 'spore_grass', 'beast_meat_fresh', 'crystal_salt'],
        cookedDishesCount: 0
      },

      // Settings
      settings: {
        sfxVolume: 0.8,
        bgmVolume: 0.5,
        screenShake: true,
        showDamageNumbers: true,
        viewDistance: 110
      }
    };
  }

  // ==========================================
  // EVENT DISPATCHER (Pub/Sub)
  // ==========================================

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`[GameState] Error in event listener for ${event}:`, e);
        }
      });
    }
  }

  // ==========================================
  // PLAYER STATS & BUFF CALCULATIONS
  // ==========================================

  /**
   * Calculates effective player stats combined with active culinary buff modifiers.
   */
  getEffectiveStats() {
    const p = this.data.player;
    let bonusHp = 0;
    let bonusAtk = 0;
    let bonusDef = 0;
    let bonusSpeed = 0;
    let bonusCritRate = 0;
    let bonusCritDmg = 0;
    let staminaRegenMult = 1.0;
    let elementalAtk = null;

    for (const buff of this.data.activeBuffs) {
      const eff = buff.effects || {};
      if (eff.atk) bonusAtk += eff.atk;
      if (eff.def) bonusDef += eff.def;
      if (eff.speed) bonusSpeed += eff.speed;
      if (eff.maxHp) bonusHp += eff.maxHp;
      if (eff.critRate) bonusCritRate += eff.critRate;
      if (eff.critDmg) bonusCritDmg += eff.critDmg;
      if (eff.staminaRegen) staminaRegenMult *= (1 + eff.staminaRegen);
      if (eff.elemental) elementalAtk = eff.elemental;
    }

    const effectiveMaxHp = p.maxHp + bonusHp;
    const effectiveAtk = Math.max(1, p.atk + bonusAtk);
    const effectiveDef = Math.max(0, p.def + bonusDef);
    const effectiveSpeed = Math.max(50, p.speed + bonusSpeed);
    const effectiveCritRate = Math.min(1.0, p.critRate + bonusCritRate);
    const effectiveCritDmg = p.critDmg + bonusCritDmg;
    const effectiveStaminaRegen = p.staminaRegenRate * staminaRegenMult;

    return {
      hp: Math.min(p.hp, effectiveMaxHp),
      maxHp: effectiveMaxHp,
      stamina: p.stamina,
      maxStamina: p.maxStamina,
      staminaRegenRate: effectiveStaminaRegen,
      atk: effectiveAtk,
      def: effectiveDef,
      speed: effectiveSpeed,
      critRate: effectiveCritRate,
      critDmg: effectiveCritDmg,
      elementalAtk
    };
  }

  /**
   * Modifies player current HP.
   */
  heal(amount) {
    const stats = this.getEffectiveStats();
    const oldHp = this.data.player.hp;
    this.data.player.hp = Math.min(stats.maxHp, this.data.player.hp + Math.max(0, amount));
    const gained = this.data.player.hp - oldHp;
    if (gained > 0) {
      this.emit('player_healed', { amount: gained, currentHp: this.data.player.hp });
    }
  }

  takeDamage(rawDamage) {
    const stats = this.getEffectiveStats();
    const actualDamage = Math.max(1, Math.round(rawDamage * (100 / (100 + stats.def))));
    this.data.player.hp = Math.max(0, this.data.player.hp - actualDamage);

    this.emit('player_damaged', {
      damage: actualDamage,
      currentHp: this.data.player.hp,
      isDead: this.data.player.hp <= 0
    });

    if (this.data.player.hp <= 0) {
      this.emit('player_died', {});
    }
    return actualDamage;
  }

  /**
   * Consumes stamina if available.
   * @returns {boolean} true if stamina was consumed successfully
   */
  consumeStamina(amount) {
    if (this.data.player.stamina >= amount) {
      this.data.player.stamina -= amount;
      this.emit('stamina_changed', { stamina: this.data.player.stamina });
      return true;
    }
    return false;
  }

  // ==========================================
  // INVENTORY & ITEM MANAGEMENT
  // ==========================================

  addItem(itemId, count = 1) {
    if (count <= 0) return;
    const current = this.data.inventory[itemId] || 0;
    this.data.inventory[itemId] = current + count;

    // Register into codex
    if (!this.data.codex.discoveredIngredients.includes(itemId)) {
      this.data.codex.discoveredIngredients.push(itemId);
    }

    // Check gather bounties
    this.progressBounty('gather', itemId, count);

    this.emit('inventory_changed', { itemId, count: this.data.inventory[itemId], added: count });
  }

  removeItem(itemId, count = 1) {
    if (count <= 0) return false;
    const current = this.data.inventory[itemId] || 0;
    if (current < count) return false;

    this.data.inventory[itemId] = current - count;
    if (this.data.inventory[itemId] <= 0) {
      delete this.data.inventory[itemId];
    }

    this.emit('inventory_changed', { itemId, count: this.data.inventory[itemId] || 0, removed: count });
    return true;
  }

  getItemCount(itemId) {
    return this.data.inventory[itemId] || 0;
  }

  hasItem(itemId, count = 1) {
    return this.getItemCount(itemId) >= count;
  }

  // ==========================================
  // CULINARY BUFFS SYSTEM
  // ==========================================

  /**
   * Applies an active culinary buff from cooked dish.
   * @param {{ id: string, name: string, icon: string, desc: string, duration: number, effects: object }} buff
   */
  addBuff(buff) {
    // Overwrite existing buff with same id or extend
    const existingIndex = this.data.activeBuffs.findIndex((b) => b.id === buff.id);
    const newBuff = {
      id: buff.id,
      name: buff.name || '美味强化',
      icon: buff.icon || '🍲',
      desc: buff.desc || '',
      duration: buff.duration || 60, // seconds
      maxDuration: buff.duration || 60,
      effects: buff.effects || {}
    };

    if (existingIndex >= 0) {
      this.data.activeBuffs[existingIndex] = newBuff;
    } else {
      this.data.activeBuffs.push(newBuff);
    }

    this.emit('buff_added', newBuff);
  }

  removeBuff(buffId) {
    const idx = this.data.activeBuffs.findIndex((b) => b.id === buffId);
    if (idx >= 0) {
      const removed = this.data.activeBuffs.splice(idx, 1)[0];
      this.emit('buff_removed', removed);
    }
  }

  /**
   * Ticks down active buffs and executes over-time effects.
   * @param {number} dt - delta time in seconds
   */
  updateBuffs(dt) {
    if (!this.data.activeBuffs || this.data.activeBuffs.length === 0) return;

    for (let i = this.data.activeBuffs.length - 1; i >= 0; i--) {
      const buff = this.data.activeBuffs[i];
      buff.duration -= dt;

      // Handle HP regeneration per second
      if (buff.effects && buff.effects.hpRegen) {
        this.heal(buff.effects.hpRegen * dt);
      }

      if (buff.duration <= 0) {
        const expired = this.data.activeBuffs.splice(i, 1)[0];
        this.emit('buff_expired', expired);
      }
    }
  }

  // ==========================================
  // ECONOMY, REPUTATION & HUNTER RANK
  // ==========================================

  addCredits(amount) {
    if (amount <= 0) return;
    this.data.credits += amount;
    this.emit('credits_changed', { credits: this.data.credits, added: amount });
  }

  spendCredits(amount) {
    if (amount <= 0 || this.data.credits < amount) return false;
    this.data.credits -= amount;
    this.emit('credits_changed', { credits: this.data.credits, spent: amount });
    return true;
  }

  addReputation(amount) {
    if (amount <= 0) return;
    this.data.reputation += amount;
    this.checkHunterRankPromotion();
    this.emit('reputation_changed', { reputation: this.data.reputation, added: amount });
  }

  checkHunterRankPromotion() {
    let targetRank = 0;
    for (let i = HUNTER_RANKS.length - 1; i >= 0; i--) {
      if (this.data.reputation >= HUNTER_RANKS[i].minRep) {
        targetRank = HUNTER_RANKS[i].rank;
        break;
      }
    }

    if (targetRank > this.data.hunterRank) {
      const oldRank = this.data.hunterRank;
      this.data.hunterRank = targetRank;
      const rankInfo = HUNTER_RANKS[targetRank];

      // Unlock high-tier bounties
      this.data.bounties.forEach((b) => {
        if (b.stars <= targetRank && b.status === 'locked') {
          b.status = 'active';
        }
      });

      this.emit('rank_promoted', { oldRank, newRank: targetRank, rankInfo });
    }
  }

  getCurrentRankInfo() {
    return HUNTER_RANKS[this.data.hunterRank] || HUNTER_RANKS[0];
  }

  // ==========================================
  // BOUNTY PROGRESSION
  // ==========================================

  progressBounty(type, targetId, amount = 1) {
    this.data.bounties.forEach((bounty) => {
      if (bounty.status === 'active' && bounty.type === type && bounty.targetId === targetId) {
        bounty.current = Math.min(bounty.required, bounty.current + amount);
        if (bounty.current >= bounty.required) {
          bounty.status = 'completed';
          this.emit('bounty_completed', bounty);
        }
        this.emit('bounty_progressed', bounty);
      }
    });
  }

  claimBountyReward(bountyId) {
    const bounty = this.data.bounties.find((b) => b.id === bountyId);
    if (bounty && bounty.status === 'completed') {
      bounty.status = 'claimed';
      this.addCredits(bounty.rewardCredits);
      this.addReputation(bounty.rewardRep);
      this.emit('bounty_claimed', bounty);
      return true;
    }
    return false;
  }

  // ==========================================
  // LOCALSTORAGE PERSISTENCE
  // ==========================================

  save(customKey = null) {
    const key = customKey || this.saveKey;
    this.data.timestamp = Date.now();

    // 留影档案里的缩略图是存档体积的大头，写不进去就先丢最早的照片再试
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        localStorage.setItem(key, JSON.stringify(this.data));
        this.emit('game_saved', { timestamp: this.data.timestamp });
        return true;
      } catch (e) {
        const gallery = this.data.gallery;
        const droppable = Array.isArray(gallery)
          && gallery.findLastIndex(p => p.id !== this.data.pinnedDishId);
        if (typeof droppable !== 'number' || droppable < 0) {
          console.error('[GameState] Save failed:', e);
          return false;
        }
        gallery.splice(droppable, 1);
      }
    }
    return false;
  }

  load(customKey = null) {
    try {
      const key = customKey || this.saveKey;
      const raw = localStorage.getItem(key);
      if (!raw) return false;

      const loaded = JSON.parse(raw);
      // Merge with default state structure for backward compatibility
      this.data = Object.assign(this.getDefaultState(), loaded);
      this.normalizeData();
      this.emit('game_loaded', this.data);
      return true;
    } catch (e) {
      console.error('[GameState] Load failed:', e);
      return false;
    }
  }

  /**
   * Fill fields introduced by the current interface when opening an older save.
   * This keeps existing local saves playable while the cooking systems converge
   * on the flat data contract used by their UI.
   */
  normalizeData() {
    const d = this.data;
    d.inventory = d.inventory || {};
    d.activeBounties = Array.isArray(d.activeBounties) ? d.activeBounties : [];
    d.completedBountyIds = Array.isArray(d.completedBountyIds) ? d.completedBountyIds : [];
    d.discoveredRecipes = Array.isArray(d.discoveredRecipes) ? d.discoveredRecipes : (d.unlockedRecipes || []);
    d.cookedDishes = Array.isArray(d.cookedDishes) ? d.cookedDishes : [];
    d.activeBuffs = Array.isArray(d.activeBuffs) ? d.activeBuffs : [];
    d.michelinStars = Number.isFinite(d.michelinStars) ? d.michelinStars : 0;
    d.upgrades = (d.upgrades && typeof d.upgrades === 'object') ? d.upgrades : {};
    d.currentPlanet = typeof d.currentPlanet === 'string' ? d.currentPlanet : 'gliese_9';
    d.visitedPlanets = Array.isArray(d.visitedPlanets) ? d.visitedPlanets : [];
    ensureAlmanac(d);
    ensureTutorial(d);
    if (!d.visitedPlanets.includes('gliese_9')) d.visitedPlanets.push('gliese_9');
    if (!d.visitedPlanets.includes(d.currentPlanet)) d.visitedPlanets.push(d.currentPlanet);
    d.ownedWeapons = Array.isArray(d.ownedWeapons) && d.ownedWeapons.length
      ? d.ownedWeapons.filter(id => WEAPONS.some(w => w.id === id))
      : [DEFAULT_WEAPON_ID];
    if (!d.ownedWeapons.includes(DEFAULT_WEAPON_ID)) d.ownedWeapons.unshift(DEFAULT_WEAPON_ID);
    d.weaponId = d.ownedWeapons.includes(d.weaponId) ? d.weaponId : DEFAULT_WEAPON_ID;
    d.crateStock = Array.isArray(d.crateStock) ? d.crateStock : [];
    d.crateTimer = Number.isFinite(d.crateTimer) ? d.crateTimer : 75;
    d.gallery = Array.isArray(d.gallery) ? d.gallery : [];
    d.pinnedDishId = typeof d.pinnedDishId === 'string' ? d.pinnedDishId : null;
    d.credits = Number.isFinite(d.credits) ? d.credits : 150;
    d.reputation = Number.isFinite(d.reputation) ? d.reputation : 0;
    d.dayCount = Number.isFinite(d.dayCount) ? d.dayCount : 1;
    const defaultSettings = this.getDefaultState().settings;
    d.settings = { ...defaultSettings, ...(d.settings || {}) };
    const viewDistance = Number(d.settings.viewDistance);
    const normalizedViewDistance = Number.isFinite(viewDistance) ? Math.round(viewDistance / 5) * 5 : 110;
    d.settings.viewDistance = Math.max(85, Math.min(140, normalizedViewDistance));
    d.player = d.player || this.getDefaultState().player;
    // baseStats 是纯配置，没有任何玩法会写入它，因此始终以当前默认值为准，
    // 否则旧存档会把已调整过的基础属性带回来。
    d.baseStats = { ...this.getDefaultState().baseStats };

    d.unlockedCharacters = Array.isArray(d.unlockedCharacters) && d.unlockedCharacters.length
      ? d.unlockedCharacters.filter(id => CHARACTERS.some(c => c.id === id))
      : [DEFAULT_CHARACTER_ID];
    if (!d.unlockedCharacters.includes(DEFAULT_CHARACTER_ID)) d.unlockedCharacters.unshift(DEFAULT_CHARACTER_ID);
    d.characterId = d.unlockedCharacters.includes(d.characterId) ? d.characterId : DEFAULT_CHARACTER_ID;
    refreshUnlocks(d);
    refreshRecipeUnlocks(d);
    applyCharacterStats(d);
    return d;
  }

  reset() {
    this.data = this.getDefaultState();
    this.save();
    this.emit('game_reset', this.data);
  }

  startAutoSave(intervalMs = 30000) {
    if (this.autoSaveTimer) clearInterval(this.autoSaveTimer);
    this.autoSaveTimer = setInterval(() => {
      this.save();
    }, intervalMs);
  }

  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }
}

// Global Singleton Instance
export const state = new GameState();
