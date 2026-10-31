// Galaxy Hunter: Gourmet Odyssey - 实体化厨房场景
// 四道工位：砧板处理 → 下锅控火 → 调味 → 摆盘。全部靠指针拖放操作，
// 各工位单独计分，最后合成米其林评级。

import { drawIngredientGlyph } from '../world/glyphs.js';
import { sound } from '../audio.js';
import { captureDishThumb } from '../systems/gallery.js';

const W = 760;
const H = 470;

const COLORS = {
  bg: '#08151d',
  panel: '#0f2632',
  panelEdge: 'rgba(148, 197, 205, 0.18)',
  steel: '#1d3d4c',
  steelLight: '#2c5768',
  cream: '#f5efdf',
  muted: '#8fb3bb',
  mutedDim: '#5b8390',
  gold: '#f0c77c',
  goldDim: 'rgba(240, 199, 124, 0.3)',
  mint: '#5cd5bd',
  coral: '#e77c65',
  flame: '#f9a03f'
};

const PREP_LABELS = {
  slice: { name: '切片', hint: '按住任意角度划过食材，各刀角度一致、间距均匀' },
  chop: { name: '剁碎', hint: '在食材上连续敲击，保持稳定节奏' },
  grind: { name: '研磨', hint: '在食材上画圈研磨，磨到质地细腻' }
};

const GARNISHES = [
  { id: 'herb', name: '星苔嫩叶', color: '#7ee0a6' },
  { id: 'flower', name: '虹光食花', color: '#f48fb1' },
  { id: 'dust', name: '星尘碎屑', color: '#ffd88a' }
];

const MAX_SAUCE_STROKES = 3;

