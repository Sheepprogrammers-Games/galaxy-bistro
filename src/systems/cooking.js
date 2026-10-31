// Galaxy Hunter: Gourmet Odyssey - Campfire Cooking Simulator & Buff System
// Handles ingredient selection, prep & temperature minigames, dish evaluation, and active player buffs.

import { matchRecipe, getIngredientById, BUFF_TYPES } from './recipes.js';
import { getUpgradeBonuses } from './upgrades.js';
import { sound } from '../audio.js';

export class CookingEngine {
  constructor(gameState) {
    this.gameState = gameState;
    this.selectedIngredients = [];
    this.maxIngredients = 4;
    this.stage = 'idle'; // 'idle' | 'select' | 'prep' | 'heat' | 'plating' | 'done'

    // Minigame state
    this.prepClicks = 0;
    this.prepRequired = 10;
    this.prepProgress = 0;

    this.currentTemp = 25; // 0 to 100 °C
    this.targetTemp = 75;
    this.tempTolerance = 12; // +/- zone
    this.heatTimeRemaining = 8.0; // 8 seconds countdown in heat phase
    this.heatTimeTotal = 8.0;
    this.isHeating = false;
    this.isCooling = false;
    this.tempAccuracyAccumulator = 0;
    this.tempSampleCount = 0;

    this.lastDishResult = null;
    this.onCookingComplete = null;
  }

  // --- INGREDIENT SELECTION ---
  selectIngredient(ingredientId) {
    if (this.selectedIngredients.length >= this.maxIngredients) {
      return false;
    }
    // Check inventory
    const count = this.gameState.inventory[ingredientId] || 0;
    const selectedCount = this.selectedIngredients.filter(id => id === ingredientId).length;
    if (selectedCount >= count) {
      return false;
    }

    this.selectedIngredients.push(ingredientId);
    sound.playChop();
    return true;
  }

  deselectIngredient(ingredientId) {
    const idx = this.selectedIngredients.lastIndexOf(ingredientId);
    if (idx !== -1) {
      this.selectedIngredients.splice(idx, 1);
      sound.playChop();
      return true;
    }
    return false;
  }

  clearSelection() {
    this.selectedIngredients = [];
  }

  getSelectedObjs() {
    return this.selectedIngredients.map(id => getIngredientById(id)).filter(Boolean);
  }

  getMatchedRecipe() {
    return matchRecipe(this.selectedIngredients);
  }

  // --- COOKING LIFECYCLE ---
  startCooking() {
    if (this.selectedIngredients.length === 0) return false;

    const recipe = this.getMatchedRecipe();
    if (!recipe) return false;

    // Deduct ingredients from player inventory
    this.selectedIngredients.forEach(id => {
      if (this.gameState.inventory[id] && this.gameState.inventory[id] > 0) {
        this.gameState.inventory[id]--;
      }
    });

    this.stage = 'kitchen';
    this.prepClicks = 0;
    this.prepRequired = 8 + this.selectedIngredients.length * 2;
    this.prepProgress = 0;
    this.targetTemp = recipe.idealTemp || 75;
    this.currentTemp = 25;
    this.tempAccuracyAccumulator = 0;
    this.tempSampleCount = 0;
    this.heatTimeRemaining = 7.0;
    this.heatTimeTotal = 7.0;

    return true;
  }

  // Prep stage action: player taps/slices
  doPrepSlice() {
    if (this.stage !== 'prep') return false;

    this.prepClicks++;
    this.prepProgress = Math.min(100, Math.round((this.prepClicks / this.prepRequired) * 100));
    sound.playChop();

    if (this.prepClicks >= this.prepRequired) {
      this.stage = 'heat';
      sound.playSizzle();
    }
    return true;
  }

  // Heat stage action: adjust flame
  setHeating(active) {
    this.isHeating = active;
  }

  setCooling(active) {
    this.isCooling = active;
  }

  // Update tick for heat minigame (called in 60FPS loop)
  updateHeatMinigame(deltaTime) {
    if (this.stage !== 'heat') return;

    // Adjust temp
    let heatRate = 35; // degrees/sec
    let coolRate = 40; // degrees/sec
    let naturalDrift = -6; // naturally cools down slowly

    if (this.isHeating) {
      this.currentTemp = Math.min(100, this.currentTemp + heatRate * deltaTime);
    } else if (this.isCooling) {
      this.currentTemp = Math.max(0, this.currentTemp - coolRate * deltaTime);
    } else {
      this.currentTemp = Math.max(0, this.currentTemp + naturalDrift * deltaTime);
    }

    // Sample temperature accuracy
    const tempDiff = Math.abs(this.currentTemp - this.targetTemp);
    const inTolerance = tempDiff <= this.tempTolerance;
    const sampleScore = Math.max(0, 100 - (tempDiff / this.tempTolerance) * 50);
    this.tempAccuracyAccumulator += sampleScore;
    this.tempSampleCount++;

    this.heatTimeRemaining -= deltaTime;

    if (this.heatTimeRemaining <= 0) {
      this.finishDish();
    }
  }

