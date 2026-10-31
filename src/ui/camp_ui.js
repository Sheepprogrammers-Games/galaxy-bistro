// Galaxy Hunter: Gourmet Odyssey - Camp Modals & Culinary Interface
// Camp Cooking Simulator, Inventory Backpack, Michelin Bounty Board, and Recipe Codex.

import {
  ALL_INGREDIENTS, RECIPES, INGREDIENT_CATEGORIES, getIngredientById, rawFoodValue
} from '../systems/recipes.js';
import {
  WEAPONS, getWeapon, getActiveWeapon, ownsWeapon, weaponStatus, buyWeapon, weaponSummary, WEAPON_KIND
} from '../systems/weapons.js';
import { crateSummary, claimCrate, CRATE_CAPACITY } from '../systems/supply_crate.js';
import {
  ensureAlmanac, getOmen, DAY_MILESTONES, milestoneStatus, claimMilestone,
  dailyLabel, claimDaily
} from '../systems/almanac.js';
import { BuffManager } from '../systems/cooking.js';
import { sound, audio } from '../audio.js';
import { state } from '../core/state.js';
import { icon, ingredientIcon, dishIcon, bountyIcon } from './icons.js';
import { KitchenScene } from './kitchen_scene.js';
import {
  UPGRADES, UPGRADE_TRACKS, TRACK_META, MAX_LEVEL,
  getUpgradeLevel, getNextCost, getUpgradeValue, getUpgradeBonuses, purchaseUpgrade
} from '../systems/upgrades.js';
import {
  TRIAL_STATES, TRIAL_TROPHY_ID, TRIAL_BOSS_STATS,
  getTrialData, refreshTrialState
} from '../systems/final_trial.js';
import {
  PLANETS, getCurrentPlanetId, isPlanetUnlocked, canTravelTo, planetBiomeSummary, hasVisited
} from '../world/planets.js';
import {
  GALLERY_LIMIT, getGallery, addDishPhoto, deleteDishPhoto, pinDishPhoto
} from '../systems/gallery.js';
import {
  CHARACTERS, getActiveCharacter, unlockStatus, UNLOCK_KIND
} from '../systems/characters.js';

const BOUNTY_VERBS = { hunt: '猎杀', gather: '采集', cook_delivery: '烹饪交付' };

// 异象效果在面板上的短标签
const OMEN_TAGS = {
  extraDrop: n => `采集 +${n} 份`,
  enemyPower: n => `异兽强度 ×${n}`,
  creditMult: n => `星币 ×${n}`,
  speedMult: n => `移动 ×${n}`,
  frostBonus: n => `冰晶食材 ×${n}`,
  repMult: n => `口碑 ×${n}`,
  nightLength: n => `夜长 ×${n}`,
  dropChance: n => `掉落率 ×${n}`,
  dishRepMult: n => `出餐口碑 ×${n}`
};

function omenTags(omen) {
  const e = omen.effects || {};
  const tags = Object.entries(e).map(([k, v]) => OMEN_TAGS[k] ? `<span>${OMEN_TAGS[k](v)}</span>` : '');
  return tags.join('') || '<span>无额外修正</span>';
}

// 只在特定星球出现的物种，星图上单独标出来
const SIGNATURE_NAMES = {
  magnetar_beetle: '磁暴甲虫',
  void_tendril: '虚空触须'
};

