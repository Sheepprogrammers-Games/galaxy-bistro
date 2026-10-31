import { assets } from "../core/assets.js";
import { shiftHex } from '../core/color.js';
import { drawCampGlyph } from './glyphs.js';
/**
 * Galaxy Hunter: Gourmet Odyssey - Procedural World Map & Environment System
 * 
 * Features:
 * - 6000x4500 layered 2D world map with 4 distinct biomes + Central Basecamp Hub
 *   1. Bioluminescent Shroom Forest (Cyan / Emerald glow, giant mushrooms, moss paths)
 *   2. Crystalline Rift (Deep purple / Magenta crystal spires, magnetic glowing cliffs)
 *   3. Magma Springs (Dark basalt rock, bubbling lava pools, charred flora)
 *   4. Absolute Cryo-Tundra (Frost blue ice plains, snow boulders, frozen geysers)
 * - 区块按需烘焙（进视野才画），画过的留在缓存里，超预算淘汰最远的
 * - Seeded procedural layout: 每颗星球每次落地重新掷种子，地貌与刷点都会变
 * - Obstacle collision geometry & raycasting (rocks, trees, crystal spires, liquid pools)
 * - Dynamic Day / Night cycle (Dawn, Day, Dusk, Midnight) with ambient tinting,
 *   star twinkling, and local point light sources (campfires, lava, mushrooms, crystals).
 */

export const MAP_WIDTH = 6000;
export const MAP_HEIGHT = 4500;
export const CHUNK_SIZE = 600; // 10x8 chunks，按需烘焙，同时最多保留 CHUNK_BUDGET 张

/** 同时驻留的区块画布上限，超出后淘汰离玩家最远的。 */
const CHUNK_BUDGET = 28;

/** 每平方像素的障碍密度基准，乘上星球系数得到实际数量。 */
const OBSTACLE_PER_AREA = 1 / 74000;

/** 32 位种子随机数，同一个种子每次得到同一张地图。 */
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const BIOMES = {
  FOREST: 'bioluminescent_forest',
  CRYSTAL: 'crystalline_rift',
  MAGMA: 'magma_springs',
  TUNDRA: 'cryo_tundra',
  CAMP: 'stardust_camp'
};

export const TIME_PHASES = {
  DAWN: 'dawn',
  DAY: 'day',
  DUSK: 'dusk',
  NIGHT: 'night'
};

/**
 * World Map Class
 */
export class WorldMap {
  constructor(options = {}) {
    this.width = options.width || MAP_WIDTH;
    this.height = options.height || MAP_HEIGHT;
    this.chunkSize = options.chunkSize || CHUNK_SIZE;

    // Day/Night cycle
    // 0 = Dawn (06:00), 0.25 = Noon (12:00), 0.5 = Dusk (18:00), 0.75 = Midnight (00:00), 1.0 = Dawn
    this.dayDuration = options.dayDuration || 180; // 180 seconds (3 min) full cycle
    this.timeOfDay = options.startTime || 0.2; // Start in morning
    this.timeSpeed = 1.0;
    this.isTimePaused = false;

    // Environmental timer for ambient animations (lava bubbling, spore pulse, stars)
    this.animTime = 0;

    // Twinkling stars for night
    this.stars = this._generateStars(140);

    // Static obstacles for collision
    this.obstacles = [];

    // Ambient light sources (campfires, glowing flora, crystals, lava pools)
    this.lightSources = [];

    // Pre-rendered chunk canvases
    this.chunks = [];
    this.chunksCols = Math.ceil(this.width / this.chunkSize);
    this.chunksRows = Math.ceil(this.height / this.chunkSize);

    // Camp center position
    this.campPosition = { x: this.width / 2, y: this.height / 2 };
    // 营地安全区：异兽无法进入，玩家在圈内不会被追击
    this.campSafeRadius = 320;

    // 四象限各自的生态区（西北 / 东北 / 西南 / 东南），由星球配置决定
    this.quadrantBiomes = options.quadrants
      || [BIOMES.FOREST, BIOMES.CRYSTAL, BIOMES.MAGMA, BIOMES.TUNDRA];

    // 世界种子：同一颗星球每次落地重新掷，地貌与资源点都会变
    this.seed = Number.isFinite(options.seed) ? options.seed : Math.floor(Math.random() * 1e9);
    this.obstacleDensity = Number.isFinite(options.obstacleDensity) ? options.obstacleDensity : 1;
    this.planetTint = options.tint || null;
    this.nightLength = Number.isFinite(options.nightLength) ? options.nightLength : 1;
    // 地表配色偏移，让同一种生态区在不同星球看起来不一样
    this.terrainShift = options.terrainShift || null;
    this.landmark = options.landmark || null;
    this.landmarkCount = options.landmarkCount || 0;
    // 星球独占资源点的 NODE_TYPES 键名，由 WorldSpawner 读取
    this.exclusiveNode = options.exclusiveNode || null;

    // 走过的区块记在这里，星图上用来画迷雾与判断能否快速传送
    this.exploredChunks = new Set();

    // Initialize map structures
    this._initObstacles();
    this._initLightSources();
    this._prepareChunks();
  }

  /** 区块索引 → 键。 */
  chunkKey(col, row) {
    return `${col},${row}`;
  }

  /** 世界坐标落在哪个区块。 */
  chunkAt(x, y) {
    return {
      col: Math.max(0, Math.min(this.chunksCols - 1, Math.floor(x / this.chunkSize))),
      row: Math.max(0, Math.min(this.chunksRows - 1, Math.floor(y / this.chunkSize)))
    };
  }

  /** 该坐标所在区块是否已经探索过。 */
  isExplored(x, y) {
    const { col, row } = this.chunkAt(x, y);
    return this.exploredChunks.has(this.chunkKey(col, row));
  }

  /** 探索进度，用于星图上的百分比。 */
  exploredRatio() {
    return this.exploredChunks.size / (this.chunksCols * this.chunksRows);
  }

  /**
   * 玩家或实体是否位于营地安全区内。
   */
  isInsideCampSafeZone(x, y, margin = 0) {
    return Math.hypot(x - this.campPosition.x, y - this.campPosition.y) < this.campSafeRadius + margin;
  }

  /**
   * 把闯入安全区的实体推回边界外，并抵消朝内的速度。
   */
  repelFromCampSafeZone(entity) {
    const dx = entity.x - this.campPosition.x;
    const dy = entity.y - this.campPosition.y;
    const dist = Math.hypot(dx, dy);
    const limit = this.campSafeRadius + (entity.radius || 0);
    if (dist >= limit) return false;

    const angle = dist > 0.001 ? Math.atan2(dy, dx) : Math.random() * Math.PI * 2;
    entity.x = this.campPosition.x + Math.cos(angle) * limit;
    entity.y = this.campPosition.y + Math.sin(angle) * limit;

    const inward = (entity.vx || 0) * Math.cos(angle) + (entity.vy || 0) * Math.sin(angle);
    if (inward < 0) {
      entity.vx -= inward * Math.cos(angle);
      entity.vy -= inward * Math.sin(angle);
    }
    return true;
  }

  /**
   * Determine biome at world coordinates (x, y)
   */
  getBiomeAt(x, y) {
    // Check central basecamp radius (safe zone)
    if (this.isInsideCampSafeZone(x, y)) {
      return BIOMES.CAMP;
    }

    const midX = this.width / 2;
    const midY = this.height / 2;

    if (x < midX && y < midY) return this.quadrantBiomes[0];
    if (x >= midX && y < midY) return this.quadrantBiomes[1];
    if (x < midX && y >= midY) return this.quadrantBiomes[2];
    return this.quadrantBiomes[3];
  }