const SEASONINGS = [
  { id: 'salt', name: '脉冲星晶盐', color: '#e8f4f8' },
  { id: 'spice', name: '反物质辛香', color: '#f08a5d' },
  { id: 'stardust', name: '星尘粉', color: '#b39ddb' }
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clamp01 = v => clamp(v, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * 由字符串派生稳定的伪随机序列，让同一道菜的调味目标固定。
 */
function seedFrom(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export class KitchenScene {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ingredients = options.ingredients || [];
    this.recipe = options.recipe || null;
    this.heatToleranceBonus = options.heatToleranceBonus || 0;
    this.chef = options.chef || null;
    this.onComplete = options.onComplete || null;
    this.onStageChange = options.onStageChange || null;

    this.ctx = canvas.getContext('2d');
    this.stage = 'prep';
    this.time = 0;
    this.running = false;
    this.rafId = null;
    this.lastFrame = 0;

    this.pointer = { x: 0, y: 0, down: false, prevX: 0, prevY: 0 };
    this.drag = null;
    this.toast = null;
    this.toastTimer = 0;
    this.sparks = [];

    this._initPrep();
    this._initPan();
    this._initSeason();
    this._initPlate();

    this._bound = {
      down: e => this._onPointerDown(e),
      move: e => this._onPointerMove(e),
      up: e => this._onPointerUp(e)
    };
  }

  // ============================================================
  // 生命周期
  // ============================================================

  start() {
    this.canvas.width = W * 2;
    this.canvas.height = H * 2;
    this.canvas.style.width = '100%';
    this.canvas.style.aspectRatio = `${W} / ${H}`;
    this.ctx.setTransform(2, 0, 0, 2, 0, 0);

    this.canvas.addEventListener('pointerdown', this._bound.down);
    window.addEventListener('pointermove', this._bound.move);
    window.addEventListener('pointerup', this._bound.up);

    this.running = true;
    this.lastFrame = performance.now();
    this._loop(this.lastFrame);
  }

  destroy() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.canvas.removeEventListener('pointerdown', this._bound.down);
    window.removeEventListener('pointermove', this._bound.move);
    window.removeEventListener('pointerup', this._bound.up);
  }

  _loop(now) {
    if (!this.running) return;
    const dt = Math.min(0.05, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.time += dt;

    this._update(dt);
    this._render();

    this.rafId = requestAnimationFrame(t => this._loop(t));
  }

  _setStage(stage) {
    this.stage = stage;
    if (this.onStageChange) this.onStageChange(stage);
  }

  _showToast(text) {
    this.toast = text;
    this.toastTimer = 1.9;
  }

  _spark(x, y, color, count = 10, spread = 60) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 20 + Math.random() * spread;
      this.sparks.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 20,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        color,
        size: 1.4 + Math.random() * 2
      });
    }
  }

  // ============================================================
  // 指针
  // ============================================================

  _toLocal(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * W,
      y: ((e.clientY - r.top) / r.height) * H
    };
  }

  _onPointerDown(e) {
    e.preventDefault();
    const p = this._toLocal(e);
    this.pointer.x = p.x; this.pointer.y = p.y;
    this.pointer.prevX = p.x; this.pointer.prevY = p.y;
    this.pointer.down = true;

    if (this.stage === 'prep') this._prepDown(p);
    else if (this.stage === 'pan') this._panDown(p);
    else if (this.stage === 'season') this._seasonDown(p);
    else if (this.stage === 'plate') this._plateDown(p);
  }

  _onPointerMove(e) {
    const p = this._toLocal(e);
    this.pointer.prevX = this.pointer.x;
    this.pointer.prevY = this.pointer.y;
    this.pointer.x = p.x;
    this.pointer.y = p.y;
    if (!this.pointer.down) return;

    if (this.stage === 'prep') this._prepMove(p);
    else if (this.stage === 'pan') this._panMove(p);
    else if (this.stage === 'season') this._seasonMove(p);
    else if (this.stage === 'plate') this._plateMove(p);
  }

  _onPointerUp() {
    if (!this.pointer.down) return;
    this.pointer.down = false;

    if (this.stage === 'prep') this._prepUp();
    else if (this.stage === 'pan') this._panUp();
    else if (this.stage === 'season') this._seasonUp();
    else if (this.stage === 'plate') this._plateUp();
  }

  // ============================================================
  // 工位一：砧板处理
  // ============================================================

  _initPrep() {
    this.board = { x: W / 2, y: 236, w: 330, h: 176 };
    this.tray = { x: W / 2, y: 408 };

    // 待处理 / 已完成
    this.rawQueue = this.ingredients.map((ing, i) => ({
      ing,
      id: `${ing.id}_${i}`,
      prepType: ing.prepType || 'slice',
      x: 96 + i * 74,
      y: 96,
      homeX: 96 + i * 74,
      homeY: 96,
      done: false,
      score: 0
    }));
    this.prepped = [];
    this.activeItem = null;

    // 当前处理进度
    this.cuts = [];          // slice：切痕的相对位置
    this.chopTaps = [];      // chop：敲击时间戳
    this.grindAngle = 0;     // grind：累计角度
    this.grindRadii = [];
    this.strokeStart = null;
    this.knifeTrail = [];
  }

  get prepTarget() {
    if (!this.activeItem) return null;
    const t = this.activeItem.prepType;
    if (t === 'slice') return 4;
    if (t === 'chop') return 9;
    return Math.PI * 2 * 3.5; // grind 累计弧度
  }

  _prepDown(p) {
    // 已在砧板上 → 开始处理动作
    if (this.activeItem && this._onBoard(p)) {
      const type = this.activeItem.prepType;
      if (type === 'chop') {
        this._registerChop(p);
      } else {
        this.strokeStart = { x: p.x, y: p.y };
        this.knifeTrail = [{ x: p.x, y: p.y }];
      }
      return;
    }

    // 从待处理区拖起一个食材
    for (const item of this.rawQueue) {
      if (item.done) continue;
      if (Math.hypot(p.x - item.x, p.y - item.y) < 34) {
        this.drag = { kind: 'raw', item, dx: p.x - item.x, dy: p.y - item.y };
        return;
      }
    }
  }

  _prepMove(p) {
    if (this.drag && this.drag.kind === 'raw') {
      this.drag.item.x = p.x - this.drag.dx;
      this.drag.item.y = p.y - this.drag.dy;
      return;
    }
    if (!this.activeItem) return;

    const type = this.activeItem.prepType;
    if (type === 'slice' && this.strokeStart) {
      this.knifeTrail.push({ x: p.x, y: p.y });
      if (this.knifeTrail.length > 26) this.knifeTrail.shift();
    } else if (type === 'grind' && this._onBoard(p)) {
      const cx = this.board.x, cy = this.board.y;
      const a0 = Math.atan2(this.pointer.prevY - cy, this.pointer.prevX - cx);
      const a1 = Math.atan2(p.y - cy, p.x - cx);
      let d = a1 - a0;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.grindAngle += Math.abs(d);
      this.grindRadii.push(Math.hypot(p.x - cx, p.y - cy));
      if (this.grindRadii.length > 140) this.grindRadii.shift();
      if (Math.random() < 0.3) this._spark(p.x, p.y, this.activeItem.ing.themeColor || COLORS.mint, 1, 24);
      this._checkPrepDone();
    }
  }

  _prepUp() {
    // 放下拖拽中的生食材
    if (this.drag && this.drag.kind === 'raw') {
      const item = this.drag.item;
      this.drag = null;
      if (this._onBoard({ x: item.x, y: item.y }) && !this.activeItem) {
        this.activeItem = item;
        item.x = this.board.x;
        item.y = this.board.y;
        this.cuts = [];
        this.chopTaps = [];
        this.grindAngle = 0;
        this.grindRadii = [];
        sound.playChop();
        const label = PREP_LABELS[item.prepType];
        this._showToast(`${item.ing.name} · ${label.name}：${label.hint}`);
      } else {
        item.x = item.homeX;
        item.y = item.homeY;
      }
      return;
    }

    // 完成一次切划
    if (this.activeItem && this.activeItem.prepType === 'slice' && this.strokeStart) {
      this._registerSlice();
      this.strokeStart = null;
      this.knifeTrail = [];
    }
  }

  _onBoard(p) {
    return Math.abs(p.x - this.board.x) < this.board.w / 2
      && Math.abs(p.y - this.board.y) < this.board.h / 2;
  }

  /**
   * 切划可以是任意角度：直切、斜切、横切都算数。
   * 记录每刀的角度与相对食材中心的垂距，评分看刀与刀之间是否平行、间距是否均匀。
   */
  _registerSlice() {
    const a = this.strokeStart;
    const b = { x: this.pointer.x, y: this.pointer.y };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);

    if (len < 56) {
      this._showToast('划得太短：要一刀贯穿食材');
      return;
    }

    // 食材中心到这条切线的垂距，决定这一刀切在哪个位置
    const nx = -dy / len;
    const ny = dx / len;
    const offset = (this.board.x - a.x) * nx + (this.board.y - a.y) * ny;

    if (Math.abs(offset) > 74) {
      this._showToast('没有切到食材，刀要从它身上过');
      return;
    }

    // 线没有方向性，把角度归一到 [0, π)
    let angle = Math.atan2(dy, dx);
    if (angle < 0) angle += Math.PI;

    this.cuts.push({ angle, offset: -offset });

    // 第一刀确定这次的刀法风格
    if (this.cuts.length === 1) {
      this.sliceStyle = this._sliceStyleName(angle);
      this._showToast(`${this.sliceStyle}：保持角度一致、间距均匀`);
    }

    sound.playChop();
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this._spark(mid.x, mid.y, COLORS.cream, 8, 50);
    this._checkPrepDone();
  }

  /**
   * 按第一刀的角度给刀法起个名字。
   */
  _sliceStyleName(angle) {
    const deg = (angle * 180) / Math.PI;
    if (deg < 22 || deg > 158) return '横切';
    if (deg < 68) return '斜刀';
    if (deg < 112) return '直切';
    return '反斜刀';
  }

  _registerChop(p) {
    if (Math.hypot(p.x - this.board.x, p.y - this.board.y) > 78) return;
    this.chopTaps.push(this.time);
    sound.playChop();
    this._spark(p.x, p.y, COLORS.cream, 6, 44);
    this._checkPrepDone();
  }

  _checkPrepDone() {
    const item = this.activeItem;
    if (!item) return;
    const type = item.prepType;
    let progress = 0;
    let score = 0;

    if (type === 'slice') {
      progress = this.cuts.length / this.prepTarget;
      if (this.cuts.length < 2) score = 60;
      else {
        // 1. 平行度：各刀角度相对第一刀的偏差（角度是 [0,π) 的线，要走环形差）
        const base = this.cuts[0].angle;
        const angleDev = this.cuts.reduce((s, c) => {
          let d = Math.abs(c.angle - base) % Math.PI;
          if (d > Math.PI / 2) d = Math.PI - d;
          return s + d;
        }, 0) / this.cuts.length;
        const parallel = clamp(100 - (angleDev / (Math.PI / 6)) * 100, 0, 100);

        // 2. 均匀度：垂距排序后的间距一致性
        const offs = this.cuts.map(c => c.offset).sort((a, b) => a - b);
        const gaps = offs.slice(1).map((v, i) => v - offs[i]);
        const mean = gaps.reduce((s, g) => s + g, 0) / gaps.length;
        const dev = gaps.reduce((s, g) => s + Math.abs(g - mean), 0) / gaps.length;
        const even = clamp(100 - (dev / Math.max(6, Math.abs(mean))) * 60, 0, 100);

        score = clamp(parallel * 0.45 + even * 0.55, 35, 100);
      }
    } else if (type === 'chop') {
      progress = this.chopTaps.length / this.prepTarget;
      // 节奏稳定度：敲击间隔的一致性
      const iv = this.chopTaps.slice(1).map((t, i) => t - this.chopTaps[i]);
      if (iv.length < 2) score = 60;
      else {
        const mean = iv.reduce((s, v) => s + v, 0) / iv.length;
        const dev = iv.reduce((s, v) => s + Math.abs(v - mean), 0) / iv.length;
        score = clamp(100 - (dev / Math.max(0.06, mean)) * 90, 35, 100);
      }
    } else {
      progress = this.grindAngle / this.prepTarget;
      // 研磨手法：半径是否平稳
      if (this.grindRadii.length < 8) score = 60;
      else {
        const mean = this.grindRadii.reduce((s, v) => s + v, 0) / this.grindRadii.length;
        const dev = this.grindRadii.reduce((s, v) => s + Math.abs(v - mean), 0) / this.grindRadii.length;
        score = clamp(100 - dev * 2.6, 35, 100);
      }
    }

    item.progress = clamp01(progress);
    if (progress < 1) return;

    item.done = true;
    item.score = Math.round(score);
    this.prepped.push(item);
    this.activeItem = null;
    this.cuts = [];
    this.chopTaps = [];
    this.grindAngle = 0;
    this.grindRadii = [];

    sound.playSparkle();
    this._spark(this.board.x, this.board.y, COLORS.gold, 18, 110);
    this._showToast(`${item.ing.name} 处理完成 · 刀工 ${item.score}`);

    if (this.rawQueue.every(i => i.done)) {
      this.knifeScore = Math.round(
        this.rawQueue.reduce((s, i) => s + i.score, 0) / this.rawQueue.length
      );
      this._beginPan();
    }
  }

  // ============================================================
  // 工位二：下锅与火候
  // ============================================================

  _initPan() {
    this.pan = { x: W / 2 + 30, y: 226, r: 108 };
    this.knifeScore = 0;
    this.heatScore = 0;

    this.flame = 0;           // 0..100 灶火强度
    this.temp = 24;           // 当前锅温
    this.panItems = [];
    this.cookTimer = 0;
    this.cookDuration = 11.0;
    this.tempSamples = 0;
    this.tempHits = 0;
    this.stirGlow = 0;
    this.flameKnob = { x: 108, y: 222, h: 166 };
    this.draggingFlame = false;
  }

  _beginPan() {
    this._setStage('pan');
    // 备料盘里的食材改为可拖入锅中
    this.prepped.forEach((item, i) => {
      item.x = 96 + i * 66;
      item.y = 414;
      item.homeX = item.x;
      item.homeY = item.y;
      item.inPan = false;
      item.brown = 0;
      item.scorch = 0;
    });
    this._showToast('把处理好的食材拖进锅里，然后拖动左侧火焰滑杆控温');
  }

  get targetTemp() { return this.recipe?.idealTemp || 78; }
  get tempTolerance() { return 11 + (this.heatToleranceBonus || 0); }

  _panDown(p) {
    if (Math.abs(p.x - this.flameKnob.x) < 40 && Math.abs(p.y - this.flameKnob.y) < this.flameKnob.h / 2 + 20) {
      this.draggingFlame = true;
      this._panMove(p);
      return;
    }
    for (const item of this.prepped) {
      if (item.inPan) continue;
      if (Math.hypot(p.x - item.x, p.y - item.y) < 30) {
        this.drag = { kind: 'prepped', item, dx: p.x - item.x, dy: p.y - item.y };
        return;
      }
    }
    // 锅内画圈翻炒
    if (Math.hypot(p.x - this.pan.x, p.y - this.pan.y) < this.pan.r) {
      this.drag = { kind: 'stir' };
    }
  }

  _panMove(p) {
    if (this.draggingFlame) {
      const top = this.flameKnob.y - this.flameKnob.h / 2;
      this.flame = clamp(100 - ((p.y - top) / this.flameKnob.h) * 100, 0, 100);
      return;
    }
    if (this.drag?.kind === 'prepped') {
      this.drag.item.x = p.x - this.drag.dx;
      this.drag.item.y = p.y - this.drag.dy;
      return;
    }
    if (this.drag?.kind === 'stir') {
      const moved = Math.hypot(p.x - this.pointer.prevX, p.y - this.pointer.prevY);
      if (Math.hypot(p.x - this.pan.x, p.y - this.pan.y) < this.pan.r) {
        this.stirGlow = Math.min(1, this.stirGlow + moved * 0.012);
        for (const item of this.panItems) {
          item.scorch = Math.max(0, item.scorch - moved * 0.0022);
          // 翻炒时食材被推着走
          const a = Math.atan2(item.y - this.pan.y, item.x - this.pan.x) + moved * 0.004;
          const r = Math.hypot(item.x - this.pan.x, item.y - this.pan.y);
          item.x = this.pan.x + Math.cos(a) * r;
          item.y = this.pan.y + Math.sin(a) * r;
        }
        if (Math.random() < 0.16) this._spark(p.x, p.y, COLORS.flame, 1, 30);
      }
    }
  }

  _panUp() {
    if (this.draggingFlame) { this.draggingFlame = false; return; }
    if (this.drag?.kind === 'prepped') {
      const item = this.drag.item;
      this.drag = null;
      if (Math.hypot(item.x - this.pan.x, item.y - this.pan.y) < this.pan.r - 14) {
        item.inPan = true;
        this.panItems.push(item);
        sound.playSizzle();
        this._spark(item.x, item.y, COLORS.flame, 14, 70);
        if (this.panItems.length === this.prepped.length) {
          this._showToast('全部下锅。把锅温稳定在目标区间，并不断翻炒防止焦糊');
        }
      } else {
        item.x = item.homeX;
        item.y = item.homeY;
      }
      return;
    }
    this.drag = null;
  }

  _updatePan(dt) {
    // 灶火 → 锅温，带惯性
    const targetTemp = 18 + this.flame * 0.92;
    this.temp += (targetTemp - this.temp) * (1 - Math.exp(-1.7 * dt));
    this.stirGlow = Math.max(0, this.stirGlow - dt * 0.85);

    if (this.panItems.length < this.prepped.length) return;

    this.cookTimer += dt;
    const diff = Math.abs(this.temp - this.targetTemp);
    this.tempSamples++;
    if (diff <= this.tempTolerance) this.tempHits++;

    for (const item of this.panItems) {
      const heatFactor = clamp01((this.temp - 40) / 60);
      item.brown = clamp01(item.brown + heatFactor * dt * 0.16);
      // 温度过高且不翻炒就开始焦糊
      if (this.temp > this.targetTemp + this.tempTolerance) {
        item.scorch = clamp01(item.scorch + (this.temp - this.targetTemp - this.tempTolerance) * dt * 0.011);
      }
    }

    if (this.cookTimer >= this.cookDuration) {
      const accuracy = this.tempSamples ? this.tempHits / this.tempSamples : 0.5;
      const avgScorch = this.panItems.reduce((s, i) => s + i.scorch, 0) / Math.max(1, this.panItems.length);
      this.heatScore = Math.round(clamp(accuracy * 100 * 0.72 + (1 - avgScorch) * 100 * 0.28, 20, 100));
      this._beginSeason();
    }
  }

  // ============================================================
  // 工位三：调味
  // ============================================================

  _initSeason() {
    this.seasonScore = 0;
    this.shakers = [];
    this.activeShaker = null;
    this.seasonIndex = 0;
  }

  _beginSeason() {
    this._setStage('season');
    const rand = seedFrom(this.recipe?.id || 'dish');
    this.shakers = SEASONINGS.map((s, i) => ({
      ...s,
      x: 150 + i * 118,
      y: 378,
      homeX: 150 + i * 118,
      homeY: 378,
      target: Math.round(35 + rand() * 50),  // 目标用量
      amount: 0,
      settled: false
    }));
    this._showToast('把调味瓶拖到锅上方，按住撒料，接近目标刻度时松手');
  }

  _seasonDown(p) {
    for (const s of this.shakers) {
      if (s.settled) continue;
      if (Math.hypot(p.x - s.x, p.y - s.y) < 30) {
        this.activeShaker = s;
        this.drag = { kind: 'shaker', s, dx: p.x - s.x, dy: p.y - s.y };
        return;
      }
    }
  }

  _seasonMove(p) {
    if (this.drag?.kind === 'shaker') {
      this.drag.s.x = p.x - this.drag.dx;
      this.drag.s.y = p.y - this.drag.dy;
    }
  }

  _seasonUp() {
    if (this.drag?.kind === 'shaker') {
      const s = this.drag.s;
      this.drag = null;
      this.activeShaker = null;
      if (s.amount > 3) {
        s.settled = true;
        sound.playSparkle();
        const err = Math.abs(s.amount - s.target);
        this._showToast(`${s.name}：${Math.round(s.amount)} / 目标 ${s.target}（偏差 ${Math.round(err)}）`);
      }
      s.x = s.homeX;
      s.y = s.homeY;

      if (this.shakers.every(k => k.settled)) {
        const errs = this.shakers.map(k => Math.abs(k.amount - k.target));
        const avgErr = errs.reduce((a, b) => a + b, 0) / errs.length;
        this.seasonScore = Math.round(clamp(100 - avgErr * 2.6, 20, 100));
        this._beginPlate();
      }
    }
  }

  _updateSeason(dt) {
    const s = this.activeShaker;
    if (!s || !this.pointer.down) return;
    // 瓶口悬在锅上方才会落料（调味工位的锅画在 196）
    const overPan = Math.hypot(s.x - this.pan.x, s.y - 196) < this.pan.r + 56;
    if (!overPan) return;
    s.amount = Math.min(120, s.amount + dt * 34);
    if (Math.random() < 0.55) {
      this._spark(s.x + (Math.random() - 0.5) * 14, s.y + 22, s.color, 1, 12);
    }
  }

  // ============================================================
  // 工位四：摆盘
  // ============================================================

  _initPlate() {
    this.platingScore = 0;
    this.plate = { x: W / 2, y: 208, r: 110 };
    this.plateItems = [];
    this.sauceStrokes = [];
    this.sauceDraft = [];
    this.drawingSauce = false;
    this.garnishes = [];
    this.plateStyle = null;
    this.finishBtn = { x: 694, y: 400, w: 110, h: 44 };
  }

  _beginPlate() {
    this._setStage('plate');
    this.panItems.forEach((item, i) => {
      item.x = 108 + i * 60;
      item.y = 400;
      item.homeX = item.x;
      item.homeY = item.y;
      item.onPlate = false;
    });
    this.garnishes = GARNISHES.map((g, i) => {
      const x = 505 + i * 47;
      return { ...g, x, y: 404, homeX: x, homeY: 404, onPlate: false };
    });
    this._showToast('摆开菜品，可加点缀、画多道酱汁，满意后点出餐');
  }

  _hitFinishBtn(p) {
    const b = this.finishBtn;
    return Math.abs(p.x - b.x) <= b.w / 2 && Math.abs(p.y - b.y) <= b.h / 2;
  }

  _canFinish() {
    return this.panItems.every(i => i.onPlate) && this.sauceStrokes.length > 0;
  }

  _plateDown(p) {
    if (this._hitFinishBtn(p)) {
      if (this._canFinish()) {
        sound.playSparkle();
        this._finish();
      } else {
        this._showToast('先把菜品全部摆进盘中，并至少画一道酱汁');
      }
      return;
    }

    for (const item of this.panItems) {
      if (Math.hypot(p.x - item.x, p.y - item.y) < 28) {
        this.drag = { kind: 'plate', item, dx: p.x - item.x, dy: p.y - item.y };
        return;
      }
    }
    for (const g of this.garnishes) {
      if (Math.hypot(p.x - g.x, p.y - g.y) < 20) {
        this.drag = { kind: 'garnish', item: g, dx: p.x - g.x, dy: p.y - g.y };
        return;
      }
    }

    // 菜品全部摆好后才能落酱，最多三道
    if (this.panItems.every(i => i.onPlate)
      && this.sauceStrokes.length < MAX_SAUCE_STROKES
      && Math.hypot(p.x - this.plate.x, p.y - this.plate.y) < this.plate.r) {
      this.drawingSauce = true;
      this.sauceDraft = [{ x: p.x, y: p.y }];
    }
  }

  _plateMove(p) {
    if (this.drag) {
      this.drag.item.x = p.x - this.drag.dx;
      this.drag.item.y = p.y - this.drag.dy;
      return;
    }
    if (this.drawingSauce) {
      const last = this.sauceDraft[this.sauceDraft.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 6) {
        this.sauceDraft.push({ x: p.x, y: p.y });
      }
    }
  }

  _plateUp() {
    if (this.drag) {
      const { kind, item } = this.drag;
      this.drag = null;
      const limit = this.plate.r - (kind === 'garnish' ? 10 : 16);
      if (Math.hypot(item.x - this.plate.x, item.y - this.plate.y) < limit) {
        item.onPlate = true;
        if (kind === 'garnish') {
          this._spark(item.x, item.y, item.color, 8, 40);
          sound.playSparkle();
        } else {
          sound.playChop();
        }
      } else {
        item.onPlate = false;
        item.x = item.homeX;
        item.y = item.homeY;
      }
      return;
    }

    if (this.drawingSauce) {
      this.drawingSauce = false;
      if (this.sauceDraft.length > 6) {
        this.sauceStrokes.push(this.sauceDraft);
        this.sauceDraft = [];
        sound.playSparkle();
        const left = MAX_SAUCE_STROKES - this.sauceStrokes.length;
        this._showToast(left > 0 ? `酱汁 ${this.sauceStrokes.length}/${MAX_SAUCE_STROKES}，还能再加 ${left} 道` : '酱汁已画满，点出餐收尾');
      } else {
        this.sauceDraft = [];
        this._showToast('酱汁线太短，再拖一道流畅的线条');
      }
    }
  }

  /**
   * 识别摆盘构图：中心堆叠、环形环绕、一线排布，都不像就算自然散点。
   * purity 是这套构图做得有多干净。
   */
  _analyzeComposition(onPlate) {
    const n = onPlate.length;
    if (n < 2) return { name: '单点主角', purity: 0.72 };

    const pts = onPlate.map(i => ({ x: i.x - this.plate.x, y: i.y - this.plate.y }));
    const cx = pts.reduce((s, p) => s + p.x, 0) / n;
    const cy = pts.reduce((s, p) => s + p.y, 0) / n;

    // 中心堆叠：彼此挨得近，且这一团压在盘心
    const maxFromCentroid = Math.max(...pts.map(p => Math.hypot(p.x - cx, p.y - cy)));
    const cluster = clamp01(1 - maxFromCentroid / 54) * clamp01(1 - Math.hypot(cx, cy) / 60);

    // 环形环绕：到盘心的半径接近，且角度分得开
    let ring = 0;
    const radii = pts.map(p => Math.hypot(p.x, p.y));
    const rm = radii.reduce((s, r) => s + r, 0) / n;
    if (n >= 3 && rm > 36) {
      const rdev = radii.reduce((s, r) => s + Math.abs(r - rm), 0) / n;
      const angs = pts.map(p => Math.atan2(p.y, p.x)).sort((a, b) => a - b);
      const idealGap = (Math.PI * 2) / n;
      let gdev = 0;
      for (let i = 0; i < n; i++) {
        const next = i === n - 1 ? angs[0] + Math.PI * 2 : angs[i + 1];
        gdev += Math.abs(next - angs[i] - idealGap);
      }
      gdev /= n;
      ring = clamp01(1 - rdev / 26) * clamp01(1 - gdev / (idealGap * 0.85));
    }

    // 一线排布：主轴方向拉得开，副轴方向几乎没有厚度
    let line = 0;
    let sxx = 0, syy = 0, sxy = 0;
    for (const p of pts) {
      const dx = p.x - cx;
      const dy = p.y - cy;
      sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
    }
    const tr = sxx + syy;
    const det = sxx * syy - sxy * sxy;
    const root = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
    const e1 = tr / 2 + root;
    const e2 = Math.max(0, tr / 2 - root);
    if (e1 > 1) {
      line = clamp01(1 - e2 / e1) * clamp01(Math.sqrt(e1 / n) / 44);
    }

    const best = Math.max(cluster, ring, line);
    if (best < 0.42) return { name: '自然散点', purity: 0.55 };
    if (best === ring) return { name: '环形环绕', purity: ring };
    if (best === line) return { name: n === 2 ? '对称双拼' : '一线排布', purity: line };
    return { name: '中心堆叠', purity: cluster };
  }

  /** 单笔酱汁的走势：首尾闭合算环绕，笔直算直线，其余算弧线。 */
  _sauceShapeName(path, len) {
    const a = path[0];
    const b = path[path.length - 1];
    const gap = Math.hypot(b.x - a.x, b.y - a.y);
    if (gap < len * 0.22) return '环绕';
    if (gap > len * 0.9) return '直线';
    return '弧线';
  }

  _scoreSauce() {
    if (!this.sauceStrokes.length) return { score: 0, name: '无' };

    let sum = 0;
    const names = [];
    for (const s of this.sauceStrokes) {
      let len = 0;
      let inside = 0;
      for (let i = 1; i < s.length; i++) {
        len += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y);
        if (Math.hypot(s[i].x - this.plate.x, s[i].y - this.plate.y) < this.plate.r) inside++;
      }
      const lenScore = clamp01(1 - Math.abs(len - 200) / 240);
      const insideRatio = inside / Math.max(1, s.length - 1);
      sum += lenScore * 0.5 + insideRatio * 0.5;
      names.push(this._sauceShapeName(s, len));
    }

    // 多画几道给一点加成，逼着人把盘面填出层次
    const variety = [0.88, 1, 1.06][Math.min(2, this.sauceStrokes.length - 1)];
    return {
      score: clamp01((sum / this.sauceStrokes.length) * variety),
      name: [...new Set(names)].join('+')
    };
  }

  _scoreGarnish() {
    const placed = this.garnishes.filter(g => g.onPlate);
    if (!placed.length) return { score: 0, count: 0 };

    let score = clamp01(placed.length / 2) * 0.75;
    if (placed.length > 1) {
      let minD = Infinity;
      for (let i = 0; i < placed.length; i++) {
        for (let j = i + 1; j < placed.length; j++) {
          minD = Math.min(minD, Math.hypot(placed[i].x - placed[j].x, placed[i].y - placed[j].y));
        }
      }
      score += clamp01(minD / 60) * 0.25;
    } else {
      score += 0.12;
    }
    return { score: clamp01(score), count: placed.length };
  }

  /**
   * 摆盘评分：入盘比例、重心、构图纯度、酱汁走势、点缀布置。
   */
  _scorePlating() {
    const items = this.panItems;
    const onPlate = items.filter(i => i.onPlate);
    if (onPlate.length === 0) {
      this.plateStyle = '空盘';
      return 20;
    }

    const cx = onPlate.reduce((s, i) => s + i.x, 0) / onPlate.length;
    const cy = onPlate.reduce((s, i) => s + i.y, 0) / onPlate.length;
    const centerOff = Math.hypot(cx - this.plate.x, cy - this.plate.y);
    const balance = clamp01(1 - centerOff / (this.plate.r * 0.62));

    const comp = this._analyzeComposition(onPlate);
    const sauce = this._scoreSauce();
    const garnish = this._scoreGarnish();
    const coverage = onPlate.length / items.length;

    const parts = [comp.name];
    if (sauce.name !== '无') parts.push(`${sauce.name}酱汁`);
    if (garnish.count) parts.push(`${garnish.count} 味点缀`);
    this.plateStyle = parts.join(' · ');

    const raw = coverage * 30 + balance * 14 + comp.purity * 22 + sauce.score * 20 + garnish.score * 14;
    return Math.round(clamp(raw, 20, 100));
  }

  _finish() {
    this.platingScore = this._scorePlating();
    this._setStage('done');

    // 主厨特长按工位加成，超过 100 截断
    const mult = this.chef?.kitchen || { knife: 1, heat: 1, season: 1, plating: 1 };
    const boost = (raw, m) => Math.min(100, Math.round(raw * m));
    const scores = {
      knife: boost(this.knifeScore, mult.knife),
      heat: boost(this.heatScore, mult.heat),
      season: boost(this.seasonScore, mult.season),
      plating: boost(this.platingScore, mult.plating),
      chefId: this.chef?.id || null,
      chefName: this.chef?.name || null,
      chefBonus: this.chef?.kitchenNote || null,
      sliceStyle: this.sliceStyle || null,
      plateStyle: this.plateStyle || null
    };
    scores.total = Math.round(
      scores.knife * 0.24 + scores.heat * 0.32 + scores.season * 0.2 + scores.plating * 0.24
    );

    this.finalScores = scores;
    // 照片要拍干净的成品盘，等下一帧托盘与提示都撤掉再抓图
    this._pendingCapture = true;
  }

  // ============================================================
  // 更新
  // ============================================================

  _update(dt) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast = null;
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 130 * dt;
      if (s.life <= 0) this.sparks.splice(i, 1);
    }

    if (this.stage === 'pan') this._updatePan(dt);
    else if (this.stage === 'season') this._updateSeason(dt);
  }

  // ============================================================
  // 渲染
  // ============================================================

  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);

    // 台面
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, W, H);
    this._drawCounterTexture(ctx);
    this._drawStageRail(ctx);

    if (this.stage === 'prep') this._renderPrep(ctx);
    else if (this.stage === 'pan') this._renderPan(ctx);
    else if (this.stage === 'season') this._renderSeason(ctx);
    else if (this.stage === 'plate' || this.stage === 'done') this._renderPlate(ctx);

    this._drawSparks(ctx);
    this._drawToast(ctx);

    if (this._pendingCapture) {
      this._pendingCapture = false;
      const photo = captureDishThumb(this.canvas, this.plate, W, H);
      if (this.finalScores) this.finalScores.photo = photo;
      this._spark(this.plate.x, this.plate.y, COLORS.gold, 40, 190);
      if (this.onComplete) this.onComplete(this.finalScores);
    }
  }

  _drawCounterTexture(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(92, 213, 189, 0.045)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 38) {
      ctx.beginPath(); ctx.moveTo(x, 44); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 44; y < H; y += 38) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
  }

  _drawStageRail(ctx) {
    const stages = [
      { key: 'prep', label: '备料' },
      { key: 'pan', label: '炉火' },
      { key: 'season', label: '调味' },
      { key: 'plate', label: '摆盘' }
    ];
    const order = ['prep', 'pan', 'season', 'plate', 'done'];
    const cur = order.indexOf(this.stage);

    ctx.save();
    ctx.font = '600 11px "Helvetica Neue", sans-serif';
    ctx.textBaseline = 'middle';
    let x = 22;
    stages.forEach((s, i) => {
      const idx = order.indexOf(s.key);
      const active = idx === cur;
      const done = idx < cur;
      const color = active ? COLORS.gold : (done ? COLORS.mint : COLORS.mutedDim);

      ctx.strokeStyle = color;
      ctx.fillStyle = active ? 'rgba(240, 199, 124, 0.14)' : 'transparent';
      ctx.lineWidth = active ? 1.6 : 1;
      const w = 74;
      ctx.beginPath();
      ctx.roundRect(x, 12, w, 24, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(`0${i + 1}  ${s.label}`, x + w / 2, 25);

      x += w;
      if (i < stages.length - 1) {
        ctx.strokeStyle = done ? COLORS.mint : 'rgba(91, 131, 144, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 4, 24); ctx.lineTo(x + 16, 24); ctx.stroke();
        x += 20;
      }
    });

    // 已得分数
    ctx.textAlign = 'right';
    ctx.font = '500 10px "SFMono-Regular", monospace';
    const parts = [];
    if (this.knifeScore) parts.push(`刀工 ${this.knifeScore}`);
    if (this.heatScore) parts.push(`火候 ${this.heatScore}`);
    if (this.seasonScore) parts.push(`调味 ${this.seasonScore}`);
    if (this.platingScore) parts.push(`摆盘 ${this.platingScore}`);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(parts.join('   ') || (this.recipe?.name || ''), W - 22, 25);
    ctx.restore();
  }

  _panelBox(ctx, x, y, w, h, label) {
    ctx.save();
    ctx.fillStyle = COLORS.panel;
    ctx.strokeStyle = COLORS.panelEdge;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, 8);
    ctx.fill();
    ctx.stroke();
    if (label) {
      ctx.fillStyle = COLORS.mutedDim;
      ctx.font = '500 9px "SFMono-Regular", monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(label, x - w / 2 + 10, y - h / 2 + 15);
    }
    ctx.restore();
  }

  _drawIngredient(ctx, item, size, opts = {}) {
    const ing = item.ing;
    const color = opts.color || COLORS.mint;
    ctx.save();
    ctx.translate(item.x, item.y);

    // 底托：浅色盘面上要压到很淡，否则会变成一团灰斑
    ctx.fillStyle = opts.onLight ? 'rgba(120, 96, 62, 0.16)' : 'rgba(4, 12, 17, 0.5)';
    ctx.beginPath();
    ctx.ellipse(0, size * 0.62, size * 0.6, size * (opts.onLight ? 0.14 : 0.2), 0, 0, Math.PI * 2);
    ctx.fill();

    if (opts.brown) {
      // 下锅后的焦化与焦糊染色
      const brown = opts.brown;
      const scorch = opts.scorch || 0;
      ctx.globalAlpha = 1;
      ctx.fillStyle = `rgba(${Math.round(lerp(120, 60, scorch))}, ${Math.round(lerp(80, 34, scorch))}, 30, ${brown * 0.55})`;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.58, 0, Math.PI * 2);
      ctx.fill();
    }

    drawIngredientGlyph(ctx, ing.id, 0, 0, size * 0.5, color);
    ctx.restore();
  }

  _renderPrep(ctx) {
    // 待处理区
    this._panelBox(ctx, W / 2, 96, 640, 92, '待处理 / RAW');
    // 砧板
    const b = this.board;
    ctx.save();
    ctx.fillStyle = COLORS.steel;
    ctx.strokeStyle = 'rgba(240, 199, 124, 0.32)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 10);
    ctx.fill();
    ctx.stroke();
    // 砧板纹理
    ctx.strokeStyle = 'rgba(148, 197, 205, 0.09)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      const yy = b.y - b.h / 2 + (b.h / 8) * i;
      ctx.beginPath(); ctx.moveTo(b.x - b.w / 2 + 12, yy); ctx.lineTo(b.x + b.w / 2 - 12, yy); ctx.stroke();
    }
    ctx.fillStyle = COLORS.mutedDim;
    ctx.font = '500 9px "SFMono-Regular", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('砧 板 / CUTTING BOARD', b.x, b.y + b.h / 2 - 10);
    ctx.restore();

    // 备料盘
    this._panelBox(ctx, W / 2, 408, 640, 76, '备料盘 / PREPPED');

    // 生食材
    for (const item of this.rawQueue) {
      if (item.done || item === this.activeItem) continue;
      this._drawIngredient(ctx, item, 46, { color: COLORS.mint });
      ctx.save();
      ctx.fillStyle = COLORS.muted;
      ctx.font = '500 8px "SFMono-Regular", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(PREP_LABELS[item.prepType].name, item.x, item.y + 34);
      ctx.restore();
    }

    // 砧板上的食材与处理反馈
    if (this.activeItem) {
      const item = this.activeItem;
      this._drawIngredient(ctx, item, 76, { color: COLORS.gold });
      const type = item.prepType;

      if (type === 'slice') {
        // 已切出的刀痕：按各自的角度与垂距画，并裁进食材范围
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.board.x, this.board.y, 62, 0, Math.PI * 2);
        ctx.clip();
        ctx.strokeStyle = 'rgba(245, 239, 223, 0.62)';
        ctx.lineWidth = 2;
        for (const c of this.cuts) {
          const dirX = Math.cos(c.angle);
          const dirY = Math.sin(c.angle);
          // 沿法线 (-sinθ, cosθ) 偏移出这一刀的位置
          const px = this.board.x - dirY * c.offset;
          const py = this.board.y + dirX * c.offset;
          ctx.beginPath();
          ctx.moveTo(px - dirX * 90, py - dirY * 90);
          ctx.lineTo(px + dirX * 90, py + dirY * 90);
          ctx.stroke();
        }
        ctx.restore();
        // 刀轨
        if (this.knifeTrail.length > 1) {
          ctx.save();
          ctx.strokeStyle = COLORS.mint;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = COLORS.mint;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.moveTo(this.knifeTrail[0].x, this.knifeTrail[0].y);
          for (const p of this.knifeTrail) ctx.lineTo(p.x, p.y);
          ctx.stroke();
          ctx.restore();
        }
      } else if (type === 'grind') {
        // 研磨圈
        ctx.save();
        ctx.strokeStyle = 'rgba(240, 199, 124, 0.35)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(this.board.x, this.board.y, 58, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // 进度环
      const prog = clamp01(item.progress || 0);
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 197, 205, 0.2)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(this.board.x, this.board.y, 66, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = COLORS.gold;
      ctx.beginPath();
      ctx.arc(this.board.x, this.board.y, 66, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (this.rawQueue.some(i => !i.done)) {
      ctx.save();
      ctx.fillStyle = COLORS.mutedDim;
      ctx.font = '500 11px "Helvetica Neue", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('把上方食材拖到砧板上开始处理', this.board.x, this.board.y - 4);
      ctx.restore();
    }

    // 已备好的
    let px = 96;
    for (const item of this.prepped) {
      const ghost = { ...item, x: px, y: 408 };
      this._drawIngredient(ctx, ghost, 40, { color: COLORS.mint });
      ctx.save();
      ctx.fillStyle = COLORS.gold;
      ctx.font = '500 9px "SFMono-Regular", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(String(item.score), px, 408 + 30);
      ctx.restore();
      px += 66;
    }

    // 拖拽中的食材画在最上层
    if (this.drag?.kind === 'raw') {
      this._drawIngredient(ctx, this.drag.item, 52, { color: COLORS.gold });
    }
  }

  _renderPan(ctx) {
    // 灶火滤杆
    const k = this.flameKnob;
    ctx.save();
    ctx.fillStyle = COLORS.panel;
    ctx.strokeStyle = COLORS.panelEdge;
    ctx.beginPath();
    ctx.roundRect(k.x - 30, k.y - k.h / 2 - 14, 60, k.h + 44, 8);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = COLORS.mutedDim;
    ctx.font = '500 9px "SFMono-Regular", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('灶火', k.x, k.y - k.h / 2 - 2);

    // 槽
    const top = k.y - k.h / 2;
    ctx.fillStyle = 'rgba(4, 12, 17, 0.7)';
    ctx.beginPath();
    ctx.roundRect(k.x - 9, top + 8, 18, k.h - 8, 9);
    ctx.fill();
    // 火焰填充
    const fillH = (this.flame / 100) * (k.h - 16);
    const grad = ctx.createLinearGradient(0, top + k.h - 8, 0, top + k.h - 8 - fillH);
    grad.addColorStop(0, '#b5451f');
    grad.addColorStop(0.55, COLORS.flame);
    grad.addColorStop(1, '#ffd98a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(k.x - 9, top + k.h - 8 - fillH, 18, fillH, 9);
    ctx.fill();
    // 把手
    const knobY = top + k.h - 8 - fillH;
    ctx.fillStyle = COLORS.cream;
    ctx.beginPath();
    ctx.roundRect(k.x - 16, knobY - 4, 32, 8, 4);
    ctx.fill();
    ctx.fillStyle = COLORS.gold;
    ctx.font = '600 10px "SFMono-Regular", monospace';
    ctx.fillText(`${Math.round(this.flame)}%`, k.x, k.y + k.h / 2 + 24);
    ctx.restore();

    // 温度表
    this._drawTempGauge(ctx);

    // 锅
    const p = this.pan;
    ctx.save();
    // 锅身
    ctx.fillStyle = '#0a1a22';
    ctx.strokeStyle = COLORS.steelLight;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 锅底受热
    const heatT = clamp01((this.temp - 30) / 70);
    if (heatT > 0.02) {
      const hg = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, p.r);
      hg.addColorStop(0, `rgba(249, 160, 63, ${0.3 * heatT})`);
      hg.addColorStop(0.6, `rgba(181, 69, 31, ${0.16 * heatT})`);
      hg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // 油光
    ctx.strokeStyle = `rgba(255, 226, 150, ${0.1 + 0.22 * heatT})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const rr = p.r * (0.34 + i * 0.2);
      ctx.beginPath();
      ctx.arc(p.x + Math.sin(this.time * 1.4 + i) * 4, p.y + Math.cos(this.time * 1.1 + i) * 3, rr, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 翻炒高亮
    if (this.stirGlow > 0.02) {
      ctx.strokeStyle = `rgba(92, 213, 189, ${0.5 * this.stirGlow})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r - 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // 锅内食材
    for (const item of this.panItems) {
      this._drawIngredient(ctx, item, 44, {
        color: item.scorch > 0.55 ? '#7c5a3a' : COLORS.gold,
        brown: item.brown,
        scorch: item.scorch
      });
    }

    // 备料盘（待下锅）
    this._panelBox(ctx, W / 2, 412, 640, 66, '待下锅 / READY');
    for (const item of this.prepped) {
      if (item.inPan) continue;
      if (this.drag?.kind === 'prepped' && this.drag.item === item) continue;
      this._drawIngredient(ctx, item, 40, { color: COLORS.mint });
    }
    if (this.drag?.kind === 'prepped') {
      this._drawIngredient(ctx, this.drag.item, 46, { color: COLORS.gold });
    }

    // 烹饪计时
    if (this.panItems.length === this.prepped.length) {
      const left = Math.max(0, this.cookDuration - this.cookTimer);
      ctx.save();
      ctx.fillStyle = COLORS.cream;
      ctx.font = '600 13px "SFMono-Regular", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${left.toFixed(1)}s`, p.x, p.y - p.r - 14);
      ctx.fillStyle = COLORS.mutedDim;
      ctx.font = '500 10px "Helvetica Neue", sans-serif';
      ctx.fillText('在锅内拖动画圈翻炒', p.x, p.y + p.r + 20);
      ctx.restore();
    }
  }

  _drawTempGauge(ctx) {
    const gx = W - 92, gy = 222, gh = 166;
    ctx.save();
    ctx.fillStyle = COLORS.panel;
    ctx.strokeStyle = COLORS.panelEdge;
    ctx.beginPath();
    ctx.roundRect(gx - 34, gy - gh / 2 - 14, 68, gh + 46, 8);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = COLORS.mutedDim;
    ctx.font = '500 9px "SFMono-Regular", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('锅温', gx, gy - gh / 2 - 2);

    const top = gy - gh / 2 + 8;
    const trackH = gh - 8;
    ctx.fillStyle = 'rgba(4, 12, 17, 0.7)';
    ctx.beginPath();
    ctx.roundRect(gx - 11, top, 22, trackH, 11);
    ctx.fill();

    // 目标区
    const toPos = t => top + trackH - (clamp(t, 0, 110) / 110) * trackH;
    const zTop = toPos(this.targetTemp + this.tempTolerance);
    const zBot = toPos(this.targetTemp - this.tempTolerance);
    ctx.fillStyle = 'rgba(92, 213, 189, 0.32)';
    ctx.fillRect(gx - 11, zTop, 22, zBot - zTop);
    ctx.strokeStyle = COLORS.mint;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(gx - 15, zTop); ctx.lineTo(gx + 15, zTop); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx - 15, zBot); ctx.lineTo(gx + 15, zBot); ctx.stroke();

    // 当前温度
    const cy = toPos(this.temp);
    const inZone = Math.abs(this.temp - this.targetTemp) <= this.tempTolerance;
    ctx.fillStyle = inZone ? COLORS.mint : COLORS.coral;
    ctx.beginPath();
    ctx.roundRect(gx - 17, cy - 3, 34, 6, 3);
    ctx.fill();

    ctx.fillStyle = inZone ? COLORS.mint : COLORS.coral;
    ctx.font = '600 11px "SFMono-Regular", monospace';
    ctx.fillText(`${Math.round(this.temp)}°`, gx, gy + gh / 2 + 24);
    ctx.fillStyle = COLORS.mutedDim;
    ctx.font = '500 9px "SFMono-Regular", monospace';
    ctx.fillText(`目标 ${this.targetTemp}°`, gx, gy + gh / 2 + 38);
    ctx.restore();
  }

  _renderSeason(ctx) {
    // 锅（简化，保留视觉连续性）
    const p = this.pan;
    const panY = 196;
    ctx.save();
    ctx.fillStyle = '#0a1a22';
    ctx.strokeStyle = COLORS.steelLight;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x, panY, p.r, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.restore();

    for (const item of this.panItems) {
      const ghost = { ...item, x: p.x + (item.x - p.x) * 0.7, y: panY + (item.y - p.y) * 0.7 };
      this._drawIngredient(ctx, ghost, 42, { color: COLORS.gold, brown: item.brown, scorch: item.scorch });
    }

    this._panelBox(ctx, W / 2, 392, 640, 84, '调味台 / SEASONING');

    for (const s of this.shakers) {
      const isDragging = this.drag?.kind === 'shaker' && this.drag.s === s;
      ctx.save();
      ctx.translate(s.x, s.y);

      // 瓶身
      ctx.fillStyle = s.settled ? 'rgba(30, 61, 76, 0.6)' : COLORS.steel;
      ctx.strokeStyle = s.settled ? COLORS.mint : COLORS.gold;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.roundRect(-13, -20, 26, 40, 5);
      ctx.fill(); ctx.stroke();
      // 瓶盖
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.roundRect(-9, -26, 18, 8, 3);
      ctx.fill();

      ctx.fillStyle = s.settled ? COLORS.mint : COLORS.cream;
      ctx.font = '500 8px "Helvetica Neue", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(s.name, 0, 34);

      // 用量刻度
      const bw = 62;
      ctx.fillStyle = 'rgba(4, 12, 17, 0.8)';
      ctx.beginPath(); ctx.roundRect(-bw / 2, 40, bw, 7, 3.5); ctx.fill();
      // 目标标记
      ctx.fillStyle = COLORS.goldDim;
      const tx = -bw / 2 + (s.target / 120) * bw;
      ctx.fillRect(tx - 1, 38, 2, 11);
      // 当前量
      const err = Math.abs(s.amount - s.target);
      ctx.fillStyle = err < 8 ? COLORS.mint : (err < 20 ? COLORS.gold : COLORS.coral);
      ctx.beginPath(); ctx.roundRect(-bw / 2, 40, (s.amount / 120) * bw, 7, 3.5); ctx.fill();
      ctx.restore();

      // 撒料动画
      if (isDragging && this.pointer.down) {
        ctx.save();
        ctx.fillStyle = s.color;
        for (let i = 0; i < 5; i++) {
          const t = (this.time * 3 + i * 0.4) % 1;
          ctx.globalAlpha = 1 - t;
          ctx.beginPath();
          ctx.arc(s.x + Math.sin(i * 2.1 + this.time * 6) * 8, s.y + 22 + t * 44, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }

    ctx.save();
    ctx.fillStyle = COLORS.mutedDim;
    ctx.font = '500 11px "Helvetica Neue", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('拖调味瓶到锅上方按住撒料，金线是目标用量', W / 2, 330);
    ctx.restore();
  }

  _renderPlate(ctx) {
    const pl = this.plate;
    ctx.save();
    // 盘子
    ctx.fillStyle = '#f3ece0';
    ctx.beginPath();
    ctx.arc(pl.x, pl.y, pl.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e6ddcd';
    ctx.beginPath();
    ctx.arc(pl.x, pl.y, pl.r * 0.82, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(240, 199, 124, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(pl.x, pl.y, pl.r * 0.82, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 底部托盘要先画，否则会盖住摆在盘上的菜品
    if (this.stage !== 'done') {
      this._panelBox(ctx, 280, 400, 400, 66, '出锅菜品 / COMPONENTS');
      this._panelBox(ctx, 552, 400, 124, 66, '点缀 / GARNISH');
      this._drawFinishBtn(ctx);

      ctx.save();
      ctx.fillStyle = COLORS.mutedDim;
      ctx.font = '500 11px "Helvetica Neue", sans-serif';
      ctx.textAlign = 'center';
      const allOn = this.panItems.every(i => i.onPlate);
      const tip = !allOn
        ? '把菜品拖到盘中，试试中心堆叠 / 环形环绕 / 一线排布'
        : `在盘上拖酱汁线（${this.sauceStrokes.length}/${MAX_SAUCE_STROKES}），点缀可拖上盘`;
      ctx.fillText(tip, W / 2, 344);
      ctx.restore();
    }

    // 酱汁：已落笔的与正在画的
    const drawStroke = (path, alpha) => {
      if (path.length < 2) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = 'rgba(150, 60, 40, 0.78)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (const p of path) ctx.lineTo(p.x, p.y);
      ctx.stroke();
      ctx.restore();
    };
    this.sauceStrokes.forEach(s => drawStroke(s, 1));
    drawStroke(this.sauceDraft, 0.7);

    // 菜品
    for (const item of this.panItems) {
      if (this.drag?.item === item) continue;
      this._drawIngredient(ctx, item, item.onPlate ? 46 : 40, {
        color: item.onPlate ? '#a8692b' : COLORS.mint,
        brown: item.brown,
        scorch: item.scorch,
        onLight: item.onPlate
      });
    }

    // 点缀
    for (const g of this.garnishes) {
      if (this.drag?.item === g) continue;
      this._drawGarnish(ctx, g, g.onPlate ? 1 : 0.82);
    }

    if (this.drag?.kind === 'plate') {
      this._drawIngredient(ctx, this.drag.item, 50, { color: COLORS.gold, brown: this.drag.item.brown });
    } else if (this.drag?.kind === 'garnish') {
      this._drawGarnish(ctx, this.drag.item, 1, 1.2);
    }

    // 抓图的那一帧不写风格文案，否则会被裁进照片里
    if (this.stage === 'done' && this.plateStyle && !this._pendingCapture) {
      ctx.save();
      ctx.fillStyle = COLORS.gold;
      ctx.font = '600 13px "Helvetica Neue", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.plateStyle, W / 2, this.plate.y + this.plate.r + 34);
      ctx.restore();
    }
  }

  _drawFinishBtn(ctx) {
    const b = this.finishBtn;
    const ready = this._canFinish();
    ctx.save();
    ctx.fillStyle = ready ? 'rgba(240, 199, 124, 0.16)' : 'rgba(15, 38, 50, 0.9)';
    ctx.strokeStyle = ready ? COLORS.gold : 'rgba(91, 131, 144, 0.5)';
    ctx.lineWidth = ready ? 1.8 : 1;
    ctx.beginPath();
    ctx.roundRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 7);
    ctx.fill();
    ctx.stroke();

    if (ready) {
      ctx.globalAlpha = 0.35 + Math.sin(this.time * 4) * 0.2;
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = ready ? COLORS.gold : COLORS.mutedDim;
    ctx.font = '700 15px "Helvetica Neue", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('出 餐', b.x, b.y - 5);
    ctx.font = '500 9px "SFMono-Regular", monospace';
    ctx.fillText('SERVE', b.x, b.y + 11);
    ctx.restore();
  }

  _drawGarnish(ctx, g, alpha = 1, scale = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(g.x, g.y);
    ctx.scale(scale, scale);
    ctx.fillStyle = g.color;
    ctx.strokeStyle = g.color;
    ctx.lineWidth = 1.4;

    if (g.id === 'herb') {
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.bezierCurveTo(8, -5, 8, 6, 0, 11);
      ctx.bezierCurveTo(-8, 6, -8, -5, 0, -11);
      ctx.fill();
      ctx.strokeStyle = 'rgba(6, 40, 24, 0.55)';
      ctx.beginPath();
      ctx.moveTo(0, -9); ctx.lineTo(0, 9);
      ctx.stroke();
    } else if (g.id === 'flower') {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        ctx.beginPath();
        ctx.ellipse(Math.cos(a) * 6, Math.sin(a) * 6, 5, 3.4, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + 0.4;
        const r = 4 + (i % 3) * 3.4;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  _drawSparks(ctx) {
    ctx.save();
    for (const s of this.sparks) {
      ctx.globalAlpha = clamp01(s.life / s.maxLife);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawToast(ctx) {
    if (!this.toast) return;
    ctx.save();
    ctx.globalAlpha = clamp01(this.toastTimer / 0.5);
    ctx.font = '500 11px "Helvetica Neue", sans-serif';
    const w = ctx.measureText(this.toast).width + 26;
    ctx.fillStyle = 'rgba(6, 19, 27, 0.94)';
    ctx.strokeStyle = COLORS.goldDim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(W / 2 - w / 2, H - 34, w, 24, 5);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = COLORS.cream;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.toast, W / 2, H - 22);
    ctx.restore();
  }
}
