/**
 * Galaxy Hunter: Gourmet Odyssey - World Spawner & Ecological Resources System
 * 
 * Features:
 * 1. Resource Node Spawner:
 *    - Harvestable flora, glowing mushrooms, crystal mineral veins across 4 biomes
 *    - Node hit feedback (shake wobble, debris sparks, health reduction)
 *    - Harvesting yields dynamic dropped loot items
 *    - Respawn timer system
 * 2. Dropped Loot Items on the Ground:
 *    - Floating sine hover animation + rarity aura shine
 *    - Magnetic pickup attraction toward player when nearby
 *    - Smooth acceleration & inventory integration callback
 *    - Pop particles & floating reward feedback
 */

import { BIOMES, makeRng } from './map.js';
import { particles } from './particles.js';
import { drawIngredientGlyph } from './glyphs.js';
import { getIngredientById } from '../systems/recipes.js';

/**
 * Resource Node Catalog
 */
export const NODE_TYPES = {
  // Bioluminescent Shroom Forest Nodes
  ZERO_G_MUSHROOM: {
    id: 'zero_g_mushroom_node',
    name: '零重力跳跳菇群',
    biome: BIOMES.FOREST,
    dropId: 'zero_g_mushroom',
    dropCount: [1, 3],
    maxHp: 3,
    color: '#06d6a0',
    icon: '🍄',
    radius: 20,
    respawnTime: 45
  },
  // --- 星球独占资源点，只在对应星球生成 ---
  HEPHAESTUS_HONEY: {
    id: 'hephaestus_honey_node',
    name: '熔心蜜结晶壁',
    biome: 'planet_only',
    dropId: 'hephaestus_core_honey',
    dropCount: [1, 2],
    maxHp: 6,
    color: '#fbbf24',
    icon: '🍯',
    radius: 23,
    respawnTime: 95
  },
  CETO_VOID_ROE: {
    id: 'ceto_void_roe_node',
    name: '虚空鱼子冰隙',
    biome: 'planet_only',
    dropId: 'ceto_void_roe',
    dropCount: [1, 2],
    maxHp: 6,
    color: '#818cf8',
    icon: '🫧',
    radius: 23,
    respawnTime: 95
  },

  VOID_MINT: {
    id: 'void_mint_node',
    name: '虚空幽光薄荷丛',
    biome: BIOMES.FOREST,
    dropId: 'void_mint',
    dropCount: [1, 2],
    maxHp: 2,
    color: '#10b981',
    icon: '🌿',
    radius: 18,
    respawnTime: 40
  },

  SPORE_HERB: {
    id: 'spore_herb_node',
    name: '荧光孢子香草丛',
    biome: BIOMES.FOREST,
    dropId: 'spore_herb',
    dropCount: [1, 2],
    maxHp: 2,
    color: '#a3e635',
    icon: '🌱',
    radius: 18,
    respawnTime: 40
  },
  COSMIC_RICE: {
    id: 'cosmic_rice_node',
    name: '引力恒星米田',
    biome: BIOMES.FOREST,
    dropId: 'cosmic_rice',
    dropCount: [1, 2],
    maxHp: 3,
    color: '#fde68a',
    icon: '🌾',
    radius: 19,
    respawnTime: 50
  },

  // Crystalline Rift Nodes
  PULSAR_CRYSTAL: {
    id: 'pulsar_crystal_node',
    name: '脉冲高导晶盐矿',
    biome: BIOMES.CRYSTAL,
    dropId: 'pulsar_crystal_salt',
    dropCount: [1, 3],
    maxHp: 4,
    color: '#c084fc',
    icon: '💎',
    radius: 22,
    respawnTime: 50
  },
  AURORA_JELLY_VEIN: {
    id: 'aurora_jelly_node',
    name: '极光霓虹晶髓',
    biome: BIOMES.CRYSTAL,
    dropId: 'aurora_jelly',
    dropCount: [1, 2],
    maxHp: 3,
    color: '#f472b6',
    icon: '🍮',
    radius: 19,
    respawnTime: 45
  },

  STARDUST_PEPPER: {
    id: 'stardust_pepper_node',
    name: '星尘彩椒晶枝',
    biome: BIOMES.CRYSTAL,
    dropId: 'stardust_pepper',
    dropCount: [1, 2],
    maxHp: 3,
    color: '#e879f9',
    icon: '🫑',
    radius: 18,
    respawnTime: 55
  },
  STAR_BATTER: {
    id: 'star_batter_node',
    name: '超空间星光酥藤',
    biome: BIOMES.CRYSTAL,
    dropId: 'star_batter',
    dropCount: [1, 2],
    maxHp: 3,
    color: '#facc15',
    icon: '🥐',
    radius: 19,
    respawnTime: 55
  },

  // Magma Springs Nodes
  ANTIMATTER_CHILI: {
    id: 'antimatter_chili_node',
    name: '反物质干辣椒丛',
    biome: BIOMES.MAGMA,
    dropId: 'antimatter_chili',
    dropCount: [1, 3],
    maxHp: 2,
    color: '#ef4444',
    icon: '🌶️',
    radius: 18,
    respawnTime: 35
  },
  MAGMA_EMBER_ROCK: {
    id: 'magma_ember_node',
    name: '地心熔岩炙肉岩',
    biome: BIOMES.MAGMA,
    dropId: 'quantum_meat',
    dropCount: [1, 2],
    maxHp: 4,
    color: '#f97316',
    icon: '🥩',
    radius: 22,
    respawnTime: 60
  },

  SUNFIRE_FRUIT: {
    id: 'sunfire_fruit_node',
    name: '地热炽阳炎果树',
    biome: BIOMES.MAGMA,
    dropId: 'sunfire_fruit',
    dropCount: [1, 2],
    maxHp: 3,
    color: '#fb923c',
    icon: '🍑',
    radius: 19,
    respawnTime: 55
  },
  SUPERNOVA_SPRING: {
    id: 'supernova_spring_node',
    name: '超新星热原露泉',
    biome: BIOMES.MAGMA,
    dropId: 'supernova_essence',
    dropCount: [1, 1],
    maxHp: 5,
    color: '#fbbf24',
    icon: '💧',
    radius: 21,
    respawnTime: 80
  },

  // Absolute Cryo-Tundra Nodes
  COMET_ICE: {
    id: 'comet_ice_node',
    name: '彗星玄冰晶矿',
    biome: BIOMES.TUNDRA,
    dropId: 'comet_ice_crystal',
    dropCount: [1, 3],
    maxHp: 3,
    color: '#38bdf8',
    icon: '🧊',
    radius: 20,
    respawnTime: 45
  },
  NEBULA_WHEAT: {
    id: 'nebula_wheat_node',
    name: '极寒星云麦穗',
    biome: BIOMES.TUNDRA,
    dropId: 'nebula_noodle',
    dropCount: [1, 2],
    maxHp: 2,
    color: '#bae6fd',
    icon: '🌾',
    radius: 18,
    respawnTime: 40
  },
  FROST_LOTUS: {
    id: 'frost_lotus_node',
    name: '玄冰寒霜雪莲丛',
    biome: BIOMES.TUNDRA,
    dropId: 'frost_lotus',
    dropCount: [1, 2],
    maxHp: 3,
    color: '#a5f3fc',
    icon: '🪷',
    radius: 19,
    respawnTime: 60
  }
};