  /**
   * Initialize map obstacles & collision geometry
   */
  _initObstacles() {
    this.obstacles = [];

    // 1. World Border Boundaries
    const thickness = 40;
    this.obstacles.push({ x: this.width / 2, y: thickness / 2, width: this.width, height: thickness, shape: 'rect', type: 'boundary' });
    this.obstacles.push({ x: this.width / 2, y: this.height - thickness / 2, width: this.width, height: thickness, shape: 'rect', type: 'boundary' });
    this.obstacles.push({ x: thickness / 2, y: this.height / 2, width: thickness, height: this.height, shape: 'rect', type: 'boundary' });
    this.obstacles.push({ x: this.width - thickness / 2, y: this.height / 2, width: thickness, height: this.height, shape: 'rect', type: 'boundary' });

    // 2. Central Camp Kitchen / Hub Obstacles
    const cx = this.campPosition.x;
    const cy = this.campPosition.y;
    // 营地设施：每一件都带 interact 描述，供交互提示读取
    this.obstacles.push({
      x: cx, y: cy, radius: 26, shape: 'circle', type: 'campfire_base', label: 'Stardust Campfire',
      interact: { action: 'rest', name: '星尘篝火', hint: '围炉休整', glyph: 'flame', color: '#fb923c' }
    });
    // 设施沿篝火外围散成一圈，彼此留够间距，走近时只会有一件抢到焦点
    this.obstacles.push({
      x: cx + 110, y: cy - 70, width: 80, height: 50, shape: 'rect', type: 'camp_stove', label: 'Cosmic Stove',
      interact: { action: 'cook', name: '宇宙灶台', hint: '开始烹饪', glyph: 'stove', color: '#f59e0b', hotkey: 'C' }
    });
    this.obstacles.push({
      x: cx - 115, y: cy - 70, width: 64, height: 46, shape: 'rect', type: 'camp_crate', label: 'Supply Cache',
      interact: { action: 'crate', name: '公会补给箱', hint: '领取补给', glyph: 'crate', color: '#d97706' }
    });
    this.obstacles.push({
      x: cx - 115, y: cy + 80, width: 48, height: 48, shape: 'rect', type: 'camp_jukebox', label: 'Cosmic Jukebox',
      interact: { action: 'music', name: '宇宙点唱机', hint: '切换电台', glyph: 'radio', color: '#a855f7', hotkey: 'M' }
    });
    this.obstacles.push({
      x: cx + 115, y: cy + 80, width: 72, height: 48, shape: 'rect', type: 'camp_workbench', label: 'Stardust Workshop',
      interact: { action: 'workshop', name: '星尘工坊', hint: '永久强化', glyph: 'anvil', color: '#38bdf8', hotkey: 'G' }
    });
    this.obstacles.push({
      x: cx, y: cy - 145, width: 66, height: 44, shape: 'rect', type: 'camp_board', label: 'Bounty Board',
      interact: { action: 'bounties', name: '米其林悬赏板', hint: '查看悬赏', glyph: 'board', color: '#fbbf24', hotkey: 'Q' }
    });
    this.obstacles.push({
      x: cx + 200, y: cy + 4, width: 78, height: 58, shape: 'rect', type: 'camp_armory', label: 'Field Armory',
      interact: { action: 'armory', name: '军械商', hint: '选购武器', glyph: 'anvil', color: '#f87171', hotkey: 'Z' }
    });
    this.obstacles.push({
      x: cx, y: cy + 148, width: 58, height: 62, shape: 'rect', type: 'camp_gallery', label: 'Dish Gallery',
      interact: { action: 'gallery', name: '菜品留影台', hint: '翻看照片', glyph: 'camera', color: '#f472b6' }
    });
    this.obstacles.push({
      x: cx - 212, y: cy + 8, width: 82, height: 60, shape: 'rect', type: 'camp_tent', label: 'Chef Roster Tent',
      interact: { action: 'roster', name: '主厨营帐', hint: '更换主厨', glyph: 'tent', color: '#34d399', hotkey: 'X' }
    });

    // 3. Procedural Biome Obstacles，按世界种子生成，同一颗星球每趟都不一样
    const rng = makeRng(this.seed);

    // 挡路的碎石类可以被打碎并掉料，地标类保留
    const spawnBiomeObstacles = (minX, maxX, minY, maxY, biomeType, count) => {
      for (let i = 0; i < count; i++) {
        const ox = minX + 60 + rng() * (maxX - minX - 120);
        const oy = minY + 60 + rng() * (maxY - minY - 120);
        const sizeVar = rng();

        // 营地外围留空，出门不会被堵住
        if (Math.hypot(ox - cx, oy - cy) < this.campSafeRadius + 90) continue;

        let obs = null;

        // 规则：挡路的一律能打碎，纯地表装饰一律 noCollide。
        // 可视外形远大于占地的（伞盖、晶柱、喷口）用 collisionRadius 单独收窄。
        if (biomeType === BIOMES.FOREST) {
          if (sizeVar > 0.62) {
            const capRadius = 28 + sizeVar * 16;
            obs = {
              x: ox, y: oy, radius: capRadius, collisionRadius: 11, shape: 'circle', type: 'mushroom_tree', biome: biomeType, color: '#06d6a0',
              destructible: true, maxHp: 40, drop: { id: 'zero_g_mushroom', name: '零重力跳跳菇', min: 1, max: 2 }
            };
          } else {
            obs = {
              x: ox, y: oy, radius: 18 + sizeVar * 12, collisionRadius: 12, shape: 'circle', type: 'moss_rock', biome: biomeType, color: '#2a9d8f',
              destructible: true, maxHp: 36, drop: { id: 'spore_herb', name: '荧光孢子香草', min: 1, max: 2 }
            };
          }
        } else if (biomeType === BIOMES.CRYSTAL) {
          if (sizeVar > 0.55) {
            obs = {
              x: ox, y: oy, radius: 22 + sizeVar * 18, collisionRadius: 12, shape: 'circle', type: 'crystal_spire', biome: biomeType, color: '#c084fc',
              destructible: true, maxHp: 54, drop: { id: 'crystal_bloom', name: '高维星核晶簇花', min: 1, max: 1 }
            };
          } else {
            obs = {
              x: ox, y: oy, width: 45 + sizeVar * 30, height: 25 + sizeVar * 15, shape: 'rect', type: 'magnetic_ridge', biome: biomeType, color: '#9333ea',
              collisionWidth: 30 + sizeVar * 18, collisionHeight: 16 + sizeVar * 9,
              destructible: true, maxHp: 50, drop: { id: 'pulsar_crystal_salt', name: '脉冲星高导晶盐', min: 1, max: 3 }
            };
          }
        } else if (biomeType === BIOMES.MAGMA) {
          if (sizeVar > 0.72) {
            // 熔岩池是地表纹样，踩上去直接过
            obs = {
              x: ox, y: oy, radius: 32 + sizeVar * 20, shape: 'circle', type: 'lava_pool', biome: biomeType, isLiquid: true, color: '#f97316',
              noCollide: true
            };
          } else if (sizeVar > 0.34) {
            obs = {
              x: ox, y: oy, radius: 20 + sizeVar * 14, collisionRadius: 13, shape: 'circle', type: 'basalt_rock', biome: biomeType, color: '#451a03',
              destructible: true, maxHp: 46, drop: { id: 'sunfire_fruit', name: '地热炽阳炎果', min: 1, max: 2 }
            };
          } else {
            obs = {
              x: ox, y: oy, width: 30 + sizeVar * 20, height: 35 + sizeVar * 20, shape: 'rect', type: 'obsidian_pillar', biome: biomeType, color: '#262626',
              collisionWidth: 20 + sizeVar * 12, collisionHeight: 22 + sizeVar * 12,
              destructible: true, maxHp: 60, drop: { id: 'antimatter_chili', name: '反物质干辣椒', min: 1, max: 2 }
            };
          }
        } else if (biomeType === BIOMES.TUNDRA) {
          if (sizeVar > 0.72) {
            obs = {
              x: ox, y: oy, radius: 26 + sizeVar * 15, collisionRadius: 12, shape: 'circle', type: 'cryo_geyser', biome: biomeType, color: '#38bdf8',
              destructible: true, maxHp: 48, drop: { id: 'frost_lotus', name: '玄冰寒霜雪莲', min: 1, max: 1 }
            };
          } else if (sizeVar > 0.34) {
            obs = {
              x: ox, y: oy, radius: 22 + sizeVar * 14, collisionRadius: 13, shape: 'circle', type: 'ice_boulder', biome: biomeType, color: '#bae6fd',
              destructible: true, maxHp: 42, drop: { id: 'comet_ice_crystal', name: '彗星冰晶碎', min: 1, max: 2 }
            };
          } else {
            obs = {
              x: ox, y: oy, width: 48 + sizeVar * 25, height: 24 + sizeVar * 15, shape: 'rect', type: 'frost_ridge', biome: biomeType, color: '#e0f2fe',
              collisionWidth: 32 + sizeVar * 15, collisionHeight: 15 + sizeVar * 9,
              destructible: true, maxHp: 46, drop: { id: 'frost_lotus', name: '玄冰寒霜雪莲', min: 1, max: 1 }
            };
          }
        }

        if (obs) {
          if (obs.destructible) obs.hp = obs.maxHp;
          this.obstacles.push(obs);
        }
      }
    };

    const midX = this.width / 2;
    const midY = this.height / 2;

    // 每个象限按面积摊障碍数，星球的 obstacleDensity 再缩放一次
    const quadArea = (midX - 100) * (midY - 100);
    const perQuad = Math.max(8, Math.round(quadArea * OBSTACLE_PER_AREA * this.obstacleDensity));

    const q = this.quadrantBiomes;
    // 西北 / 东北 / 西南 / 东南，生态区由星球配置决定
    spawnBiomeObstacles(60, midX - 40, 60, midY - 40, q[0], perQuad);
    spawnBiomeObstacles(midX + 40, this.width - 60, 60, midY - 40, q[1], perQuad);
    spawnBiomeObstacles(60, midX - 40, midY + 40, this.height - 60, q[2], perQuad);
    spawnBiomeObstacles(midX + 40, this.width - 60, midY + 40, this.height - 60, q[3], perQuad);

    this._spawnLandmarks(rng);
  }

  /**
   * 星球专属地标：只在特定星球出现，不分生态区随机撒。
   * 它们是这颗星球最显眼的辨识物。
   */
  _spawnLandmarks(rng) {
    if (!this.landmark || this.landmarkCount <= 0) return;

    const cx = this.campPosition.x;
    const cy = this.campPosition.y;

    for (let i = 0; i < this.landmarkCount; i++) {
      const x = 90 + rng() * (this.width - 180);
      const y = 90 + rng() * (this.height - 180);
      if (Math.hypot(x - cx, y - cy) < this.campSafeRadius + 140) continue;

      const size = rng();
      if (this.landmark === 'ember_vent') {
        // 熔火喷气孔：不断吐火星的高温裂口，走近会被顶开但打得碎
        this.obstacles.push({
          x, y, radius: 24 + size * 14, collisionRadius: 13, shape: 'circle',
          type: 'ember_vent', biome: 'landmark', color: '#fb923c',
          destructible: true, maxHp: 66, hp: 66,
          drop: { id: 'supernova_essence', name: '超新星浓缩热原露', min: 1, max: 1 },
          phase: rng() * 6.28
        });
      } else if (this.landmark === 'void_spire') {
        // 虚空尖碑：黑色方尖碑，中间裂开一道紫色缝
        this.obstacles.push({
          x, y, radius: 26 + size * 16, collisionRadius: 14, shape: 'circle',
          type: 'void_spire', biome: 'landmark', color: '#a78bfa',
          destructible: true, maxHp: 78, hp: 78,
          drop: { id: 'void_wyrm_meat', name: '虚空神龙脊髓肉', min: 1, max: 1 },
          phase: rng() * 6.28
        });
      }
    }
  }

  /**
   * 打碎一块可破坏的障碍：扣血，归零时从碰撞列表移除并交还掉落物。
   * 返回 { destroyed, drop } 供上层生成掉落与特效。
   */
  damageObstacle(obs, amount) {
    if (!obs || !obs.destructible || obs.hp <= 0) return null;
    obs.hp -= amount;
    obs.hitFlash = 0.18;
    if (obs.hp > 0) return { destroyed: false, drop: null };

    // 障碍每帧实时绘制，从数组里移走就同时没了碰撞和画面
    const idx = this.obstacles.indexOf(obs);
    if (idx >= 0) this.obstacles.splice(idx, 1);
    return { destroyed: true, drop: obs.drop || null };
  }

