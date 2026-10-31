// Galaxy Hunter: Gourmet Odyssey - 扩充异兽
// 这些物种没有位图素材，全部走矢量 customRender，AI 交给 Creature 的通用状态机。

/** 统一的落地阴影与呼吸幅度。 */
function bob(self, speed = 4, amp = 2) {
  return Math.sin(self.animTime * speed) * amp;
}

export const EXTRA_MONSTERS = {
  // 棘刺游囊：悬浮的带刺孢子囊，几乎不动但撞上去很疼
  SPINE_URCHIN: {
    id: 'spine_urchin',
    name: '棘刺游囊 (Spine Urchin)',
    species: 'Echinus Volans',
    category: 'flora_beast',
    biome: 'shroom_forest',
    icon: '🦔',
    hp: 78,
    defense: 6,
    speed: 52,
    chaseSpeed: 84,
    wanderSpeed: 34,
    radius: 17,
    poise: 34,
    sightRange: 160,
    loseTargetRange: 250,
    knockbackResist: 0.55,
    contactDamage: 9,
    damage: 11,
    attackRange: 40,
    attackCooldown: 1.5,
    themeColor: '#7c3aed',
    accentColor: '#c4b5fd',
    eyeColor: '#fde68a',
    drops: [
      { id: 'spore_herb', name: '荧光孢子香草', icon: '✨', chance: 0.9, min: 1, max: 3 },
      { id: 'void_mint', name: '虚空幽光薄荷', icon: '🌿', chance: 0.5, min: 1, max: 2 }
    ],
    customRender: (self, ctx) => {
      const y = bob(self, 2.4, 3);
      const r = self.radius;
      const spin = self.animTime * 0.7;

      ctx.fillStyle = 'rgba(124, 58, 237, 0.22)';
      ctx.beginPath();
      ctx.arc(0, y, r * 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = self.accentColor;
      ctx.lineWidth = 2.4;
      for (let i = 0; i < 12; i++) {
        const a = spin + (i / 12) * Math.PI * 2;
        const len = r * (1.32 + Math.sin(self.animTime * 3 + i) * 0.12);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78);
        ctx.lineTo(Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.stroke();
      }

      ctx.fillStyle = self.themeColor;
      ctx.beginPath();
      ctx.arc(0, y, r * 0.86, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#2e1065';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = self.eyeColor;
      ctx.beginPath();
      ctx.arc(0, y - r * 0.1, r * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2e1065';
      ctx.beginPath();
      ctx.ellipse(0, y - r * 0.1, r * 0.09, r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  // 浮空滑翔鳐：贴地滑行的菱形鳐鱼，血薄但很快
  GLIDE_RAY: {
    id: 'glide_ray',
    name: '浮空滑翔鳐 (Glide Ray)',
    species: 'Manta Nebula',
    category: 'predator',
    biome: 'shroom_forest',
    icon: '🛸',
    hp: 62,
    defense: 1,
    speed: 178,
    chaseSpeed: 268,
    wanderSpeed: 96,
    radius: 19,
    poise: 16,
    sightRange: 300,
    loseTargetRange: 430,
    knockbackResist: 0.05,
    contactDamage: 7,
    damage: 13,
    attackRange: 52,
    attackCooldown: 1.1,
    themeColor: '#0ea5e9',
    accentColor: '#7dd3fc',
    eyeColor: '#fef08a',
    drops: [
      { id: 'plasma_tentacle', name: '等离子巨鱿触手', icon: '🧪', chance: 0.8, min: 1, max: 2 },
      { id: 'aurora_jelly', name: '极光霓虹果冻', icon: '🍮', chance: 0.55, min: 1, max: 2 }
    ],
    customRender: (self, ctx) => {
      const y = bob(self, 3.4, 3.5);
      const r = self.radius;
      const flap = Math.sin(self.animTime * 6) * 0.34;

      ctx.save();
      ctx.translate(0, y);

      const grad = ctx.createLinearGradient(0, -r, 0, r);
      grad.addColorStop(0, self.accentColor);
      grad.addColorStop(1, self.themeColor);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.95);
      ctx.quadraticCurveTo(r * 1.6, -r * 0.2 + flap * r, r * 0.15, r * 0.8);
      ctx.quadraticCurveTo(0, r * 1.05, -r * 0.15, r * 0.8);
      ctx.quadraticCurveTo(-r * 1.6, -r * 0.2 + flap * r, 0, -r * 0.95);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#083344';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // 尾鞭
      ctx.strokeStyle = self.themeColor;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, r * 0.8);
      ctx.quadraticCurveTo(flap * r * 0.9, r * 1.5, flap * r * 1.6, r * 2.1);
      ctx.stroke();

      // 背脊上的两点发光眼
      ctx.fillStyle = self.eyeColor;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * r * 0.26, -r * 0.36, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  },

  // 余烬猎犬：熔岩带的四足掠食者，冲得快咬得疼
  CINDER_HOUND: {
    id: 'cinder_hound',
    name: '余烬猎犬 (Cinder Hound)',
    species: 'Canis Ignis',
    category: 'predator',
    biome: 'magma_springs',
    icon: '🐺🔥',
    hp: 128,
    defense: 4,
    speed: 162,
    chaseSpeed: 292,
    wanderSpeed: 88,
    radius: 21,
    poise: 30,
    sightRange: 330,
    loseTargetRange: 470,
    knockbackResist: 0.32,
    contactDamage: 10,
    damage: 21,
    attackRange: 56,
    attackCooldown: 1.25,
    themeColor: '#ea580c',
    accentColor: '#fbbf24',
    eyeColor: '#fef3c7',
    drops: [
      { id: 'magma_tail', name: '熔岩巨蜥炙尾肉', icon: '🥩🔥', chance: 0.85, min: 1, max: 2 },
      { id: 'antimatter_chili', name: '反物质干辣椒', icon: '🌶️', chance: 0.6, min: 1, max: 2 },
      { id: 'sunfire_fruit', name: '地热炽阳炎果', icon: '🌋', chance: 0.35, min: 1, max: 1 }
    ],
    customRender: (self, ctx) => {
      const r = self.radius;
      const run = Math.sin(self.walkCycle) * r * 0.34;
      const y = bob(self, 5, 1.6);

      ctx.save();
      ctx.translate(0, y);

      // 四条腿
      ctx.strokeStyle = '#7c2d12';
      ctx.lineWidth = 3.4;
      ctx.lineCap = 'round';
      for (const [ox, phase] of [[-r * 0.5, 1], [r * 0.5, -1]]) {
        ctx.beginPath();
        ctx.moveTo(ox, r * 0.24);
        ctx.lineTo(ox + run * phase, r * 0.94);
        ctx.moveTo(ox * 0.4, r * 0.24);
        ctx.lineTo(ox * 0.4 - run * phase, r * 0.94);
        ctx.stroke();
      }

      // 躯干
      const grad = ctx.createLinearGradient(0, -r * 0.7, 0, r * 0.5);
      grad.addColorStop(0, self.accentColor);
      grad.addColorStop(1, self.themeColor);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 1.05, r * 0.62, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#431407';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 背上的余烬脊刺
      ctx.fillStyle = '#fde68a';
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * r * 0.42, -r * 0.5);
        ctx.lineTo(i * r * 0.42 + 4, -r * 0.96 - Math.abs(i) * -3);
        ctx.lineTo(i * r * 0.42 - 4, -r * 0.5);
        ctx.closePath();
        ctx.fill();
      }

      // 头
      ctx.fillStyle = self.themeColor;
      ctx.beginPath();
      ctx.ellipse(r * 0.86, -r * 0.16, r * 0.44, r * 0.36, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#431407';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.fillStyle = self.eyeColor;
      ctx.beginPath();
      ctx.arc(r * 1.02, -r * 0.24, 2.8, 0, Math.PI * 2);
      ctx.fill();

      // 尾
      ctx.strokeStyle = self.accentColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-r * 1.0, -r * 0.1);
      ctx.quadraticCurveTo(-r * 1.5, -r * 0.5 + run * 0.6, -r * 1.7, -r * 0.9);
      ctx.stroke();
      ctx.restore();
    }
  },

  // 棱镜甲蟹：重甲，轻击弹开，必须用破甲重击
  PRISM_CRAB: {
    id: 'prism_crab',
    name: '棱镜甲蟹 (Prism Crab)',
    species: 'Cancer Prismaticus',
    category: 'armored',
    biome: 'crystalline_rift',
    icon: '🦀💎',
    hp: 190,
    defense: 17,
    speed: 92,
    chaseSpeed: 150,
    wanderSpeed: 52,
    radius: 25,
    poise: 62,
    sightRange: 235,
    loseTargetRange: 330,
    knockbackResist: 0.72,
    contactDamage: 12,
    damage: 26,
    attackRange: 66,
    attackCooldown: 1.7,
    themeColor: '#a855f7',
    accentColor: '#e9d5ff',
    eyeColor: '#22d3ee',
    drops: [
      { id: 'pulsar_crystal_salt', name: '脉冲星高导晶盐', icon: '🧂', chance: 1.0, min: 2, max: 4 },
      { id: 'crystal_bloom', name: '高维星核晶簇花', icon: '💎', chance: 0.5, min: 1, max: 2 },
      { id: 'quantum_meat', name: '量子恐龙肉排', icon: '🥩', chance: 0.55, min: 1, max: 2 }
    ],
    customRender: (self, ctx) => {
      const r = self.radius;
      const y = bob(self, 3, 1.4);
      const claw = Math.sin(self.animTime * 4) * 0.22;

      ctx.save();
      ctx.translate(0, y);

      // 腿
      ctx.strokeStyle = '#6b21a8';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const a = (0.5 + i * 0.34) * s;
          ctx.beginPath();
          ctx.moveTo(s * r * 0.5, r * 0.16);
          ctx.lineTo(s * r * (1.0 + i * 0.16), r * 0.5 + Math.sin(self.walkCycle + i) * 3);
          ctx.lineTo(s * r * (1.15 + i * 0.2), r * 0.92);
          ctx.stroke();
        }
      }

      // 甲壳：多面体，边缘高光
      const grad = ctx.createLinearGradient(0, -r * 0.8, 0, r * 0.5);
      grad.addColorStop(0, self.accentColor);
      grad.addColorStop(0.55, self.themeColor);
      grad.addColorStop(1, '#581c87');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-r * 1.05, 0);
      ctx.lineTo(-r * 0.62, -r * 0.66);
      ctx.lineTo(r * 0.62, -r * 0.66);
      ctx.lineTo(r * 1.05, 0);
      ctx.lineTo(r * 0.6, r * 0.44);
      ctx.lineTo(-r * 0.6, r * 0.44);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#3b0764';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.62, -r * 0.66);
      ctx.lineTo(0, r * 0.42);
      ctx.moveTo(r * 0.62, -r * 0.66);
      ctx.lineTo(0, r * 0.42);
      ctx.stroke();

      // 两只钳
      ctx.fillStyle = self.themeColor;
      ctx.strokeStyle = '#3b0764';
      ctx.lineWidth = 2;
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(s * r * 1.12, -r * 0.28);
        ctx.rotate(s * (0.4 + claw));
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(s * r * 0.5, -r * 0.3);
        ctx.lineTo(s * r * 0.62, r * 0.06);
        ctx.lineTo(s * r * 0.2, r * 0.24);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // 眼柄
      ctx.strokeStyle = '#6b21a8';
      ctx.lineWidth = 2.4;
      ctx.fillStyle = self.eyeColor;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * r * 0.26, -r * 0.62);
        ctx.lineTo(s * r * 0.34, -r * 0.98);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(s * r * 0.34, -r * 1.04, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  },

  // 虚空触须：从地面钻出的高个子触须，够得远
  VOID_TENDRIL: {
    id: 'void_tendril',
    name: '虚空触须 (Void Tendril)',
    species: 'Tentaculum Abyssi',
    category: 'aberration',
    biome: 'crystalline_rift',
    icon: '🌑',
    hp: 156,
    defense: 8,
    speed: 74,
    chaseSpeed: 122,
    wanderSpeed: 40,
    radius: 22,
    poise: 44,
    sightRange: 360,
    loseTargetRange: 500,
    knockbackResist: 0.6,
    contactDamage: 8,
    damage: 24,
    attackRange: 96,
    attackCooldown: 1.9,
    themeColor: '#4c1d95',
    accentColor: '#a78bfa',
    eyeColor: '#f0abfc',
    drops: [
      { id: 'void_mint', name: '虚空幽光薄荷', icon: '🌿', chance: 0.9, min: 1, max: 3 },
      { id: 'void_wyrm_meat', name: '虚空神龙脊髓肉', icon: '🐉', chance: 0.3, min: 1, max: 1 },
      { id: 'supernova_essence', name: '超新星浓缩热原露', icon: '💧', chance: 0.22, min: 1, max: 1 }
    ],
    customRender: (self, ctx) => {
      const r = self.radius;
      const sway = Math.sin(self.animTime * 2.2);

      // 地面的裂口
      ctx.fillStyle = 'rgba(20, 8, 40, 0.85)';
      ctx.beginPath();
      ctx.ellipse(0, r * 0.86, r * 0.94, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      // 主触须
      const grad = ctx.createLinearGradient(0, -r * 2.1, 0, r * 0.8);
      grad.addColorStop(0, self.accentColor);
      grad.addColorStop(1, self.themeColor);
      ctx.strokeStyle = grad;
      ctx.lineCap = 'round';
      ctx.lineWidth = r * 0.72;
      ctx.beginPath();
      ctx.moveTo(0, r * 0.8);
      ctx.quadraticCurveTo(sway * r * 0.7, -r * 0.6, sway * r * 1.1, -r * 1.9);
      ctx.stroke();

      // 两条副触须
      ctx.lineWidth = r * 0.26;
      ctx.strokeStyle = self.themeColor;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * r * 0.36, r * 0.78);
        ctx.quadraticCurveTo(s * r * 1.0, -r * 0.2, s * r * (0.7 + sway * 0.3), -r * 1.15);
        ctx.stroke();
      }

      // 顶端的独眼
      const ex = sway * r * 1.1;
      const ey = -r * 1.9;
      ctx.fillStyle = self.eyeColor;
      ctx.beginPath();
      ctx.arc(ex, ey, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1e0836';
      ctx.beginPath();
      ctx.ellipse(ex, ey, r * 0.1, r * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();

      // 吸盘
      ctx.fillStyle = 'rgba(240, 171, 252, 0.55)';
      for (let i = 0; i < 5; i++) {
        const t = i / 5;
        const px = sway * r * 1.1 * t;
        const py = r * 0.8 - t * r * 2.7;
        ctx.beginPath();
        ctx.arc(px, py, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  // 磁暴甲虫：熔核带的重甲虫，撞击伤害高
  MAGNETAR_BEETLE: {
    id: 'magnetar_beetle',
    name: '磁暴甲虫 (Magnetar Beetle)',
    species: 'Scarabaeus Magneticus',
    category: 'armored',
    biome: 'magma_springs',
    icon: '🪲⚡',
    hp: 172,
    defense: 13,
    speed: 118,
    chaseSpeed: 236,
    wanderSpeed: 62,
    radius: 23,
    poise: 54,
    sightRange: 290,
    loseTargetRange: 400,
    knockbackResist: 0.66,
    contactDamage: 14,
    damage: 23,
    attackRange: 58,
    attackCooldown: 1.45,
    themeColor: '#0f766e',
    accentColor: '#5eead4',
    eyeColor: '#fbbf24',
    drops: [
      { id: 'thunder_wing', name: '雷霆飞龙薄翼肉', icon: '⚡', chance: 0.75, min: 1, max: 2 },
      { id: 'pulsar_crystal_salt', name: '脉冲星高导晶盐', icon: '🧂', chance: 0.7, min: 1, max: 3 },
      { id: 'stardust_pepper', name: '星尘研磨彩胡椒', icon: '🌈', chance: 0.4, min: 1, max: 2 }
    ],
    customRender: (self, ctx) => {
      const r = self.radius;
      const y = bob(self, 4.4, 1.4);
      const arc = (Math.sin(self.animTime * 7) + 1) * 0.5;

      ctx.save();
      ctx.translate(0, y);

      // 六条足
      ctx.strokeStyle = '#134e4a';
      ctx.lineWidth = 2.8;
      ctx.lineCap = 'round';
      for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(s * r * 0.4, -r * 0.1 + i * r * 0.24);
          ctx.lineTo(s * r * (0.95 + i * 0.1), r * 0.36 + Math.sin(self.walkCycle + i * 2) * 3);
          ctx.stroke();
        }
      }

      // 鞘翅
      const grad = ctx.createLinearGradient(0, -r * 0.9, 0, r * 0.7);
      grad.addColorStop(0, self.accentColor);
      grad.addColorStop(0.5, self.themeColor);
      grad.addColorStop(1, '#042f2e');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.86, r * 1.02, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#042f2e';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.9);
      ctx.lineTo(0, r * 0.98);
      ctx.stroke();

      // 头与独角
      ctx.fillStyle = '#134e4a';
      ctx.beginPath();
      ctx.ellipse(0, -r * 1.02, r * 0.44, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = self.accentColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.2);
      ctx.lineTo(0, -r * 1.7);
      ctx.stroke();

      // 角尖跳动的电弧
      ctx.strokeStyle = `rgba(94, 234, 212, ${0.35 + arc * 0.6})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + self.animTime * 5;
        const rad = r * (0.4 + arc * 0.28);
        ctx.moveTo(0, -r * 1.7);
        ctx.lineTo(Math.cos(a) * rad, -r * 1.7 + Math.sin(a) * rad * 0.7);
      }
      ctx.stroke();

      ctx.fillStyle = self.eyeColor;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * r * 0.22, -r * 1.06, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
};

/** #rrggbb → {h,s,l}，色相 0-360。 */
function hexToHsl(hex) {
  const h = String(hex).replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0));
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  return { h: hue * 60, s, l };
}

function hslToHex({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let rgb = [0, 0, 0];
  if (hp < 1) rgb = [c, x, 0];
  else if (hp < 2) rgb = [x, c, 0];
  else if (hp < 3) rgb = [0, c, x];
  else if (hp < 4) rgb = [0, x, c];
  else if (hp < 5) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  const m = l - c / 2;
  const to = (v) => Math.round(Math.max(0, Math.min(1, v + m)) * 255).toString(16).padStart(2, '0');
  return `#${to(rgb[0])}${to(rgb[1])}${to(rgb[2])}`;
}

/**
 * 把 CSS filter 串里的 hue-rotate / saturate / brightness 一次性烤进配色。
 * 矢量生物用这个替代每帧的 ctx.filter。
 */
export function bakeVariantTint(monster, filter) {
  if (!filter || filter === 'none') return;

  const num = (re) => {
    const m = filter.match(re);
    return m ? parseFloat(m[1]) : null;
  };
  const hue = num(/hue-rotate\((-?[\d.]+)deg\)/) || 0;
  const sat = num(/saturate\(([\d.]+)\)/) ?? 1;
  const bri = num(/brightness\(([\d.]+)\)/) ?? 1;
  const sepia = num(/sepia\(([\d.]+)\)/) ?? 0;

  const shift = (hex) => {
    if (typeof hex !== 'string' || !hex.startsWith('#')) return hex;
    const c = hexToHsl(hex);
    let h = c.h + hue;
    let s = Math.max(0, Math.min(1, c.s * sat));
    const l = Math.max(0.04, Math.min(0.96, c.l * bri));
    if (sepia > 0) {
      h = h * (1 - sepia) + 38 * sepia;
      s = s * (1 - sepia) + 0.32 * sepia;
    }
    return hslToHex({ h, s, l });
  };

  monster.themeColor = shift(monster.themeColor);
  monster.accentColor = shift(monster.accentColor);
  monster.eyeColor = shift(monster.eyeColor);
}
