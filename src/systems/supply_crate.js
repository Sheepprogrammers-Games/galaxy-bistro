// Galaxy Hunter: Gourmet Odyssey - 营地补给箱
// 随游戏时间自动进货：多数是食材，偶尔是一份现成料理，少数时候是一把武器。
// 库存存在存档里，离开再回来还在。

import { ALL_INGREDIENTS, RECIPES, getIngredientById, getRecipeById } from './recipes.js';
import { WEAPONS, getWeapon, ownsWeapon } from './weapons.js';

export const CRATE_INTERVAL = 75;   // 每 75 秒进一次货
export const CRATE_CAPACITY = 8;    // 装满就不再进，取走后继续

const KIND = { INGREDIENT: 'ingredient', DISH: 'dish', WEAPON: 'weapon' };

function pick(list, rng = Math.random) {
  return list[Math.floor(rng() * list.length)] || null;
}

/**
 * 掷一份补给。权重：食材 62% / 料理 26% / 武器 12%。
 * 武器只会掉还没拥有、且口碑够得着的那些；没有符合的就退回食材。
 */
export function rollSupply(gameData, rng = Math.random) {
  const roll = rng();

  if (roll > 0.88) {
    const rep = gameData?.reputation || 0;
    const pool = WEAPONS.filter(w => w.cost > 0 && !ownsWeapon(gameData, w.id) && rep >= w.reqRep * 0.6);
    const w = pick(pool, rng);
    if (w) return { kind: KIND.WEAPON, id: w.id, count: 1, name: w.name };
  }

  if (roll > 0.62) {
    // 只发已经进过图鉴的菜，避免凭空拿到还没解锁的料理
    const known = (gameData?.discoveredRecipes || [])
      .map(id => getRecipeById(id))
      .filter(r => r && r.tier <= 3);
    const r = pick(known, rng);
    if (r) return { kind: KIND.DISH, id: r.id, count: 1, name: r.name, stars: 1 + Math.floor(rng() * 2) };
  }

  // 低阶食材为主，偶尔混一份高阶的
  const tierCap = rng() > 0.82 ? 4 : 2;
  const pool = ALL_INGREDIENTS.filter(i => (i.tier || 1) <= tierCap && !i.planetOnly);
  const ing = pick(pool, rng);
  if (!ing) return null;
  return { kind: KIND.INGREDIENT, id: ing.id, count: 1 + Math.floor(rng() * 2), name: ing.name };
}

/**
 * 推进补给箱计时。返回这次新进货的条目，供上层提示。
 */
export function tickCrate(gameData, dt) {
  if (!Array.isArray(gameData.crateStock)) gameData.crateStock = [];
  if (!Number.isFinite(gameData.crateTimer)) gameData.crateTimer = CRATE_INTERVAL;

  if (gameData.crateStock.length >= CRATE_CAPACITY) {
    gameData.crateTimer = CRATE_INTERVAL;
    return null;
  }

  gameData.crateTimer -= dt;
  if (gameData.crateTimer > 0) return null;

  gameData.crateTimer = CRATE_INTERVAL;
  const entry = rollSupply(gameData);
  if (!entry) return null;

  gameData.crateStock.push(entry);
  return entry;
}

/** 取出全部库存，写进背包 / 料理袋 / 武器库。返回归类后的清单。 */
export function claimCrate(gameData) {
  const stock = gameData.crateStock || [];
  if (!stock.length) return { taken: [], empty: true };

  const taken = [];
  for (const entry of stock) {
    if (entry.kind === KIND.INGREDIENT) {
      gameData.inventory[entry.id] = (gameData.inventory[entry.id] || 0) + entry.count;
      taken.push(entry);
    } else if (entry.kind === KIND.DISH) {
      const recipe = getRecipeById(entry.id);
      if (!recipe) continue;
      const stars = entry.stars || 1;
      const mult = stars >= 3 ? 1.5 : stars === 2 ? 1.25 : 1.0;
      gameData.cookedDishes = gameData.cookedDishes || [];
      gameData.cookedDishes.push({
        ...recipe,
        qualityStars: stars,
        qualityName: stars >= 2 ? '优良佳肴 (Gourmet ★★)' : '可口料理 (Standard ★)',
        score: 60 + stars * 8,
        buffMultiplier: mult,
        adjustedBuff: {
          ...recipe.buff,
          val: Math.round(recipe.buff.val * mult),
          duration: Math.round(recipe.buff.duration * (1 + (stars - 1) * 0.2)),
          label: `${recipe.buff.label} [${stars}★]`
        }
      });
      taken.push(entry);
    } else if (entry.kind === KIND.WEAPON) {
      if (!Array.isArray(gameData.ownedWeapons)) gameData.ownedWeapons = [];
      if (!gameData.ownedWeapons.includes(entry.id)) gameData.ownedWeapons.push(entry.id);
      taken.push(entry);
    }
  }

  gameData.crateStock = [];
  return { taken, empty: false };
}

/** 面板与世界图标要显示的库存摘要。 */
export function crateSummary(gameData) {
  const stock = gameData?.crateStock || [];
  return {
    count: stock.length,
    full: stock.length >= CRATE_CAPACITY,
    nextIn: Math.max(0, Math.ceil(gameData?.crateTimer ?? CRATE_INTERVAL)),
    items: stock.map(e => ({
      ...e,
      icon: e.kind === KIND.WEAPON ? 'bolt' : e.kind === KIND.DISH ? 'book' : 'veg',
      detail: e.kind === KIND.INGREDIENT
        ? `食材 ×${e.count}`
        : e.kind === KIND.DISH
          ? `料理 ${e.stars || 1}★`
          : '武器'
    }))
  };
}

export { KIND as CRATE_KIND };