/** 把 #rrggbb 转成带透明度的 rgba，用于画布上的辉光。 */
function hexAlpha(hex, alpha) {
  const h = String(hex).replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export class CampUI {
  constructor(container, gameState, cookingEngine, bountyManager, hud) {
    this.container = container;
    this.gameState = gameState;
    this.cookingEngine = cookingEngine;
    this.bountyManager = bountyManager;
    this.hud = hud;

    this.currentModal = null;
    this.initModalContainer();
  }

  initModalContainer() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay hidden';
    this.overlay.id = 'camp-modal-overlay';
    this.overlay.innerHTML = `
      <div class="modal-card" id="camp-modal-card">
        <!-- Dynamic Content -->
      </div>
    `;
    this.container.appendChild(this.overlay);

    this.card = this.overlay.querySelector('#camp-modal-card');

    // Click outside to close (if not actively in mid-heat cooking)
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay && this.cookingEngine.stage !== 'kitchen') {
        this.closeModal();
      }
    });

    this.initScrollCue();
  }

  /**
   * 内容超出一屏时，在卡片底部挂一条"向下还有"的提示，滚到底自动收起。
   */
  initScrollCue() {
    this.scrollCue = document.createElement('div');
    this.scrollCue.className = 'scroll-cue';
    this.scrollCue.innerHTML = `${icon('arrow')}<span>向下滚动查看更多</span>`;
    this.card.appendChild(this.scrollCue);

    this.syncScrollCue = () => {
      const body = this.card.querySelector('.modal-body');
      const more = !!body && body.scrollHeight - body.clientHeight - body.scrollTop > 24;
      this.card.classList.toggle('has-more', more);
    };

    this.card.addEventListener('scroll', this.syncScrollCue, true);
    new MutationObserver(() => {
      // 每次重绘面板后内容高度都会变，等一帧再量
      requestAnimationFrame(this.syncScrollCue);
      if (this.scrollCue && this.scrollCue.parentElement !== this.card) this.card.appendChild(this.scrollCue);
    }).observe(this.card, { childList: true, subtree: true });
    window.addEventListener('resize', () => requestAnimationFrame(this.syncScrollCue));
  }

  closeModal() {
    this.stopWorldMapTracking();
    this.stopKitchenScene();
    this.overlay.classList.add('hidden');
    this.currentModal = null;
  }

  // ================= 1. CAMPFIRE COOKING SIMULATOR =================
  openCampCookingModal() {
    this.currentModal = 'camp';
    this.overlay.classList.remove('hidden');
    this.renderCampCooking();
  }

  renderCampCooking() {
    const stage = this.cookingEngine.stage;
    const selectedObjs = this.cookingEngine.getSelectedObjs();
    const matchedRecipe = this.cookingEngine.getMatchedRecipe();

    let stepHtml = '';

    if (stage === 'idle' || stage === 'select') {
      // Step 1: Ingredient selection
      stepHtml = `
        <div class="camp-cook-layout">
          <!-- Left: Ingredients Selection Pantry -->
          <div class="pantry-panel">
            <div class="panel-kicker"><span>01</span><strong>食材库</strong><small>FIELD PANTRY / ${ALL_INGREDIENTS.length} ITEMS</small></div>
            <div class="pantry-categories">
              <button class="cat-btn active" data-cat="all">全部</button>
              <button class="cat-btn" data-cat="${INGREDIENT_CATEGORIES.MEAT}">${icon('meat')}<span>肉类</span></button>
              <button class="cat-btn" data-cat="${INGREDIENT_CATEGORIES.VEG}">${icon('veg')}<span>菌蔬</span></button>
              <button class="cat-btn" data-cat="${INGREDIENT_CATEGORIES.SPICE}">${icon('spice')}<span>香辛</span></button>
              <button class="cat-btn" data-cat="${INGREDIENT_CATEGORIES.BASE}">${icon('base')}<span>主料</span></button>
            </div>
            <div class="pantry-grid" id="camp-pantry-grid">
              ${this.renderPantryGrid('all')}
            </div>
          </div>

          <!-- Right: Campfire Pot & Recipe Preview -->
          <div class="pot-panel">
            <div class="panel-kicker"><span>02</span><strong>构思料理</strong><small>RECIPE BENCH / LIVE MATCH</small></div>
            <div class="campfire-visual">
              <div class="campfire-visual-glow"></div>
              <img class="camp-pot-image" src="./assets/sprites/camp_pot.png" alt="营地烹饪锅" />
              <div class="campfire-flame">${icon('flame')}</div>
              <div class="pot-title">荒野等离子烹饪锅</div>
              <small class="pot-status"><span class="status-dot"></span> STATION ONLINE</small>
            </div>

            <!-- Selected Ingredient Slots -->
            <div class="selected-slots-row">
              ${[0, 1, 2, 3].map(idx => {
                const item = selectedObjs[idx];
                return `
                  <div class="select-slot ${item ? 'filled' : 'empty'}" data-slot="${idx}">
                    ${item ? `
                      <span class="slot-icon">${ingredientIcon(item)}</span>
                      <span class="slot-name">${item.name}</span>
                      <button class="slot-remove" data-id="${item.id}" title="移除食材">${icon('close')}</button>
                    ` : '<span class="slot-plus">+</span>'}
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Matched Recipe Preview Card -->
            <div class="recipe-match-card">
              ${matchedRecipe ? `
                <div class="match-header">
                  <span class="match-icon">${dishIcon()}</span>
                  <div>
                    <div class="match-name">${matchedRecipe.name} <span class="tier-tag">Tier ${matchedRecipe.tier}</span></div>
                    <div class="match-desc">${matchedRecipe.desc}</div>
                  </div>
                </div>
                <div class="match-buff">
                  <span class="match-buff-icon">${icon('spark')}</span> 预估增益：<b>${matchedRecipe.buff.label}</b> <span>· ${matchedRecipe.buff.duration}s</span>
                </div>
              ` : '<div class="match-hint">请在左侧选取 1~4 种食材开始构思料理</div>'}
            </div>

            <button class="btn-action-main" id="btn-start-cook" ${selectedObjs.length === 0 ? 'disabled' : ''}>
              ${icon('flame')}<span>开始备料</span><small>${selectedObjs.length} / 4</small>
            </button>
          </div>
        </div>
      `;
    } else if (stage === 'kitchen') {
      // Step 2: 实体化厨房场景（砧板 / 炉火 / 调味 / 摆盘）
      stepHtml = `
        <div class="kitchen-stage">
          <div class="kitchen-headline">
            <div>
              <strong>${matchedRecipe ? matchedRecipe.name : '野外料理'}</strong>
              <small>MICHELIN KITCHEN / ${selectedObjs.length} INGREDIENTS</small>
            </div>
            <span class="kitchen-hint" id="kitchen-hint">按住并拖动进行操作</span>
          </div>
          <canvas class="kitchen-canvas" id="kitchen-canvas"></canvas>
        </div>
      `;
    } else if (stage === 'done') {
      // Step 4: Dish Result Card
      const res = this.cookingEngine.lastDishResult;
      stepHtml = `
        <div class="dish-result-card">
          <div class="result-badge">${Array.from({ length: res.qualityStars }, () => icon('star')).join('')}</div>
          ${this.lastDishPhoto
            ? `<figure class="result-shot"><img src="${this.lastDishPhoto.thumb}" alt="${res.name}" /><figcaption>${icon('book')}<span>已收进留影台</span></figcaption></figure>`
            : `<div class="result-icon">${dishIcon()}</div>`}
          <h2 class="result-title">${res.name}</h2>
          <div class="result-quality" style="color: #facc15;">${res.qualityName}</div>
          <p class="result-desc">${res.desc}</p>

          ${res.stationScores ? `
          <div class="station-scorecard">
            <div class="scorecard-head"><span>评审记分卡</span><small>${res.stationScores.chefName ? `主厨 ${res.stationScores.chefName}` : 'TASTING NOTES'}</small></div>
            ${res.stationScores.chefBonus ? `<div class="scorecard-chef">${icon('chef')}<span>${res.stationScores.chefBonus}</span></div>` : ''}
            <div class="scorecard-rows">
              ${[
                ['刀工', 'KNIFE WORK', res.stationScores.knife],
                ['火候', 'HEAT CONTROL', res.stationScores.heat],
                ['调味', 'SEASONING', res.stationScores.season],
                ['摆盘', 'PLATING', res.stationScores.plating]
              ].map(([cn, en, v]) => `
                <div class="scorecard-row">
                  <span class="sc-label">${cn}<small>${en}</small></span>
                  <span class="sc-track"><span class="sc-fill" style="width:${v}%"></span></span>
                  <b class="sc-val ${v >= 88 ? 'high' : (v >= 70 ? 'mid' : 'low')}">${v}</b>
                </div>
              `).join('')}
            </div>
            ${res.stationScores.sliceStyle || res.stationScores.plateStyle ? `
            <div class="scorecard-craft">
              ${res.stationScores.sliceStyle ? `<span><i>刀法</i>${res.stationScores.sliceStyle}</span>` : ''}
              ${res.stationScores.plateStyle ? `<span><i>摆盘</i>${res.stationScores.plateStyle}</span>` : ''}
            </div>` : ''}
            <div class="scorecard-total"><span>综合得分</span><b>${res.stationScores.total}</b></div>
          </div>
          ` : ''}

          <div class="result-buff-box">
            <div class="buff-box-title">${icon('spark')} 获得冒险增益 <small>ACTIVE BUFF</small></div>
            <div class="buff-box-val">${res.adjustedBuff.label} (${res.adjustedBuff.duration}秒)</div>
          </div>

          <div class="result-rewards-row">
            <span>${icon('coin')} 信用点 <b>+${res.earnedCredits}</b></span>
            <span>${icon('spark')} 公会声望 <b>+${res.earnedRep}</b></span>
          </div>

          <div class="result-actions">
            <button class="btn-action-main" id="btn-eat-now">${icon('dish')}<span>立即享用</span><small>激活增益</small></button>
            <button class="btn-icon" id="btn-cook-more">${icon('arrow')}<span>继续烹饪</span></button>
          </div>
        </div>
      `;
    }

    this.card.innerHTML = `
      <div class="modal-header">
        <div class="modal-title-group"><span class="modal-title-icon">${icon('camp')}</span><div><h3>星际野外营地</h3><small>FIELD KITCHEN / COOKING WORKBENCH</small></div></div>
        ${stage !== 'kitchen' ? `<button class="btn-icon btn-close" id="btn-close-camp" title="关闭">${icon('close')}</button>` : ''}
      </div>
      <div class="modal-body">
        ${stepHtml}
      </div>
    `;

    this.bindCampEvents();
  }

  /**
   * 挂载 canvas 厨房场景，四道工位跑完后把分数交回烹饪引擎。
   */
  startKitchenScene() {
    const canvas = this.card.querySelector('#kitchen-canvas');
    if (!canvas) return;

    this.stopKitchenScene();

    const hintEl = this.card.querySelector('#kitchen-hint');
    const hints = {
      prep: '把食材拖到砧板，按手法处理',
      pan: '拖食材下锅，拖动火焰滑杆控温，锅内画圈翻炒',
      season: '拖调味瓶到锅上方按住撒料',
      plate: '摆开菜品、加点缀、画酱汁，再点出餐',
      done: '出餐'
    };

    this.kitchenScene = new KitchenScene(canvas, {
      ingredients: this.cookingEngine.getSelectedObjs(),
      recipe: this.cookingEngine.getMatchedRecipe(),
      heatToleranceBonus: getUpgradeBonuses(this.gameState).heatTolerance,
      chef: getActiveCharacter(this.gameState),
      onStageChange: (s) => {
        if (hintEl) hintEl.textContent = hints[s] || '';
      },
      onComplete: (scores) => {
        const result = this.cookingEngine.submitStationScores(scores);
        this.archiveDishPhoto(scores, result);
        setTimeout(() => {
          this.stopKitchenScene();
          this.renderCampCooking();
        }, 700);
      }
    });
    this.kitchenScene.start();
    if (hintEl) hintEl.textContent = hints.prep;
  }

  /** 出餐时把成品盘的照片存进留影档案。 */
  archiveDishPhoto(scores, result) {
    this.lastDishPhoto = null;
    if (!scores?.photo || !result) return null;
    const styleParts = [scores.sliceStyle, scores.plateStyle].filter(Boolean);
    const photo = addDishPhoto(this.gameState, {
      name: result.name,
      stars: result.qualityStars,
      quality: result.qualityName,
      chef: scores.chefName || null,
      style: styleParts.join(' / '),
      day: this.gameState.dayCount || 1,
      score: result.score ?? scores.total,
      thumb: scores.photo
    });
    this.lastDishPhoto = photo;
    state.save();
    this.hud?.showToast(`${result.name} 已收进留影台档案。`, 'info', icon('book'));
    return photo;
  }

  // ================= 留影台：菜品照片档案 =================
  openGalleryModal(gameMaster) {
    this.currentModal = 'gallery';
    this.galleryHost = gameMaster || this.galleryHost;
    this.overlay.classList.remove('hidden');
    this.renderGallery();
  }

  renderGallery() {
    const photos = getGallery(this.gameState);
    const pinnedId = this.gameState.pinnedDishId || null;

    const cards = photos.map(p => {
      const stars = '★'.repeat(p.stars || 1);
      const isPinned = p.id === pinnedId;
      return `
        <figure class="gal-card ${isPinned ? 'is-pinned' : ''}">
          <div class="gal-shot"><img src="${p.thumb}" alt="${p.name}" loading="lazy" /></div>
          <figcaption>
            <strong>${p.name}</strong>
            <span class="gal-stars">${stars}</span>
            <small>${p.style || '常规摆盘'}</small>
            <small class="gal-meta">第 ${p.day} 宇宙日 · 评分 ${p.score}${p.chef ? ` · 主厨 ${p.chef}` : ''}</small>
          </figcaption>
          <div class="gal-actions">
            <button class="gal-btn ${isPinned ? 'active' : ''}" data-pin="${p.id}">${icon('star')}<span>${isPinned ? '已贴出' : '贴到相框'}</span></button>
            <button class="gal-btn gal-del" data-del="${p.id}">${icon('close')}<span>撕掉</span></button>
          </div>
        </figure>
      `;
    }).join('');

    this.card.innerHTML = `
      <div class="modal-header">
        <div class="modal-title-group"><span class="modal-title-icon">${icon('book')}</span><div><h3>菜品留影台</h3><small>DISH GALLERY / ${photos.length} / ${GALLERY_LIMIT}</small></div></div>
        <button class="btn-icon btn-close" id="btn-close-gallery" title="关闭">${icon('close')}</button>
      </div>
      <div class="modal-body">
        <p class="gal-intro">每次出餐都会自动给成品盘拍一张照片。贴出的那张会挂在营地留影台的相框上，成为这间野外餐厅的招牌。档案最多保留 ${GALLERY_LIMIT} 张，贴出的那张不会被挤掉。</p>
        ${photos.length
          ? `<div class="gal-grid">${cards}</div>`
          : `<div class="gal-empty">${icon('camp')}<p>还没有留影。去营地灶台做一道菜，出餐时会自动拍照。</p></div>`}
      </div>
    `;

    this.card.querySelector('#btn-close-gallery')?.addEventListener('click', () => this.closeModal());

    this.card.querySelectorAll('[data-pin]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pinned = pinDishPhoto(this.gameState, btn.dataset.pin);
        state.save();
        sound.playSparkle();
        this.galleryHost?.refreshPinnedDish();
        this.renderGallery();
        this.hud?.showToast(pinned ? `${pinned.name} 已贴到营地相框。` : '已取下相框里的照片。', 'success', icon('star'));
      });
    });

    this.card.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (deleteDishPhoto(this.gameState, btn.dataset.del)) {
          state.save();
          sound.playChop();
          this.galleryHost?.refreshPinnedDish();
          this.renderGallery();
        }
      });
    });
  }

  stopKitchenScene() {
    if (this.kitchenScene) {
      this.kitchenScene.destroy();
      this.kitchenScene = null;
    }
  }

  renderPantryGrid(category) {
    const inventory = this.gameState.inventory || {};
    const filtered = ALL_INGREDIENTS.filter(i => category === 'all' || i.category === category);

    return filtered.map(item => {
      const count = inventory[item.id] || 0;
      const selectedCount = this.cookingEngine.selectedIngredients.filter(id => id === item.id).length;
      const remaining = count - selectedCount;
      const disabled = remaining <= 0;

      return `
        <div class="pantry-item-card ${disabled ? 'disabled' : ''}" data-id="${item.id}">
          <div class="pantry-item-top">
            <span class="pantry-item-icon">${ingredientIcon(item)}</span>
            <span class="pantry-item-count">x${remaining}</span>
          </div>
          <div class="pantry-item-name">${item.name}</div>
          <div class="pantry-item-tag"><span>${item.tags[0] || '食材'}</span><span>T${item.tier || 1}</span></div>
        </div>
      `;
    }).join('');
  }

  bindCampEvents() {
    const stage = this.cookingEngine.stage;

    const closeBtn = this.card.querySelector('#btn-close-camp');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.cookingEngine.resetCamp();
        this.closeModal();
      });
    }

    if (stage === 'idle' || stage === 'select') {
      // Category filter buttons
      this.card.querySelectorAll('.cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          this.card.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const cat = btn.dataset.cat;
          const grid = this.card.querySelector('#camp-pantry-grid');
          grid.innerHTML = this.renderPantryGrid(cat);
          this.bindPantryCardEvents();
        });
      });

      this.bindPantryCardEvents();

      // Remove slot buttons
      this.card.querySelectorAll('.slot-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.dataset.id;
          this.cookingEngine.deselectIngredient(id);
          this.renderCampCooking();
        });
      });

      // Start cook button
      const startBtn = this.card.querySelector('#btn-start-cook');
      if (startBtn) {
        startBtn.addEventListener('click', () => {
          if (this.cookingEngine.startCooking()) {
            this.renderCampCooking();
          }
        });
      }
    } else if (stage === 'kitchen') {
      this.startKitchenScene();
    } else if (stage === 'done') {
      const eatBtn = this.card.querySelector('#btn-eat-now');
      const cookMoreBtn = this.card.querySelector('#btn-cook-more');

      if (eatBtn) {
        eatBtn.addEventListener('click', () => {
          const res = this.cookingEngine.lastDishResult;
          BuffManager.applyBuff(this.gameState, res);
          this.hud.showToast(`享用了【${res.name}】！${res.adjustedBuff.label}`, 'success', res.icon);
          this.cookingEngine.resetCamp();
          this.closeModal();
        });
      }

      if (cookMoreBtn) {
        cookMoreBtn.addEventListener('click', () => {
          this.cookingEngine.resetCamp();
          this.renderCampCooking();
        });
      }
    }
  }

  bindPantryCardEvents() {
    this.card.querySelectorAll('.pantry-item-card:not(.disabled)').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        if (this.cookingEngine.selectIngredient(id)) {
          this.renderCampCooking();
        }
      });
    });
  }

  updateHeatUI() {
    if (this.currentModal !== 'camp' || this.cookingEngine.stage !== 'heat') return;

    const needle = this.card.querySelector('#camp-temp-needle');
    const readout = this.card.querySelector('#camp-temp-readout');

    if (needle) {
      needle.style.left = `${Math.round(this.cookingEngine.currentTemp)}%`;
    }
    if (readout) {
      readout.innerText = `${Math.round(this.cookingEngine.currentTemp)}°C`;
    }
  }

  // ================= 世界地图 =================
  openWorldMapModal(game) {
    this.currentModal = 'worldmap';
    this.mapHost = game;
    this.overlay.classList.remove('hidden');
    this.renderWorldMap(game);
    this.startWorldMapTracking();
  }

  /**
   * 大地图开着的时候持续跟着玩家走。整块 DOM 重绘太贵，
   * 只挪玩家点和迷雾这两样会动的东西。
   */
  startWorldMapTracking() {
    this.stopWorldMapTracking();

    const step = () => {
      if (this.currentModal !== 'worldmap' || !this.mapHost) {
        this.stopWorldMapTracking();
        return;
      }

      const game = this.mapHost;
      const wrap = this.card.querySelector('#wm-canvas');
      const dot = this.card.querySelector('.wm-player');
      if (wrap && dot) {
        const s = wrap.clientWidth / game.map.width;
        dot.style.left = `${game.player.x * s}px`;
        dot.style.top = `${game.player.y * s}px`;

        // 走进新区块就把那格雾揭开，不必等下次打开面板
        const seen = game.map.exploredChunks.size;
        if (seen !== this._fogSeen) {
          this._fogSeen = seen;
          this.refreshWorldMapFog(game, wrap, s);
        }
      }

      this._mapRaf = requestAnimationFrame(step);
    };
    this._mapRaf = requestAnimationFrame(step);
  }

  stopWorldMapTracking() {
    if (this._mapRaf) cancelAnimationFrame(this._mapRaf);
    this._mapRaf = null;
  }

  /** 迷雾格数变化时只重画雾层，其余 DOM 不动。 */
  refreshWorldMapFog(game, wrap, s) {
    const layer = wrap.querySelector('.wm-fog-layer');
    if (!layer) return;

    const map = game.map;
    const cw = (map.chunkSize || 600) * s;
    let fog = '';
    for (let r = 0; r < map.chunksRows; r++) {
      for (let c = 0; c < map.chunksCols; c++) {
        if (map.exploredChunks.has(map.chunkKey(c, r))) continue;
        fog += `<span class="wm-fog" style="left:${c * cw}px;top:${r * cw}px;width:${cw + 0.6}px;height:${cw + 0.6}px"></span>`;
      }
    }
    layer.innerHTML = fog;

    const label = this.card.querySelector('#wm-explored');
    if (label) label.textContent = `已探索 ${Math.round(map.exploredRatio() * 100)}%`;
  }

  renderWorldMap(game) {
    const map = game.map;
    const W = 660;
    const H = Math.round(W * (map.height / map.width));
    const s = W / map.width;

    const biomes = [
      { name: '荧光菌林', color: 'rgba(6, 214, 160, 0.16)', x: 0, y: 0 },
      { name: '晶簇裂谷', color: 'rgba(192, 132, 252, 0.16)', x: 0.5, y: 0 },
      { name: '熔岩温泉', color: 'rgba(249, 115, 22, 0.16)', x: 0, y: 0.5 },
      { name: '绝对冻原', color: 'rgba(125, 211, 252, 0.16)', x: 0.5, y: 0.5 }
    ].map(b => `<div class="wm-biome" style="left:${b.x * 100}%;top:${b.y * 100}%;background:${b.color}">
        <span>${b.name}</span></div>`).join('');

    const dot = (x, y, cls, title) =>
      `<span class="wm-dot ${cls}" style="left:${x * s}px;top:${y * s}px" title="${title}"></span>`;

    const nodes = game.spawner.nodes.filter(n => !n.isDepleted)
      .map(n => dot(n.x, n.y, 'wm-node', n.name || '资源点')).join('');
    const beasts = game.monsters.filter(m => m.hp > 0 && m.x < 90000)
      .map(m => dot(m.x, m.y, m.isTrialBoss ? 'wm-boss' : 'wm-beast', m.name || '异兽')).join('');
    const campMark = `<span class="wm-camp-mark" style="left:${map.campPosition.x * s}px;top:${map.campPosition.y * s}px"
        title="星尘营地">${icon('camp')}<b>营地</b></span>`;
    const playerDot = dot(game.player.x, game.player.y, 'wm-player', '你');
    const safeR = map.campSafeRadius * s;

    // 没走到过的区块盖一层迷雾，也是能不能快速传送的依据
    const cw = map.chunkSize * s;
    let fog = '';
    for (let r = 0; r < map.chunksRows; r++) {
      for (let c = 0; c < map.chunksCols; c++) {
        if (map.exploredChunks.has(map.chunkKey(c, r))) continue;
        fog += `<span class="wm-fog" style="left:${c * cw}px;top:${r * cw}px;width:${cw + 0.6}px;height:${cw + 0.6}px"></span>`;
      }
    }
    const pct = Math.round(map.exploredRatio() * 100);

    this.card.innerHTML = `
      <div class="modal-header">
        <div class="modal-title-group"><span class="modal-title-icon">${icon('target')}</span><div><h3>星域测绘图</h3><small>SECTOR MAP / ${map.width} × ${map.height} · <span id="wm-explored">已探索 ${pct}%</span></small></div></div>
        <button class="btn-icon btn-close" id="btn-close-map" title="关闭">${icon('close')}</button>
      </div>
      <div class="modal-body">
        <p class="wm-hint">${icon('compass')}<span>点击<b>已探索</b>的区域即可就地跃迁过去；灰雾区要先自己走过一遍。</span>
          <button class="wm-home" id="wm-home">${icon('camp')}回营地</button></p>
        <div class="wm-wrap" id="wm-canvas" style="width:${W}px;height:${H}px">
          ${biomes}
          <span class="wm-safe" style="left:${map.campPosition.x * s}px;top:${map.campPosition.y * s}px;width:${safeR * 2}px;height:${safeR * 2}px"></span>
          ${nodes}${beasts}<span class="wm-fog-layer">${fog}</span>${campMark}${playerDot}
        </div>
        <div class="wm-legend">
          <span><i class="wm-dot wm-player"></i>你</span>
          <span><i class="wm-dot wm-camp"></i>营地</span>
          <span><i class="wm-dot wm-node"></i>资源点 ${game.spawner.nodes.filter(n => !n.isDepleted).length}</span>
          <span><i class="wm-dot wm-beast"></i>异兽 ${game.monsters.filter(m => m.hp > 0 && m.x < 90000).length}</span>
          <span><i class="wm-fog-key"></i>未探索</span>
          ${game.trialBoss ? '<span><i class="wm-dot wm-boss"></i>虚空母龙</span>' : ''}
        </div>

        <div class="planet-panel">
          <div class="panel-kicker"><span>跃迁</span><strong>星图</strong><small>INTERSTELLAR JUMP</small></div>
          <div class="planet-grid">${this.renderPlanetCards(game)}</div>
        </div>
      </div>`;

    this.card.querySelector('#btn-close-map')?.addEventListener('click', () => this.closeModal());
    this.bindPlanetCards(game);
    this.bindSectorTravel(game, s);
  }

  /** 星图上点击已探索区域就地传送，以及一键回营地。 */
  bindSectorTravel(game, scale) {
    this.card.querySelector('#wm-home')?.addEventListener('click', () => {
      game.teleportTo(game.map.campPosition.x, game.map.campPosition.y, '已返回星尘营地');
      this.closeModal();
    });

    const wrap = this.card.querySelector('#wm-canvas');
    wrap?.addEventListener('click', (e) => {
      const rect = wrap.getBoundingClientRect();
      const wx = (e.clientX - rect.left) / scale;
      const wy = (e.clientY - rect.top) / scale;

      if (!game.map.isExplored(wx, wy)) {
        this.hud?.showToast('这片区域还没探索过，得先自己走一趟。', 'warning', icon('compass'));
        return;
      }
      if (game.teleportTo(wx, wy, '已跃迁到测绘点')) this.closeModal();
    });
  }

  renderPlanetCards(game) {
    const current = getCurrentPlanetId(this.gameState);
    return PLANETS.map(p => {
      const unlocked = isPlanetUnlocked(this.gameState, p);
      const isHere = p.id === current;
      const check = canTravelTo(this.gameState, p);
      const visited = hasVisited(this.gameState, p);
      const summary = planetBiomeSummary(p)
        .map(s => `<span class="pb-chip">${s.label}${s.count > 1 ? ` ×${s.count}` : ''}</span>`).join('');

      return `
        <div class="planet-card ${isHere ? 'is-here' : ''} ${unlocked ? '' : 'is-locked'}" style="--accent:${p.accent}">
          <div class="pc-head">
            <div><strong>${p.name}</strong><small>${p.nameEn}</small></div>
            ${isHere ? '<span class="pc-badge here">所在</span>'
              : unlocked ? `<span class="pc-badge ${visited ? 'opened' : ''}">难度 ×${p.difficulty}</span>`
              : `<span class="pc-badge locked">${icon('close')}${p.unlockRep} 声望</span>`}
          </div>
          <p class="pc-desc">${p.desc}</p>
          ${p.traits ? `<div class="pc-trait"><b>${p.traits.label}</b><span>${p.traits.note}</span></div>` : ''}
          <div class="pc-biomes">${summary}</div>
          ${p.signature ? `<div class="pc-signature">${icon('target')}<span>专属物种：${SIGNATURE_NAMES[p.signature] || p.signature}</span></div>` : ''}
          ${p.traits?.exclusiveIngredient ? `<div class="pc-signature is-food">${icon('spice')}<span>专属食材：${getIngredientById(p.traits.exclusiveIngredient)?.name || p.traits.exclusiveIngredient}</span></div>` : ''}
          <div class="pc-foot">
            <span class="pc-reward">收益 ×${p.rewardMult}${visited && !isHere ? ' · 航道已通' : ''}</span>
            ${isHere ? '<span class="pc-cost">—</span>'
              : `<button class="pc-jump ${check.ok ? '' : 'disabled'}" data-planet="${p.id}" ${check.ok ? '' : 'disabled'}>
                   ${check.ok
                     ? (visited ? `${icon('spark')}免费跃迁` : `${icon('coin')}<b>${p.travelCost}</b> 开通航道`)
                     : check.reason}
                 </button>`}
          </div>
        </div>`;
    }).join('');
  }

  bindPlanetCards(game) {
    this.card.querySelectorAll('.pc-jump').forEach(btn => {
      btn.addEventListener('click', () => {
        if (game.travelToPlanet(btn.dataset.planet)) {
          this.closeModal();
        } else {
          this.renderWorldMap(game);
        }
      });
    });
  }

  // ================= 终极评鉴 =================
  openTrialModal(game) {
    this.currentModal = 'trial';
    this.overlay.classList.remove('hidden');
    this.renderTrial(game);
  }

  renderTrial(game) {
    refreshTrialState(this.gameState);
    const trial = getTrialData(this.gameState);
    const stars = this.gameState.michelinStars || 0;
    const heart = (this.gameState.inventory || {})[TRIAL_TROPHY_ID] || 0;

    const steps = [
      { key: 'star', label: '取得三星米其林认证', done: stars >= 3, hint: `当前 ${stars} / 3 星` },
      { key: 'boss', label: '讨伐传奇异兽「虚空母龙」', done: trial.state === TRIAL_STATES.COOKING || trial.state === TRIAL_STATES.COMPLETE, hint: `血量 ${TRIAL_BOSS_STATS.hp} · 护甲 ${TRIAL_BOSS_STATS.defense} · 三阶段` },
      { key: 'dish', label: '以母龙心核烹制「终焉盛宴」', done: trial.state === TRIAL_STATES.COMPLETE, hint: heart > 0 ? `心核已在背包 ×${heart}` : '需要母龙心核' }
    ];

    let action = '';
    if (trial.state === TRIAL_STATES.LOCKED) {
      action = `<div class="trial-locked">${icon('close')}<span>尚未取得三星认证，评鉴无法开启</span></div>`;
    } else if (trial.state === TRIAL_STATES.AVAILABLE) {
      action = `<button class="btn-launch-game" id="btn-summon-boss"><span>召唤虚空母龙</span><small>降临于地图正北</small></button>`;
    } else if (trial.state === TRIAL_STATES.HUNTING) {
      action = `<div class="trial-active">${icon('bolt')}<span>母龙已在地图正北方等待。用 H 破甲重击撕开它的护甲。</span></div>`;
    } else if (trial.state === TRIAL_STATES.COOKING) {
      action = `<div class="trial-active ready">${icon('dish')}<span>母龙已伏诛。回营地按 C，用心核 + 恒星米 + 炽阳炎果 + 高导晶盐 做出终焉盛宴。</span></div>`;
    } else {
      const g = trial.bestGrade;
      action = `<div class="trial-complete">
          <div class="ending-grade grade-${g?.grade || 'C'}">${g?.grade || '-'}</div>
          <div><strong>${g?.title || ''}</strong><small>历史最佳评分 ${g?.total || 0}</small></div>
        </div>
        <button class="btn-launch-game" id="btn-summon-boss"><span>再次挑战</span><small>刷新更高评分</small></button>`;
    }

    this.card.innerHTML = `
      <div class="modal-header">
        <div class="modal-title-group"><span class="modal-title-icon">${icon('star')}</span><div><h3>终极评鉴</h3><small>FINAL TASTING / ENDGAME TRIAL</small></div></div>
        <button class="btn-icon btn-close" id="btn-close-trial" title="关闭">${icon('close')}</button>
      </div>
      <div class="modal-body">
        <p class="trial-intro">米其林评审团已经注意到了这颗星球上的你。想拿到最终评定，必须先让整个星系最危险的猎物成为盘中之物。</p>
        <div class="trial-steps">
          ${steps.map((s, i) => `
            <div class="trial-step ${s.done ? 'done' : ''}">
              <span class="ts-index">${s.done ? icon('star') : `0${i + 1}`}</span>
              <div class="ts-body"><strong>${s.label}</strong><small>${s.hint}</small></div>
            </div>`).join('')}
        </div>
        <div class="trial-action">${action}</div>
      </div>`;

    this.card.querySelector('#btn-close-trial')?.addEventListener('click', () => this.closeModal());
    this.card.querySelector('#btn-summon-boss')?.addEventListener('click', () => {
      const t = getTrialData(this.gameState);
      if (t.state === TRIAL_STATES.COMPLETE) t.state = TRIAL_STATES.AVAILABLE;
      if (game.summonTrialBoss()) {
        this.closeModal();
      }
    });
  }

  // ================= 星尘工坊 / 永久升级 =================
  openWorkshopModal() {
    this.currentModal = 'workshop';
    this.overlay.classList.remove('hidden');
    this.renderWorkshop();
  }

  renderWorkshop() {
    const credits = this.gameState.credits || 0;
    const tracks = Object.values(UPGRADE_TRACKS);

    const trackHtml = tracks.map(track => {
      const meta = TRACK_META[track];
      const items = UPGRADES.filter(u => u.track === track);

      const rows = items.map(u => {
        const lv = getUpgradeLevel(this.gameState, u.id);
        const cost = getNextCost(this.gameState, u.id);
        const maxed = cost === null;
        const affordable = !maxed && credits >= cost;
        const current = getUpgradeValue(this.gameState, u.id);
        const next = maxed ? null : +(u.perLevel * (lv + 1)).toFixed(4);

        const pips = Array.from({ length: MAX_LEVEL }, (_, i) =>
          `<span class="wk-pip ${i < lv ? 'on' : ''}"></span>`).join('');

        return `
          <div class="wk-row ${maxed ? 'is-maxed' : ''}">
            <div class="wk-info">
              <div class="wk-name">${u.name}<small>${u.nameEn}</small></div>
              <p class="wk-desc">${u.desc}</p>
              <div class="wk-effect">
                <span class="wk-now">${lv > 0 ? u.format(current) : '未强化'}</span>
                ${maxed ? '' : `<span class="wk-arrow">→</span><span class="wk-next">${u.format(next)}</span>`}
              </div>
            </div>
            <div class="wk-action">
              <div class="wk-pips">${pips}</div>
              ${maxed
                ? '<div class="wk-maxed">已满级</div>'
                : `<button class="wk-buy ${affordable ? '' : 'disabled'}" data-upgrade="${u.id}" ${affordable ? '' : 'disabled'}>
                     ${icon('coin')}<b>${cost}</b>
                   </button>`}
            </div>
          </div>
        `;
      }).join('');

      return `
        <section class="wk-track">
          <header class="wk-track-head">
            <span class="wk-track-icon">${icon(meta.icon)}</span>
            <div><strong>${meta.name}</strong><small>${meta.nameEn}</small></div>
          </header>
          ${rows}
        </section>
      `;
    }).join('');

    this.card.innerHTML = `
      <div class="modal-header">
        <div class="modal-title-group"><span class="modal-title-icon">${icon('bolt')}</span><div><h3>星尘工坊</h3><small>STARDUST WORKSHOP / PERMANENT UPGRADES</small></div></div>
        <div class="wk-wallet">${icon('coin')}<b id="wk-credits">${credits}</b><span>星币</span></div>
        <button class="btn-icon btn-close" id="btn-close-workshop" title="关闭">${icon('close')}</button>
      </div>
      <div class="modal-body">
        <p class="wk-intro">狩猎与出餐赚来的星币可以在这里换成永久强化。升级不会因死亡丢失。</p>
        <div class="wk-tracks">${trackHtml}</div>
      </div>
    `;

    this.card.querySelector('#btn-close-workshop')?.addEventListener('click', () => this.closeModal());
    this.card.querySelectorAll('.wk-buy').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.upgrade;
        if (purchaseUpgrade(this.gameState, id)) {
          sound.playSparkle();
          state.save();
          this.renderWorkshop();
          if (this.onUpgradePurchased) this.onUpgradePurchased(id);
        } else {
          sound.playChop();
        }
      });
    });
  }

  // ================= 主厨营帐 / 角色切换 =================
  openRosterModal(gameMaster) {
    this.currentModal = 'roster';
    this.rosterHost = gameMaster || this.rosterHost;
    this.overlay.classList.remove('hidden');
    this.renderRoster();
  }

  renderRoster() {
    const activeId = this.gameState.characterId;
    const statBars = (c) => {
      const rows = [
        { label: '生命', key: 'maxHp', max: 180 },
        { label: '攻击', key: 'attack', max: 34 },
        { label: '速度', key: 'speed', max: 290 },
        { label: '耐力', key: 'staminaRegen', max: 24 },
        { label: '防御', key: 'defense', max: 22 },
        { label: '暴击', key: 'critChance', max: 22 }
      ];
      return rows.map(r => {
        const v = c.stats[r.key] || 0;
        const pct = Math.max(4, Math.min(100, (v / r.max) * 100));
        return `
          <div class="cr-stat">
            <span class="cr-stat-label">${r.label}</span>
            <div class="cr-stat-track"><i style="width:${pct.toFixed(0)}%"></i></div>
            <span class="cr-stat-val">${v}</span>
          </div>
        `;
      }).join('');
    };

    const cards = CHARACTERS.map(c => {
      const st = unlockStatus(c, this.gameState);
      const isActive = c.id === activeId;
      const pct = st.unlocked ? 100 : Math.min(100, (st.progress / st.need) * 100);

      const action = isActive
        ? '<div class="cr-active-tag">出战中 / ON DUTY</div>'
        : st.unlocked
          ? `<button class="cr-pick" data-pick="${c.id}">${icon('swap')}<span>换上场</span></button>`
          : `<div class="cr-lock">
               ${icon('lock')}<span>${st.label}</span>
               ${c.unlock.kind === UNLOCK_KIND.TRIAL ? '' : `<em>${Math.min(st.progress, st.need)} / ${st.need}</em>`}
               <div class="cr-lock-track"><i style="width:${pct.toFixed(0)}%"></i></div>
             </div>`;

      return `
        <article class="cr-card ${isActive ? 'is-active' : ''} ${st.unlocked ? '' : 'is-locked'}" style="--cr-theme:${c.theme}">
          <div class="cr-portrait"><canvas width="248" height="140" data-portrait="${c.id}"></canvas></div>
          <div class="cr-head">
            <strong>${c.name}</strong>
            <span class="cr-title">${c.title}</span>
            <small>${c.en} · ${c.role}</small>
          </div>
          <p class="cr-bio">${c.bio}</p>
          <div class="cr-stats">${statBars(c)}</div>
          <div class="cr-kitchen">${icon('knife')}<span>${c.kitchenNote}</span></div>
          <div class="cr-skill">
            <div class="cr-skill-head">
              <span class="cr-skill-icon">${icon('bolt')}</span>
              <div><strong>${c.skill.name}</strong><small>${c.skill.en}</small></div>
              <div class="cr-skill-cost">
                <span>${icon('clock')}${c.skill.cooldown}s</span>
                <span>${icon('spark')}${c.skill.stamina}</span>
              </div>
            </div>
            <p>${c.skill.desc}</p>
          </div>
          <div class="cr-foot">${action}</div>
        </article>
      `;
    }).join('');

    this.card.innerHTML = `
      <div class="modal-header">
        <div class="modal-title-group"><span class="modal-title-icon">${icon('chef')}</span><div><h3>主厨营帐</h3><small>CHEF ROSTER / ${CHARACTERS.length} MEMBERS</small></div></div>
        <button class="btn-icon btn-close" id="btn-close-roster" title="关闭">${icon('close')}</button>
      </div>
      <div class="modal-body">
        <p class="cr-intro">整支厨师团随队扎营。换人会立刻改写基础属性、模型配色与 <b>F</b> 键技能，厨房里的工位加成也跟着走。</p>
        <div class="cr-grid">${cards}</div>
      </div>
    `;

    this.card.querySelectorAll('[data-portrait]').forEach(cv => {
      const c = CHARACTERS.find(x => x.id === cv.dataset.portrait);
      const locked = !unlockStatus(c, this.gameState).unlocked;
      this.drawChefPortrait(cv, c, locked);
    });

    this.card.querySelector('#btn-close-roster')?.addEventListener('click', () => this.closeModal());
    this.card.querySelectorAll('[data-pick]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.rosterHost?.applyCharacter(btn.dataset.pick);
        sound.playSparkle();
        this.renderRoster();
      });
    });
  }

  /** 用角色的制服配色画一张头盔胸像，锁住的画成剪影。 */
  drawChefPortrait(canvas, c, locked = false) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const suit = locked ? ['#161b21', '#252e37', '#3b4750'] : c.palette.suit;
    const armor = locked ? ['#39434c', '#5b6873', '#7b8993'] : c.palette.armor;
    const visor = locked ? '#2c3740' : c.palette.visor;
    const accent = locked ? '#3a444d' : c.palette.accent;

    const cx = W / 2;
    const hr = H * 0.205;
    const hy = H * 0.55;
    const outline = locked ? 'rgba(10,16,20,0.9)' : (c.palette.outline || '#07141c');
    const tint = locked ? 'rgba(90,104,116,1)' : c.theme;

    // 背板：网格 + 两道同心弧，把两侧留白填住
    ctx.fillStyle = locked ? 'rgba(255,255,255,0.03)' : hexAlpha(c.theme, 0.06);
    for (let gx = 10; gx < W; gx += 16) ctx.fillRect(gx, 0, 1, H);
    for (let gy = 10; gy < H; gy += 16) ctx.fillRect(0, gy, W, 1);

    ctx.strokeStyle = locked ? 'rgba(120,135,148,0.18)' : hexAlpha(c.theme, 0.22);
    ctx.lineWidth = 1.5;
    for (const r of [H * 0.42, H * 0.58]) {
      ctx.beginPath();
      ctx.arc(cx, H * 0.98, r, Math.PI * 1.06, Math.PI * 1.94);
      ctx.stroke();
    }

    const glow = ctx.createRadialGradient(cx, hy, 8, cx, hy, W * 0.42);
    glow.addColorStop(0, locked ? 'rgba(60,72,82,0.32)' : hexAlpha(c.theme, 0.32));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // 角标
    ctx.strokeStyle = locked ? 'rgba(120,135,148,0.35)' : hexAlpha(c.theme, 0.5);
    ctx.lineWidth = 2;
    for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const ax = sx > 0 ? 8 : W - 8;
      const ay = sy > 0 ? 8 : H - 8;
      ctx.beginPath();
      ctx.moveTo(ax + sx * 14, ay);
      ctx.lineTo(ax, ay);
      ctx.lineTo(ax, ay + sy * 12);
      ctx.stroke();
    }

    // 地面投影
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx, H - 6, W * 0.2, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // 肩甲：外层制服 + 内层高光
    ctx.fillStyle = suit[1];
    ctx.beginPath();
    ctx.moveTo(cx - hr * 2.3, H);
    ctx.quadraticCurveTo(cx - hr * 1.9, hy + hr * 1.15, cx, hy + hr * 1.05);
    ctx.quadraticCurveTo(cx + hr * 1.9, hy + hr * 1.15, cx + hr * 2.3, H);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = suit[2];
    ctx.beginPath();
    ctx.moveTo(cx - hr * 1.5, H);
    ctx.quadraticCurveTo(cx - hr * 1.2, hy + hr * 1.5, cx, hy + hr * 1.4);
    ctx.quadraticCurveTo(cx + hr * 1.2, hy + hr * 1.5, cx + hr * 1.5, H);
    ctx.closePath();
    ctx.fill();

    // 两侧肩章
    ctx.fillStyle = armor[1];
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.6;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + s * hr * 1.5, hy + hr * 1.36, hr * 0.44, hr * 0.26, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = tint;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + s * hr * 1.5, hy + hr * 1.36, hr * 0.17, hr * 0.1, s * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 领口配饰
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(cx - hr * 0.42, hy + hr * 1.08);
    ctx.lineTo(cx + hr * 0.42, hy + hr * 1.08);
    ctx.lineTo(cx, hy + hr * 1.75);
    ctx.closePath();
    ctx.fill();

    // 头盔
    ctx.fillStyle = armor[1];
    ctx.beginPath();
    ctx.ellipse(cx, hy, hr * 0.92, hr, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = armor[2];
    ctx.beginPath();
    ctx.ellipse(cx - hr * 0.28, hy - hr * 0.34, hr * 0.44, hr * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 面罩
    ctx.fillStyle = c.palette.visorDark || outline;
    ctx.beginPath();
    ctx.ellipse(cx, hy + hr * 0.18, hr * 0.74, hr * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = visor;
    ctx.beginPath();
    ctx.ellipse(cx, hy + hr * 0.16, hr * 0.66, hr * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(cx - hr * 0.28, hy + hr * 0.06, hr * 0.2, hr * 0.1, -0.35, 0, Math.PI * 2);
    ctx.fill();

    // 面罩上沿的一道横梁，两端接到头盔侧面
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx - hr * 0.88, hy - hr * 0.16);
    ctx.quadraticCurveTo(cx, hy - hr * 0.34, cx + hr * 0.88, hy - hr * 0.16);
    ctx.stroke();
    ctx.fillStyle = tint;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + s * hr * 0.84, hy - hr * 0.14, hr * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }

    // 厨师帽：帽檐压在头盔上沿，帽顶三团鼓包
    const brimY = hy - hr * 0.72;
    ctx.fillStyle = armor[2];
    for (const [ox, orr] of [[-0.6, 0.46], [0, 0.56], [0.6, 0.46]]) {
      ctx.beginPath();
      ctx.arc(cx + hr * ox, brimY - hr * 0.34, hr * orr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillRect(cx - hr * 1.06, brimY - hr * 0.36, hr * 2.12, hr * 0.4);
    ctx.strokeStyle = outline;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(cx - hr * 1.06, brimY - hr * 0.36, hr * 2.12, hr * 0.4);
    ctx.fillStyle = accent;
    ctx.fillRect(cx - hr * 1.06, brimY - hr * 0.1, hr * 2.12, hr * 0.14);

    if (locked) {
      ctx.fillStyle = 'rgba(6, 11, 15, 0.44)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ================= 宇宙点唱机 =================
  openJukeboxModal(gameMaster) {
    this.currentModal = 'jukebox';
    this.jukeboxHost = gameMaster || this.jukeboxHost;
    this.overlay.classList.remove('hidden');
    this.renderJukebox();
  }

  renderJukebox() {
    const stations = [
      { id: 'wilderness', name: '荒野漫游', en: 'WILDERNESS DRIFT', desc: '异星菌林的低频泛音，适合采集与赶路。', color: '#4ade80' },
      { id: 'combat', name: '猎杀频段', en: 'HUNT PROTOCOL', desc: '压低半个八度的紧绷音阶，打起来更来劲。', color: '#f87171' },
      { id: 'camp', name: '营地夜话', en: 'CAMPFIRE TALK', desc: '明亮的大调拨弦，围炉与备料时的背景。', color: '#fbbf24' },
      { id: 'night', name: '深空夜航', en: 'DEEP NIGHT', desc: '只留下缓慢呼吸的空间铺底，很安静。', color: '#818cf8' }
    ];
    const current = audio.currentTheme || 'wilderness';
    const muted = audio.isMuted;
    const bgm = Math.round((audio.bgmVolume ?? 0.45) * 100);
    const sfx = Math.round((audio.sfxVolume ?? 0.8) * 100);

    const bars = (seed) => Array.from({ length: 14 }, (_, i) => {
      const h = 24 + ((Math.sin(seed * 3.7 + i * 1.31) + 1) / 2) * 62;
      return `<i style="height:${h.toFixed(0)}%"></i>`;
    }).join('');

    const cards = stations.map((st, idx) => `
      <button class="jb-station ${st.id === current ? 'is-playing' : ''}" data-station="${st.id}" style="--jb-theme:${st.color}">
        <div class="jb-wave">${bars(idx + 1)}</div>
        <div class="jb-station-name"><strong>${st.name}</strong><small>${st.en}</small></div>
        <p>${st.desc}</p>
        <span class="jb-state">${st.id === current ? `${icon('music')}正在播放` : `${icon('arrow')}切到这一段`}</span>
      </button>
    `).join('');

    this.card.innerHTML = `
      <div class="modal-header">
        <div class="modal-title-group"><span class="modal-title-icon">${icon('radio')}</span><div><h3>宇宙点唱机</h3><small>COSMIC JUKEBOX / 4 STATIONS</small></div></div>
        <button class="btn-icon btn-close" id="btn-close-jukebox" title="关闭">${icon('close')}</button>
      </div>
      <div class="modal-body">
        <div class="jb-now ${muted ? 'is-muted' : ''}">
          <span class="jb-now-dot"></span>
          <div><strong id="jb-now-name">${stations.find(s => s.id === current)?.name || '荒野漫游'}</strong><small>${muted ? '当前静音' : 'ON AIR'}</small></div>
          <button class="jb-mute" id="jb-mute">${icon(muted ? 'close' : 'volume')}<span>${muted ? '取消静音' : '静音'}</span></button>
        </div>
        <div class="jb-grid">${cards}</div>
        <div class="jb-mixer">
          <label class="jb-slider">
            <span>${icon('music')}背景音乐</span>
            <input type="range" min="0" max="100" value="${bgm}" id="jb-bgm" />
            <output id="jb-bgm-out">${bgm}%</output>
          </label>
          <label class="jb-slider">
            <span>${icon('bolt')}音效</span>
            <input type="range" min="0" max="100" value="${sfx}" id="jb-sfx" />
            <output id="jb-sfx-out">${sfx}%</output>
          </label>
        </div>
      </div>
    `;

    this.card.querySelector('#btn-close-jukebox')?.addEventListener('click', () => this.closeModal());
    this.card.querySelectorAll('[data-station]').forEach(btn => {
      btn.addEventListener('click', () => {
        audio.startBGM(btn.dataset.station);
        sound.playSparkle();
        this.renderJukebox();
      });
    });
    this.card.querySelector('#jb-mute')?.addEventListener('click', () => {
      const isMuted = audio.toggleMute();
      this.jukeboxHost?.setSoundButtonState?.(document.getElementById('top-btn-sound'), isMuted);
      this.renderJukebox();
    });
    const bgmInput = this.card.querySelector('#jb-bgm');
    bgmInput?.addEventListener('input', () => {
      audio.setBGMVolume(Number(bgmInput.value) / 100);
      this.card.querySelector('#jb-bgm-out').textContent = `${bgmInput.value}%`;
    });
    const sfxInput = this.card.querySelector('#jb-sfx');
    sfxInput?.addEventListener('input', () => {
      audio.setSFXVolume(Number(sfxInput.value) / 100);
      this.card.querySelector('#jb-sfx-out').textContent = `${sfxInput.value}%`;
    });
  }

  // ================= 星尘篝火 / 围炉休整 =================
  openCampfireModal(gameMaster, prop) {
    this.currentModal = 'campfire';
    this.campfireHost = gameMaster || this.campfireHost;
    this.campfireProp = prop || this.campfireProp;
    this.overlay.classList.remove('hidden');
    this.renderCampfire();
  }

  renderCampfire() {
    const host = this.campfireHost;
    const player = host?.player;
    const hp = Math.round(player?.hp ?? 0);
    const maxHp = Math.round(player?.maxHp ?? 1);
    const sta = Math.round(player?.stamina ?? 0);
    const maxSta = Math.round(player?.maxStamina ?? 1);
    const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    const staPct = Math.max(0, Math.min(100, (sta / maxSta) * 100));

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const cdLeft = host?.restCooldownUntil ? Math.max(0, Math.ceil((host.restCooldownUntil - now) / 1000)) : 0;
    const healPreview = Math.min(maxHp - hp, Math.round(maxHp * 0.35));
    const chef = getActiveCharacter(this.gameState);

    const buffs = BuffManager.getActiveBuffs(this.gameState);
    const buffHtml = buffs.length
      ? buffs.map(b => `
          <div class="cf-buff">
            <span class="cf-buff-icon">${icon('spark')}</span>
            <div><strong>${b.dishName}</strong><small>${b.label}</small></div>
            <span class="cf-buff-time">${b.timeDisplay}</span>
          </div>
        `).join('')
      : '<div class="cf-buff-empty">暂时没有生效的料理增益，去灶台做一道。</div>';

    const ring = (pct, color) =>
      `background: conic-gradient(${color} ${pct.toFixed(1)}%, rgba(255,255,255,0.07) ${pct.toFixed(1)}%)`;

    this.card.innerHTML = `
      <div class="modal-header">
        <div class="modal-title-group"><span class="modal-title-icon">${icon('flame')}</span><div><h3>星尘篝火</h3><small>STARDUST CAMPFIRE / FIELD REST</small></div></div>
        <button class="btn-icon btn-close" id="btn-close-campfire" title="关闭">${icon('close')}</button>
      </div>
      <div class="modal-body">
        <div class="cf-layout">
          <section class="cf-vitals">
            <div class="panel-kicker"><span>状态</span><strong>身体读数</strong><small>VITALS</small></div>
            <div class="cf-rings">
              <div class="cf-ring" style="${ring(hpPct, '#f87171')}">
                <div class="cf-ring-core"><b>${hp}</b><small>/ ${maxHp} HP</small></div>
              </div>
              <div class="cf-ring" style="${ring(staPct, '#38bdf8')}">
                <div class="cf-ring-core"><b>${sta}</b><small>/ ${maxSta} STA</small></div>
              </div>
            </div>
            <div class="cf-chef" style="--cf-theme:${chef.theme}">
              <span>${icon('chef')}</span>
              <div><strong>${chef.name}</strong><small>${chef.title} · ${chef.skill.name}</small></div>
            </div>
          </section>

          <section class="cf-side">
            <div class="panel-kicker"><span>增益</span><strong>饱食效果</strong><small>ACTIVE BUFFS</small></div>
            <div class="cf-buffs">${buffHtml}</div>
            <div class="cf-rest">
              <p class="cf-rest-note">围炉一次可回复 <b>35%</b> 生命并补满耐力，之后篝火需要 60 秒重新攒热。</p>
              <button class="cf-rest-btn ${cdLeft > 0 ? 'is-cooling' : ''}" id="cf-rest" ${cdLeft > 0 ? 'disabled' : ''}>
                ${icon('flame')}
                <span>${cdLeft > 0 ? `攒热中 ${cdLeft}s` : '围炉休整'}</span>
                ${cdLeft > 0 ? '' : `<em>+${healPreview} HP</em>`}
              </button>
            </div>
          </section>
        </div>
      </div>
    `;

    this.card.querySelector('#btn-close-campfire')?.addEventListener('click', () => this.closeModal());
    this.card.querySelector('#cf-rest')?.addEventListener('click', () => {
      this.campfireHost?.restAtCampfire(this.campfireProp || { x: player?.x || 0, y: player?.y || 0 });
      this.renderCampfire();
    });
  }

  // ================= 2. INVENTORY BACKPACK MODAL =================
  openInventoryModal() {
    this.currentModal = 'inventory';
    this.overlay.classList.remove('hidden');
    this.renderInventory();
  }

  renderInventory(activeTab = 'ingredients') {
    const inventory = this.gameState.inventory || {};
    const cookedDishes = this.gameState.cookedDishes || [];

    let itemsHtml = '';
    if (activeTab === 'ingredients') {
      const rawEntries = Object.entries(inventory).filter(([_, count]) => count > 0);
      if (rawEntries.length === 0) {
        itemsHtml = `<div class="inventory-empty"><span class="empty-illustration">${icon('backpack')}</span><strong>背包暂无记录</strong><span>前往荒野采集第一份食材。</span></div>`;
      } else {
        itemsHtml = `
          <div class="inventory-grid">
            ${rawEntries.map(([id, count]) => {
              const item = getIngredientById(id);
              if (!item) return '';
              return `
                <div class="inv-card" data-id="${item.id}" data-type="ingredient">
                  <div class="inv-card-top">
                    <span class="inv-card-icon">${ingredientIcon(item)}</span>
                    <span class="inv-card-count">x${count}</span>
                  </div>
                  <div class="inv-card-name">${item.name}</div>
                  <div class="inv-card-tier">Tier ${item.tier}</div>
                  ${(() => {
                    const raw = rawFoodValue(item);
                    return raw
                      ? `<button class="btn-inv-raw" data-raw="${item.id}" title="${raw.note}">生吃 <b>+${raw.hp}</b>HP <b>+${raw.stamina}</b>STA</button>`
                      : '';
                  })()}
                </div>
              `;
            }).join('')}
          </div>
        `;
      }
    } else if (activeTab === 'dishes') {
      if (cookedDishes.length === 0) {
        itemsHtml = `<div class="inventory-empty"><span class="empty-illustration">${dishIcon()}</span><strong>还没有完成的料理</strong><span>在营地选择食材，完成第一道出餐。</span></div>`;
      } else {
        itemsHtml = `
          <div class="inventory-grid">
            ${cookedDishes.map((dish, idx) => `
              <div class="inv-card" data-index="${idx}" data-type="dish">
                <div class="inv-card-top">
                  <span class="inv-card-icon">${dishIcon()}</span>
                  <span class="inv-card-count">${Array.from({ length: dish.qualityStars || 0 }, () => icon('star')).join('')}</span>
                </div>
                <div class="inv-card-name">${dish.name}</div>
                <div class="inv-card-buff">${dish.adjustedBuff.label.split(' ')[0]}</div>
                <button class="btn-inv-eat" data-index="${idx}">享用</button>
              </div>
            `).join('')}
          </div>
        `;
      }
    } else if (activeTab === 'weapons') {
      itemsHtml = this.renderCarriedWeapons();
    }

    const carried = WEAPONS.filter(w => ownsWeapon(this.gameState, w.id)).length;

    this.card.innerHTML = `
      <div class="modal-header">
        <div class="modal-title-group"><span class="modal-title-icon">${icon('backpack')}</span><div><h3>猎人便携行囊</h3><small>FIELD INVENTORY / 食材可直接生吃</small></div></div>
        <button class="btn-icon btn-close" id="btn-close-inv" title="关闭">${icon('close')}</button>
      </div>
      <div class="modal-body">
        <div class="inventory-tabs">
          <button class="tab-btn ${activeTab === 'ingredients' ? 'active' : ''}" data-tab="ingredients">${icon('veg')}<span>原生食材</span></button>
          <button class="tab-btn ${activeTab === 'dishes' ? 'active' : ''}" data-tab="dishes">${dishIcon()}<span>已烹饪料理</span><b>${cookedDishes.length}</b></button>
          <button class="tab-btn ${activeTab === 'weapons' ? 'active' : ''}" data-tab="weapons">${icon('bolt')}<span>随身武器</span><b>${carried}</b></button>
        </div>

        <div class="inventory-content-area">
          ${itemsHtml}
        </div>
      </div>
    `;

    this.card.querySelector('#btn-close-inv').addEventListener('click', () => this.closeModal());

    this.card.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.renderInventory(btn.dataset.tab);
      });
    });

    this.card.querySelectorAll('.btn-inv-equip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.inventoryHost?.equipWeaponById?.(btn.dataset.equip);
        sound.playCoin();
        this.renderInventory('weapons');
      });
    });

    this.card.querySelectorAll('.btn-inv-raw').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.eatRaw(btn.dataset.raw);
      });
    });

    this.card.querySelectorAll('.btn-inv-eat').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index);
        const dish = this.gameState.cookedDishes[idx];
        if (dish) {
          BuffManager.applyBuff(this.gameState, dish);
          this.almanacHost?.tutorialStep?.('eat');
          this.hud.showToast(`享用了【${dish.name}】！${dish.adjustedBuff.label}`, 'success', dish.icon);
          this.gameState.cookedDishes.splice(idx, 1);
          this.renderInventory('dishes');
        }
      });
    });
  }

  /**
   * 背包里的武器页：只列已拥有的，随时可切换。
   * 没买的留在军械商，这里不做购买。
   */
  renderCarriedWeapons() {
    const equippedId = this.gameState.weaponId;
    const list = WEAPONS.filter(w => ownsWeapon(this.gameState, w.id));

    if (!list.length) {
      return `<div class="inventory-empty"><span class="empty-illustration">${icon('bolt')}</span><strong>还没有可换的武器</strong><span>到营地军械商（Z）选购，或开补给箱碰运气。</span></div>`;
    }

    const cards = list.map(w => {
      const isOn = w.id === equippedId;
      const ranged = w.kind === WEAPON_KIND.RANGED;
      return `
        <div class="inv-weapon ${isOn ? 'is-active' : ''}" style="--wp:${w.color}">
          <div class="iw-head">
            <span class="iw-mark">${icon(ranged ? 'bolt' : 'chef')}</span>
            <div class="iw-title"><strong>${w.name}</strong><small>${ranged ? '枪械' : '近战'} · ${w.nameEn}</small></div>
            ${isOn ? '<span class="iw-badge">装备中</span>' : ''}
          </div>
          <div class="iw-stats">${weaponSummary(w).map(([k, v]) => `<span><i>${k}</i><b>${v}</b></span>`).join('')}</div>
          ${isOn
            ? '<span class="iw-on">当前手持</span>'
            : `<button class="btn-inv-equip" data-equip="${w.id}">${icon('swap')}<span>换上</span></button>`}
        </div>`;
    }).join('');

    return `<div class="inv-weapon-list">${cards}</div>`;
  }

  /** 生吃一份食材：扣库存、回血回耐力，交给宿主实际结算。 */
  eatRaw(id) {
    const item = getIngredientById(id);
    if (!item) return;
    if ((this.gameState.inventory[id] || 0) <= 0) return;

    const raw = rawFoodValue(item);
    const applied = this.inventoryHost?.consumeRawFood?.(item, raw);
    if (applied === false) return;

    this.gameState.inventory[id] -= 1;
    if (this.gameState.inventory[id] <= 0) delete this.gameState.inventory[id];
    state.save();
    sound.playCoin();
    this.hud.showToast(
      `生吃了【${item.name}】：+${raw.hp} HP，+${raw.stamina} 耐力。${raw.note}。`,
      'info', ingredientIcon(item)
    );
    this.renderInventory('ingredients');
  }

  // ================= 公会补给箱 =================
  // ================= 星历 =================

  openAlmanacModal(gameMaster) {
    this.currentModal = 'almanac';
    this.almanacHost = gameMaster || this.almanacHost;
    this.overlay.classList.remove('hidden');
    this.renderAlmanac();
  }

  renderAlmanac() {
    const d = this.gameState;
    ensureAlmanac(d);
    const day = d.dayCount || 1;
    const omen = getOmen(d);
    const dailies = d.almanac.dailies || [];

    const omenCard = `
      <div class="omen-card" style="--omen:${omen.color}">
        <div class="omen-head">
          <span class="omen-mark">${icon('spark')}</span>
          <div><strong>${omen.name}</strong><small>今日异象 · ${omen.nameEn}</small></div>
        </div>
        <p>${omen.desc}</p>
        <div class="omen-tags">${omenTags(omen)}</div>
      </div>`;

    const dailyCards = dailies.length ? dailies.map(t => {
      const lb = dailyLabel(t);
      const pct = Math.min(100, Math.round((t.progress / t.goal) * 100));
      const ready = !t.claimed && t.progress >= t.goal;
      return `
        <div class="dq-row ${t.claimed ? 'is-done' : ''} ${ready ? 'is-ready' : ''}">
          <span class="dq-verb">${lb.verb}</span>
          <div class="dq-body">
            <strong>${lb.text}</strong>
            <div class="dq-bar"><i style="width:${pct}%"></i></div>
            <small>${Math.min(t.progress, t.goal)} / ${t.goal}</small>
          </div>
          <div class="dq-reward">${icon('coin')}<b>${t.credits}</b><span>${icon('spark')}${t.rep}</span></div>
          ${t.claimed
            ? '<span class="dq-claimed">已领取</span>'
            : ready
              ? `<button class="dq-claim" data-daily="${t.id}">领取</button>`
              : '<span class="dq-wait">进行中</span>'}
        </div>`;
    }).join('') : '<div class="inventory-empty"><strong>今天还没有委托</strong><span>睡一觉，明天公会会派新的。</span></div>';

    const stoneCards = DAY_MILESTONES.map(m => {
      const st = milestoneStatus(d, m);
      const items = (m.items || []).map(([id, n]) => {
        const it = getIngredientById(id);
        return `<span class="ms-item">${it ? ingredientIcon(it) : ''}${it?.name || id} ×${n}</span>`;
      }).join('');
      const gun = m.weapon ? `<span class="ms-item is-gun">${icon('bolt')}${getWeapon(m.weapon).name}</span>` : '';
      return `
        <div class="ms-card ${st}">
          <div class="ms-day"><b>${m.day}</b><small>宇宙日</small></div>
          <div class="ms-body">
            <strong>${m.name}</strong>
            <div class="ms-loot">${icon('coin')}<b>${m.credits}</b>${icon('spark')}<b>${m.rep}</b>${items}${gun}</div>
          </div>
          ${st === 'ready'
            ? `<button class="ms-claim" data-milestone="${m.day}">领取</button>`
            : st === 'claimed'
              ? `<span class="ms-tag">${icon('check')}已领</span>`
              : `<span class="ms-tag locked">还差 ${m.day - day} 天</span>`}
        </div>`;
    }).join('');

    this.card.innerHTML = `
      <div class="modal-header">
        <div class="modal-title-group"><span class="modal-title-icon">${icon('clock')}</span><div><h3>猎人星历</h3><small>FIELD ALMANAC / 第 ${day} 宇宙日</small></div></div>
        <button class="btn-icon btn-close" id="btn-close-almanac" title="关闭">${icon('close')}</button>
      </div>
      <div class="modal-body">
        ${omenCard}
        <div class="panel-kicker"><span>01</span><strong>今日委托</strong><small>DAILY ORDERS / 跨日作废</small></div>
        <div class="daily-list">${dailyCards}</div>
        <div class="panel-kicker"><span>02</span><strong>生存里程碑</strong><small>SURVIVAL MILESTONES</small></div>
        <div class="ms-list">${stoneCards}</div>
      </div>`;

    this.card.querySelector('#btn-close-almanac').addEventListener('click', () => this.closeModal());

    this.card.querySelectorAll('.dq-claim').forEach(btn => {
      btn.addEventListener('click', () => {
        const res = claimDaily(this.gameState, btn.dataset.daily);
        if (!res.ok) { this.hud.showToast(res.msg, 'warning', icon('close')); return; }
        const lb = dailyLabel(res.task);
        this.hud.showToast(`委托达成：${lb.text}。+${res.task.credits} 星币，+${res.task.rep} 口碑。`, 'success', icon('coin'));
        sound.playCoin();
        this.almanacHost?.onAlmanacChanged?.();
        this.renderAlmanac();
      });
    });

    this.card.querySelectorAll('.ms-claim').forEach(btn => {
      btn.addEventListener('click', () => {
        const res = claimMilestone(this.gameState, Number(btn.dataset.milestone));
        if (!res.ok) { this.hud.showToast(res.msg, 'warning', icon('close')); return; }
        this.hud.showToast(
          `生存 ${res.milestone.day} 天：${res.milestone.name}。+${res.milestone.credits} 星币，+${res.milestone.rep} 口碑。`,
          'success', icon('star')
        );
        if (res.weapon) {
          this.hud.showToast(`星历附赠了一把【${getWeapon(res.weapon).name}】，行囊里可以直接换上。`, 'success', icon('bolt'));
        }
        sound.playCoin();
        this.almanacHost?.onAlmanacChanged?.();
        this.renderAlmanac();
      });
    });
  }

  openCrateModal(gameMaster) {
    this.currentModal = 'crate';
    this.crateHost = gameMaster || this.crateHost;
    this.overlay.classList.remove('hidden');
    this.renderCrate();
  }

  renderCrate() {
    const info = crateSummary(this.gameState);

    this.card.innerHTML = `
      <div class="modal-header">
        <div class="modal-title-group"><span class="modal-title-icon">${icon('backpack')}</span><div><h3>公会补给箱</h3><small>SUPPLY CACHE / ${info.count} / ${CRATE_CAPACITY}</small></div></div>
        <button class="btn-icon btn-close" id="btn-close-crate" title="关闭">${icon('close')}</button>
      </div>
      <div class="modal-body">
        <p class="tp-lead">公会每隔一段时间往箱子里塞一份补给。多数是食材，偶尔是一份现成料理，运气好会有一把武器。装满 ${CRATE_CAPACITY} 件就停止进货，记得回来取。</p>

        <div class="crate-status">
          <div class="crate-meter">
            <span>下一份补给</span>
            <div class="crate-track"><i style="width:${Math.round((1 - info.nextIn / 75) * 100)}%"></i></div>
            <b>${info.full ? '已装满' : `${info.nextIn}s`}</b>
          </div>
          <button class="btn-action-main" id="btn-crate-claim" ${info.count ? '' : 'disabled'}>
            ${icon('arrow')}<span>${info.count ? `全部取出（${info.count} 件）` : '暂无补给'}</span>
          </button>
        </div>

        ${info.count ? `
          <div class="crate-grid">
            ${info.items.map(it => `
              <div class="crate-item is-${it.kind}">
                <span class="crate-icon">${icon(it.icon)}</span>
                <div class="crate-copy"><strong>${it.name}</strong><small>${it.detail}</small></div>
              </div>
            `).join('')}
          </div>
        ` : `<div class="gal-empty">${icon('backpack')}<p>箱子是空的。出门转一圈再回来，公会会补上新的物资。</p></div>`}
      </div>
    `;

    this.card.querySelector('#btn-close-crate')?.addEventListener('click', () => this.closeModal());
    this.card.querySelector('#btn-crate-claim')?.addEventListener('click', () => {
      const res = claimCrate(this.gameState);
      if (res.empty) return;
      state.save();
      sound.playSparkle();
      this.crateHost?.onCrateClaimed?.(res.taken);
      this.hud.showToast(`从补给箱取出 ${res.taken.length} 件物资。`, 'success', icon('backpack'));
      this.renderCrate();
    });
  }

  // ================= 军械商 =================
  openArmoryModal(gameMaster) {
    this.currentModal = 'armory';
    this.armoryHost = gameMaster || this.armoryHost;
    this.overlay.classList.remove('hidden');
    this.renderArmory();
  }

  renderArmory() {
    const equippedId = this.gameState.weaponId;
    const owned = WEAPONS.filter(w => ownsWeapon(this.gameState, w.id)).length;

    const cards = WEAPONS.map(w => {
      const st = weaponStatus(this.gameState, w);
      const isOn = w.id === equippedId;
      const stats = weaponSummary(w);
      const ranged = w.kind === WEAPON_KIND.RANGED;

      return `
        <div class="wp-card ${isOn ? 'is-active' : ''} ${st.locked ? 'is-locked' : ''}" style="--wp:${w.color}">
          <div class="wp-head">
            <span class="wp-mark">${icon(ranged ? 'bolt' : 'chef')}</span>
            <div class="wp-title">
              <strong>${w.name}</strong>
              <small>${w.nameEn} · ${ranged ? '枪械' : '近战'}</small>
            </div>
            ${isOn ? '<span class="wp-badge">装备中</span>' : ''}
          </div>
          <p class="wp-desc">${w.desc}</p>
          <div class="wp-stats">
            ${stats.map(([k, v]) => `<span><i>${k}</i><b>${v}</b></span>`).join('')}
          </div>
          <div class="wp-foot">
            ${st.owned
              ? (isOn
                ? '<span class="wp-owned">已装备</span>'
                : `<button class="wp-btn equip" data-equip="${w.id}">${icon('swap')}<span>装备</span></button>`)
              : st.locked
                ? `<span class="wp-lock">${icon('close')}${st.reason}</span>`
                : `<button class="wp-btn buy ${st.afford ? '' : 'disabled'}" data-buy="${w.id}" ${st.afford ? '' : 'disabled'}>
                     ${icon('coin')}<b>${w.cost}</b><span>${st.afford ? '购入' : '星币不足'}</span>
                   </button>`}
          </div>
        </div>
      `;
    }).join('');

    this.card.innerHTML = `
      <div class="modal-header">
        <div class="modal-title-group"><span class="modal-title-icon">${icon('bolt')}</span><div><h3>军械商</h3><small>FIELD ARMORY / ${owned} / ${WEAPONS.length} OWNED</small></div></div>
        <button class="btn-icon btn-close" id="btn-close-armory" title="关闭">${icon('close')}</button>
      </div>
      <div class="modal-body">
        <div class="guild-status-bar">
          <div class="guild-rank"><span>持有星币</span><b>${icon('coin')} ${this.gameState.credits || 0}</b></div>
          <div class="guild-rep"><span>猎人声望</span><b>${this.gameState.reputation || 0} REP</b></div>
        </div>
        <p class="tp-lead">近战武器改写挥击数值；<b>枪械</b>换成远程开火，按 <b>J</b> 或左键射击，每发消耗耐力。口碑越高，货架上的东西越狠。</p>
        <div class="wp-grid">${cards}</div>
      </div>
    `;

    this.card.querySelector('#btn-close-armory')?.addEventListener('click', () => this.closeModal());

    this.card.querySelectorAll('[data-buy]').forEach(btn => {
      btn.addEventListener('click', () => {
        const res = buyWeapon(this.gameState, btn.dataset.buy);
        this.hud.showToast(res.msg, res.ok ? 'success' : 'warning', icon(res.ok ? 'coin' : 'close'));
        if (res.ok) {
          sound.playStarFanfare();
          this.armoryHost?.onWeaponBought?.(res.weapon);
        }
        this.renderArmory();
      });
    });

    this.card.querySelectorAll('[data-equip]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.armoryHost?.equipWeaponById?.(btn.dataset.equip);
        sound.playSparkle();
        this.renderArmory();
      });
    });
  }

  // ================= 3. MICHELIN BOUNTY BOARD MODAL =================
  openBountiesModal() {
    this.currentModal = 'bounties';
    this.overlay.classList.remove('hidden');
    this.renderBounties(1);
  }

  renderBounties(activeTier = 1) {
    const bounties = this.bountyManager.getAvailableBounties(activeTier);
    const michelinStars = this.gameState.michelinStars || 0;
    const reputation = this.gameState.reputation || 0;

    this.card.innerHTML = `
      <div class="modal-header">
        <div class="modal-title-group"><span class="modal-title-icon">${icon('scroll')}</span><div><h3>银河米其林公会</h3><small>CONTRACT BOARD / REPUTATION OFFICE</small></div></div>
        <button class="btn-icon btn-close" id="btn-close-bounties" title="关闭">${icon('close')}</button>
      </div>
      <div class="modal-body">
        <!-- Guild Hunter Status Bar -->
        <div class="guild-status-bar">
          <div class="guild-rank">
            <span>当前星级认证</span>
            <b>${michelinStars ? Array.from({ length: michelinStars }, () => icon('star')).join('') : '无星级 / 见习学徒'}</b>
          </div>
          <div class="guild-rep">
            <span>猎人声望</span><b>${reputation} REP</b>
          </div>
        </div>

        <!-- Tier Tabs -->
        <div class="bounty-tabs">
          <button class="tab-btn ${activeTier === 1 ? 'active' : ''}" data-tier="1">${icon('star')}<span>初星委托</span><b>01</b></button>
          <button class="tab-btn ${activeTier === 2 ? 'active' : ''}" data-tier="2">${icon('star')}<span>二星讨伐</span><b>02</b></button>
          <button class="tab-btn ${activeTier === 3 ? 'active' : ''}" data-tier="3">${icon('star')}<span>传奇主厨</span><b>03</b></button>
        </div>

        <!-- Bounties List -->
        <div class="bounties-list">
          ${bounties.map(b => `
            <div class="bounty-card ${b.isCompleted ? 'completed' : (b.isActive ? 'active' : '')}">
              <div class="bounty-card-left">
                <span class="bounty-icon">${bountyIcon()}</span>
                <div class="bounty-info">
                  <div class="bounty-title">${b.title}</div>
                  <div class="bounty-desc">${b.desc}</div>
                  <div class="bounty-rewards">
                    <span>${icon('coin')} +${b.rewardCredits}</span>
                    <span>${icon('spark')} +${b.rewardRep}</span>
                  </div>
                </div>
              </div>
              <div class="bounty-card-right">
                <div class="bounty-objective">
                  <span class="bo-kind">${BOUNTY_VERBS[b.type] || '目标'}</span>
                  <strong>${b.targetName}</strong>
                  <span class="bo-count">${b.currentProgress} / ${b.targetCount}</span>
                  <span class="bo-track"><i style="width:${Math.min(100, Math.round((b.currentProgress / b.targetCount) * 100))}%"></i></span>
                </div>
                ${b.isCompleted ? `
                  <span class="bounty-badge-completed">${icon('trophy')} 已完成</span>
                ` : (b.canClaim ? `
                  <button class="btn-claim-bounty" data-id="${b.id}">${icon('trophy')}<span>领取报酬</span></button>
                ` : (b.isActive ? `
                  <div class="bounty-progress-tag">${b.currentProgress}/${b.targetCount} 进行中</div>
                  <button class="btn-abandon-bounty" data-id="${b.id}">放弃</button>
                ` : `
                  <button class="btn-accept-bounty" data-id="${b.id}">${icon('arrow')}<span>接取委托</span></button>
                `))}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.card.querySelector('#btn-close-bounties').addEventListener('click', () => this.closeModal());

    this.card.querySelectorAll('.bounty-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.renderBounties(parseInt(btn.dataset.tier));
      });
    });

    this.card.querySelectorAll('.btn-accept-bounty').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const res = this.bountyManager.acceptBounty(id);
        this.hud.showToast(res.msg, res.success ? 'success' : 'info');
        if (res.success) this.almanacHost?.tutorialStep?.('bounty');
        this.renderBounties(activeTier);
      });
    });

    this.card.querySelectorAll('.btn-abandon-bounty').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        this.bountyManager.abandonBounty(id);
        this.renderBounties(activeTier);
      });
    });

    this.card.querySelectorAll('.btn-claim-bounty').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const res = this.bountyManager.claimBounty(id);
        this.hud.showToast(res.msg, 'success', icon('trophy'));
        if (res.success) {
          this.almanacHost?.applyOmenRep?.(res.rewardRep);
          this.almanacHost?.tutorialStep?.('bounty_done');
        }
        this.almanacHost?.onAlmanacChanged?.();
        this.renderBounties(activeTier);
      });
    });
  }

  // ================= 4. RECIPE CODEX MODAL =================
  openRecipeCodexModal() {
    this.currentModal = 'recipes';
    this.overlay.classList.remove('hidden');
    this.renderRecipeCodex(1);
  }

  // Backwards-compatible alias used by the top bar and HUD shortcuts.
  openCodexModal() {
    this.openRecipeCodexModal();
  }

  renderRecipeCodex(activeTier = 1) {
    const discovered = this.gameState.discoveredRecipes || [];
    const tierRecipes = RECIPES.filter(r => r.tier === activeTier);

    this.card.innerHTML = `
      <div class="modal-header">
        <div class="modal-title-group"><span class="modal-title-icon">${icon('book')}</span><div><h3>银河星尘食谱大典</h3><small>RECIPE CODEX / DISCOVERY ARCHIVE</small></div></div>
        <button class="btn-icon btn-close" id="btn-close-codex" title="关闭">${icon('close')}</button>
      </div>
      <div class="modal-body">
        <div class="recipe-tabs">
          <button class="tab-btn ${activeTier === 1 ? 'active' : ''}" data-tier="1"><span>初阶探险</span><b>01</b></button>
          <button class="tab-btn ${activeTier === 2 ? 'active' : ''}" data-tier="2"><span>进阶饕餮</span><b>02</b></button>
          <button class="tab-btn ${activeTier === 3 ? 'active' : ''}" data-tier="3"><span>大师星耀</span><b>03</b></button>
          <button class="tab-btn ${activeTier === 4 ? 'active' : ''}" data-tier="4"><span>宇宙神话</span><b>04</b></button>
        </div>

        <div class="codex-grid">
          ${tierRecipes.map(recipe => {
            const isKnown = discovered.includes(recipe.id);
            return `
              <div class="codex-card ${isKnown ? 'discovered' : 'undiscovered'}">
                <div class="codex-icon">${isKnown ? dishIcon() : icon('lock')}</div>
                <div class="codex-info">
                  <div class="codex-title">${isKnown ? recipe.name : '神秘未解锁料理'}</div>
                  <div class="codex-desc">${isKnown ? recipe.desc : '在营火前尝试不同异星食材配方即可发现新菜谱。'}</div>
                  ${isKnown ? `
                    <div class="codex-formula">
                      ${recipe.ingredients.map(ingId => {
                        const ing = getIngredientById(ingId);
                        return `<span>${ing ? ingredientIcon(ing) + '<em>' + ing.name + '</em>' : ingId}</span>`;
                      }).join(' + ')}
                    </div>
                    <div class="codex-buff">${icon('spark')} 增益: ${recipe.buff.label}</div>
                  ` : `<div class="codex-hint">${icon('lock')} 需要在营地尝试新的食材组合</div>`}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    this.card.querySelector('#btn-close-codex').addEventListener('click', () => this.closeModal());

    this.card.querySelectorAll('.recipe-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.renderRecipeCodex(parseInt(btn.dataset.tier));
      });
    });
  }
}