  /**
   * 由厨房场景交回四项工位分数，替代原先只看温度的评价。
   */
  submitStationScores(scores) {
    this.stationScores = {
      knife: Math.round(scores.knife || 0),
      heat: Math.round(scores.heat || 0),
      season: Math.round(scores.season || 0),
      plating: Math.round(scores.plating || 0),
      total: Math.round(scores.total || 0),
      sliceStyle: scores.sliceStyle || null,
      plateStyle: scores.plateStyle || null,
      chefName: scores.chefName || null,
      chefBonus: scores.chefBonus || null
    };
    return this.finishDish();
  }

  // Final evaluation of dish
  finishDish() {
    this.stage = 'done';
    const recipe = this.getMatchedRecipe();

    const stations = this.stationScores || null;
    const avgTempScore = stations
      ? stations.total
      : (this.tempSampleCount > 0
        ? Math.min(100, Math.round(this.tempAccuracyAccumulator / this.tempSampleCount))
        : 70);

    let qualityStars = 1; // 1 to 3
    let qualityName = '普通品质 (Standard)';
    let buffMultiplier = 1.0;

    if (avgTempScore >= 88) {
      qualityStars = 3;
      qualityName = '极品神作 (Masterpiece ★★★)';
      buffMultiplier = 1.5;
      sound.playStarFanfare();
    } else if (avgTempScore >= 70) {
      qualityStars = 2;
      qualityName = '优良佳肴 (Gourmet ★★)';
      buffMultiplier = 1.25;
      sound.playSparkle();
    } else {
      qualityStars = 1;
      qualityName = '可口料理 (Standard ★)';
      buffMultiplier = 1.0;
      sound.playCoin();
    }

    // Register recipe in codex
    if (!this.gameState.discoveredRecipes) {
      this.gameState.discoveredRecipes = [];
    }
    if (!this.gameState.discoveredRecipes.includes(recipe.id)) {
      this.gameState.discoveredRecipes.push(recipe.id);
    }

    // Construct dish item
    const dishResult = {
      ...recipe,
      qualityStars,
      qualityName,
      score: avgTempScore,
      stationScores: stations,
      buffMultiplier,
      adjustedBuff: {
        ...recipe.buff,
        val: Math.round(recipe.buff.val * buffMultiplier),
        duration: Math.round(recipe.buff.duration * (1 + (qualityStars - 1) * 0.2)),
        label: `${recipe.buff.label} [${qualityStars}★]`
      },
      earnedCredits: Math.round(recipe.rewardGold * (0.8 + qualityStars * 0.2)),
      earnedRep: Math.round(recipe.rewardRep * (0.8 + qualityStars * 0.3)),
      createdAt: Date.now()
    };

    this.lastDishResult = dishResult;

    // Add to cooked dishes bag
    if (!this.gameState.cookedDishes) {
      this.gameState.cookedDishes = [];
    }
    this.gameState.cookedDishes.push(dishResult);

    // Apply reputation & credits stats
    this.gameState.credits = (this.gameState.credits || 0) + dishResult.earnedCredits;
    this.gameState.reputation = (this.gameState.reputation || 0) + dishResult.earnedRep;

    // Check bounties progress
    if (this.gameState.onDishCooked) {
      this.gameState.onDishCooked(dishResult);
    }

    if (this.onCookingComplete) {
      this.onCookingComplete(dishResult);
    }

    return dishResult;
  }

  resetCamp() {
    this.stage = 'idle';
    this.selectedIngredients = [];
    this.lastDishResult = null;
    this.stationScores = null;
    this.currentTemp = 25;
  }
}

// --- BUFF MANAGER ---
export class BuffManager {
  static applyBuff(playerState, dishResult) {
    if (!playerState.activeBuffs) {
      playerState.activeBuffs = [];
    }

    const buffData = dishResult.adjustedBuff || dishResult.buff;
    if (!buffData) return;

    // 保温食盒延长增益时长
    const durationMult = 1 + getUpgradeBonuses(playerState).buffDuration;
    const duration = Math.round(buffData.duration * durationMult);

    // Check if same buff type is already active
    const existingIndex = playerState.activeBuffs.findIndex(b => b.type === buffData.type);
    
    const newBuff = {
      id: `${buffData.type}_${Date.now()}`,
      dishName: dishResult.name,
      dishIcon: dishResult.icon,
      type: buffData.type,
      val: buffData.val,
      duration,
      remainingTime: duration,
      totalDuration: duration,
      label: buffData.label,
      appliedAt: Date.now()
    };

    if (existingIndex !== -1) {
      // Refresh or upgrade with higher value/duration
      playerState.activeBuffs[existingIndex] = newBuff;
    } else {
      playerState.activeBuffs.push(newBuff);
    }

    sound.playSparkle();
    BuffManager.recalculateStats(playerState);
  }