/**
 * Single Harvestable Resource Node
 */
export class ResourceNode {
  constructor(x, y, nodeType) {
    this.x = x;
    this.y = y;
    this.type = nodeType;
    this.maxHp = nodeType.maxHp;
    this.hp = nodeType.maxHp;
    this.radius = nodeType.radius;
    this.color = nodeType.color;
    this.icon = nodeType.icon;
    this.name = nodeType.name || '资源点';
    this.isDepleted = false;
    this.respawnTimer = 0;

    // Wobble animation on hit
    this.shakeTimer = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;

    // Ambient floating phase
    this.floatPhase = Math.random() * Math.PI * 2;
  }

  hit(damage = 1, hitAngle = 0) {
    if (this.isDepleted) return null;

    this.hp -= damage;
    this.shakeTimer = 0.25;
    this.shakeOffsetX = Math.cos(hitAngle) * 6;
    this.shakeOffsetY = Math.sin(hitAngle) * 6;

    // Particle hit response
    particles.hitSparks(this.x, this.y, 8, this.color, 150);

    if (this.hp <= 0) {
      this.isDepleted = true;
      this.respawnTimer = this.type.respawnTime;

      // Burst particles
      particles.hitSparks(this.x, this.y, 16, this.color, 220);
      particles.glowingSpores(this.x, this.y, 8, this.color);

      // Return drop specs
      const [minD, maxD] = this.type.dropCount;
      const count = Math.floor(minD + Math.random() * (maxD - minD + 1));
      return {
        dropId: this.type.dropId,
        count: count,
        x: this.x,
        y: this.y
      };
    }

    return null;
  }

