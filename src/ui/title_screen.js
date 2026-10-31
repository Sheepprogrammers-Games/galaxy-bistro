// Galaxy Hunter: Gourmet Odyssey - Title Screen
// 主菜单：竖排菜单驱动右侧内容板，背景跑一层漂浮尘埃，支持方向键选择。

import { CHARACTERS, unlockStatus } from '../systems/characters.js';

const CONTROL_KEYS = [
  ['WASD', '移动', false],
  ['J / 左键', '刀击连段', false],
  ['H', '破甲重击', true],
  ['K', '疾冲闪避', false],
  ['空格 / Shift', '盾反格挡', false],
  ['E', '营地交互', true],
  ['F', '主厨技能', true],
  ['X', '更换主厨', true],
  ['Z', '军械商', true],
  ['C', '营地烹饪', false],
  ['G', '星尘工坊', true],
  ['T', '终极评鉴', true],
  ['V', '星域地图', false],
  ['B', '背包物资', false],
  ['Q / R', '悬赏 / 图鉴', false],
  ['Esc', '暂停菜单', false]
];

const BRIEFING = [
  '四大生态群落各有专属食材与掠食者，昼夜会换一批出没的目标。',
  '刀工、火候、调味、摆盘四个工位实打实操作，评分直接决定星级与收益。',
  '星币在星尘工坊换永久强化，口碑攒够可以跃迁到更高阶的星球。',
  '五位主厨属性、厨艺特长与主动技能各不相同，随时回营帐换人。'
];

export class TitleScreen {
  /**
   * @param {object} options
   * @param {object} options.gameData
   * @param {(id: string) => void} options.onPickChef
   * @param {(canvas: HTMLCanvasElement, character: object, locked: boolean) => void} options.drawPortrait
   * @param {(name: string) => void} [options.onSound]
   */
  constructor(options) {
    this.root = document.getElementById('start-screen');
    this.menu = document.getElementById('title-menu');
    this.panel = document.getElementById('title-panel');
    this.motes = document.getElementById('title-motes');
    if (!this.root || !this.menu || !this.panel) return;

    this.chefBadge = document.getElementById('title-chef');
    this.gameData = options.gameData;
    this.onPickChef = options.onPickChef;
    this.drawPortrait = options.drawPortrait;
    this.onSound = options.onSound || (() => {});
    this.active = 'codex';

    this._bindMenu();
    this._startMotes();
    this.refresh();
    this.select('codex', { silent: true });
  }

  /** 菜单项点击、悬停与方向键。 */
  _bindMenu() {
    this.items = [...this.menu.querySelectorAll('.tm-item')];

    this.items.forEach(btn => {
      btn.addEventListener('click', () => this.select(btn.dataset.menu));
      btn.addEventListener('mouseenter', () => this.select(btn.dataset.menu));
    });

    this._onKey = (e) => {
      if (this.root.classList.contains('hidden')) return;
      if (e.key === 'Enter') {
        document.getElementById('btn-start-game')?.click();
        e.preventDefault();
        return;
      }
      if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
      const openIndex = this.items.findIndex(b => b.classList.contains('is-open'));
      const step = e.key === 'ArrowDown' ? 1 : -1;
      this.select(this.items[(openIndex + step + this.items.length) % this.items.length].dataset.menu);
      e.preventDefault();
    };
    window.addEventListener('keydown', this._onKey);
  }

  _highlight(id) {
    this.items.forEach(b => b.classList.toggle('is-open', b.dataset.menu === id));
  }

  select(id, { silent = false } = {}) {
    this.active = id;
    this._highlight(id);
    if (!silent) this.onSound('hover');
    this.panel.innerHTML = this._panelHtml(id);
    if (id === 'roster') this._wireRoster();
  }

  /** 存档进度与开始按钮文案随读到的存档变化。 */
  refresh() {
    const d = this.gameData;
    const played = (d.dayCount || 1) > 1 || (d.reputation || 0) > 0 || (d.cookedDishes || []).length > 0;

    const label = document.getElementById('tm-play-label');
    const sub = document.getElementById('tm-play-sub');
    if (label) label.textContent = played ? '继续这趟狩猎' : '踏入异星荒野';
    if (sub) sub.textContent = played ? 'CONTINUE EXPEDITION' : 'ENTER THE WILD';

    const save = document.getElementById('title-save');
    if (save) {
      save.textContent = played
        ? `LOCAL SAVE · 第 ${d.dayCount || 1} 宇宙日 · 口碑 ${d.reputation || 0} · 星币 ${d.credits || 0}`
        : 'LOCAL SAVE ENABLED · 尚无存档记录';
    }

    this._renderChefBadge();
    if (this.active === 'roster') this.select('roster', { silent: true });
  }

  /** 左下角的出战主厨名牌。 */
  _renderChefBadge() {
    if (!this.chefBadge) return;
    const c = CHARACTERS.find(x => x.id === this.gameData.characterId) || CHARACTERS[0];
    this.chefBadge.style.setProperty('--tc-theme', c.theme);
    this.chefBadge.innerHTML = `
      <span class="tc-tag">出战主厨</span>
      <span class="tc-mark">${c.en.slice(0, 2)}</span>
      <span class="tc-copy"><strong>${c.name} · ${c.title}</strong><small>${c.role} · ${c.skill.name} [F]</small></span>
    `;
  }

  _panelHtml(id) {
    if (id === 'roster') return this._rosterHtml();
    if (id === 'controls') return this._controlsHtml();
    return this._codexHtml();
  }

