/**
 * Galaxy Hunter: Gourmet Odyssey (银河系米其林指南：荒野美食猎人)
 * Master Game Controller & Integration Loop
 * File: src/main.js
 */

import { assets, GAME_SPRITE_PATHS } from './core/assets.js';
import { Engine } from './core/engine.js';
import { Camera } from './core/camera.js';
import { state } from './core/state.js';
import { audio } from './audio.js';
import { WorldMap, makeRng } from './world/map.js';
import {
  PLANETS, getPlanet, getCurrentPlanet, canTravelTo, planetFauna, rollWorldSeed, hasVisited
} from './world/planets.js';
import { particles } from './world/particles.js';
import { WorldSpawner } from './world/spawner.js';
import { Player, PLAYER_STATES } from './entities/player.js';
import { createMonster } from './entities/monster_types.js';
import { bakeVariantTint } from './entities/fauna_extra.js';
import { CookingEngine, BuffManager } from './systems/cooking.js';
import { getIngredientById, refreshRecipeUnlocks } from './systems/recipes.js';
import { BountyManager } from './systems/bounties.js';
import { CampInteractionManager } from './systems/camp_interactions.js';
import { getPinnedDish } from './systems/gallery.js';
import { getUpgradeById, getUpgradeValue } from './systems/upgrades.js';
import {
  getActiveWeapon, equipWeapon, getWeapon, ownsWeapon, WEAPON_KIND
} from './systems/weapons.js';
import { tickCrate, crateSummary } from './systems/supply_crate.js';
import {
  ensureAlmanac, rollNewDay, getOmen, omenEffect, trackDaily, almanacAlerts,
  claimMilestone, claimDaily
} from './systems/almanac.js';
import { reportTutorial, isActive as tutorialActive, ensureTutorial } from './systems/tutorial.js';
import {
  CHARACTERS, getActiveCharacter, refreshUnlocks, applyCharacterStats, unlockStatus
} from './systems/characters.js';
import { SkillRuntime, castSkill } from './systems/skills.js';
import {
  TRIAL_STATES, TRIAL_BOSS_ID, TRIAL_BOSS_STATS, BOSS_PHASES,
  getTrialData, refreshTrialState, getArenaPosition, phaseIndex, evaluateFinalGrade
} from './systems/final_trial.js';
import { GameHUD } from './ui/hud.js';
import { CampUI } from './ui/camp_ui.js';
import { TitleScreen } from './ui/title_screen.js';
import { icon } from './ui/icons.js';

const ALIEN_VARIANTS = {
  standard: {},
  juvenile: { label: '幼生', scale: 0.82, hp: 0.72, speed: 1.18, filter: 'saturate(1.12) brightness(1.14)' },
  swift: { label: '疾行', scale: 0.9, hp: 0.88, speed: 1.24, filter: 'hue-rotate(18deg) saturate(1.3) brightness(1.08)' },
  charged: { label: '电弧', scale: 1.06, hp: 1.22, damage: 1.12, filter: 'hue-rotate(35deg) saturate(1.45) brightness(1.08)' },
  bloom: { label: '花冠', scale: 0.96, hp: 1.08, filter: 'hue-rotate(-28deg) saturate(1.5) brightness(1.06)' },
  toxic: { label: '酸雾', scale: 1.02, hp: 1.15, damage: 1.1, filter: 'hue-rotate(72deg) saturate(1.55)' },
  prowler: { label: '夜行', scale: 0.94, hp: 1.1, speed: 1.15, filter: 'hue-rotate(150deg) saturate(1.2) brightness(0.76)' },
  prismatic: { label: '棱镜', scale: 0.98, hp: 1.16, filter: 'hue-rotate(118deg) saturate(1.48) brightness(1.08)' },
  sentinel: { label: '哨卫', scale: 1.13, hp: 1.42, damage: 1.12, defense: 4, filter: 'hue-rotate(26deg) saturate(1.2)' },
  ember: { label: '余烬', scale: 1.04, hp: 1.18, damage: 1.14, filter: 'hue-rotate(-22deg) saturate(1.6) brightness(1.06)' },
  frost: { label: '霜纹', scale: 1.03, hp: 1.2, defense: 2, filter: 'hue-rotate(168deg) saturate(1.2) brightness(1.1)' },
  ancient: { label: '远古', scale: 1.22, hp: 1.65, damage: 1.25, speed: 0.86, defense: 5, filter: 'sepia(0.32) saturate(1.25) brightness(0.92)' }
};

// 每种生态区常见的异兽。象限换了生态区，住在那儿的猎物也跟着换。
const BIOME_MONSTERS = {
  bioluminescent_forest: ['spore_bunny', 'spore_bunny', 'spore_bunny', 'venom_lizard'],
  crystalline_rift: ['crystal_golem', 'crystal_golem', 'venom_lizard', 'spore_bunny'],
  magma_springs: ['magma_wyrm', 'magma_wyrm', 'venom_lizard', 'spore_bunny'],
  cryo_tundra: ['frost_mammoth', 'frost_mammoth', 'crystal_golem', 'venom_lizard']
};

class GameMaster {
  constructor() {
    this.stageContainer = document.getElementById('stage-container');
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.startScreen = document.getElementById('start-screen');
    this.btnStart = document.getElementById('btn-start-game');

    this.decorateStaticIcons();

    // 调试句柄：控制台与自动化测试从这里读音频状态
    this.audio = audio;

    this.isGameRunning = false;
    this.monsters = [];
    this.projectiles = [];
    // 渲染插值期间被临时改写坐标的对象
    this._interpolated = [];
    this.ecosystemRespawns = new Map();
    this.lastPointerX = Number.NaN;
    this.lastPointerY = Number.NaN;
    this.lastPointerMovedAt = -Infinity;
    this.settingsSaveTimer = null;

    this.init();
  }

  /**
   * 按星球配置造一张新地图。每次调用都掷一个新种子，
   * 所以同一颗星球来回跃迁也不会是同一片地貌。
   */
  buildPlanetMap(planet) {
    const traits = planet.traits || {};
    this.worldSeed = rollWorldSeed();
    // 重力换算成移动速度：0.78g 的熔核带跑得更快，1.22g 的冰晶环带更沉
    this.planetGravity = traits.gravity ?? 1;
    if (this.player) {
      this.player.envSpeedMult = 1 / Math.sqrt(this.planetGravity);
      BuffManager.recalculateStats(this.gameData);
      BuffManager.updateBuffs(0, this.gameData, this.player, this.hud);
    }
    return new WorldMap({
      quadrants: planet.quadrants,
      seed: this.worldSeed,
      obstacleDensity: traits.obstacleDensity ?? 1,
      nightLength: traits.nightLength ?? 1,
      tint: traits.tint || null,
      terrainShift: traits.terrain || null,
      landmark: traits.landmark || null,
      landmarkCount: traits.landmarkCount || 0,
      exclusiveNode: traits.exclusiveNode || null
    });
  }

  decorateStaticIcons() {
    const nodes = document.querySelectorAll('[data-static-icon]');
    nodes.forEach(node => {
      const name = node.dataset.staticIcon;
      if (name) node.innerHTML = icon(name);
    });
  }

  async init() {
    // Restore a compatible field save before constructing systems that consume
    // the flat cooking/bounty data contract.
    state.load();
    state.normalizeData?.();

    // 1. Preload high-res sprite assets (non-blocking with fallback)
    try {
      const runtimeSprites = Object.fromEntries(
        Object.entries(GAME_SPRITE_PATHS).filter(([key]) => key !== 'player' && key !== 'cover')
      );
      await assets.loadImages(runtimeSprites);
    } catch (e) {
      console.warn('Assets loading warning:', e);
    }

    // 2. Initialize Game Engine & Map
    this.engine = new Engine(this.canvas);
    // WorldMap accepts an options object; passing positional numbers produced
    // an invalid camera position in the previous build and blanked the canvas.
    const startPlanet = getCurrentPlanet(state.data);
    this.map = this.buildPlanetMap(startPlanet);
    this.camera = new Camera(this.engine.width, this.engine.height, this.map.width, this.map.height);
    this.camera.setViewDistance(state.data.settings?.viewDistance ?? 110);
    this.spawner = new WorldSpawner(this.map);

    // 3. Initialize Player at Stardust Camp Center
    const campPos = this.map.campPosition;
    // The old spawn point sat between the campfire and jukebox. It was valid
    // for rendering, but the player radius left too little clearance to move
    // in several directions and felt like a hard lock on game start.
    const spawnOffsets = [
      [60, 60],
      [0, 100],
      [100, 0],
      [-100, 0],
      [0, -100],
      [140, 0],
      [0, 140],
      [-140, 0],
      [0, -140]
    ];
    const spawnOffset = spawnOffsets.find(([dx, dy]) => (
      !this.map.isBlocked(campPos.x + dx, campPos.y + dy, 20)
    ));
    const spawnX = campPos.x + (spawnOffset?.[0] ?? 60);
    const spawnY = campPos.y + (spawnOffset?.[1] ?? 60);
    this.spawnPoint = { x: spawnX, y: spawnY };
    this.player = new Player(spawnX, spawnY);
    this.camera.follow(this.player);

    // 实体是生命/耐力的唯一权威，从存档播种；HUD 每帧从实体回写展示
    const savedVitals = state.data.player || {};
    this.player.maxHp = savedVitals.maxHp || 120;
    this.player.hp = savedVitals.hp > 0
      ? Math.min(this.player.maxHp, savedVitals.hp)
      : this.player.maxHp;
    this.player.maxStamina = savedVitals.maxStamina || 100;
    this.player.stamina = Math.min(this.player.maxStamina, savedVitals.stamina ?? this.player.maxStamina);
    this.deathHandled = false;

    // 4. Initialize Systems & UI
    this.gameData = state.data;
    this.cookingEngine = new CookingEngine(this.gameData, audio, particles);
    this.bountyManager = new BountyManager(this.gameData, audio, particles);
    // 终焉盛宴出餐即触发通关结算
    this.cookingEngine.onCookingComplete = (dish) => {
      if (dish?.isFinale) this.onFinaleDishCooked(dish);
      this.tutorialStep('cook');
      if (trackDaily(this.gameData, 'cook_any')) this.refreshAlmanacBadge();
      // 美食巡展当天出餐口碑翻倍
      const mult = omenEffect(this.gameData, 'dishRepMult', 1);
      if (mult > 1 && dish?.earnedRep) {
        const extra = Math.round(dish.earnedRep * (mult - 1));
        if (extra > 0) {
          this.gameData.reputation = (this.gameData.reputation || 0) + extra;
          this.hud.showToast(`美食巡展加成：口碑 +${extra}。`, 'success', icon('spark'));
        }
      }
      this.updateTopBar();
    };

    this.hud = new GameHUD(
      this.stageContainer,
      this.gameData,
      (action, payload) => this.handleHUDAction(action, payload),
      {
        viewDistance: this.camera.viewDistance,
        onViewDistanceChange: (value) => this.setViewDistance(value)
      }
    );
    this.campUI = new CampUI(this.stageContainer, this.gameData, this.cookingEngine, this.bountyManager, this.hud);
    // 升级即时生效：重算属性、刷新顶栏并存档
    this.campUI.onUpgradePurchased = (id) => {
      BuffManager.recalculateStats(this.gameData);
      BuffManager.updateBuffs(0, this.gameData, this.player, this.hud);
      this.updateTopBar();
      state.save();
      const up = getUpgradeById(id);
      if (up) {
        this.hud.showToast(`${up.name} 已强化 · ${up.format(getUpgradeValue(this.gameData, id))}`, 'success', icon('bolt'));
      }
      this.tutorialStep('upgrade');
    };

    this.campUI.inventoryHost = this;
    this.campUI.crateHost = this;
    this.campUI.armoryHost = this;
    this.campUI.almanacHost = this;

    this.campInteractions = new CampInteractionManager(this.map, (action, prop) => this.handleCampInteraction(action, prop));
    this.refreshPinnedDish();

    this.skillRuntime = new SkillRuntime();
    this.applyCharacter(this.gameData.characterId, { silent: true });
    this.equipWeaponById(this.gameData.weaponId, { silent: true });
    this.fireCooldown = 0;

    // 5. Seed Initial Monster Ecosystem
    this.spawnEcosystem();

    // 6. Bind UI & Top Bar Events
    this.bindEvents();

    // 7. Auto-save Interval (every 15s)
    setInterval(() => {
      if (this.isGameRunning) {
        state.save();
      }
    }, 15000);
  }