  // Compatibility helper for callers that expect a list of harvested drops.
  harvest(damage = 1, hitAngle = 0) {
    const drop = this.hit(damage, hitAngle);
    return drop ? [drop] : [];
  }

  update(dt) {
    this.floatPhase += dt * 2;

    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const decay = this.shakeTimer / 0.25;
      this.shakeOffsetX = Math.sin(this.shakeTimer * 30) * 5 * decay;
      this.shakeOffsetY = Math.cos(this.shakeTimer * 30) * 5 * decay;
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }

    if (this.isDepleted) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) {
        this.isDepleted = false;
        this.hp = this.maxHp;
        particles.glowingSpores(this.x, this.y, 10, this.color);
      }
    }
  }

  render(ctx, camera, player = null) {
    if (this.isDepleted) {
      // 采空后留一个灰色残桩，并标出还有多久长回来
      const rx = this.x - camera.x;
      const ry = this.y - camera.y;
      ctx.fillStyle = 'rgba(75, 85, 99, 0.4)';
      ctx.beginPath();
      ctx.ellipse(rx, ry + 4, this.radius * 0.7, this.radius * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();

      if (player && Math.hypot(player.x - this.x, player.y - this.y) < 150) {
        ctx.save();
        ctx.fillStyle = 'rgba(148, 163, 184, 0.85)';
        ctx.font = '10px "PingFang SC", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`已采空 · ${Math.ceil(Math.max(0, this.respawnTimer))}s`, rx, ry - 6);
        ctx.restore();
      }
      return;
    }

    const rx = this.x + this.shakeOffsetX - camera.x;
    const ry = this.y + this.shakeOffsetY - camera.y;

    // Viewport cull check
    const margin = 40;
    if (
      rx < -margin || rx > camera.viewportWidth + margin ||
      ry < -margin || ry > camera.viewportHeight + margin
    ) {
      return;
    }

    const bob = Math.sin(this.floatPhase) * 3;

    ctx.save();

    // Soft ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(rx, ry + 8, this.radius * 0.9, this.radius * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();

    // Node outer aura glow
    const grad = ctx.createRadialGradient(rx, ry + bob, 2, rx, ry + bob, this.radius * 1.5);
    grad.addColorStop(0, this.color);
    grad.addColorStop(0.5, this.color + '66');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(rx, ry + bob, this.radius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Node core circle
    ctx.fillStyle = '#1e1e2e';
    ctx.beginPath();
    ctx.arc(rx, ry + bob, this.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Procedural glyph stays crisp and avoids platform-dependent emoji fonts.
    drawIngredientGlyph(
      ctx,
      this.type.dropId || this.type.id || this.icon,
      rx,
      ry + bob,
      this.radius * 1.12,
      this.color
    );

    // HP indicator dots if damaged
    if (this.hp < this.maxHp) {
      const dotSpacing = 7;
      const startX = rx - ((this.maxHp - 1) * dotSpacing) / 2;
      for (let i = 0; i < this.maxHp; i++) {
        ctx.fillStyle = i < this.hp ? this.color : '#4b5563';
        ctx.beginPath();
        ctx.arc(startX + i * dotSpacing, ry - this.radius - 8 + bob, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 脚下一圈虚线，告诉玩家这东西可以敲
    ctx.strokeStyle = this.color;
    ctx.globalAlpha = 0.34;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.ellipse(rx, ry + this.radius * 0.62, this.radius * 0.92, this.radius * 0.34, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // 靠近了浮出名牌与产出，不必猜这是什么
    if (player) {
      const dist = Math.hypot(player.x - this.x, player.y - this.y);
      if (dist < 190) {
        const fade = Math.min(1, (190 - dist) / 55);
        this._drawNameplate(ctx, rx, ry - this.radius - 20 + bob, fade);
      }
    }

    ctx.restore();
  }

  /** 资源点名牌：名字 + 产出 + 「可采集」提示。 */
  _drawNameplate(ctx, x, y, fade) {
    const label = String(this.name || '资源点').replace(/\s*\(.*\)$/, '');
    const yieldName = getIngredientById(this.type?.dropId)?.name || '';

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.font = 'bold 11px "PingFang SC", "Microsoft YaHei", sans-serif';
    const w = Math.max(ctx.measureText(label).width, yieldName ? ctx.measureText(yieldName).width + 62 : 0) + 26;
    const h = yieldName ? 30 : 19;

    ctx.fillStyle = 'rgba(8, 18, 26, 0.88)';
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect
      ? ctx.roundRect(x - w / 2, y - h, w, h, 5)
      : ctx.rect(x - w / 2, y - h, w, h);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f5efdf';
    ctx.fillText(label, x - w / 2 + 20, y - h + (yieldName ? 9 : 10));

    if (yieldName) {
      ctx.font = '9px "PingFang SC", sans-serif';
      ctx.fillStyle = this.color;
      ctx.fillText(`敲击 / 按 E 采集 · ${yieldName}`, x - w / 2 + 20, y - h + 22);
    }

    // 左侧一把小镐子，示意用攻击键敲
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    const px = x - w / 2 + 11;
    const py = y - h / 2;
    ctx.beginPath();
    ctx.moveTo(px - 4, py + 4);
    ctx.lineTo(px + 4, py - 4);
    ctx.moveTo(px + 1, py - 6);
    ctx.lineTo(px + 6, py - 1);
    ctx.stroke();

    ctx.restore();
  }
}

/**
 * Dropped Loot Item on ground with Magnetic Attraction & Collection
 */
export class DroppedItem {
  constructor(x, y, itemId, count = 1, initialVx = 0, initialVy = 0) {
    this.x = x;
    this.y = y;
    this.itemId = itemId;
    this.count = count;

    // Physics
    this.vx = initialVx || (Math.random() - 0.5) * 120;
    this.vy = initialVy || (Math.random() - 0.5) * 120;
    this.friction = 0.90;

    // Hover animation
    this.animTime = Math.random() * Math.PI * 2;
    this.heightOffset = 0;

    // Lifetime (despawns after 90s)
    this.life = 90.0;
    this.maxLife = 90.0;
    this.collected = false;

    // Magnetic pickup state
    this.isMagnetized = false;
    this.magnetSpeed = 100;

    // Rarity and visual styling
    this.color = this._getItemColor(itemId);
    this.icon = this._getItemIcon(itemId);
    this.name = this._getItemName(itemId);
  }

  _getItemColor(id) {
    const colors = {
      nebula_noodle: '#60a5fa',
      quantum_meat: '#f43f5e',
      antimatter_chili: '#ef4444',
      comet_ice_crystal: '#38bdf8',
      pulsar_crystal_salt: '#c084fc',
      zero_g_mushroom: '#06d6a0',
      aurora_jelly: '#f472b6',
      void_mint: '#10b981'
    };
    return colors[id] || '#fbbf24';
  }

  _getItemIcon(id) {
    return getIngredientById(id)?.icon || '✨';
  }

  _getItemName(id) {
    return getIngredientById(id)?.name || '异星食材';
  }

  /**
   * Update item physics and magnetic pull toward player
   */
  update(dt, player, onCollectCallback) {
    if (this.collected) return;

    // 供渲染插值使用的上一固定步位置
    this.prevX = this.x;
    this.prevY = this.y;

    this.life -= dt;
    if (this.life <= 0) {
      this.collected = true;
      return;
    }

    this.animTime += dt * 3.5;
    this.heightOffset = Math.sin(this.animTime) * 4;

    // Apply initial ejection physics
    if (Math.abs(this.vx) > 1 || Math.abs(this.vy) > 1) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= Math.pow(this.friction, dt * 60);
      this.vy *= Math.pow(this.friction, dt * 60);
    }

    // Magnetic Attraction Logic
    if (player) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.hypot(dx, dy);
      const pickupRadius = player.pickupRadius || 130;

      if (dist < pickupRadius) {
        this.isMagnetized = true;
        // Exponentially accelerate towards player
        this.magnetSpeed += 550 * dt;
        const moveDist = this.magnetSpeed * dt;
        const angle = Math.atan2(dy, dx);

        this.x += Math.cos(angle) * Math.min(dist, moveDist);
        this.y += Math.sin(angle) * Math.min(dist, moveDist);

        // Spawn magnet trail particle
        if (Math.random() < 0.35) {
          particles.glowingSpores(this.x, this.y, 1, this.color);
        }

        // Collected threshold reached
        if (dist < 22) {
          this.collected = true;
          // Feedback
          particles.hitSparks(this.x, this.y, 10, this.color, 180);
          particles.floatingText(this.x, this.y - 10, `+${this.count} ${this.name}`, this.color, 14);

          if (onCollectCallback) {
            onCollectCallback(this.itemId, this.count);
          }
        }
      } else {
        this.isMagnetized = false;
        this.magnetSpeed = 100;
      }
    }
  }

  render(ctx, camera) {
    if (this.collected) return;

    const rx = this.x - camera.x;
    const ry = this.y - camera.y + this.heightOffset;

    // Viewport cull check
    const margin = 30;
    if (
      rx < -margin || rx > camera.viewportWidth + margin ||
      ry < -margin || ry > camera.viewportHeight + margin
    ) {
      return;
    }

    // Blink when near expiration
    if (this.life < 5.0 && Math.floor(this.life * 6) % 2 === 0) {
      return;
    }

    ctx.save();

    // Ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(rx, this.y - camera.y + 6, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glowing aura
    const pulse = Math.sin(this.animTime * 2) * 2;
    const grad = ctx.createRadialGradient(rx, ry, 2, rx, ry, 16 + pulse);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, this.color);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(rx, ry, 16 + pulse, 0, Math.PI * 2);
    ctx.fill();

    // Procedural ingredient glyph; data icons remain save/UI metadata only.
    drawIngredientGlyph(ctx, this.itemId || this.icon, rx, ry, 16, this.color);

    // Quantity Badge (if count > 1)
    if (this.count > 1) {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(rx + 8, ry + 8, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`x${this.count}`, rx + 8, ry + 8);
    }

    ctx.restore();
  }
}

/**
 * World Resource & Ecological Spawner System
 */
export class WorldSpawner {
  constructor(worldMap) {
    this.map = worldMap;
    this.nodes = [];
    this.droppedItems = [];

    this._initResourceNodes();
  }

  /**
   * Seed resource nodes evenly across the 4 biomes
   */
  _initResourceNodes() {
    this.nodes = [];
    const w = this.map.width;
    const h = this.map.height;
    const midX = w / 2;
    const midY = h / 2;
    const cx = this.map.campPosition.x;
    const cy = this.map.campPosition.y;

    // 资源点跟着地图种子走，换一趟就换一批位置
    const rng = makeRng(((this.map.seed || 1) ^ 0x2f1b) >>> 0);

    const spawnNodesInZone = (minX, maxX, minY, maxY, types, count) => {
      for (let i = 0; i < count; i++) {
        const nx = minX + 50 + rng() * (maxX - minX - 100);
        const ny = minY + 50 + rng() * (maxY - minY - 100);

        // Keep away from camp hub
        if (Math.hypot(nx - cx, ny - cy) < 220) continue;

        // Check map obstacle collision
        if (this.map.isBlocked(nx, ny, 25)) continue;

        const type = types[Math.floor(rng() * types.length) % types.length];
        this.nodes.push(new ResourceNode(nx, ny, type));
      }
    };

    // 每种生态区对应一组可采集资源，象限放哪种生态由星球配置决定
    const BIOME_NODE_TABLE = {
      [BIOMES.FOREST]: [NODE_TYPES.ZERO_G_MUSHROOM, NODE_TYPES.VOID_MINT, NODE_TYPES.SPORE_HERB, NODE_TYPES.COSMIC_RICE],
      [BIOMES.CRYSTAL]: [NODE_TYPES.PULSAR_CRYSTAL, NODE_TYPES.AURORA_JELLY_VEIN, NODE_TYPES.STARDUST_PEPPER, NODE_TYPES.STAR_BATTER],
      [BIOMES.MAGMA]: [NODE_TYPES.ANTIMATTER_CHILI, NODE_TYPES.MAGMA_EMBER_ROCK, NODE_TYPES.SUNFIRE_FRUIT, NODE_TYPES.SUPERNOVA_SPRING],
      [BIOMES.TUNDRA]: [NODE_TYPES.COMET_ICE, NODE_TYPES.NEBULA_WHEAT, NODE_TYPES.FROST_LOTUS]
    };

    const quads = this.map.quadrantBiomes || [BIOMES.FOREST, BIOMES.CRYSTAL, BIOMES.MAGMA, BIOMES.TUNDRA];
    const zones = [
      [60, midX - 60, 60, midY - 60],
      [midX + 60, w - 60, 60, midY - 60],
      [60, midX - 60, midY + 60, h - 60],
      [midX + 60, w - 60, midY + 60, h - 60]
    ];

    // 每象限的资源点数按面积摊，地图放大后不会显得空
    const perZone = Math.max(12, Math.round(((midX - 120) * (midY - 120)) / 210000));

    zones.forEach(([x0, x1, y0, y1], i) => {
      const table = BIOME_NODE_TABLE[quads[i]] || BIOME_NODE_TABLE[BIOMES.FOREST];
      spawnNodesInZone(x0, x1, y0, y1, table, perZone);
    });

    // 星球独占资源点：不分生态区，每象限少量点缀，是跃迁过来的理由
    const exclusive = NODE_TYPES[this.map.exclusiveNode];
    if (exclusive) {
      const perZoneExclusive = Math.max(2, Math.round(perZone * 0.22));
      zones.forEach(([x0, x1, y0, y1]) => {
        spawnNodesInZone(x0, x1, y0, y1, [exclusive], perZoneExclusive);
      });
    }
  }

  /**
   * Spawn a dropped item at coordinate (e.g. from slain monster or harvested node)
   */
  spawnLoot(x, y, itemId, count = 1) {
    const item = new DroppedItem(x, y, itemId, count);
    this.droppedItems.push(item);
    return item;
  }

  // Older game-loop callers pass optional display metadata. Keep that API
  // while routing all drops through the single physics implementation.
  spawnDroppedItem(x, y, itemId, count = 1, displayName = '', displayIcon = '') {
    const item = this.spawnLoot(x, y, itemId, count);
    if (displayName) item.name = displayName;
    if (displayIcon) item.sourceIcon = displayIcon;
    return item;
  }

  /**
   * Trigger attack check against resource nodes in area
   */
  hitNodesInArea(hitX, hitY, hitRadius, damage = 1, hitAngle = 0) {
    const drops = [];
    for (const node of this.nodes) {
      if (node.isDepleted) continue;

      const dist = Math.hypot(node.x - hitX, node.y - hitY);
      if (dist < hitRadius + node.radius) {
        const drop = node.hit(damage, hitAngle);
        if (drop) {
          // Spawn loot items with outward burst velocity
          for (let i = 0; i < drop.count; i++) {
            const spreadAngle = (Math.PI * 2 * i) / drop.count + (Math.random() - 0.5);
            const burstSpeed = 80 + Math.random() * 60;
            const item = new DroppedItem(
              drop.x,
              drop.y,
              drop.dropId,
              1,
              Math.cos(spreadAngle) * burstSpeed,
              Math.sin(spreadAngle) * burstSpeed
            );
            this.droppedItems.push(item);
            drops.push(item);
          }
        }
      }
    }
    return drops;
  }

  /**
   * Update nodes and dropped items
   */
  update(dt, player, onCollectCallback) {
    // 1. Update nodes
    for (const node of this.nodes) {
      node.update(dt);
    }

    // 2. Update dropped items
    for (let i = this.droppedItems.length - 1; i >= 0; i--) {
      const item = this.droppedItems[i];
      item.update(dt, player, onCollectCallback);
      if (item.collected) {
        this.droppedItems.splice(i, 1);
      }
    }
  }

  /**
   * Render resource nodes and dropped loot items
   */
  render(ctx, camera, player = null) {
    // 1. Render Resource Nodes
    for (const node of this.nodes) {
      node.render(ctx, camera, player);
    }

    // 2. Render Dropped Items
    for (const item of this.droppedItems) {
      item.render(ctx, camera);
    }
  }
}