  _codexHtml() {
    const d = this.gameData;
    return `
      <div class="tp-panel">
        <div class="tp-head"><h3>星域档案</h3><small>SECTOR BRIEFING</small><span class="tp-tail">09A</span></div>
        <div class="tp-art" style="background-image: url('./assets/cover.jpg');"></div>
        <div class="tp-stats">
          <div class="tp-stat"><i>DAY</i><strong>第 ${d.dayCount || 1} 宇宙日</strong><span>昼夜循环影响出没</span></div>
          <div class="tp-stat"><i>REP</i><strong>口碑 ${d.reputation || 0}</strong><span>解锁主厨与星球</span></div>
          <div class="tp-stat"><i>DISH</i><strong>${(d.cookedDishes || []).length} 道</strong><span>累计出餐记录</span></div>
        </div>
        <div class="tp-notes">
          ${BRIEFING.map(t => `<p class="tp-note"><i></i><span>${t}</span></p>`).join('')}
        </div>
      </div>
    `;
  }

  _controlsHtml() {
    return `
      <div class="tp-panel">
        <div class="tp-head"><h3>操作指南</h3><small>FIELD CONTROLS</small><span class="tp-tail">${CONTROL_KEYS.length} KEYS</span></div>
        <div class="tp-controls">
          ${CONTROL_KEYS.map(([k, name, hot]) => `
            <div class="tp-key ${hot ? 'is-key' : ''}"><b>${k}</b><span>${name}</span></div>
          `).join('')}
        </div>
        <p class="tp-tip">重甲异兽会弹开轻击，用 <b>H</b> 破甲重击才咬得动。走近营地里的灶台、营帐、工坊会浮出提示，按 <b>E</b> 或直接点它就能用。主厨技能按 <b>F</b>，右下角的充能环走满才放得出来。</p>
      </div>
    `;
  }

  _rosterHtml() {
    const activeId = this.gameData.characterId;
    const cards = CHARACTERS.map(c => {
      const st = unlockStatus(c, this.gameData);
      const isActive = c.id === activeId;
      const state = isActive ? '出战中' : (st.unlocked ? '可选' : '未解锁');
      return `
        <button class="sr-card ${isActive ? 'is-active' : ''} ${st.unlocked ? '' : 'is-locked'}"
                type="button" data-chef="${c.id}" style="--sr-theme:${c.theme}" ${st.unlocked ? '' : 'disabled'}>
          <span class="sr-shot"><canvas width="248" height="140" data-portrait="${c.id}"></canvas></span>
          <span class="sr-state">${state}</span>
          <span class="sr-body">
            <strong>${c.name}</strong>
            <em>${c.title}</em>
            <small>${st.unlocked ? c.skill.name : st.label}</small>
          </span>
        </button>
      `;
    }).join('');

    const unlocked = CHARACTERS.filter(c => unlockStatus(c, this.gameData).unlocked).length;
    return `
      <div class="tp-panel">
        <div class="tp-head"><h3>选择主厨</h3><small>CHEF ROSTER</small><span class="tp-tail">${unlocked} / ${CHARACTERS.length}</span></div>
        <p class="tp-lead">出场主厨决定基础属性、制服配色、<b>F</b> 键技能与厨房里的工位加成。进游戏后走到营地的主厨营帐（<b>X</b>）随时能换。</p>
        <div class="tp-roster">${cards}</div>
      </div>
    `;
  }

  _wireRoster() {
    this.panel.querySelectorAll('canvas[data-portrait]').forEach(cv => {
      const c = CHARACTERS.find(x => x.id === cv.dataset.portrait);
      if (!c) return;
      this.drawPortrait?.(cv, c, !unlockStatus(c, this.gameData).unlocked);
    });

    this.panel.querySelectorAll('[data-chef]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.onPickChef?.(btn.dataset.chef);
        this.onSound('pick');
        this._renderChefBadge();
        this.select('roster', { silent: true });
      });
    });
  }

  /** 背景上缓慢上浮的光尘。 */
  _startMotes() {
    const cv = this.motes;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const dots = [];

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.floor(cv.clientWidth * dpr);
      cv.height = Math.floor(cv.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const want = Math.round((cv.clientWidth * cv.clientHeight) / 26000);
      while (dots.length < want) {
        dots.push({
          x: Math.random() * cv.clientWidth,
          y: Math.random() * cv.clientHeight,
          r: 0.6 + Math.random() * 1.7,
          vy: 5 + Math.random() * 14,
          vx: -5 + Math.random() * 10,
          a: 0.16 + Math.random() * 0.42,
          hue: Math.random() < 0.32 ? '212, 164, 94' : '140, 232, 212'
        });
      }
      dots.length = want;
    };
    resize();
    this._onResize = resize;
    window.addEventListener('resize', resize);

    let last = performance.now();
    const step = (now) => {
      if (this.root.classList.contains('hidden')) {
        this._raf = null;
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      ctx.clearRect(0, 0, w, h);
      for (const p of dots) {
        p.y -= p.vy * dt;
        p.x += p.vx * dt;
        if (p.y < -6) { p.y = h + 6; p.x = Math.random() * w; }
        if (p.x < -6) p.x = w + 6;
        if (p.x > w + 6) p.x = -6;
        ctx.fillStyle = `rgba(${p.hue}, ${p.a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      this._raf = requestAnimationFrame(step);
    };
    this._raf = requestAnimationFrame(step);
  }

  /** 进游戏后停掉粒子与键盘监听。 */
  dispose() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    if (this._onKey) window.removeEventListener('keydown', this._onKey);
    if (this._onResize) window.removeEventListener('resize', this._onResize);
  }
}