  /** 命中范围内可破坏的障碍，按距离取最近的一个。 */
  findDestructibleAt(x, y, reach = 0) {
    let best = null;
    let bestDist = Infinity;
    for (const obs of this.obstacles) {
      if (!obs.destructible || obs.hp <= 0) continue;
      const half = obs.shape === 'circle'
        ? { w: obs.radius, h: obs.radius }
        : { w: obs.width / 2, h: obs.height / 2 };
      const dx = Math.max(Math.abs(x - obs.x) - half.w, 0);
      const dy = Math.max(Math.abs(y - obs.y) - half.h, 0);
      const d = Math.hypot(dx, dy);
      if (d <= reach && d < bestDist) { best = obs; bestDist = d; }
    }
    return best;
  }

  /**
   * Register dynamic point lights
   */
  _initLightSources() {
    this.lightSources = [];

    // Central Basecamp Campfire (Warm orange glow)
    this.lightSources.push({
      id: 'camp_fire',
      x: this.campPosition.x,
      y: this.campPosition.y,
      radius: 260,
      color: 'rgba(255, 160, 60, 0.85)',
      flicker: 0.15,
      alwaysOn: true
    });

    // Register light sources for glowing obstacles
    for (const obs of this.obstacles) {
      if (obs.type === 'mushroom_tree') {
        this.lightSources.push({
          x: obs.x,
          y: obs.y,
          radius: 120 + obs.radius * 1.5,
          color: 'rgba(6, 214, 160, 0.7)',
          flicker: 0.1,
          alwaysOn: false
        });
      } else if (obs.type === 'crystal_spire') {
        this.lightSources.push({
          x: obs.x,
          y: obs.y,
          radius: 140 + obs.radius * 1.6,
          color: 'rgba(192, 132, 252, 0.75)',
          flicker: 0.08,
          alwaysOn: false
        });
      } else if (obs.type === 'lava_pool') {
        this.lightSources.push({
          x: obs.x,
          y: obs.y,
          radius: 150 + obs.radius * 1.4,
          color: 'rgba(249, 115, 22, 0.8)',
          flicker: 0.2,
          alwaysOn: true
        });
      } else if (obs.type === 'cryo_geyser') {
        this.lightSources.push({
          x: obs.x,
          y: obs.y,
          radius: 110 + obs.radius * 1.2,
          color: 'rgba(56, 189, 248, 0.65)',
          flicker: 0.12,
          alwaysOn: false
        });
      }
    }
  }

  /**
   * Pre-render static background tiles into offscreen chunk canvases
   */
  /**
   * 只建区块索引，画布留空。真正的绘制推迟到区块第一次进视野，
   * 这样地图可以做得很大而不必一次吃下所有离屏画布。
   */
  _prepareChunks() {
    this.chunks = [];

    for (let r = 0; r < this.chunksRows; r++) {
      for (let c = 0; c < this.chunksCols; c++) {
        const startX = c * this.chunkSize;
        const startY = r * this.chunkSize;
        this.chunks.push({
          col: c,
          row: r,
          x: startX,
          y: startY,
          width: Math.min(this.chunkSize, this.width - startX),
          height: Math.min(this.chunkSize, this.height - startY),
          canvas: null,
          usedAt: 0
        });
      }
    }
  }

  /** 现烘焙一个区块，同时记进已探索名单。 */
  _bakeChunk(chunk) {
    if (typeof document === 'undefined') return;

    const canvas = document.createElement('canvas');
    canvas.width = chunk.width;
    canvas.height = chunk.height;
    this._drawChunkContent(canvas.getContext('2d'), chunk.x, chunk.y, chunk.width, chunk.height);
    chunk.canvas = canvas;
    this.exploredChunks.add(this.chunkKey(chunk.col, chunk.row));
  }

  /**
   * 驻留的区块画布超预算时，丢掉离玩家最远的那些。
   * 只丢画布，探索记录保留，回头再走过去会重新烘焙出同一片地貌（种子固定）。
   */
  _trimChunkCache(focusX, focusY) {
    const live = this.chunks.filter(c => c.canvas);
    if (live.length <= CHUNK_BUDGET) return;

    live.sort((a, b) => {
      const da = Math.hypot(a.x + a.width / 2 - focusX, a.y + a.height / 2 - focusY);
      const db = Math.hypot(b.x + b.width / 2 - focusX, b.y + b.height / 2 - focusY);
      return db - da;
    });

    for (let i = 0; i < live.length - CHUNK_BUDGET; i++) {
      live[i].canvas = null;
    }
  }