  static update(playerState, deltaTime) {
    if (!playerState.activeBuffs || playerState.activeBuffs.length === 0) return;

    let hasExpired = false;
    for (let i = playerState.activeBuffs.length - 1; i >= 0; i--) {
      const buff = playerState.activeBuffs[i];
      buff.remainingTime -= deltaTime;
      if (buff.remainingTime <= 0) {
        playerState.activeBuffs.splice(i, 1);
        hasExpired = true;
      }
    }

    if (hasExpired) {
      BuffManager.recalculateStats(playerState);
    }
  }

  static recalculateStats(playerState) {
    // Base stats
    const baseStats = playerState.baseStats || {
      maxHp: 120,
      attack: 22,
      speed: 250,
      staminaRegen: 15,
      elemResist: 0,
      nightVision: 100,
      lootMagnet: 80,
      defense: 0,
      critChance: 5
    };

    // Modifiers
    let hpBonus = 0;
    let atkMult = 1.0;
    let speedMult = 1.0;
    let staminaRegenMult = 1.0;
    let elemResistBonus = 0;
    let nightVisionMult = 1.0;
    let lootMagnetMult = 1.0;
    let defenseBonus = 0;
    let critBonus = 0;

    (playerState.activeBuffs || []).forEach(b => {
      switch (b.type) {
        case BUFF_TYPES.MAX_HP_BOOST:
          hpBonus += b.val;
          break;
        case BUFF_TYPES.ATK_BOOST:
          atkMult += b.val / 100;
          break;
        case BUFF_TYPES.SPEED_BOOST:
          speedMult += b.val / 100;
          break;
        case BUFF_TYPES.STAMINA_REGEN:
          staminaRegenMult += b.val / 100;
          break;
        case BUFF_TYPES.ELEM_RESIST:
          elemResistBonus += b.val;
          break;
        case BUFF_TYPES.NIGHT_VISION:
          nightVisionMult += b.val / 100;
          break;
        case BUFF_TYPES.LOOT_MAGNET:
          lootMagnetMult += b.val / 100;
          break;
        case BUFF_TYPES.DEFENSE_BOOST:
          defenseBonus += b.val;
          break;
        case BUFF_TYPES.CRIT_BOOST:
          critBonus += b.val;
          break;
      }
    });

    // 工坊的永久升级叠在基础属性之上，再乘料理增益
    const up = getUpgradeBonuses(playerState);

    playerState.maxHp = baseStats.maxHp + up.maxHp + hpBonus;
    playerState.attack = Math.round((baseStats.attack + up.attack) * atkMult);
    playerState.speed = Math.round(baseStats.speed * speedMult);
    playerState.staminaRegen = baseStats.staminaRegen * staminaRegenMult;
    playerState.elemResist = Math.min(85, baseStats.elemResist + elemResistBonus);
    playerState.nightVisionRadius = Math.round(baseStats.nightVision * nightVisionMult);
    playerState.lootMagnetRadius = Math.round((baseStats.lootMagnet + up.pickupRadius) * lootMagnetMult);
    playerState.armorPierceBonus = up.armorPierce;
    playerState.defense = Math.min(75, baseStats.defense + defenseBonus);
    playerState.critChance = Math.min(80, baseStats.critChance + critBonus);

    // Keep current HP within max HP limit
    if (playerState.hp > playerState.maxHp) {
      playerState.hp = playerState.maxHp;
    }
  }

  static updateBuffs(dt, playerState, player = null, hud = null) {
    BuffManager.update(playerState, dt);
    if (player) {
      if (playerState.maxHp) {
        player.maxHp = playerState.maxHp;
        if (player.hp > player.maxHp) player.hp = player.maxHp;
      }
      if (playerState.speed) {
        // 星球重力越低跑得越快，envSpeedMult 由跃迁时按星球特性写入；
        // omenSpeedMult 是当日异象的修正，两者相乘
        const env = (player.envSpeedMult || 1) * (player.omenSpeedMult || 1);
        player.speed = playerState.speed * env;
        player.baseSpeed = player.speed;
      }
      // 这里原本读的是从未被赋值的 lootMagnet，导致拾取范围永远不生效
      if (playerState.lootMagnetRadius) player.pickupRadius = playerState.lootMagnetRadius;
      player.armorPierceBonus = playerState.armorPierceBonus || 0;
      if (playerState.attack && player.weapon) {
        player.weapon.baseDamage = playerState.attack;
      }
      if (playerState.critChance && player.weapon) {
        player.weapon.critChance = (playerState.critChance || 5) / 100;
      }
    }
  }

  static getActiveBuffs(playerState) {
    return (playerState.activeBuffs || []).map(b => ({
      ...b,
      percentRemaining: Math.max(0, Math.min(100, Math.round((b.remainingTime / b.totalDuration) * 100))),
      timeDisplay: `${Math.ceil(b.remainingTime)}s`
    }));
  }
}