  /** 开始界面的主菜单：主厨选择、操作指南与档案面板。 */
  buildTitleScreen() {
    this.titleScreen = new TitleScreen({
      gameData: this.gameData,
      drawPortrait: (cv, c, locked) => this.campUI.drawChefPortrait(cv, c, locked),
      onPickChef: (id) => this.applyCharacter(id, { silent: true }),
      onSound: (kind) => {
        audio.init();
        audio.play(kind === 'pick' ? 'item_pickup' : 'ui_hover', { volume: kind === 'pick' ? 0.4 : 0.22 });
      }
    });
    this.refreshStartRoster = () => this.titleScreen?.refresh();
  }

  bindEvents() {
    this.buildTitleScreen();
    const launchGame = () => {
      audio.init();
      audio.startBGM('wilderness');
      if (this.startScreen) {
        this.startScreen.classList.add('hidden');
        this.startScreen.style.display = 'none';
      }
      this.titleScreen?.dispose();
      this.isGameRunning = true;
      this.engine.start(
        (dt) => this.update(dt),
        (ctx, alpha) => this.render(ctx, alpha)
      );
      // 开局先把当天的异象与委托摆好，再按引导状态给开场提示
      this.refreshDayCycle();
      const omen = getOmen(this.gameData);
      if (tutorialActive(this.gameData)) {
        this.hud.showToast('右侧有一条新手引导，跟着做就能上手。不想看可以点 × 跳过。', 'success', icon('spark'));
      } else {
        this.hud.showToast('欢迎来到荒野。前往四大生态狩猎食材，按 C 在营地烹饪。', 'success', icon('spark'));
      }
      this.hud.showToast(`第 ${this.gameData.dayCount || 1} 宇宙日 · ${omen.name}：${omen.desc}`, 'info', icon('clock'));
      this.hud.refreshTutorial();
    };

    // Start Game Button
    if (this.btnStart) {
      this.btnStart.addEventListener('click', launchGame);
      this.btnStart.addEventListener('touchend', (e) => {
        e.preventDefault();
        launchGame();
      });
    }

    // Top Bar Quick Access
    const bindBtn = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };

    bindBtn('top-btn-camp', () => this.campUI.openCampCookingModal());
    bindBtn('top-btn-bag', () => this.campUI.openInventoryModal());
    bindBtn('top-btn-bounty', () => this.campUI.openBountiesModal());
    bindBtn('top-btn-codex', () => this.campUI.openCodexModal());
    bindBtn('top-btn-workshop', () => this.campUI.openWorkshopModal());
    bindBtn('top-btn-almanac', () => this.campUI.openAlmanacModal(this));
    bindBtn('top-btn-map', () => this.campUI.openWorldMapModal(this));
    bindBtn('top-btn-trial', () => this.campUI.openTrialModal(this));
    bindBtn('top-btn-sound', () => {
      const isMuted = audio.toggleMute();
      const btn = document.getElementById('top-btn-sound');
      if (btn) this.setSoundButtonState(btn, isMuted);
      this.hud.showToast(isMuted ? '宇宙电台已静音' : '宇宙电台已播放', 'info', icon(isMuted ? 'close' : 'music'));
    });

    this.canvas.addEventListener('wheel', (event) => {
      if (!this.isGameRunning) return;
      event.preventDefault();
      const step = event.deltaY > 0 ? 5 : -5;
      this.setViewDistance(this.camera.viewDistance + step);
    }, { passive: false });