  /**
   * Render procedural terrain for a chunk
   */
  _drawChunkContent(ctx, startX, startY, w, h) {
    if (!ctx) return;

    // Helper tile fill
    const tileSize = 40;
    const cols = Math.ceil(w / tileSize);
    const rows = Math.ceil(h / tileSize);

    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const wx = startX + i * tileSize;
        const wy = startY + j * tileSize;
        const biome = this.getBiomeAt(wx + tileSize / 2, wy + tileSize / 2);

        // Base tile colors
        let baseColor = '#1e1e2e';
        let detailColor = '#252538';
        let accentColor = '#3b3b54';

        if (biome === BIOMES.CAMP) {
          baseColor = '#2d2438';
          detailColor = '#3c304a';
          accentColor = '#58466b';
        } else if (biome === BIOMES.FOREST) {
          baseColor = '#0b231c';
          detailColor = '#0f3329';
          accentColor = '#17473a';
        } else if (biome === BIOMES.CRYSTAL) {
          baseColor = '#1c102a';
          detailColor = '#26173a';
          accentColor = '#392156';
        } else if (biome === BIOMES.MAGMA) {
          baseColor = '#230f0f';
          detailColor = '#331515';
          accentColor = '#4a1d1d';
        } else if (biome === BIOMES.TUNDRA) {
          baseColor = '#0c2233';
          detailColor = '#122e45';
          accentColor = '#1d4261';
        }

        if (this.terrainShift) {
          baseColor = shiftHex(baseColor, this.terrainShift);
          detailColor = shiftHex(detailColor, this.terrainShift);
          accentColor = shiftHex(accentColor, this.terrainShift);
        }

        // Draw tile base
        ctx.fillStyle = baseColor;
        ctx.fillRect(i * tileSize, j * tileSize, tileSize, tileSize);

        // Tile pattern / texture variation
        const noise = (Math.sin(wx * 0.05) + Math.cos(wy * 0.05)) * 0.5;
        if (noise > 0.1) {
          ctx.fillStyle = detailColor;
          ctx.fillRect(i * tileSize + 4, j * tileSize + 4, tileSize - 8, tileSize - 8);
        }

        // Accent micro-details
        const microNoise = Math.sin(wx * 0.2 + wy * 0.3);
        if (microNoise > 0.4) {
          ctx.fillStyle = accentColor;
          ctx.beginPath();
          ctx.arc(i * tileSize + 20, j * tileSize + 20, 3 + microNoise * 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Biome specific tile decor
        if (biome === BIOMES.FOREST) {
          // Moss path specks
          if ((i + j) % 3 === 0) {
            ctx.fillStyle = 'rgba(6, 214, 160, 0.18)';
            ctx.beginPath();
            ctx.arc(i * tileSize + 10, j * tileSize + 10, 4, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (biome === BIOMES.CRYSTAL) {
          // Crystal veins
          if ((i * 2 + j) % 4 === 0) {
            ctx.strokeStyle = 'rgba(192, 132, 252, 0.22)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(i * tileSize, j * tileSize + 20);
            ctx.lineTo(i * tileSize + tileSize, j * tileSize + 20);
            ctx.stroke();
          }
        } else if (biome === BIOMES.MAGMA) {
          // Heat cracks
          if ((i + j * 3) % 5 === 0) {
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(i * tileSize + 5, j * tileSize + 5);
            ctx.lineTo(i * tileSize + 25, j * tileSize + 35);
            ctx.stroke();
          }
        } else if (biome === BIOMES.TUNDRA) {
          // Ice patches
          if ((i * 3 + j) % 4 === 0) {
            ctx.fillStyle = 'rgba(186, 230, 253, 0.15)';
            ctx.fillRect(i * tileSize + 6, j * tileSize + 6, tileSize - 12, tileSize - 12);
          }
        }
      }
    }

    // Grid border subtle lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += tileSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += tileSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    this._drawChunkFlora(ctx, startX, startY, w, h);
  }

  /**
   * 不参与碰撞的植被与碎屑，只烘焙一次，运行时零开销。
   * 障碍减少后靠这一层把地表填满，走位空间不受影响。
   */
  _drawChunkFlora(ctx, startX, startY, w, h) {
    const rng = makeRng((this.seed ^ (startX * 73856093) ^ (startY * 19349663)) >>> 0);
    const count = Math.round((w * h) / 5200);

    for (let i = 0; i < count; i++) {
      const lx = rng() * w;
      const ly = rng() * h;
      const wx = startX + lx;
      const wy = startY + ly;
      const biome = this.getBiomeAt(wx, wy);
      if (biome === BIOMES.CAMP) continue;

      const s = 0.6 + rng() * 1.1;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.scale(s, s);

      if (biome === BIOMES.FOREST) {
        // 一丛小菌菇
        ctx.fillStyle = 'rgba(6, 214, 160, 0.5)';
        for (let k = 0; k < 3; k++) {
          const ox = (k - 1) * 5;
          ctx.fillRect(ox - 1, -4, 2, 6);
          ctx.beginPath();
          ctx.ellipse(ox, -5, 4, 2.6, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (biome === BIOMES.CRYSTAL) {
        // 地面上冒出的小晶簇
        ctx.fillStyle = 'rgba(192, 132, 252, 0.42)';
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo((k - 1) * 4, 3);
          ctx.lineTo((k - 1) * 4 + 2.4, -6 - k);
          ctx.lineTo((k - 1) * 4 + 4.4, 3);
          ctx.closePath();
          ctx.fill();
        }
      } else if (biome === BIOMES.MAGMA) {
        // 焦黑碎石与一点余温
        ctx.fillStyle = 'rgba(69, 26, 3, 0.72)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 3.2, rng() * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(249, 115, 22, 0.35)';
        ctx.beginPath();
        ctx.arc(1.4, -0.8, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (biome === BIOMES.TUNDRA) {
        // 雪堆与冰刺
        ctx.fillStyle = 'rgba(186, 230, 253, 0.34)';
        ctx.beginPath();
        ctx.ellipse(0, 1, 6, 2.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(224, 242, 254, 0.5)';
        ctx.beginPath();
        ctx.moveTo(-2, 1);
        ctx.lineTo(0, -6);
        ctx.lineTo(2, 1);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  /**
   * Generate background stars for night time
   */
  _generateStars(count) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        size: 0.8 + Math.random() * 2.2,
        twinkleSpeed: 1.5 + Math.random() * 3.5,
        twinklePhase: Math.random() * Math.PI * 2,
        color: ['#ffffff', '#bae6fd', '#fef08a', '#e9d5ff', '#a7f3d0'][Math.floor(Math.random() * 5)]
      });
    }
    return stars;
  }

  /**
   * Update Day/Night cycle & ambient timers
   */
  update(dt) {
    this.animTime += dt;

    if (!this.isTimePaused) {
      // nightLength > 1 的星球夜里走得更慢，等于夜晚更长
      const isNight = this.timeOfDay >= 0.62;
      // omenNightScale 是当日异象的夜长修正，和星球本身的夜长叠乘
      const pace = isNight ? 1 / ((this.nightLength || 1) * (this.omenNightScale || 1)) : 1;
      const prev = this.timeOfDay;
      this.timeOfDay = (prev + (dt / this.dayDuration) * this.timeSpeed * pace) % 1.0;
      // 绕回 0 说明跨过了一个昼夜，累加给上层去推进宇宙日
      if (this.timeOfDay < prev) this.dayRollover = (this.dayRollover || 0) + 1;
    }
  }

  /** 取走累积的跨日次数，调用后清零。 */
  consumeDayRollover() {
    const n = this.dayRollover || 0;
    this.dayRollover = 0;
    return n;
  }

  /**
   * Get current phase of day
   */
  getTimePhase() {
    // 0.0 - 0.15: Dawn
    // 0.15 - 0.55: Day
    // 0.55 - 0.70: Dusk
    // 0.70 - 1.0: Night
    if (this.timeOfDay < 0.15) return TIME_PHASES.DAWN;
    if (this.timeOfDay < 0.55) return TIME_PHASES.DAY;
    if (this.timeOfDay < 0.70) return TIME_PHASES.DUSK;
    return TIME_PHASES.NIGHT;
  }

  /**
   * Get formatted in-game clock (HH:MM)
   */
  getClockString() {
    // 0.0 = 06:00, 0.25 = 12:00, 0.5 = 18:00, 0.75 = 00:00
    const totalMinutes = Math.floor(((this.timeOfDay * 24 + 6) % 24) * 60);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Calculate ambient sky overlay color and darkness factor (0 = bright daylight, 1 = darkest night)
   */
  getAmbientLighting() {
    const t = this.timeOfDay;
    let darkness = 0;
    let r = 255, g = 255, b = 255;

    if (t >= 0.0 && t < 0.15) {
      // Dawn (Sunrise: Deep Indigo transitioning to Golden Orange & Daylight)
      const p = t / 0.15;
      darkness = 0.75 * (1 - p);
      r = Math.round(180 + p * 75);
      g = Math.round(120 + p * 135);
      b = Math.round(200 + p * 55);
    } else if (t >= 0.15 && t < 0.55) {
      // Day (Clear bright sunlight)
      darkness = 0.0;
      r = 255; g = 255; b = 255;
    } else if (t >= 0.55 && t < 0.70) {
      // Dusk (Golden Sunset to Violet Twilight)
      const p = (t - 0.55) / 0.15;
      darkness = 0.75 * p;
      r = Math.round(255 - p * 160);
      g = Math.round(180 - p * 130);
      b = Math.round(120 + p * 100);
    } else {
      // Night (Deep Indigo / Midnight darkness)
      const p = (t - 0.70) / 0.30;
      // Darkest around 0.85 (Midnight)
      const nightCurve = Math.sin(p * Math.PI);
      darkness = 0.75 + nightCurve * 0.15; // Max 0.90 darkness
      r = 15; g = 18; b = 40;
    }

    return {
      darkness,
      r, g, b,
      colorString: `rgba(${r}, ${g}, ${b}, ${darkness})`
    };
  }

  /**
   * Collision check for circular entity {x, y, radius}
   * Returns true if blocked, or returns the colliding obstacle object.
   */
  checkCollision(x, y, radius = 16) {
    for (const obs of this.obstacles) {
      if (obs.shape === 'circle') {
        const dx = x - obs.x;
        const dy = y - obs.y;
        const dist = Math.hypot(dx, dy);
        if (dist < radius + obs.radius) {
          return obs;
        }
      } else if (obs.shape === 'rect') {
        const halfW = obs.width / 2;
        const halfH = obs.height / 2;
        const nearestX = Math.max(obs.x - halfW, Math.min(x, obs.x + halfW));
        const nearestY = Math.max(obs.y - halfH, Math.min(y, obs.y + halfH));
        const dx = x - nearestX;
        const dy = y - nearestY;
        if (Math.hypot(dx, dy) < radius) {
          return obs;
        }
      }
    }
    return null;
  }

  /**
   * Fast boolean check if coordinate is blocked
   */
  isBlocked(x, y, radius = 16) {
    return this.checkCollision(x, y, radius) !== null;
  }

  /**
   * Resolve entity movement and prevent walking into obstacles
   * Returns corrected {x, y}
   */
  resolveCollision(oldX, oldY, newX, newY, radius = 16) {
    // Check X axis movement
    let targetX = newX;
    let targetY = oldY;
    if (this.isBlocked(targetX, targetY, radius)) {
      targetX = oldX;
    }

    // Check Y axis movement
    targetY = newY;
    if (this.isBlocked(targetX, targetY, radius)) {
      targetY = oldY;
    }

    // World bounds clamp
    const margin = radius + 20;
    targetX = Math.max(margin, Math.min(this.width - margin, targetX));
    targetY = Math.max(margin, Math.min(this.height - margin, targetY));

    return { x: targetX, y: targetY };
  }

  /**
   * Line of sight raycasting check
   */
  hasLineOfSight(x1, y1, x2, y2) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.ceil(dist / 20);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const rx = x1 + (x2 - x1) * t;
      const ry = y1 + (y2 - y1) * t;
      if (this.isBlocked(rx, ry, 10)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Render the world map background chunks in viewport
   */
    /**
   * Complete map render (Background + Obstacles)
   */
  render(ctx, camera) {
    this.renderBackground(ctx, camera);
    this.renderObstacles(ctx, camera);
  }

  getTimeString() {
    const phaseNames = {
      dawn: "黎明 (Dawn)",
      day: "白昼 (Day)",
      dusk: "黄昏 (Dusk)",
      night: "深夜 (Night)"
    };
    const phase = this.getTimePhase();
    return `${phaseNames[phase] || phase} ${this.getClockString()}`;
  }

  renderBackground(ctx, camera) {
    const viewLeft = camera.x;
    const viewTop = camera.y;
    const viewRight = camera.x + camera.viewportWidth;
    const viewBottom = camera.y + camera.viewportHeight;

    // 1. 视野内的区块：没烘焙过的现场烘焙，之后一直用缓存
    const focusX = camera.x + camera.viewportWidth / 2;
    const focusY = camera.y + camera.viewportHeight / 2;
    let bakedThisFrame = 0;

    for (const chunk of this.chunks) {
      if (
        chunk.x + chunk.width >= viewLeft - 120 &&
        chunk.x <= viewRight + 120 &&
        chunk.y + chunk.height >= viewTop - 120 &&
        chunk.y <= viewBottom + 120
      ) {
        // 一帧最多补三块，快速穿图时不会卡出长帧
        if (!chunk.canvas && bakedThisFrame < 3) {
          this._bakeChunk(chunk);
          bakedThisFrame++;
        }
        if (chunk.canvas) {
          chunk.usedAt = this.animTime;
          ctx.drawImage(
            chunk.canvas,
            chunk.x - camera.x,
            chunk.y - camera.y
          );
        }
      }
    }

    // 2. 星球色调：整片地表压一层星球本身的颜色
    if (this.planetTint) {
      ctx.save();
      ctx.fillStyle = this.planetTint;
      ctx.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);
      ctx.restore();
    }

    // 3. Draw Central Camp Decals (Stone platform, safety runes)
    this._renderCampPlatform(ctx, camera);

    if (bakedThisFrame > 0) this._trimChunkCache(focusX, focusY);
  }

  /**
   * Render central camp ground hub
   */
  _renderCampPlatform(ctx, camera) {
    const cx = this.campPosition.x - camera.x;
    const cy = this.campPosition.y - camera.y;

    const safeR = this.campSafeRadius;

    // Soft camp light ground gradient
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, safeR);
    grad.addColorStop(0, 'rgba(251, 191, 36, 0.16)');
    grad.addColorStop(0.62, 'rgba(245, 158, 11, 0.07)');
    grad.addColorStop(1, 'rgba(245, 158, 11, 0)');
    ctx.save();
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, safeR, 0, Math.PI * 2);
    ctx.fill();

    // 安全区边界：异兽实际被挡住的那条线
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = -(this.animTime * 18) % 24;
    ctx.beginPath();
    ctx.arc(cx, cy, safeR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, safeR - 7, 0, Math.PI * 2);
    ctx.stroke();

    // Camp banner / welcome sign text
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('★ STARDUST BISTRO CAMP ★', cx, cy - 85);
    ctx.restore();
  }

  /**
   * Render map obstacles with detailed art, depth, and animated effects
   */
  renderObstacles(ctx, camera) {
    const viewLeft = camera.x - 100;
    const viewTop = camera.y - 100;
    const viewRight = camera.x + camera.viewportWidth + 100;
    const viewBottom = camera.y + camera.viewportHeight + 100;

    // Sort obstacles by Y for isometric 2.5D depth
    const visible = this.obstacles.filter(obs => {
      if (obs.shape === 'circle') {
        return obs.x + obs.radius >= viewLeft && obs.x - obs.radius <= viewRight &&
               obs.y + obs.radius >= viewTop && obs.y - obs.radius <= viewBottom;
      } else {
        const hw = obs.width / 2;
        const hh = obs.height / 2;
        return obs.x + hw >= viewLeft && obs.x - hw <= viewRight &&
               obs.y + hh >= viewTop && obs.y - hh <= viewBottom;
      }
    });

    visible.sort((a, b) => a.y - b.y);

    for (const obs of visible) {
      const rx = obs.x - camera.x;
      const ry = obs.y - camera.y;

      ctx.save();
      if (obs.type === 'mushroom_tree') {
        this._drawMushroomTree(ctx, rx, ry, obs.radius);
      } else if (obs.type === 'moss_rock') {
        this._drawMossRock(ctx, rx, ry, obs.radius, obs);
      } else if (obs.type === 'crystal_spire') {
        this._drawCrystalSpire(ctx, rx, ry, obs.radius);
      } else if (obs.type === 'magnetic_ridge') {
        this._drawMagneticRidge(ctx, rx, ry, obs.width, obs.height);
      } else if (obs.type === 'lava_pool') {
        this._drawLavaPool(ctx, rx, ry, obs.radius, obs);
      } else if (obs.type === 'basalt_rock') {
        this._drawBasaltRock(ctx, rx, ry, obs.radius, obs);
      } else if (obs.type === 'obsidian_pillar') {
        this._drawObsidianPillar(ctx, rx, ry, obs.width, obs.height);
      } else if (obs.type === 'cryo_geyser') {
        this._drawCryoGeyser(ctx, rx, ry, obs.radius, obs);
      } else if (obs.type === 'ice_boulder') {
        this._drawIceBoulder(ctx, rx, ry, obs.radius, obs);
      } else if (obs.type === 'frost_ridge') {
        this._drawFrostRidge(ctx, rx, ry, obs.width, obs.height);
      } else if (obs.type === 'ember_vent') {
        this._drawEmberVent(ctx, rx, ry, obs);
      } else if (obs.type === 'void_spire') {
        this._drawVoidSpire(ctx, rx, ry, obs);
      } else if (obs.type === 'campfire_base') {
        this._drawCampfire(ctx, rx, ry, obs.radius);
      } else if (obs.type === 'camp_stove') {
        this._drawCampStove(ctx, rx, ry, obs.width, obs.height);
      } else if (obs.type === 'camp_crate') {
        this._drawCampCrates(ctx, rx, ry, obs.width, obs.height);
      } else if (obs.type === 'camp_jukebox') {
        this._drawCampJukebox(ctx, rx, ry, obs.width, obs.height);
      } else if (obs.type === 'camp_workbench') {
        this._drawCampWorkbench(ctx, rx, ry, obs.width, obs.height);
      } else if (obs.type === 'camp_board') {
        this._drawCampBoard(ctx, rx, ry, obs.width, obs.height);
      } else if (obs.type === 'camp_armory') {
        this._drawCampArmory(ctx, rx, ry, obs.width, obs.height);
      } else if (obs.type === 'camp_gallery') {
        this._drawCampGallery(ctx, rx, ry, obs.width, obs.height);
      } else if (obs.type === 'camp_tent') {
        this._drawCampTent(ctx, rx, ry, obs.width, obs.height);
      } else if (obs.type === 'boundary') {
        // Boundary wall
        ctx.fillStyle = '#0f0f18';
        ctx.fillRect(rx - obs.width / 2, ry - obs.height / 2, obs.width, obs.height);
        ctx.strokeStyle = '#312e81';
        ctx.lineWidth = 2;
        ctx.strokeRect(rx - obs.width / 2, ry - obs.height / 2, obs.width, obs.height);
      }

      if (obs.destructible) this._drawRubbleState(ctx, rx, ry, obs);
      ctx.restore();
    }
  }

  /**
   * 可破坏障碍的状态叠加：常态一圈虚线提示能打，受损后加裂纹与血条。
   */
  _drawRubbleState(ctx, rx, ry, obs) {
    const reach = obs.shape === 'circle' ? obs.radius : Math.max(obs.width, obs.height) / 2;
    const hurt = obs.hp < obs.maxHp;

    if (obs.hitFlash > 0) {
      obs.hitFlash = Math.max(0, obs.hitFlash - 0.016);
      ctx.globalAlpha = Math.min(0.75, obs.hitFlash * 3.6);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(rx, ry, reach * 1.05, reach * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 常态提示：一圈很淡的破碎标记
    ctx.strokeStyle = hurt ? 'rgba(251, 191, 36, 0.7)' : 'rgba(226, 232, 240, 0.2)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.ellipse(rx, ry + reach * 0.5, reach * 0.9, reach * 0.34, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    if (!hurt) return;

    // 裂纹
    ctx.strokeStyle = 'rgba(15, 23, 30, 0.75)';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(rx - reach * 0.5, ry - reach * 0.3);
    ctx.lineTo(rx - reach * 0.1, ry + reach * 0.1);
    ctx.lineTo(rx + reach * 0.35, ry - reach * 0.15);
    ctx.stroke();

    // 头顶血条
    const pct = Math.max(0, obs.hp / obs.maxHp);
    const bw = reach * 1.5;
    const by = ry - reach - 12;
    ctx.fillStyle = 'rgba(6, 14, 20, 0.85)';
    ctx.fillRect(rx - bw / 2, by, bw, 4);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(rx - bw / 2, by, bw * pct, 4);
  }

  // --- Specific Obstacle Renderers ---

  _drawMushroomTree(ctx, x, y, radius) {
    const pulse = Math.sin(this.animTime * 2 + x * 0.1) * 0.1 + 1.0;
    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, radius * 1.1, radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stem
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x - 8, y - radius * 0.6, 16, radius * 0.8);

    // Glowing Cap
    const capRadius = radius * pulse;
    const grad = ctx.createRadialGradient(x, y - radius * 0.6, 5, x, y - radius * 0.6, capRadius);
    grad.addColorStop(0, '#a7f3d0');
    grad.addColorStop(0.5, '#06d6a0');
    grad.addColorStop(1, '#065f46');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y - radius * 0.6, capRadius, Math.PI, 0);
    ctx.closePath();
    ctx.fill();

    // Spore dots
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x - capRadius * 0.4, y - radius * 0.8, 3, 0, Math.PI * 2);
    ctx.arc(x + capRadius * 0.3, y - radius * 0.9, 4, 0, Math.PI * 2);
    ctx.arc(x, y - radius * 1.1, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * 按障碍的世界坐标派生一组固定的多面体顶点，缓存在障碍上。
   * 用世界坐标做种子，石头的形状才不会随镜头移动而变化。
   */
  _boulderShape(obs, radius) {
    if (obs._boulder) return obs._boulder;

    let seed = Math.imul(Math.round(obs.x) | 0, 374761393)
      ^ Math.imul(Math.round(obs.y) | 0, 668265263);
    const rand = () => {
      seed = Math.imul(seed ^ (seed >>> 13), 1274126177);
      return ((seed ^ (seed >>> 16)) >>> 0) / 4294967296;
    };

    const sides = 7 + Math.floor(rand() * 3);
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + rand() * 0.22;
      const r = radius * (0.78 + rand() * 0.3);
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.86 });
    }
    obs._boulder = pts;
    return pts;
  }

  /**
   * 多面体巨砾：底面阴影 + 主体渐变 + 受光顶面 + 轮廓。
   */
  _drawBoulder(ctx, x, y, radius, pts, colors) {
    ctx.save();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
    ctx.beginPath();
    ctx.ellipse(x, y + radius * 0.42, radius * 1.02, radius * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    const path = new Path2D();
    pts.forEach((p, i) => {
      if (i === 0) path.moveTo(x + p.x, y + p.y);
      else path.lineTo(x + p.x, y + p.y);
    });
    path.closePath();

    const grad = ctx.createLinearGradient(x, y - radius, x, y + radius);
    grad.addColorStop(0, colors.light);
    grad.addColorStop(0.55, colors.mid);
    grad.addColorStop(1, colors.dark);
    ctx.fillStyle = grad;
    ctx.fill(path);

    // 受光的上半面，切出岩石的体积感
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = colors.facet;
    ctx.beginPath();
    ctx.moveTo(x - radius, y - radius * 0.16);
    ctx.lineTo(x - radius * 0.28, y - radius * 0.72);
    ctx.lineTo(x + radius * 0.42, y - radius * 0.5);
    ctx.lineTo(x + radius, y - radius * 0.05);
    ctx.lineTo(x + radius, y - radius);
    ctx.lineTo(x - radius, y - radius);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = colors.edge;
    ctx.lineWidth = 1.5;
    ctx.stroke(path);

    ctx.restore();
  }

  _drawMossRock(ctx, x, y, radius, obs) {
    const pts = this._boulderShape(obs, radius);
    this._drawBoulder(ctx, x, y, radius, pts, {
      light: '#5b7183', mid: '#3b4c5c', dark: '#212d38',
      facet: 'rgba(160, 190, 205, 0.14)', edge: 'rgba(14, 24, 32, 0.85)'
    });

    // 顶面苔藓
    ctx.save();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.85)';
    ctx.beginPath();
    ctx.ellipse(x - radius * 0.16, y - radius * 0.42, radius * 0.52, radius * 0.26, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(52, 211, 153, 0.7)';
    ctx.beginPath();
    ctx.ellipse(x + radius * 0.3, y - radius * 0.24, radius * 0.24, radius * 0.14, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // 荧光孢子点
    ctx.fillStyle = 'rgba(167, 243, 208, 0.9)';
    ctx.beginPath();
    ctx.arc(x - radius * 0.3, y - radius * 0.46, 1.8, 0, Math.PI * 2);
    ctx.arc(x + radius * 0.1, y - radius * 0.56, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawCrystalSpire(ctx, x, y, radius) {
    const shine = Math.sin(this.animTime * 3 + y * 0.08) * 0.2 + 0.8;
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(x, y + 8, radius * 0.9, radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crystal Spire polygon
    const height = radius * 2.2;
    ctx.beginPath();
    ctx.moveTo(x, y - height);
    ctx.lineTo(x + radius * 0.8, y);
    ctx.lineTo(x, y + radius * 0.3);
    ctx.lineTo(x - radius * 0.8, y);
    ctx.closePath();

    const grad = ctx.createLinearGradient(x - radius, y - height, x + radius, y);
    grad.addColorStop(0, `rgba(244, 114, 182, ${shine})`);
    grad.addColorStop(0.5, '#c084fc');
    grad.addColorStop(1, '#6b21a8');
    ctx.fillStyle = grad;
    ctx.fill();

    // Facet highlights
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - height);
    ctx.lineTo(x, y + radius * 0.3);
    ctx.stroke();
  }

  /** 磁脊：一列从地里斜插出来的磁石片，缝隙间有电弧游走。 */
  _drawMagneticRidge(ctx, x, y, width, height) {
    const hw = width / 2;
    const hh = height / 2;
    const blades = Math.max(3, Math.round(width / 14));

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(x + 3, y + hh * 0.7, hw * 1.02, hh * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < blades; i++) {
      const t = i / (blades - 1);
      const bx = x - hw + t * width;
      const lean = (t - 0.5) * 0.5;
      const h = hh * (1.5 + Math.sin(i * 2.1) * 0.5);

      const grad = ctx.createLinearGradient(bx, y - h, bx, y + hh * 0.6);
      grad.addColorStop(0, '#c084fc');
      grad.addColorStop(0.45, '#6d28d9');
      grad.addColorStop(1, '#2e1065');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#1a0733';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(bx + lean * 12, y - h);
      ctx.lineTo(bx + 6, y + hh * 0.55);
      ctx.lineTo(bx - 6, y + hh * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 沿脊线跳动的电弧
    const arc = (Math.sin(this.animTime * 4 + x * 0.03) + 1) * 0.5;
    ctx.strokeStyle = `rgba(232, 121, 249, ${0.3 + arc * 0.55})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i <= blades; i++) {
      const bx = x - hw + (i / blades) * width;
      const by = y - hh * (0.9 + (i % 2) * 0.7);
      if (i === 0) ctx.moveTo(bx, by);
      else ctx.lineTo(bx, by);
    }
    ctx.stroke();
    ctx.restore();
  }

  _drawLavaPool(ctx, x, y, radius, obs) {
    // 冷却熔岩堆成的隆起外沿，让它读起来是"挡路的坑"而不是地上的光斑
    const pts = obs ? this._boulderShape(obs, radius * 1.14) : null;
    ctx.save();
    if (pts) {
      const rim = new Path2D();
      pts.forEach((p, i) => {
        if (i === 0) rim.moveTo(x + p.x, y + p.y * 1.1);
        else rim.lineTo(x + p.x, y + p.y * 1.1);
      });
      rim.closePath();
      const rimGrad = ctx.createLinearGradient(x, y - radius, x, y + radius);
      rimGrad.addColorStop(0, '#4b3a30');
      rimGrad.addColorStop(0.5, '#2b211c');
      rimGrad.addColorStop(1, '#140e0b');
      ctx.fillStyle = rimGrad;
      ctx.fill(rim);
      ctx.strokeStyle = 'rgba(255, 140, 60, 0.35)';
      ctx.lineWidth = 1.6;
      ctx.stroke(rim);
    } else {
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.arc(x, y, radius + 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 内凹的熔融面
    const pulse = Math.sin(this.animTime * 2.5 + x * 0.1) * 2;
    const inner = radius * 0.74 + pulse;
    const grad = ctx.createRadialGradient(x, y - inner * 0.2, 4, x, y, inner);
    grad.addColorStop(0, '#fff3b0');
    grad.addColorStop(0.35, '#f97316');
    grad.addColorStop(0.75, '#c2410c');
    grad.addColorStop(1, '#5e1a12');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, inner, inner * 0.88, 0, 0, Math.PI * 2);
    ctx.fill();

    // 熔浆结壳的暗色浮块
    ctx.fillStyle = 'rgba(28, 18, 14, 0.62)';
    ctx.beginPath();
    ctx.ellipse(x - inner * 0.3, y + inner * 0.16, inner * 0.28, inner * 0.14,
      Math.sin(this.animTime * 0.5 + x) * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Bubbles
    const bubblePhase = (this.animTime * 2 + x) % (Math.PI * 2);
    const bx = x + Math.cos(bubblePhase) * (inner * 0.45);
    const by = y + Math.sin(bubblePhase * 1.5) * (inner * 0.4);
    ctx.fillStyle = 'rgba(255, 240, 190, 0.9)';
    ctx.beginPath();
    ctx.arc(bx, by, 2.4 + Math.sin(bubblePhase) * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawBasaltRock(ctx, x, y, radius, obs) {
    const pts = this._boulderShape(obs, radius);
    this._drawBoulder(ctx, x, y, radius, pts, {
      light: '#4a423d', mid: '#2f2926', dark: '#17130f',
      facet: 'rgba(255, 180, 120, 0.09)', edge: 'rgba(10, 7, 5, 0.9)'
    });

    // 岩缝里透出的熔光，随时间明灭
    const glow = 0.55 + Math.sin(this.animTime * 2.2 + obs.x * 0.05) * 0.28;
    ctx.save();
    ctx.strokeStyle = `rgba(249, 115, 22, ${glow})`;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(249, 115, 22, 0.8)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(x - radius * 0.55, y + radius * 0.12);
    ctx.lineTo(x - radius * 0.12, y - radius * 0.18);
    ctx.lineTo(x + radius * 0.2, y + radius * 0.04);
    ctx.lineTo(x + radius * 0.52, y - radius * 0.26);
    ctx.stroke();
    ctx.restore();
  }

  /** 黑曜石柱：三根高低不齐的黑玻璃棱柱，边缘反着一点熔光。 */
  _drawObsidianPillar(ctx, x, y, width, height) {
    const hw = width / 2;
    const hh = height / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.ellipse(x + 3, y + hh * 0.78, hw * 1.05, hh * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    const shards = [
      { ox: -0.52, h: 1.25, w: 0.3 },
      { ox: 0.05, h: 1.85, w: 0.38 },
      { ox: 0.56, h: 1.0, w: 0.26 }
    ];

    for (const sh of shards) {
      const bx = x + sh.ox * hw;
      const top = y - hh * sh.h;
      const bw = hw * sh.w;

      const grad = ctx.createLinearGradient(bx - bw, top, bx + bw, y + hh * 0.7);
      grad.addColorStop(0, '#2a2a33');
      grad.addColorStop(0.35, '#101014');
      grad.addColorStop(1, '#050507');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(bx, top);
      ctx.lineTo(bx + bw, top + hh * 0.5);
      ctx.lineTo(bx + bw * 0.72, y + hh * 0.7);
      ctx.lineTo(bx - bw * 0.72, y + hh * 0.7);
      ctx.lineTo(bx - bw, top + hh * 0.5);
      ctx.closePath();
      ctx.fill();

      // 一道高光棱边
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.28)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(bx, top);
      ctx.lineTo(bx - bw * 0.5, y + hh * 0.6);
      ctx.stroke();

      // 底部反射的余温
      ctx.strokeStyle = 'rgba(249, 115, 22, 0.32)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(bx - bw * 0.68, y + hh * 0.66);
      ctx.lineTo(bx + bw * 0.68, y + hh * 0.66);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawCryoGeyser(ctx, x, y, radius, obs) {
    ctx.save();

    // 冰壳堆起的喷口外沿
    const pts = obs ? this._boulderShape(obs, radius * 1.1) : null;
    if (pts) {
      const rim = new Path2D();
      pts.forEach((p, i) => {
        if (i === 0) rim.moveTo(x + p.x, y + p.y * 1.08);
        else rim.lineTo(x + p.x, y + p.y * 1.08);
      });
      rim.closePath();
      const rimGrad = ctx.createLinearGradient(x, y - radius, x, y + radius);
      rimGrad.addColorStop(0, '#cfe9f7');
      rimGrad.addColorStop(0.55, '#7fb4d0');
      rimGrad.addColorStop(1, '#2c5f7d');
      ctx.fillStyle = rimGrad;
      ctx.fill(rim);
      ctx.strokeStyle = 'rgba(224, 242, 254, 0.55)';
      ctx.lineWidth = 1.4;
      ctx.stroke(rim);
    }

    // 喷口内部的深色井
    ctx.fillStyle = '#0b2233';
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 0.52, radius * 0.44, 0, 0, Math.PI * 2);
    ctx.fill();
    const core = ctx.createRadialGradient(x, y, 1, x, y, radius * 0.5);
    core.addColorStop(0, 'rgba(186, 230, 253, 0.95)');
    core.addColorStop(1, 'rgba(56, 189, 248, 0.15)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.ellipse(x, y, radius * 0.48, radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 上升的寒气环
    const steamRadius = ((this.animTime * 20) % (radius * 1.5));
    const alpha = 1 - steamRadius / (radius * 1.5);
    ctx.strokeStyle = `rgba(224, 242, 254, ${alpha * 0.55})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(x, y - steamRadius * 0.35, steamRadius, steamRadius * 0.42, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  _drawIceBoulder(ctx, x, y, radius, obs) {
    const pts = this._boulderShape(obs, radius);
    this._drawBoulder(ctx, x, y, radius, pts, {
      light: '#dff1fb', mid: '#8ec9e6', dark: '#2f7ca8',
      facet: 'rgba(255, 255, 255, 0.34)', edge: 'rgba(24, 74, 105, 0.75)'
    });

    // 冰体内部的裂面与高光
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - radius * 0.42, y + radius * 0.3);
    ctx.lineTo(x - radius * 0.06, y - radius * 0.3);
    ctx.lineTo(x + radius * 0.38, y + radius * 0.16);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.beginPath();
    ctx.ellipse(x - radius * 0.3, y - radius * 0.42, radius * 0.2, radius * 0.09, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** 霜脊：一排高低错落的冰刺，从半透明的雪堆里长出来。 */
  _drawFrostRidge(ctx, x, y, width, height) {
    const hw = width / 2;
    const hh = height / 2;
    const spikes = Math.max(4, Math.round(width / 12));

    ctx.save();
    // 底下的雪堆
    ctx.fillStyle = 'rgba(191, 219, 254, 0.22)';
    ctx.beginPath();
    ctx.ellipse(x, y + hh * 0.6, hw * 1.05, hh * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < spikes; i++) {
      const t = i / (spikes - 1);
      const bx = x - hw + t * width;
      const h = hh * (1.3 + Math.abs(Math.sin(i * 1.7)) * 1.1);
      const bw = hw * 0.13;

      const grad = ctx.createLinearGradient(bx, y - h, bx, y + hh * 0.5);
      grad.addColorStop(0, '#f0f9ff');
      grad.addColorStop(0.5, '#7dd3fc');
      grad.addColorStop(1, '#0c4a6e');
      ctx.fillStyle = grad;
      ctx.strokeStyle = 'rgba(8, 47, 73, 0.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(bx, y - h);
      ctx.lineTo(bx + bw, y + hh * 0.5);
      ctx.lineTo(bx - bw, y + hh * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawCampfire(ctx, x, y, radius) {
    const campImg = assets.getImage("camp_pot");
    if (campImg) {
      const potW = radius * 2.8;
      const potH = radius * 2.8;
      ctx.drawImage(campImg, x - potW / 2, y - potH / 2, potW, potH);
      return;
    }
    // Stone ring
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Animated Fire
    const flicker = Math.sin(this.animTime * 15) * 4;
    const fireRadius = radius * 0.6 + flicker;
    const grad = ctx.createRadialGradient(x, y, 2, x, y - 6, fireRadius);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, '#fef08a');
    grad.addColorStop(0.6, '#f97316');
    grad.addColorStop(1, 'rgba(220, 38, 38, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y - 6, fireRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawCampStove(ctx, x, y, width, height) {
    const hw = width / 2;
    const hh = height / 2;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x - hw, y - hh, width, height);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - hw, y - hh, width, height);

    // Grill bars
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    for (let gx = x - hw + 8; gx < x + hw - 4; gx += 10) {
      ctx.beginPath();
      ctx.moveTo(gx, y - hh + 4);
      ctx.lineTo(gx, y + hh - 4);
      ctx.stroke();
    }

    drawCampGlyph(ctx, 'stove', x, y, 16, '#fef3c7');
  }

  _drawCampCrates(ctx, x, y, width, height) {
    const hw = width / 2;
    const hh = height / 2;
    ctx.fillStyle = '#78350f';
    ctx.fillRect(x - hw, y - hh, width, height);
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - hw, y - hh, width, height);
    drawCampGlyph(ctx, 'crate', x, y, 16, '#fef3c7');
  }

  _drawCampJukebox(ctx, x, y, width, height) {
    const hw = width / 2;
    const hh = height / 2;
    ctx.fillStyle = '#4c1d95';
    ctx.fillRect(x - hw, y - hh, width, height);
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - hw, y - hh, width, height);
    drawCampGlyph(ctx, 'radio', x, y, 16, '#e9d5ff');
  }

  _drawCampWorkbench(ctx, x, y, width, height) {
    const hw = width / 2;
    const hh = height / 2;
    ctx.fillStyle = '#0f2436';
    ctx.fillRect(x - hw, y - hh, width, height);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - hw, y - hh, width, height);

    // 台面上的工具槽
    ctx.fillStyle = 'rgba(56, 189, 248, 0.18)';
    ctx.fillRect(x - hw + 5, y - hh + 5, width - 10, 8);

    // 敲击时溅出的火星
    const spark = (Math.sin(this.animTime * 3.4) + 1) * 0.5;
    if (spark > 0.72) {
      ctx.fillStyle = `rgba(253, 224, 71, ${(spark - 0.72) * 3})`;
      ctx.beginPath();
      ctx.arc(x + hw - 12, y - hh + 6, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    drawCampGlyph(ctx, 'anvil', x, y + 4, 16, '#bae6fd');
  }

  _drawCampBoard(ctx, x, y, width, height) {
    const hw = width / 2;
    const hh = height / 2;

    // 支撑木桩
    ctx.fillStyle = '#4b2e11';
    ctx.fillRect(x - 4, y + hh - 6, 8, 12);

    ctx.fillStyle = '#3b2a17';
    ctx.fillRect(x - hw, y - hh, width, height);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - hw, y - hh, width, height);

    // 钉在板上的悬赏纸
    ctx.fillStyle = '#e7dcc4';
    ctx.fillRect(x - hw + 6, y - hh + 6, width - 20, height - 22);
    ctx.fillStyle = '#8b6b3d';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x - hw + 10, y - hh + 13 + i * 6, width - 30, 2);
    }
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(x - hw + 6 + (width - 20) / 2, y - hh + 9, 2.5, 0, Math.PI * 2);
    ctx.fill();

    drawCampGlyph(ctx, 'board', x + hw - 9, y + hh - 10, 12, '#fde68a');
  }

  _drawCampGallery(ctx, x, y, width, height) {
    const hw = width / 2;
    const hh = height / 2;

    ctx.fillStyle = '#2a1030';
    ctx.fillRect(x - 4, y + hh - 6, 8, 12);

    ctx.fillStyle = '#1c1024';
    ctx.fillRect(x - hw, y - hh, width, height);
    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - hw, y - hh, width, height);

    // 相框内容：贴上的招牌菜照片，没有就留空框
    const inner = { x: x - hw + 5, y: y - hh + 5, w: width - 10, h: height - 18 };
    const shot = this.pinnedDish;
    if (shot && shot.complete !== false && (shot.naturalWidth || shot.width)) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(inner.x, inner.y, inner.w, inner.h);
      ctx.clip();
      ctx.drawImage(shot, inner.x, inner.y, inner.w, inner.h);
      ctx.restore();
      ctx.strokeStyle = 'rgba(244, 114, 182, 0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(inner.x, inner.y, inner.w, inner.h);
    } else {
      ctx.fillStyle = 'rgba(244, 114, 182, 0.12)';
      ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
      ctx.strokeStyle = 'rgba(244, 114, 182, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(inner.x, inner.y, inner.w, inner.h);
      ctx.setLineDash([]);
    }

    drawCampGlyph(ctx, 'camera', x, y + hh - 8, 13, '#fbcfe8');
  }

  /** 熔火喷气孔：熔核带专属，裂口里持续喷出火星。 */
  _drawEmberVent(ctx, x, y, obs) {
    const r = obs.radius;
    const t = this.animTime * 1.6 + (obs.phase || 0);
    const pulse = 0.5 + Math.sin(t * 2.2) * 0.5;

    // 外围的焦黑土堆
    ctx.fillStyle = '#1c0f07';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.2, r, r * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3b1d09';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 内壁的赤热渐层
    const glow = ctx.createRadialGradient(x, y, 2, x, y, r * 0.72);
    glow.addColorStop(0, `rgba(255, 244, 214, ${0.75 + pulse * 0.25})`);
    glow.addColorStop(0.4, 'rgba(251, 146, 60, 0.85)');
    glow.addColorStop(1, 'rgba(120, 30, 4, 0.2)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.1, r * 0.6, r * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    // 上升的火星
    for (let i = 0; i < 6; i++) {
      const p = ((t * 0.5 + i / 6) % 1);
      const ex = x + Math.sin(t * 2 + i * 2.1) * r * 0.42;
      const ey = y - p * r * 2.4;
      ctx.globalAlpha = (1 - p) * 0.85;
      ctx.fillStyle = i % 2 ? '#fde68a' : '#fb923c';
      ctx.beginPath();
      ctx.arc(ex, ey, 2.4 * (1 - p * 0.55), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 三块翘起的岩板
    ctx.fillStyle = '#2a1509';
    ctx.strokeStyle = '#0f0703';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.6;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.4 + r * 0.2);
      ctx.lineTo(x + Math.cos(a) * r * 1.05, y + Math.sin(a) * r * 0.6 - r * 0.3);
      ctx.lineTo(x + Math.cos(a + 0.5) * r * 0.95, y + Math.sin(a + 0.5) * r * 0.55 + r * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  /** 虚空尖碑：冰晶环带专属，黑色方尖碑中间裂开一道紫缝。 */
  _drawVoidSpire(ctx, x, y, obs) {
    const r = obs.radius;
    const t = this.animTime * 1.1 + (obs.phase || 0);
    const pulse = 0.5 + Math.sin(t * 1.8) * 0.5;
    const top = y - r * 2.0;

    // 地面的霜环
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.3)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.42, r * 1.05, r * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();

    // 碑体
    const body = ctx.createLinearGradient(x - r * 0.5, 0, x + r * 0.5, 0);
    body.addColorStop(0, '#0a0713');
    body.addColorStop(0.45, '#221a38');
    body.addColorStop(1, '#070510');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + r * 0.46, top + r * 0.5);
    ctx.lineTo(x + r * 0.34, y + r * 0.4);
    ctx.lineTo(x - r * 0.34, y + r * 0.4);
    ctx.lineTo(x - r * 0.46, top + r * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.5)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // 中缝：随呼吸明灭的紫光
    ctx.strokeStyle = `rgba(196, 181, 253, ${0.4 + pulse * 0.6})`;
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, top + r * 0.4);
    ctx.lineTo(x + r * 0.08, y - r * 0.5);
    ctx.lineTo(x - r * 0.06, y + r * 0.2);
    ctx.stroke();

    // 悬浮的碎块
    ctx.fillStyle = `rgba(167, 139, 250, ${0.5 + pulse * 0.3})`;
    for (let i = 0; i < 3; i++) {
      const a = t * 0.8 + (i / 3) * Math.PI * 2;
      const ox = x + Math.cos(a) * r * 0.9;
      const oy = top + r * 0.7 + Math.sin(a) * r * 0.26;
      ctx.beginPath();
      ctx.moveTo(ox, oy - 4);
      ctx.lineTo(ox + 3.4, oy);
      ctx.lineTo(ox, oy + 4);
      ctx.lineTo(ox - 3.4, oy);
      ctx.closePath();
      ctx.fill();
    }
  }

  /** 军械商：一张摆着枪管与刀刃的货摊，头顶挂红布篷。 */
  _drawCampArmory(ctx, x, y, width, height) {
    const hw = width / 2;
    const hh = height / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(4, 10, 14, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x + 3, y + hh + 3, hw * 1.05, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 摊面
    const top = ctx.createLinearGradient(0, y - hh, 0, y + hh);
    top.addColorStop(0, '#3f2a20');
    top.addColorStop(1, '#1c120d');
    ctx.fillStyle = top;
    ctx.fillRect(x - hw, y - hh * 0.2, width, hh * 1.2);
    ctx.strokeStyle = '#0e0907';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - hw, y - hh * 0.2, width, hh * 1.2);

    // 红布篷：四道条纹
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.moveTo(x - hw - 6, y - hh * 0.2);
    ctx.lineTo(x - hw + 4, y - hh);
    ctx.lineTo(x + hw - 4, y - hh);
    ctx.lineTo(x + hw + 6, y - hh * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b91c1c';
    for (let i = 0; i < 3; i++) {
      const sx = x - hw + 6 + i * (width / 3);
      ctx.fillRect(sx, y - hh + 2, width / 6, hh * 0.78);
    }
    ctx.strokeStyle = '#450a0a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(x - hw - 6, y - hh * 0.2);
    ctx.lineTo(x + hw + 6, y - hh * 0.2);
    ctx.stroke();

    // 摊上立着的两支枪管与一把刀
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (const ox of [-hw * 0.5, -hw * 0.18]) {
      ctx.beginPath();
      ctx.moveTo(x + ox, y + hh * 0.7);
      ctx.lineTo(x + ox + 5, y - hh * 0.05);
      ctx.stroke();
    }
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.moveTo(x + hw * 0.42, y + hh * 0.72);
    ctx.lineTo(x + hw * 0.56, y - hh * 0.1);
    ctx.lineTo(x + hw * 0.64, y + hh * 0.72);
    ctx.closePath();
    ctx.fill();

    drawCampGlyph(ctx, 'anvil', x, y + hh * 0.42, 13, '#fca5a5');
    ctx.restore();
  }

  _drawCampTent(ctx, x, y, width, height) {
    const hw = width / 2;
    const hh = height / 2;
    const theme = this.rosterColor || '#34d399';
    const ridgeY = y - hh;
    const baseY = y + hh;
    const depth = 16;

    // 地面投影
    ctx.fillStyle = 'rgba(4, 10, 9, 0.45)';
    ctx.beginPath();
    ctx.ellipse(x + 4, baseY + 3, hw + 8, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // 背侧的斜面，让帐篷有厚度
    ctx.fillStyle = '#0a1614';
    ctx.beginPath();
    ctx.moveTo(x, ridgeY);
    ctx.lineTo(x + depth, ridgeY - 4);
    ctx.lineTo(x + hw + depth, baseY - 6);
    ctx.lineTo(x + hw, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(90, 122, 114, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 正面篷布，从脊线向下渐暗
    const cloth = ctx.createLinearGradient(x, ridgeY, x, baseY);
    cloth.addColorStop(0, '#1d332e');
    cloth.addColorStop(1, '#0c1a17');
    ctx.fillStyle = cloth;
    ctx.beginPath();
    ctx.moveTo(x, ridgeY);
    ctx.lineTo(x + hw, baseY);
    ctx.lineTo(x - hw, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = theme;
    ctx.lineWidth = 2;
    ctx.stroke();

    // 门帘内透出的暖光
    const glow = ctx.createLinearGradient(x, ridgeY + 10, x, baseY);
    glow.addColorStop(0, 'rgba(255, 214, 150, 0.55)');
    glow.addColorStop(1, 'rgba(255, 168, 80, 0.12)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.moveTo(x, ridgeY + 9);
    ctx.lineTo(x + 12, baseY);
    ctx.lineTo(x - 12, baseY);
    ctx.closePath();
    ctx.fill();

    // 掀起的两片门帘
    ctx.fillStyle = '#162924';
    ctx.beginPath();
    ctx.moveTo(x - 12, baseY);
    ctx.lineTo(x - 2, ridgeY + 11);
    ctx.lineTo(x - 20, ridgeY + 26);
    ctx.lineTo(x - 24, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 12, baseY);
    ctx.lineTo(x + 2, ridgeY + 11);
    ctx.lineTo(x + 20, ridgeY + 26);
    ctx.lineTo(x + 24, baseY);
    ctx.closePath();
    ctx.fill();

    // 篷布上的两道缝线
    ctx.strokeStyle = 'rgba(120, 160, 150, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 6, ridgeY + 8);
    ctx.lineTo(x - hw + 6, baseY - 2);
    ctx.moveTo(x + 6, ridgeY + 8);
    ctx.lineTo(x + hw - 6, baseY - 2);
    ctx.stroke();

    // 顶上的队旗，颜色跟着当前主厨走
    ctx.strokeStyle = '#5b6a66';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, ridgeY);
    ctx.lineTo(x, ridgeY - 18);
    ctx.stroke();
    ctx.fillStyle = theme;
    ctx.beginPath();
    ctx.moveTo(x, ridgeY - 18);
    ctx.lineTo(x + 19, ridgeY - 12);
    ctx.lineTo(x, ridgeY - 6);
    ctx.closePath();
    ctx.fill();

    // 两侧拉绳与地钉
    ctx.strokeStyle = 'rgba(120, 150, 140, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - hw, baseY);
    ctx.lineTo(x - hw - 10, baseY + 5);
    ctx.moveTo(x + hw + depth, baseY - 6);
    ctx.lineTo(x + hw + depth + 9, baseY + 3);
    ctx.stroke();

    drawCampGlyph(ctx, 'tent', x, baseY - 13, 12, theme);
  }

  /**
   * Render Day/Night cycle lighting, stars, ambient shadow, and dynamic light holes
   */
  /**
   * 复用同一张离屏遮罩画布，仅在视口尺寸变化时重新分配。
   */
  _acquireLightMask(vw, vh) {
    if (typeof document === 'undefined') return null;
    if (!this._lightScratch) this._lightScratch = [];

    const w = Math.max(1, Math.ceil(vw));
    const h = Math.max(1, Math.ceil(vh));

    if (!this._lightMask) {
      this._lightMask = document.createElement('canvas');
      this._lightMaskCtx = null;
    }
    if (this._lightMask.width !== w || this._lightMask.height !== h) {
      this._lightMask.width = w;
      this._lightMask.height = h;
      this._lightMaskCtx = this._lightMask.getContext('2d');
    }
    if (!this._lightMaskCtx) {
      this._lightMaskCtx = this._lightMask.getContext('2d');
    }
    return this._lightMaskCtx ? this._lightMask : null;
  }

  renderLighting(ctx, camera, dynamicLights = []) {
    const ambient = this.getAmbientLighting();
    if (ambient.darkness <= 0.01) {
      return; // Fully bright daytime, skip overlay
    }

    const vw = camera.viewportWidth;
    const vh = camera.viewportHeight;

    // 1. Draw twinkling stars at night
    if (ambient.darkness > 0.35) {
      const starAlpha = (ambient.darkness - 0.35) / 0.65;
      ctx.save();
      for (const star of this.stars) {
        const sx = star.x - camera.x;
        const sy = star.y - camera.y;
        if (sx >= 0 && sx <= vw && sy >= 0 && sy <= vh) {
          const twinkle = Math.sin(this.animTime * star.twinkleSpeed + star.twinklePhase);
          const a = starAlpha * (0.4 + twinkle * 0.4);
          ctx.fillStyle = star.color;
          ctx.globalAlpha = Math.max(0, Math.min(1, a));
          ctx.beginPath();
          ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // 2. Render Darkness Mask using an offscreen canvas or 2D canvas blend mode
    ctx.save();
    // We use a darkness overlay with 'destination-out' to punch light holes
    const maskCanvas = this._acquireLightMask(vw, vh);
    if (!maskCanvas) {
      // Fallback simple dark tint
      ctx.fillStyle = ambient.colorString;
      ctx.fillRect(0, 0, vw, vh);
      ctx.restore();
      return;
    }

    const mctx = this._lightMaskCtx;
    const maskW = maskCanvas.width;
    const maskH = maskCanvas.height;

    // Fill mask with ambient darkness color
    mctx.globalCompositeOperation = 'source-over';
    mctx.clearRect(0, 0, maskW, maskH);
    mctx.fillStyle = ambient.colorString;
    mctx.fillRect(0, 0, maskW, maskH);

    // Prepare light sources list (static map lights + player/creature dynamic lights)
    const allLights = this._lightScratch;
    allLights.length = 0;
    for (const light of this.lightSources) allLights.push(light);
    for (const light of dynamicLights) allLights.push(light);

    // Punch out light circles using composite operation
    mctx.globalCompositeOperation = 'destination-out';

    for (const light of allLights) {
      const lx = light.x - camera.x;
      const ly = light.y - camera.y;
      const flicker = light.flicker ? Math.sin(this.animTime * 10 + light.x) * (light.radius * light.flicker) : 0;
      const r = Math.max(10, light.radius + flicker);

      // Check if light is in viewport
      if (lx + r >= 0 && lx - r <= vw && ly + r >= 0 && ly - r <= vh) {
        const grad = mctx.createRadialGradient(lx, ly, 0, lx, ly, r);
        grad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
        grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.75)');
        grad.addColorStop(0.85, 'rgba(0, 0, 0, 0.3)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

        mctx.fillStyle = grad;
        mctx.beginPath();
        mctx.arc(lx, ly, r, 0, Math.PI * 2);
        mctx.fill();
      }
    }

    // Draw the punched darkness mask onto the main screen
    ctx.drawImage(maskCanvas, 0, 0);

    // Add additive light warmth overlay for glowing colors
    ctx.globalCompositeOperation = 'lighter';
    for (const light of allLights) {
      const lx = light.x - camera.x;
      const ly = light.y - camera.y;
      const r = Math.max(10, light.radius * 0.7);

      if (lx + r >= 0 && lx - r <= vw && ly + r >= 0 && ly - r <= vh) {
        const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, r);
        grad.addColorStop(0, light.color || 'rgba(255, 200, 100, 0.3)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(lx, ly, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}