    // Global Key Listener for Quick Modals
    window.addEventListener('keydown', (e) => {
      if (!this.isGameRunning) return;
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;

      const k = e.key.toLowerCase();
      if (k === 'c') this.campUI.openCampCookingModal();
      if (k === 'b') this.campUI.openInventoryModal();
      if (k === 'q') this.campUI.openBountiesModal();
      if (k === 'r') this.campUI.openCodexModal();
      if (k === 'g') this.campUI.openWorkshopModal();
      if (k === 'n') this.campUI.openAlmanacModal(this);
      if (k === 'v') this.campUI.openWorldMapModal(this);
      if (k === 't') this.campUI.openTrialModal(this);
      if (k === 'escape' || k === 'p') this.togglePause();
    });
  }

  handleHUDAction(action, payload) {
    if (action === 'claim-bounty') { this.claimBountyInField(payload); return; }
    if (action === 'camp') this.campUI.openCampCookingModal();
    if (action === 'inventory') this.campUI.openInventoryModal();
    if (action === 'bounties') this.campUI.openBountiesModal();
    if (action === 'recipes') this.campUI.openCodexModal();
    if (action === 'workshop') this.campUI.openWorkshopModal();
    if (action === 'roster') this.campUI.openRosterModal(this);
    if (action === 'armory') this.campUI.openArmoryModal(this);
    if (action === 'crate') this.campUI.openCrateModal(this);
    if (action === 'skill') this.useCharacterSkill();
    if (action === 'sound') this.campUI.openJukeboxModal(this);
  }

  handleCampInteraction(action, prop) {
    audio.play('item_pickup', { volume: 0.35 });
    if (action === 'cook') this.campUI.openCampCookingModal();
    else if (action === 'inventory') this.campUI.openInventoryModal();
    else if (action === 'bounties') this.campUI.openBountiesModal();
    else if (action === 'workshop') this.campUI.openWorkshopModal();
    else if (action === 'gallery') this.campUI.openGalleryModal(this);
    else if (action === 'roster') this.campUI.openRosterModal(this);
    else if (action === 'armory') this.campUI.openArmoryModal(this);
    else if (action === 'crate') this.campUI.openCrateModal(this);
    else if (action === 'music') this.campUI.openJukeboxModal(this);
    else if (action === 'rest') this.campUI.openCampfireModal(this, prop);
  }

  /** 换主厨：改写基础属性、模型配色与技能冷却。 */
  applyCharacter(id, { silent = false } = {}) {
    const data = this.gameData;
    if (id && data.unlockedCharacters?.includes(id)) data.characterId = id;
    const character = applyCharacterStats(data);

    BuffManager.recalculateStats(data);
    BuffManager.updateBuffs(0, data, this.player, this.hud);
    this.player.maxHp = data.maxHp;
    this.player.hp = Math.min(this.player.maxHp, Math.max(1, this.player.hp));
    this.player.setPalette(character.palette);
    this.player.setCharacterLook(character);
    // 上一位主厨留下的技能增益不跟着换人走
    this.player.buffs.delete('chef_ward');
    this.player.buffs.delete('chef_rift');
    this.skillRuntime.reset(character);
    if (this.map) this.map.rosterColor = character.theme;
    this.hud.setSkill?.(character, this.skillRuntime);

    this.updateTopBar();
    state.save();
    if (!silent) {
      particles.hitSparks?.(this.player.x, this.player.y - 20, 24, character.theme, 180);
      audio.play('level_up', { volume: 0.5 });
      this.hud.showToast(`${character.name} 接手后厨 · ${character.skill.name} 已就绪（F）`, 'success', icon('spark'));
    }
    return character;
  }

  /** 检查解锁条件，新解锁的角色弹条提示。 */
  checkCharacterUnlocks() {
    const fresh = refreshUnlocks(this.gameData);
    for (const c of fresh) {
      this.hud.showToast(`新主厨加入：${c.name} · ${c.title}，去主厨营帐换人（X）`, 'success', icon('star'));
    }

    // 口碑一次跳很多档时会同时解锁一批，合并成一条免得刷屏
    const dishes = refreshRecipeUnlocks(this.gameData);
    if (dishes.length === 1) {
      this.hud.showToast(`口碑解锁新食谱：${dishes[0].name}（R 查看图鉴）`, 'success', icon('book'));
    } else if (dishes.length > 1) {
      const names = dishes.slice(0, 2).map(r => r.name).join('、');
      this.hud.showToast(
        `口碑解锁 ${dishes.length} 道新食谱：${names}${dishes.length > 2 ? ' 等' : ''}（R 查看图鉴）`,
        'success', icon('book')
      );
    }

    if (fresh.length || dishes.length) state.save();
  }

  /**
   * 昼夜循环绕回起点就推进一个宇宙日。天数存进存档，顶栏与 HUD 都读它。
   */
  advanceCosmicDay() {
    const rolled = this.map.consumeDayRollover();
    if (!rolled) return;

    this.gameData.dayCount = (this.gameData.dayCount || 1) + rolled;
    this.refreshDayCycle({ announce: true });
  }

  /**
   * 翻页到新的一天：重掷当日异象与三条委托，刷新受异象影响的世界参数。
   * 读档时也走这里，保证同一天重开拿到的是同一批。
   */
  refreshDayCycle({ announce = false } = {}) {
    const rolled = rollNewDay(this.gameData, this.gameData.currentPlanet);
    this.applyOmen();
    this.updateTopBar();
    state.save();

    if (!announce) return;

    const omen = getOmen(this.gameData);
    this.hud.showToast(
      `第 ${this.gameData.dayCount} 宇宙日开始。荒野的猎物换了一批。`,
      'info', icon('clock')
    );
    if (rolled) {
      this.hud.showToast(`今日异象：${omen.name}。${omen.desc}`, 'warning', icon('spark'));
      this.hud.showToast('公会派下了三条新的今日委托，按 N 查看星历。', 'info', icon('scroll'));
    }
  }

  /**
   * 把当日异象折算成世界参数。只改能被玩家直接感知的几项，
   * 其余修正在结算时按需读取。
   */
  applyOmen() {
    const speed = omenEffect(this.gameData, 'speedMult', 1);
    const night = omenEffect(this.gameData, 'nightLength', 1);
    this.omenSpeedMult = speed;
    if (this.map) this.map.omenNightScale = night;
    if (this.player) {
      this.player.omenSpeedMult = speed;
      BuffManager.recalculateStats(this.gameData);
      BuffManager.updateBuffs(0, this.gameData, this.player, this.hud);
    }
  }

  /**
   * 异象带来的额外掉落。流星雨对所有食材生效，
   * 极寒潮只翻倍冰晶类。
   */
  omenDropBonus(itemId, count) {
    let bonus = omenEffect(this.gameData, 'extraDrop', 0);
    const frost = omenEffect(this.gameData, 'frostBonus', 1);
    if (frost > 1) {
      const it = getIngredientById(itemId);
      const icy = /ice|frost|comet|cryo|crystal/i.test(itemId) || /冰|霜|晶/.test(it?.name || '');
      if (icy) bonus += count * (frost - 1);
    }
    return Math.round(bonus);
  }

  /**
   * 累计步行距离，按整米推进引导与今日委托。
   * 传送与复活的瞬移不算数，超过一步能走的距离直接丢弃。
   */
  trackTravel(dt) {
    const px = this._lastTravelX ?? this.player.x;
    const py = this._lastTravelY ?? this.player.y;
    this._lastTravelX = this.player.x;
    this._lastTravelY = this.player.y;

    const moved = Math.hypot(this.player.x - px, this.player.y - py);
    const cap = (this.player.speed || 250) * dt * 3;
    if (!(moved > 0) || moved > cap) return;

    const a = ensureAlmanac(this.gameData);
    a.walked = (a.walked || 0) + moved;
    // 世界像素折算成米，每 12 像素算一米
    const meters = Math.floor(a.walked / 12);
    if (meters <= 0) return;
    a.walked -= meters * 12;

    this.tutorialStep('walk', meters);
    if (trackDaily(this.gameData, 'walk_any', meters)) this.refreshAlmanacBadge();

    // 走进营地安全区就算完成"回营地"这一步
    if (this.map.isInsideCampSafeZone?.(this.player.x, this.player.y)) {
      this.tutorialStep('camp');
    }
  }

  /**
   * 灵潮当天悬赏口碑加成。委托本身的口碑已经结算过，这里只补差额。
   */
  applyOmenRep(baseRep) {
    const mult = omenEffect(this.gameData, 'repMult', 1);
    if (!(mult > 1) || !(baseRep > 0)) return 0;
    const extra = Math.round(baseRep * (mult - 1));
    if (extra <= 0) return 0;
    this.gameData.reputation = (this.gameData.reputation || 0) + extra;
    this.hud.showToast(`灵潮加成：口碑 +${extra}。`, 'success', icon('spark'));
    return extra;
  }

  /** 星历按钮上的可领取角标。 */
  refreshAlmanacBadge() {
    const btn = document.getElementById('top-btn-almanac');
    if (!btn) return;
    const n = almanacAlerts(this.gameData);
    btn.classList.toggle('has-alert', n > 0);
    btn.dataset.alertCount = String(n);
    btn.title = n > 0 ? `猎人星历 [N] · ${n} 项可领取` : '猎人星历 [N]';
  }

  /** 星历面板里领了东西之后刷新顶栏与存档。 */
  onAlmanacChanged() {
    BuffManager.recalculateStats(this.gameData);
    BuffManager.updateBuffs(0, this.gameData, this.player, this.hud);
    this.updateTopBar();
    state.save();
  }

  /** 记一次引导进度，完成一步就播报。 */
  tutorialStep(id, amount = 1) {
    if (!tutorialActive(this.gameData)) return;
    const res = reportTutorial(this.gameData, id, amount);
    if (!res || !res.advanced) return;

    this.hud.showToast(`引导完成：${res.step.title}。+${res.step.credits} 星币。`, 'success', icon('check'));
    if (res.finished) {
      this.hud.showToast(
        `新手引导全部完成，公会补贴 +${800} 星币、+${40} 口碑。剩下的路自己走了。`,
        'success', icon('trophy')
      );
    }
    this.updateTopBar();
    state.save();
  }

  /** 装备一把已拥有的武器，写进实体并存档。 */
  equipWeaponById(id, { silent = false } = {}) {
    const weapon = ownsWeapon(this.gameData, id) ? getWeapon(id) : getActiveWeapon(this.gameData);
    this.gameData.weaponId = weapon.id;
    equipWeapon(this.player, weapon);
    // 武器数值会被属性重算覆盖，装完立刻再叠一次上去
    BuffManager.recalculateStats(this.gameData);
    BuffManager.updateBuffs(0, this.gameData, this.player, this.hud);
    this.player.weapon.baseDamage = weapon.damage;
    this.player.weapon.critChance = weapon.critChance;
    this.player.weapon.critMultiplier = weapon.critMultiplier;
    this.fireCooldown = 0;
    state.save();
    if (!silent) {
      this.hud.showToast(`已装备【${weapon.name}】。`, 'success', icon(weapon.kind === WEAPON_KIND.RANGED ? 'bolt' : 'chef'));
    }
    return weapon;
  }

  /** 军械商买到新武器后直接换上。 */
  onWeaponBought(weapon) {
    this.updateTopBar();
    this.equipWeaponById(weapon.id);
  }

  /** 补给箱取货后刷新顶栏；掉到的武器直接可用。 */
  onCrateClaimed(taken) {
    if (trackDaily(this.gameData, 'crate_any', taken.length)) this.refreshAlmanacBadge();
    this.updateTopBar();
    const gun = taken.find(t => t.kind === 'weapon');
    if (gun) this.hud.showToast(`补给箱里有一把【${gun.name}】，去军械商（Z）装备。`, 'success', icon('bolt'));
  }

  /** 生吃食材：回血回耐力。战斗中连吃有 1.2 秒间隔。 */
  consumeRawFood(item, raw) {
    if ((this._rawEatCooldown || 0) > 0) {
      this.hud.showToast('刚吃过，缓一口气再来。', 'info', icon('clock'));
      return false;
    }
    this._rawEatCooldown = 1.2;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + raw.hp);
    this.player.stamina = Math.min(this.player.maxStamina, this.player.stamina + raw.stamina);
    particles.glowingSpores?.(this.player.x, this.player.y - 20, 8, '#86efac');
    return true;
  }

  /**
   * 枪械开火：按射速与耐力限制，一次可能打出多颗弹丸。
   */
  fireRangedWeapon() {
    const gun = this.player.ranged;
    if (!gun || this.fireCooldown > 0) return false;
    if (this.player.stamina < gun.staminaCost) return false;
    if (this.player.state === PLAYER_STATES.DEAD) return false;

    this.player.consumeStamina(gun.staminaCost);
    this.fireCooldown = gun.cooldown;
    this.player.muzzleTimer = 0.07;
    this.player.recoilTimer = this.player.recoilDuration;

    const angle = this.player.aimAngle ?? this.player.facingAngle;
    const dmg = this.player.weapon.baseDamage;

    for (let i = 0; i < gun.shots; i++) {
      const jitter = gun.shots > 1
        ? (i / (gun.shots - 1) - 0.5) * gun.spread * 2
        : (Math.random() - 0.5) * gun.spread;
      const a = angle + jitter;
      this.projectiles.push({
        x: this.player.x + Math.cos(a) * 22,
        y: this.player.y - 18 + Math.sin(a) * 22,
        vx: Math.cos(a) * gun.speed,
        vy: Math.sin(a) * gun.speed,
        radius: 5,
        damage: dmg,
        life: gun.range / gun.speed,
        source: 'player',
        color: gun.color,
        pierce: gun.pierce,
        hitSet: new Set()
      });
    }

    this.camera.addTrauma(gun.shots > 2 ? 0.3 : 0.16);
    audio.play('sword_slash', { volume: 0.34, pitch: 720 });
    particles.hitSparks?.(
      this.player.x + Math.cos(angle) * 26,
      this.player.y - 18 + Math.sin(angle) * 26,
      6, gun.color, 120
    );
    return true;
  }

  /**
   * 弹丸打到资源点与可破坏障碍。近战靠 attackHitbox 结算，
   * 装了枪就没有挥击帧，采集与拆障碍改由弹丸接管。
   */
  projectileHitsTerrain(p) {
    for (const node of this.spawner.nodes) {
      if (node.isDepleted) continue;
      if (p.hitSet && p.hitSet.has(node)) continue;
      if (Math.hypot(node.x - p.x, node.y - p.y) > node.radius + (p.radius || 6)) continue;

      p.hitSet?.add(node);
      const drops = node.harvest(1, Math.atan2(p.vy, p.vx));
      drops.forEach(d => this.spawner.spawnDroppedItem(node.x, node.y, d.dropId, d.count, node.name, node.icon));
      audio.play('hit_impact', { volume: 0.45 });
      this.camera.addTrauma(0.1);
      p.life = 0;
      return;
    }

    const rubble = this.map.findDestructibleAt?.(p.x, p.y, p.radius || 6);
    if (rubble) {
      const res = this.map.damageObstacle(rubble, p.damage);
      audio.play('hit_impact', { volume: 0.45 });
      particles.spawnHitSparks?.(rubble.x, rubble.y, Math.atan2(p.vy, p.vx), rubble.color);
      this.camera.addTrauma(0.12);
      if (res?.destroyed) {
        particles.spawnShockwave?.(rubble.x, rubble.y, 46, rubble.color);
        if (trackDaily(this.gameData, 'smash_any')) this.refreshAlmanacBadge();
        const drop = res.drop;
        if (drop) {
          const n = drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1));
          this.spawner.spawnDroppedItem(rubble.x, rubble.y, drop.id, n, drop.name, '📦');
        }
      }
      p.life = 0;
    }
  }

  /**
   * 徒手采集：走到资源点旁按 E 就能采，不依赖手上拿的是什么。
   * 营地范围内 E 归营地设施，这里只接管野外。
   */
  harvestNearbyNode() {
    const reach = this.player.radius + 46;
    let best = null;
    let bestDist = Infinity;

    for (const node of this.spawner.nodes) {
      if (node.isDepleted) continue;
      const d = Math.hypot(node.x - this.player.x, node.y - this.player.y);
      if (d > reach + node.radius) continue;
      if (d < bestDist) { bestDist = d; best = node; }
    }
    if (!best) return false;

    // 资源点要敲够次数才出货，敲到就算这次 E 用掉了
    const angle = Math.atan2(best.y - this.player.y, best.x - this.player.x);
    const drops = best.harvest(1, angle);
    drops.forEach(d => this.spawner.spawnDroppedItem(best.x, best.y, d.dropId, d.count, best.name, best.icon));
    audio.play('hit_impact');
    this.camera.addTrauma(0.1);
    return true;
  }

  /** 进行中的猎杀委托指定的怪物类型，用于在世界与雷达上高亮。 */
  huntTargetIds() {
    const active = this.bountyManager.getActiveBountiesDetailed();
    const ids = new Set();
    for (const b of active) {
      if (b.type === 'hunt' && !b.isReadyToClaim) ids.add(b.targetId);
    }
    return ids;
  }

  /** 悬赏猎物脚下的脉冲光环与头顶的指示箭头。 */
  drawBountyTargetMarkers(ctx) {
    const ids = this.huntTargetIds();
    if (!ids.size) return;

    const t = this.engine.totalTime;
    const pulse = 0.5 + Math.sin(t * 3.4) * 0.5;

    for (const m of this.monsters) {
      if (m.state === 'DEAD' || m.hp <= 0) continue;
      if (!ids.has(m.typeKey || m.id)) continue;

      const rx = m.x - this.camera.x;
      const ry = m.y - this.camera.y;
      const r = m.radius * (1.5 + pulse * 0.28);

      ctx.save();
      ctx.strokeStyle = `rgba(251, 191, 36, ${0.35 + pulse * 0.45})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -(t * 26) % 24;
      ctx.beginPath();
      ctx.ellipse(rx, ry + m.radius * 0.55, r, r * 0.44, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 头顶的倒三角，随呼吸上下浮动
      const ay = ry - m.radius * 2.1 - pulse * 5;
      ctx.fillStyle = `rgba(251, 191, 36, ${0.65 + pulse * 0.35})`;
      ctx.beginPath();
      ctx.moveTo(rx, ay + 11);
      ctx.lineTo(rx - 7, ay - 2);
      ctx.lineTo(rx + 7, ay - 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(14, 22, 30, 0.7)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.restore();
    }
  }

  /** 在野外直接领取已完成的悬赏。 */
  claimBountyInField(bountyId) {
    if (!bountyId) return;
    const res = this.bountyManager.claimBounty(bountyId);
    if (!res.success) {
      this.hud.showToast(res.msg, 'warn', icon('target'));
      return;
    }
    this.applyOmenRep(res.rewardRep);
    this.tutorialStep('bounty_done');
    this.updateTopBar();
    state.save();
    this.hud.showToast(res.msg, 'success', icon('star'));
    if (this.campUI.currentModal === 'bounties') this.campUI.openBountiesModal();
  }

  /** 释放当前主厨的主动技能。 */
  useCharacterSkill() {
    if (this.engine.isPaused || this.campUI.currentModal) return;
    if (this.player.state === PLAYER_STATES.DEAD) return;

    const character = getActiveCharacter(this.gameData);
    if (!this.skillRuntime.ready) {
      this.hud.showToast(`${character.skill.name} 冷却中，还需 ${Math.ceil(this.skillRuntime.cooldown)} 秒。`, 'warning', icon('clock'));
      return;
    }

    const result = castSkill(character, this.skillRuntime, {
      player: this.player,
      monsters: this.monsters,
      map: this.map,
      particles,
      audio,
      camera: this.camera
    });

    if (!result) return;
    if (result.failed === 'stamina') {
      this.hud.showToast('耐力不足，无法发动技能。', 'warning', icon('bolt'));
      return;
    }
    this.engine.addHitstop(0.06, 0.05);
  }

  /** 围炉休整：补满耐力并回一截生命，之后进入冷却。 */
  restAtCampfire(prop) {
    const now = performance.now();
    if (this.restCooldownUntil && now < this.restCooldownUntil) {
      const left = Math.ceil((this.restCooldownUntil - now) / 1000);
      this.hud.showToast(`篝火还在攒热量，${left} 秒后可再次休整。`, 'warning', icon('clock'));
      return;
    }

    const healed = Math.min(this.player.maxHp - this.player.hp, Math.round(this.player.maxHp * 0.35));
    const staminaGap = this.player.maxStamina - this.player.stamina;
    if (healed <= 0 && staminaGap <= 1) {
      this.hud.showToast('状态正好，不需要休整。', 'info', icon('spark'));
      return;
    }

    this.player.hp += healed;
    this.player.stamina = this.player.maxStamina;
    this.restCooldownUntil = now + 60000;

    particles.hitSparks(prop.x, prop.y - 10, 22, '#fbbf24', 160);
    if (healed > 0) particles.floatingText(this.player.x, this.player.y - 30, `+${healed}`, '#4ade80', 15);
    audio.play('item_pickup');
    this.hud.showToast(`围炉休整，生命 +${healed}，耐力已恢复。`, 'success', icon('spark'));
    state.save();
  }

  /** 把钉住的招牌菜照片解码成图片，交给地图画在留影台相框里。 */
  refreshPinnedDish() {
    const photo = getPinnedDish(this.gameData);
    if (!photo?.thumb) {
      this.map.pinnedDish = null;
      this._pinnedDishId = null;
      return;
    }
    if (this._pinnedDishId === photo.id && this.map.pinnedDish) return;
    const img = new Image();
    img.onload = () => { this.map.pinnedDish = img; };
    img.src = photo.thumb;
    this._pinnedDishId = photo.id;
  }

  setViewDistance(value) {
    const appliedValue = this.camera.setViewDistance(value);
    this.gameData.settings = this.gameData.settings || {};
    this.gameData.settings.viewDistance = appliedValue;
    this.hud?.setViewDistance(appliedValue);

    clearTimeout(this.settingsSaveTimer);
    this.settingsSaveTimer = setTimeout(() => state.save(), 300);
    return appliedValue;
  }

  /**
   * 按世界种子在四个象限里撒生态位。位置、物种与变体每次都重新掷，
   * 但同一份种子能复现同一批刷点，方便重生时归位。
   */
  rollEcosystemSlots() {
    const rng = makeRng((this.worldSeed || 1) ^ 0x5f3a);
    const slots = [];
    const variantKeys = Object.keys(ALIEN_VARIANTS);
    const midX = this.map.width / 2;
    const midY = this.map.height / 2;
    const quads = [
      { x0: 60, x1: midX - 60, y0: 60, y1: midY - 60, tag: 'nw' },
      { x0: midX + 60, x1: this.map.width - 60, y0: 60, y1: midY - 60, tag: 'ne' },
      { x0: 60, x1: midX - 60, y0: midY + 60, y1: this.map.height - 60, tag: 'sw' },
      { x0: midX + 60, x1: this.map.width - 60, y0: midY + 60, y1: this.map.height - 60, tag: 'se' }
    ];

    // 每象限按面积摊刷点数，地图放大后密度不变
    const quadArea = (midX - 120) * (midY - 120);
    const perQuad = Math.max(8, Math.round(quadArea / 300000));
    for (const q of quads) {
      for (let i = 0; i < perQuad; i++) {
        let x = 0;
        let y = 0;
        let tries = 0;
        do {
          x = q.x0 + rng() * (q.x1 - q.x0);
          y = q.y0 + rng() * (q.y1 - q.y0);
          tries++;
        } while (this.map.isInsideCampSafeZone(x, y, 180) && tries < 12);

        slots.push({
          id: `${q.tag}-${i}`,
          x, y,
          variant: variantKeys[Math.floor(rng() * variantKeys.length)],
          pick: rng()
        });
      }
    }
    return slots;
  }

  spawnEcosystem() {
    this.monsters = [];
    this.ecosystemRespawns.clear();
    this.ecosystemSlots = this.rollEcosystemSlots();
    this.ecosystemSlots.forEach(slot => this.spawnEcosystemSlot(slot));
  }

  spawnEcosystemSlot(slot) {
    // 物种取自「当前星球 × 该坐标生态区」的动物区系，所以换星球会换一整套猎物
    const planet = getCurrentPlanet(this.gameData);
    const biome = this.map.getBiomeAt(slot.x, slot.y);
    const pool = planetFauna(planet, biome, BIOME_MONSTERS[biome]);
    const type = pool.length ? pool[Math.floor((slot.pick ?? Math.random()) * pool.length) % pool.length] : slot.type;

    const monster = createMonster(type, slot.x, slot.y);
    if (!monster) return null;

    const diff = planet.difficulty || 1;

    const variant = ALIEN_VARIANTS[slot.variant] || ALIEN_VARIANTS.standard;
    const baseName = String(monster.name || '').split(' (')[0];
    if (variant.label) monster.name = `${variant.label}${baseName}`;

    monster.variantKey = slot.variant || 'standard';
    monster.spawnSlot = slot.id;
    // 记下出生的生态区，走出去会掉血并自己往回赶
    monster.homeBiome = biome;
    monster.radius = Math.max(12, Math.round(monster.radius * (variant.scale || 1)));
    // 星球难度叠在变体倍率之上
    monster.maxHp = Math.max(1, Math.round(monster.maxHp * (variant.hp || 1) * diff));
    monster.hp = monster.maxHp;
    monster.speed *= variant.speed || 1;
    monster.chaseSpeed *= variant.speed || 1;
    monster.wanderSpeed *= variant.speed || 1;
    monster.damage = Math.max(0, Math.round(monster.damage * (variant.damage || 1) * diff));
    monster.defense += (variant.defense || 0) + Math.round((diff - 1) * 8);
    // 有位图的走预烘焙精灵缓存，纯矢量的把变体染色一次性烤进配色，
    // 两条路都不会在绘制时碰 ctx.filter
    if (assets.getImage(monster.typeKey) && !monster.preferVector) {
      monster.spriteFilter = variant.filter || 'none';
    } else {
      bakeVariantTint(monster, variant.filter);
      monster.spriteFilter = 'none';
    }
    monster.patrolRadius = Math.min(monster.patrolRadius, 145);

    this.monsters.push(monster);
    return monster;
  }

  // ================= 星际跃迁 =================

  /**
   * 跃迁到另一颗星球：重建地图与资源点，重新播撒生态，玩家回到营地。
   */
  travelToPlanet(planetId) {
    const planet = getPlanet(planetId);
    const check = canTravelTo(this.gameData, planet);
    if (!check.ok) {
      this.hud.showToast(`无法跃迁：${check.reason}`, 'warning', icon('close'));
      return false;
    }

    const fee = check.fee || 0;
    const firstTime = !hasVisited(this.gameData, planet);
    this.gameData.credits = Math.max(0, (this.gameData.credits || 0) - fee);
    this.gameData.currentPlanet = planet.id;
    if (!Array.isArray(this.gameData.visitedPlanets)) this.gameData.visitedPlanets = [];
    if (!this.gameData.visitedPlanets.includes(planet.id)) this.gameData.visitedPlanets.push(planet.id);

    // 终极评鉴的 Boss 不跨星球
    if (this.trialBoss) {
      this.monsters = this.monsters.filter(m => m !== this.trialBoss);
      this.trialBoss = null;
      this.hud.updateBossBar(null);
      const trial = getTrialData(this.gameData);
      if (trial.state === TRIAL_STATES.HUNTING) trial.state = TRIAL_STATES.AVAILABLE;
    }

    // 重建世界
    this.map = this.buildPlanetMap(planet);
    if (this.camera) { this.camera.worldWidth = this.map.width; this.camera.worldHeight = this.map.height; }
    this.spawner = new WorldSpawner(this.map);
    this.projectiles.length = 0;
    particles.reset?.();
    this.campInteractions.refresh(this.map);
    this.map.rosterColor = getActiveCharacter(this.gameData).theme;
    this._pinnedDishId = null;
    this.refreshPinnedDish();
    this.spawnEcosystem();

    // 玩家落在营地
    const camp = this.map.campPosition;
    this.player.x = camp.x + 60;
    this.player.y = camp.y + 60;
    this.player.vx = 0;
    this.player.vy = 0;
    this.spawnPoint = { x: this.player.x, y: this.player.y };
    this.camera.x = this.player.x - this.camera.viewportWidth / 2;
    this.camera.y = this.player.y - this.camera.viewportHeight / 2;

    state.save();
    this.updateTopBar();
    this.camera.shake(10, 0.7);
    audio.play('level_up');
    this.hud.showToast(
      firstTime
        ? `已跃迁至 ${planet.name} · 难度 ×${planet.difficulty}。航道已开通，往返不再收费。`
        : `已跃迁至 ${planet.name} · 难度 ×${planet.difficulty}`,
      'success', icon('spark')
    );
    return true;
  }

  // ================= 终极评鉴 =================

  /**
   * 召唤传奇异兽。它不属于生态刷新体系，被击杀后不会重生。
   */
  summonTrialBoss() {
    refreshTrialState(this.gameData);
    const trial = getTrialData(this.gameData);
    if (trial.state !== TRIAL_STATES.AVAILABLE) return null;
    if (this.trialBoss && this.trialBoss.hp > 0) return null;

    const pos = getArenaPosition(this.map);
    const boss = createMonster('MAGMA_WYRM', pos.x, pos.y, {
      typeKey: 'magma_wyrm',
      hp: TRIAL_BOSS_STATS.hp,
      defense: TRIAL_BOSS_STATS.defense,
      damage: TRIAL_BOSS_STATS.damage,
      radius: TRIAL_BOSS_STATS.radius,
      sightRange: 520,
      loseTargetRange: 1400,
      patrolRadius: 220,
      knockbackResist: 1.0,
      drops: [
        { id: 'void_matriarch_heart', name: '虚空母龙心核', icon: '💠', chance: 1.0, min: 1, max: 1 },
        { id: 'void_wyrm_meat', name: '虚空神龙脊髓肉', icon: '🐉', chance: 1.0, min: 2, max: 3 },
        { id: 'magma_tail', name: '熔岩巨蜥炙尾肉', icon: '🥩🔥', chance: 1.0, min: 2, max: 3 }
      ]
    });
    if (!boss) return null;

    boss.name = '虚空母龙 (Void Matriarch)';
    boss.typeKey = TRIAL_BOSS_ID;
    boss.isTrialBoss = true;
    boss.category = 'boss';
    boss.spriteFilter = 'hue-rotate(212deg) saturate(1.55) brightness(1.12)';
    boss.leashRange = 4000;
    boss.aggroDuration = 999;
    boss.alwaysHostile = true;
    boss.provoke();
    boss._phase = 0;

    this.monsters.push(boss);
    this.trialBoss = boss;

    trial.state = TRIAL_STATES.HUNTING;
    this.camera.shake(16, 0.8);
    audio.play('monster_roar');
    this.hud.showToast('虚空母龙已降临地图正北方。它不会离开，也不会有人替你挡下。', 'warning', icon('bolt'));
    state.save();
    return boss;
  }

  /**
   * Boss 分阶段：血量跌破阈值时提速、增伤、并逐层剥落护甲。
   */
  updateTrialBoss() {
    const boss = this.trialBoss;
    if (!boss) return;

    if (boss.hp <= 0 || boss.isDead || !this.monsters.includes(boss)) {
      if (boss.hp <= 0 && !boss._victoryHandled) {
        boss._victoryHandled = true;
        this.onTrialBossDefeated();
      }
      if (!this.monsters.includes(boss)) this.trialBoss = null;
      this.hud.updateBossBar(null);
      return;
    }

    const ratio = boss.hp / boss.maxHp;
    const idx = phaseIndex(ratio);
    this.hud.updateBossBar(boss, BOSS_PHASES[idx].label);
    if (idx > boss._phase) {
      boss._phase = idx;
      const phase = BOSS_PHASES[idx];
      if (!boss.baseChaseSpeed) boss.baseChaseSpeed = boss.chaseSpeed;
      boss.chaseSpeed = boss.baseChaseSpeed * phase.speedMult;
      boss.damage = Math.round(TRIAL_BOSS_STATS.damage * phase.damageMult);
      boss.defense = phase.defense;
      boss.provoke();
      this.camera.shake(13, 0.6);
      particles.hitSparks(boss.x, boss.y, 40, '#a78bfa', 320);
      this.hud.showToast(`虚空母龙进入「${phase.label}」阶段 · 护甲剥落至 ${phase.defense}`, 'warning', icon('bolt'));
      audio.play('monster_roar');
    }
  }

  onTrialBossDefeated() {
    const trial = getTrialData(this.gameData);
    trial.state = TRIAL_STATES.COOKING;
    trial.bossKills = (trial.bossKills || 0) + 1;
    this.camera.shake(20, 1.2);
    this.hud.showToast('虚空母龙已被讨伐。带着心核回营地，做出你的终焉盛宴。', 'success', icon('star'));
    state.save();
  }

  /**
   * 终焉盛宴出餐后触发通关结算。
   */
  onFinaleDishCooked(dishResult) {
    const trial = getTrialData(this.gameData);
    if (trial.state !== TRIAL_STATES.COOKING) return;

    const grade = evaluateFinalGrade(this.gameData, dishResult.score);
    trial.state = TRIAL_STATES.COMPLETE;
    if (!trial.bestGrade || grade.total > trial.bestGrade.total) {
      trial.bestGrade = grade;
    }
    state.save();
    this.showEndingOverlay(grade, dishResult);
  }

  scheduleEcosystemRespawn(slotId) {
    if (!slotId || this.ecosystemRespawns.has(slotId)) return;
    const slots = this.ecosystemSlots || [];
    const slotIndex = slots.findIndex(slot => slot.id === slotId);
    if (slotIndex < 0) return;
    const respawnSeconds = 12 + ((slotIndex * 7) % 11);
    this.ecosystemRespawns.set(slotId, respawnSeconds);
  }

  updateEcosystemRespawns(dt) {
    for (const [slotId, timeLeft] of this.ecosystemRespawns.entries()) {
      const nextTime = timeLeft - dt;
      if (nextTime > 0) {
        this.ecosystemRespawns.set(slotId, nextTime);
        continue;
      }

      const slot = (this.ecosystemSlots || []).find(candidate => candidate.id === slotId);
      const occupied = this.monsters.some(monster => monster.spawnSlot === slotId);
      if (slot && !occupied) this.spawnEcosystemSlot(slot);
      this.ecosystemRespawns.delete(slotId);
    }
  }

  update(dt) {
    const input = this.engine.getInput();

    // Keep viewport geometry current before pointer-to-world conversion. The
    // tracking step runs after player physics so the camera never follows the
    // previous fixed frame.
    this.camera.resize(this.engine.width, this.engine.height);

    // Pointer aiming stays active while clicking, or briefly while stationary
    // after a real mouse movement. Keyboard and touch movement therefore own
    // the travel direction instead of being overridden by a stale cursor.
    const pointerMoved = input.mouse
      && (input.mouse.screenX !== this.lastPointerX || input.mouse.screenY !== this.lastPointerY);
    if (pointerMoved && !input.touch?.active) {
      this.lastPointerX = input.mouse.screenX;
      this.lastPointerY = input.mouse.screenY;
      this.lastPointerMovedAt = performance.now();
    }

    const movementActive = Math.hypot(input.moveX || 0, input.moveY || 0) > 0.08;
    const pointerIsFresh = performance.now() - this.lastPointerMovedAt < 1200;
    // 单击的按下与抬起可能落在同一个固定步之间，届时 isDown 已复位。
    // 补上 justClicked，才能保证鼠标攻击总是朝光标方向出手。
    const pointerAttack = Boolean(input.mouse?.justClicked || input.mouse?.justRightClicked);
    const pointerControlsFacing = input.mouse?.hasPosition
      && !input.touch?.active
      && (input.mouse.isDown || input.mouse.isRightDown || pointerAttack || (!movementActive && pointerIsFresh));

    if (pointerControlsFacing) {
      input.pointerAim = this.camera.screenToWorld(input.mouse.screenX, input.mouse.screenY);
    } else {
      delete input.pointerAim;
    }

    // 营地交互抢在玩家动作之前处理，点提示气泡才不会连带触发攻击
    const pointerWorld = input.mouse?.hasPosition && !input.touch?.active
      ? this.camera.screenToWorld(input.mouse.screenX, input.mouse.screenY)
      : null;
    this.campInteractions.blocked = Boolean(this.campUI.currentModal) || this.engine.isPaused;
    this.campInteractions.update(dt, this.player, input, pointerWorld);

    // 营地设施没接走这次 E，就当作野外徒手采集
    if (input.isInteractPressed && !this.campUI.currentModal && !this.engine.isPaused) {
      if (this.harvestNearbyNode()) input.isInteractPressed = false;
    }

    // 每两秒对一次主厨解锁条件
    this._unlockTimer = (this._unlockTimer || 0) + dt;
    if (this._unlockTimer >= 2) {
      this._unlockTimer = 0;
      this.checkCharacterUnlocks();
    }

    // 主厨技能：冷却推进与释放，F 键在玩家动作之前消耗掉
    this.skillRuntime.update(dt);
    if (input.isSkillPressed) {
      input.isSkillPressed = false;
      this.useCharacterSkill();
    }

    // 装了枪就把攻击键改判成开火，在 player.update 之前把输入吃掉
    if (this.fireCooldown > 0) this.fireCooldown -= dt;
    if (this._rawEatCooldown > 0) this._rawEatCooldown -= dt;
    if (this.player.ranged && !this.campUI.currentModal) {
      const wantsFire = input.isAttackPressed || input.isAttackDown || input.mouse?.isDown;
      if (wantsFire && this.fireRangedWeapon()) {
        input.isAttackPressed = false;
        input.mouse.justClicked = false;
      } else if (input.isAttackPressed) {
        // 冷却或耐力不够时也别退化成挥刀
        input.isAttackPressed = false;
      }
    }

    // 补给箱按时间进货
    const restock = tickCrate(this.gameData, dt);
    if (restock) {
      this.hud.showToast(`补给箱到货：${restock.name}。回营地取（走近补给箱）。`, 'info', icon('backpack'));
      state.save();
    }

    // 2. Update Map, Day/Night & Lighting
    this.map.update(dt);
    this.advanceCosmicDay();

    // 3. Update Particles
    particles.update(dt);

    // 4. Update Culinary Active Buffs & Player Stats
    BuffManager.updateBuffs(dt, this.gameData, this.player, this.hud);

    // 厨房场景自带渲染循环，这里只保留旧温控小游戏的兼容驱动。

    // 5. Update Player Movement & State
    this.player.update(
      dt,
      input,
      { minX: 0, minY: 0, maxX: this.map.width, maxY: this.map.height },
      this.map.obstacles,
      particles,
      audio
    );
    this.camera.update(dt, this.player);

    // 6. Update Resource Spawner & Dropped Item Loot Pickups
    this.spawner.update(dt, this.player, (itemId, count) => {
      const bonus = this.omenDropBonus(itemId, count);
      const total = count + bonus;
      state.addItem(itemId, total);
      this.bountyManager.checkGatherProgress(itemId);
      this.tutorialStep('gather', total);
      if (trackDaily(this.gameData, 'gather_any', total)) this.refreshAlmanacBadge();
      audio.play('item_pickup');
      const itemName = getIngredientById(itemId)?.name || itemId;
      this.hud.showToast(
        bonus > 0
          ? `拾取食材  +${total}  ${itemName}（异象 +${bonus}）`
          : `拾取食材  +${total}  ${itemName}`,
        'info', icon('box')
      );
    });

    // 7. Update Monsters AI & Lifecycles
    // 时缝生效时怪物按更慢的时间步推进，动作和位移一起被拖慢
    const enemyDt = dt * this.skillRuntime.enemyTimeScale();
    // 离玩家很远的怪跳过 AI，地图放大后总数上去了也不会拖帧
    const cullRange = Math.max(this.camera.viewportWidth, this.camera.viewportHeight) + 700;

    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const m = this.monsters[i];
      const far = m.state !== 'DEAD'
        && Math.hypot(m.x - this.player.x, m.y - this.player.y) > cullRange;

      if (far) {
        m.prevX = m.x;
        m.prevY = m.y;
      } else {
        m.update(
          enemyDt,
          this.player,
          this.map,
          this.map.obstacles,
          this.projectiles,
          [],
          particles,
          audio
        );
      }

      // 异兽无法踏入营地安全区
      if (m.state !== 'DEAD') {
        this.map.repelFromCampSafeZone(m);
      }

      // Resolve each creature melee hitbox once per attack. This shares the
      // player damage contract with projectile hits and keeps parries reliable.
      if (m.activeAttackHitbox && !m.activeAttackHitbox.hitPlayer) {
        const hit = m.activeAttackHitbox;
        const dist = Math.hypot(this.player.x - hit.x, this.player.y - hit.y);
        if (dist <= this.player.radius + (hit.radius || m.radius)) {
          hit.hitPlayer = true;
          const sourceAngle = Math.atan2(this.player.y - hit.y, this.player.x - hit.x);
          this.player.takeDamage(
            hit.damage || m.damage || 10,
            sourceAngle,
            hit.knockback || 120,
            hit.isParriable !== false,
            m,
            audio,
            particles
          );
          this.camera.addTrauma(0.22);
        }
      }

      // Remove and roll loot drops upon death
      if (m.isDead) {
        // 高难度星球的猎物给更多星币，血月当天再翻一倍
        const rewardMult = getCurrentPlanet(this.gameData).rewardMult || 1;
        const creditMult = omenEffect(this.gameData, 'creditMult', 1);
        const bonus = Math.round((m.maxHp / 40) * (rewardMult * creditMult - 1));
        if (bonus > 0) {
          this.gameData.credits = (this.gameData.credits || 0) + bonus;
          particles.floatingText(m.x, m.y - 20, `+${bonus}`, '#f0c77c', 13);
        }
        if (m.drops && m.drops.length > 0) {
          // 长夜把掉落判定放宽
          const chanceMult = omenEffect(this.gameData, 'dropChance', 1);
          m.drops.forEach(drop => {
            if (Math.random() <= drop.chance * chanceMult) {
              const count = Math.floor(Math.random() * (drop.max - drop.min + 1)) + drop.min;
              this.spawner.spawnDroppedItem(m.x, m.y, drop.id, count, drop.name, drop.icon);
            }
          });
        }
        // Bounty hunt tracking check
        this.bountyManager.checkHuntProgress(m.typeKey || m.id);
        this.tutorialStep('hunt');
        if (trackDaily(this.gameData, 'hunt_any')) this.refreshAlmanacBadge();
        this.scheduleEcosystemRespawn(m.spawnSlot);
        this.monsters.splice(i, 1);
      }
    }

    this.updateEcosystemRespawns(dt);
    this.updateTrialBoss();

    // 8. Update Projectiles (Lizard spit, Magma fireballs, etc.)
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.prevX = p.x;
      p.prevY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      // 敌方投射物在安全区边界被拦下，避免隔着屏障打人
      if (p.source !== 'player' && this.map.isInsideCampSafeZone(p.x, p.y)) {
        particles.hitSparks(p.x, p.y, 8, '#fbbf24', 140);
        this.projectiles.splice(i, 1);
        continue;
      }

      // 玩家射出的弹丸打怪：按 pierce 决定能穿几只，同一只只结算一次
      if (p.source === 'player') {
        for (const m of this.monsters) {
          if (m.state === 'DEAD' || m.hp <= 0) continue;
          if (p.hitSet && p.hitSet.has(m)) continue;
          if (Math.hypot(m.x - p.x, m.y - p.y) > m.radius + (p.radius || 6)) continue;

          const angle = Math.atan2(p.vy, p.vx);
          m.takeDamage(p.damage, angle, 140, Math.random() < (this.player.weapon?.critChance || 0),
            false, this.player, audio, particles);
          p.hitSet?.add(m);
          particles.hitSparks?.(p.x, p.y, 10, p.color || '#22d3ee', 160);
          this.engine.addHitstop(0.02, 0.1);

          p.pierce = (p.pierce || 1) - 1;
          if (p.pierce <= 0) { p.life = 0; break; }
        }

        if (p.life > 0) this.projectileHitsTerrain(p);

        if (p.life <= 0) {
          this.projectiles.splice(i, 1);
          continue;
        }
      }

      // Check collision with player
      const distToPlayer = Math.hypot(this.player.x - p.x, this.player.y - p.y);
      if (distToPlayer <= this.player.radius + (p.radius || 6)) {
        if (this.player.isParrying) {
          // Perfect Parry Projectile Deflect!
          p.vx = -p.vx * 1.5;
          p.vy = -p.vy * 1.5;
          p.source = 'player';
          audio.play('shield_parry');
          particles.hitSparks(p.x, p.y, 16, '#f59e0b', 220);
          this.camera.addTrauma(0.25);
          this.hud.showToast('完美盾反，投射物已被反弹。', 'warning', icon('bolt'));
        } else if (p.source !== 'player') {
          const sourceAngle = Math.atan2(this.player.y - p.y, this.player.x - p.x);
          this.player.takeDamage(p.damage || 15, sourceAngle, 120, true, p.attacker || null, audio, particles);
          this.camera.addTrauma(0.3);
          p.life = 0;
        }
      }

      if (p.life <= 0) {
        this.projectiles.splice(i, 1);
      }
    }

    // 9. Combat Collisions: Player Attacks vs Monsters & Resource Nodes
    this.handleCombatCollisions();

    // 星历与引导按实际位移计数，只算真正走出去的距离
    this.trackTravel(dt);

    // 10. Sync Entity Vitals into Shared State & Handle Death
    const vitals = this.gameData.player;
    if (vitals) {
      vitals.hp = Math.round(this.player.hp);
      vitals.maxHp = this.player.maxHp;
      vitals.stamina = this.player.stamina;
      vitals.maxStamina = this.player.maxStamina;
      vitals.position = { x: Math.round(this.player.x), y: Math.round(this.player.y) };
    }
    if (this.player.state === PLAYER_STATES.DEAD && !this.deathHandled) {
      this.deathHandled = true;
      this.showDeathOverlay();
    }

    // 11. Update HUD Elements
    const huntIds = this.huntTargetIds();
    this.hud.refreshSkillOrb();
    this.hud.refreshTutorial();
    this.hud.update(this.gameData, this.bountyManager, {
      biomeName: this.getBiomeLabel(this.map.getBiomeAt(this.player.x, this.player.y)),
      timeString: `DAY ${this.gameData.dayCount || 1} · ${this.map.getTimeString()}`,
      playerX: this.player.x,
      playerY: this.player.y,
      entities: [
        ...this.monsters.map(m => ({
          x: m.x, y: m.y, isHostile: true,
          isBountyTarget: huntIds.has(m.typeKey || m.id)
        })),
        ...this.spawner.nodes.filter(n => !n.isDepleted).map(n => ({ x: n.x, y: n.y, isResource: true }))
      ],
      campPos: this.map.campPosition
    });

    // 12. Update Top Bar Stats
    this.updateTopBar();
  }

  handleCombatCollisions() {
    const attackHitbox = this.player.attackHitbox;
    if (!attackHitbox) return;

    // 1. Attack vs Monsters
    this.monsters.forEach(m => {
      if (this.player.hitEntitiesThisAttack.has(m)) return;

      let isHit = false;
      const dist = Math.hypot(m.x - attackHitbox.x, m.y - attackHitbox.y);

      if (attackHitbox.type === 'arc') {
        if (dist <= attackHitbox.radius + m.radius) {
          const angleToMonster = Math.atan2(m.y - attackHitbox.y, m.x - attackHitbox.x);
          let diff = angleToMonster - attackHitbox.facingAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;

          if (Math.abs(diff) <= (attackHitbox.endAngle - attackHitbox.startAngle) / 2) {
            isHit = true;
          }
        }
      } else if (attackHitbox.type === 'circle') {
        if (dist <= attackHitbox.radius + m.radius) {
          isHit = true;
        }
      }

      if (isHit) {
        this.player.hitEntitiesThisAttack.add(m);
        const dmg = attackHitbox.damage;
        m.takeDamage(
          dmg,
          attackHitbox.facingAngle ?? this.player.facingAngle,
          attackHitbox.knockback,
          Boolean(attackHitbox.isCrit),
          Boolean(attackHitbox.isHeavy),
          this.player,
          audio,
          particles
        );
        this.camera.addTrauma(attackHitbox.isCrit ? 0.35 : 0.18);
        // 命中顿帧：重击停得久一些，轻击只是轻轻一顿
        this.engine.addHitstop(attackHitbox.isHeavy ? 0.075 : 0.032, 0.06);
      }
    });

    // 1b. Attack vs 可破坏障碍：碎石类挨两下就散，掉对应生态的食材
    const rubble = this.map.findDestructibleAt(attackHitbox.x, attackHitbox.y, attackHitbox.radius);
    if (rubble && !this.player.hitEntitiesThisAttack.has(rubble)) {
      this.player.hitEntitiesThisAttack.add(rubble);
      const dmg = attackHitbox.damage * (attackHitbox.isHeavy ? 2.2 : 1);
      const res = this.map.damageObstacle(rubble, dmg);
      audio.play('hit_impact', { volume: 0.5 });
      particles.spawnHitSparks?.(rubble.x, rubble.y, attackHitbox.facingAngle ?? 0, rubble.color);
      this.camera.addTrauma(0.14);
      this.engine.addHitstop(0.028, 0.08);

      if (res?.destroyed) {
        particles.spawnShockwave?.(rubble.x, rubble.y, 46, rubble.color);
        audio.play('sword_heavy', { volume: 0.4 });
        this.camera.addTrauma(0.3);
        if (trackDaily(this.gameData, 'smash_any')) this.refreshAlmanacBadge();
        const drop = res.drop;
        if (drop) {
          const n = drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1));
          this.spawner.spawnDroppedItem(rubble.x, rubble.y, drop.id, n, drop.name, '📦');
        }
      }
    }

    // 2. Attack vs Resource Nodes
    this.spawner.nodes.forEach(node => {
      if (node.isDepleted) return;
      if (this.player.hitEntitiesThisAttack.has(node)) return;

      const dist = Math.hypot(node.x - attackHitbox.x, node.y - attackHitbox.y);
      if (dist <= attackHitbox.radius + node.radius) {
        this.player.hitEntitiesThisAttack.add(node);
        const drops = node.harvest(1, attackHitbox.facingAngle ?? this.player.facingAngle);
        if (drops && drops.length > 0) {
          drops.forEach(d => {
            this.spawner.spawnDroppedItem(node.x, node.y, d.dropId, d.count, node.name, node.icon);
          });
          audio.play('hit_impact');
          this.camera.addTrauma(0.12);
        }
      }
    });
  }

  /**
   * 通关结算：把整局经营成果折算成最终评级。
   */
  showEndingOverlay(grade, dishResult) {
    if (!this.endingOverlay) {
      this.endingOverlay = document.createElement('div');
      this.endingOverlay.className = 'modal-overlay ending-overlay';
      this.stageContainer.appendChild(this.endingOverlay);
    }

    this.endingOverlay.innerHTML = `
      <div class="ending-card">
        <div class="ending-eyebrow"><span class="eyebrow-line"></span> FINAL TASTING / 终极评鉴 <span class="eyebrow-line"></span></div>
        <div class="ending-grade grade-${grade.grade}">${grade.grade}</div>
        <h2>${grade.title}</h2>
        <p class="ending-dish">评审团品尝了你的「${dishResult.name}」</p>

        <div class="ending-rows">
          ${grade.breakdown.map(b => `
            <div class="ending-row">
              <span class="er-label">${b.label}<small>${b.weight}</small></span>
              <span class="er-track"><span class="er-fill" style="width:${Math.min(100, b.value)}%"></span></span>
              <b class="er-val">${b.value}</b>
            </div>`).join('')}
        </div>

        <div class="ending-total"><span>最终评分</span><b>${grade.total}</b></div>
        <div class="ending-stats">
          <span>${icon('coin')} 星币 <b>${this.gameData.credits || 0}</b></span>
          <span>${icon('spark')} 声望 <b>${this.gameData.reputation || 0}</b></span>
          <span>${icon('book')} 图鉴 <b>${(this.gameData.discoveredRecipes || []).length} / 22</b></span>
        </div>

        <button class="btn-launch-game" id="btn-ending-continue"><span>继续经营</span><small>荒野仍在等你</small></button>
        <p class="ending-foot">虚空母龙可在终极评鉴面板中再次挑战，刷新更高评分。</p>
      </div>`;

    this.endingOverlay.querySelector('#btn-ending-continue').addEventListener('click', () => {
      this.endingOverlay.classList.add('hidden');
    });
    this.endingOverlay.classList.remove('hidden');
    audio.play('cook_fanfare');
  }

  /**
   * 暂停菜单：Esc / P 呼出。引擎此前只记录了按键，没有任何地方消费它。
   */
  togglePause() {
    if (!this.isGameRunning) return;
    if (this.campUI?.currentModal) return;          // 面板打开时不叠加暂停
    if (this.player?.state === PLAYER_STATES.DEAD) return;

    if (!this.pauseOverlay) {
      this.pauseOverlay = document.createElement('div');
      this.pauseOverlay.className = 'modal-overlay pause-overlay hidden';
      this.pauseOverlay.innerHTML = `
        <div class="pause-card">
          <div class="ending-eyebrow"><span class="eyebrow-line"></span> PAUSED <span class="eyebrow-line"></span></div>
          <h2>狩猎暂停</h2>
          <div class="pause-stats" id="pause-stats"></div>
          <div class="pause-actions">
            <button class="btn-launch-game" id="btn-resume"><span>继续狩猎</span><small>ESC</small></button>
            <button class="btn-icon pause-secondary" id="btn-pause-camp">${icon('camp')}<span>回到营地</span></button>
            <button class="btn-icon pause-secondary" id="btn-pause-save">${icon('spark')}<span>立即存档</span></button>
          </div>
          <p class="pause-hint">WASD 移动 · J/左键 刀击 · H 破甲重击 · K 疾冲 · 空格 盾反 · E 营地交互 · C 营地 · G 工坊 · V 地图</p>
        </div>`;
      this.stageContainer.appendChild(this.pauseOverlay);

      this.pauseOverlay.querySelector('#btn-resume').addEventListener('click', () => this.togglePause());
      this.pauseOverlay.querySelector('#btn-pause-camp').addEventListener('click', () => {
        this.player.x = this.spawnPoint?.x ?? this.player.x;
        this.player.y = this.spawnPoint?.y ?? this.player.y;
        this.player.vx = 0; this.player.vy = 0;
        this.togglePause();
        this.hud.showToast('已返回星尘营地。', 'info', icon('camp'));
      });
      this.pauseOverlay.querySelector('#btn-pause-save').addEventListener('click', () => {
        state.save();
        this.hud.showToast('进度已保存。', 'success', icon('spark'));
      });
    }

    const paused = this.engine.togglePause();
    if (paused) {
      const d = this.gameData;
      this.pauseOverlay.querySelector('#pause-stats').innerHTML = `
        <span>${icon('coin')} 星币 <b>${d.credits || 0}</b></span>
        <span>${icon('spark')} 声望 <b>${d.reputation || 0}</b></span>
        <span>${icon('star')} 米其林 <b>${d.michelinStars || 0} 星</b></span>
        <span>${icon('book')} 图鉴 <b>${(d.discoveredRecipes || []).length}</b></span>`;
      this.pauseOverlay.classList.remove('hidden');
    } else {
      this.pauseOverlay.classList.add('hidden');
    }
  }

  showDeathOverlay() {
    if (!this.deathOverlay) {
      this.deathOverlay = document.createElement('div');
      this.deathOverlay.className = 'modal-overlay death-overlay';
      this.deathOverlay.innerHTML = `
        <div class="death-card">
          <div class="death-glyph">${icon('skull')}</div>
          <h2>猎人倒在了荒野</h2>
          <p><b id="death-planet">星尘营地</b>的救援无人机把你拖回了篝火旁。<br/>急救费用：<b id="death-penalty">0</b> 星币</p>
          <button class="btn-launch-game" id="btn-respawn"><span id="death-return">回到营地</span><small>整装再猎</small></button>
        </div>`;
      this.stageContainer.appendChild(this.deathOverlay);
      this.deathOverlay.querySelector('#btn-respawn').addEventListener('click', () => this.respawnPlayer());
    }
    const penalty = Math.floor((this.gameData.credits || 0) * 0.1);
    this.deathPenalty = penalty;
    const elPenalty = this.deathOverlay.querySelector('#death-penalty');
    if (elPenalty) elPenalty.innerText = penalty;

    const here = getCurrentPlanet(this.gameData);
    const elPlanet = this.deathOverlay.querySelector('#death-planet');
    if (elPlanet) elPlanet.innerText = `${here.name} 营地`;
    const elReturn = this.deathOverlay.querySelector('#death-return');
    if (elReturn) elReturn.innerText = `回到 ${here.name} 营地`;
    this.deathOverlay.classList.remove('hidden');
    audio.stopBGM?.();
  }

  /**
   * 把玩家挪到测绘图上点中的位置。落点被挡就在附近找一圈空地。
   */
  teleportTo(x, y, message = '') {
    const p = this.player;
    if (!p) return false;

    let tx = Math.max(60, Math.min(this.map.width - 60, x));
    let ty = Math.max(60, Math.min(this.map.height - 60, y));

    if (this.map.isBlocked(tx, ty, p.radius + 4)) {
      const found = [40, 80, 130, 190].flatMap(r =>
        Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return { x: tx + Math.cos(a) * r, y: ty + Math.sin(a) * r };
        })
      ).find(c => !this.map.isBlocked(c.x, c.y, p.radius + 4));
      if (!found) {
        this.hud.showToast('那片地形落不下去，换个点。', 'warning', icon('close'));
        return false;
      }
      tx = found.x;
      ty = found.y;
    }

    particles.spawnShockwave?.(p.x, p.y, 70, '#7dd3fc');
    p.x = tx;
    p.y = ty;
    p.prevX = tx;
    p.prevY = ty;
    p.vx = 0;
    p.vy = 0;
    this.camera.snapTo?.(p.x, p.y);
    this.camera.x = p.x - this.camera.viewportWidth / 2;
    this.camera.y = p.y - this.camera.viewportHeight / 2;
    this.camera.prevX = this.camera.x;
    this.camera.prevY = this.camera.y;
    particles.spawnShockwave?.(p.x, p.y, 90, '#7dd3fc');
    audio.play('dash', { volume: 0.5 });
    if (message) this.hud.showToast(message, 'success', icon('compass'));
    return true;
  }

  respawnPlayer() {
    this.gameData.credits = Math.max(0, (this.gameData.credits || 0) - (this.deathPenalty || 0));
    const p = this.player;
    // 复活点永远是当前所在星球的营地，不会把人送回母星
    const camp = this.map.campPosition;
    p.x = this.spawnPoint?.x ?? camp.x;
    p.y = this.spawnPoint?.y ?? camp.y;
    p.prevX = p.x;
    p.prevY = p.y;
    this.camera.x = p.x - this.camera.viewportWidth / 2;
    this.camera.y = p.y - this.camera.viewportHeight / 2;
    this.camera.prevX = this.camera.x;
    this.camera.prevY = this.camera.y;
    p.hp = p.maxHp;
    p.stamina = p.maxStamina;
    p.vx = 0;
    p.vy = 0;
    p.isParrying = false;
    p.attackHitbox = null;
    p.setState(PLAYER_STATES.IDLE);
    p.invulnerable = true;
    p.invulnerableTimer = Math.max(p.invulnerableTimer || 0, 2.0);
    this.deathHandled = false;
    if (this.deathOverlay) this.deathOverlay.classList.add('hidden');
    audio.startBGM?.('wilderness');
    this.updateTopBar();
    state.save();
    this.hud.showToast(
      `已在 ${getCurrentPlanet(this.gameData).name} 的营地苏醒，吃点热食再出发吧。`,
      'warning', icon('camp')
    );
  }

  updateTopBar() {
    const elDay = document.getElementById('top-day-clock');
    const elCredits = document.getElementById('top-credits');
    const elRep = document.getElementById('top-rep');
    const elRank = document.getElementById('top-hunter-rank');

    const data = this.gameData || state.data || {};
    if (elDay) elDay.innerText = `第 ${data.dayCount || 1} 宇宙日 · ${this.map.getTimeString()}`;
    if (elCredits) elCredits.innerText = data.credits || 0;
    if (elRep) elRep.innerText = data.reputation || 0;
    if (elRank) {
      const stars = data.michelinStars || 0;
      const starMarks = Array.from({ length: Math.max(1, stars) }, () => icon('star')).join('');
      elRank.innerHTML = `${starMarks}<span>${stars === 0 ? '初星猎人' : '星级猎人'}</span>`;
    }

    this.refreshTravelBadge();
    this.refreshAlmanacBadge();
  }

  /**
   * 有星球现在跃迁得起，就在地图按钮上挂个感叹号。
   */
  refreshTravelBadge() {
    const btn = document.getElementById('top-btn-map');
    if (!btn) return;

    // 只为还没开通航道的星球提示，去过的不再反复弹感叹号
    const ready = PLANETS.filter(p => canTravelTo(this.gameData, p).ok && !hasVisited(this.gameData, p));
    btn.classList.toggle('has-alert', ready.length > 0);
    btn.dataset.alertCount = String(ready.length);
    if (ready.length) {
      btn.title = `星域测绘图 [V] · ${ready.map(p => p.name).join('、')} 可开通航道`;
    } else {
      btn.title = '星域测绘图 [V]';
    }
  }

  getBiomeLabel(biome) {
    const labels = {
      bioluminescent_forest: '荧光菌林',
      crystalline_rift: '晶簇裂谷',
      magma_springs: '熔岩温泉',
      cryo_tundra: '绝对冻原',
      stardust_camp: '星尘营地'
    };
    return labels[biome] || '未知扇区';
  }

  setSoundButtonState(button, muted) {
    button.classList.toggle('is-muted', muted);
    const label = button.querySelector('span:nth-of-type(2)');
    const glyph = button.querySelector('.action-glyph');
    if (label) label.innerText = muted ? '静音' : '音乐';
    if (glyph) glyph.innerHTML = icon(muted ? 'close' : 'music');
    const hudGlyph = document.querySelector('#hud-btn-sound .btn-icon');
    if (hudGlyph) hudGlyph.innerHTML = icon(muted ? 'close' : 'music');
  }

  /**
   * 渲染前把所有会移动的对象换成固定步之间的插值坐标，渲染后还原。
   * 这样所有 draw 代码都不必关心插值，画面也不会被固定步长的位置锁住。
   */
  _applyRenderInterpolation(alpha) {
    const swap = (obj) => {
      if (!obj || typeof obj.prevX !== 'number') return;
      obj._trueX = obj.x;
      obj._trueY = obj.y;
      obj.x = obj.prevX + (obj.x - obj.prevX) * alpha;
      obj.y = obj.prevY + (obj.y - obj.prevY) * alpha;
    };

    this._interpolated.length = 0;
    const track = (obj) => {
      if (!obj || typeof obj.prevX !== 'number') return;
      swap(obj);
      this._interpolated.push(obj);
    };

    track(this.camera);
    track(this.player);
    for (const m of this.monsters) track(m);
    for (const p of this.projectiles) track(p);
    for (const d of this.spawner.droppedItems) track(d);
  }

  _restoreRenderInterpolation() {
    for (const obj of this._interpolated) {
      obj.x = obj._trueX;
      obj.y = obj._trueY;
    }
    this._interpolated.length = 0;
  }

  render(ctx, alpha = 1) {
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this._applyRenderInterpolation(alpha);

    ctx.save();
    ctx.translate(this.camera.shakeOffsetX, this.camera.shakeOffsetY);
    ctx.scale(this.camera.zoom, this.camera.zoom);
    // 1. Render World Map Layers
    this.map.render(ctx, this.camera);

    // 2. Render Resource Nodes & Dropped Loot
    this.spawner.render(ctx, this.camera, this.player);

    // 3. Render Monsters（悬赏目标先描一圈高亮，再画本体）
    this.drawBountyTargetMarkers(ctx);
    this.monsters.forEach(m => m.draw(ctx, this.camera, this.player));

    // 4. Render Projectiles
    this.projectiles.forEach(p => {
      const rx = p.x - this.camera.x;
      const ry = p.y - this.camera.y;
      ctx.save();
      ctx.fillStyle = p.color || '#ef4444';
      ctx.shadowColor = p.color || '#f87171';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(rx, ry, p.radius || 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 4c. Render Chef Skill FX（画在角色脚下，位移刀痕不会盖住人）
    ctx.save();
    ctx.translate(-this.camera.x, -this.camera.y);
    this.skillRuntime.render(ctx);
    ctx.restore();

    // 5. Render Player Character
    this.player.draw(ctx, this.camera);

    // 5b. Render Camp Interaction Prompts
    this.campInteractions.render(ctx, this.camera);

    // 6. Render Particles & Visual FX
    particles.render(ctx, this.camera);

    // 7. Render Map Ambient Night Overlay & Point Lights
    this.map.renderLighting(ctx, this.camera, [
      { x: this.player.x, y: this.player.y, radius: 140, color: '#fef08a', intensity: 0.8 },
      { x: this.map.campPosition.x, y: this.map.campPosition.y, radius: 240, color: '#f97316', intensity: 0.95 }
    ]);

    ctx.restore();
    this._restoreRenderInterpolation();
  }
}

// Instantiate and launch master game on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.game = new GameMaster();
  window.__claimMilestone = claimMilestone;
  window.__claimDaily = claimDaily;
  window.__trackDaily = trackDaily;
  window.spawnMonster = (typeKey, x, y) => {
    const m = createMonster(typeKey, x, y);
    window.game.monsters.push(m);
    return m;
  };
});
