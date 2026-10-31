// Galaxy Hunter: Gourmet Odyssey - HUD & In-Game Interface
// Renders HP/Stamina bars, active buff tray with countdown timers, mini-map radar, harvest trackers, and notifications.

import { BuffManager } from '../systems/cooking.js';
import { icon, bountyIcon, dishIcon } from './icons.js';
import {
  TUTORIAL_STEPS, currentStep, ensureTutorial, isActive, skipTutorial, toggleCollapsed
} from '../systems/tutorial.js';

const TRACKER_VERBS = { hunt: '猎杀', gather: '采集', cook_delivery: '烹饪' };

export class GameHUD {
  constructor(container, gameState, onActionClick, options = {}) {
    this.container = container;
    this.gameState = gameState;
    this.onActionClick = onActionClick || (() => {});
    this.onViewDistanceChange = options.onViewDistanceChange || (() => {});
    this.viewDistance = Number.isFinite(Number(options.viewDistance)) ? Number(options.viewDistance) : 110;
    this.toasts = [];

    this.initDOM();
  }

  initDOM() {
    this.hudElement = document.createElement('div');
    this.hudElement.className = 'game-hud-layer';
    this.hudElement.innerHTML = `
      <div class="hud-topline">
        <span class="hud-mode-label"><span class="status-dot"></span> FIELD RUN / LIVE</span>
        <span class="hud-location-label" id="hud-location-label">STARDUST CAMP</span>
      </div>
      <div class="hud-top-left">
        <div class="player-status-card">
          <div class="player-avatar-mini" id="hud-chef-avatar"><img src="./assets/sprites/player_hunter.png" alt="主厨" /></div>
          <div class="bars-wrap">
            <div class="player-name-row"><strong id="hud-chef-name">星尘主厨</strong><span id="hud-chef-role">FIELD CHEF / 01</span></div>
            <div class="bar-row">
              <span class="bar-label"><span class="bar-dot hp-dot"></span>HP</span>
              <div class="bar-track hp-track">
                <div class="bar-fill hp-fill" id="hud-hp-fill" style="width: 100%;"></div>
                <span class="bar-text" id="hud-hp-text">100 / 100</span>
              </div>
            </div>
            <div class="bar-row">
              <span class="bar-label"><span class="bar-dot sta-dot"></span>STA</span>
              <div class="bar-track sta-track">
                <div class="bar-fill sta-fill" id="hud-sta-fill" style="width: 100%;"></div>
                <span class="bar-text" id="hud-sta-text">100 / 100</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Active Buffs Tray -->
        <div class="active-buffs-tray" id="hud-buffs-tray">
          <!-- Dynamic Buff Badges -->
        </div>
      </div>

      <div class="hud-top-right">
        <div class="minimap-card">
          <div class="minimap-header">
            <span class="minimap-kicker">SECTOR SCAN</span>
            <span class="time-clock" id="hud-time-clock">DAY 01 · 14:00</span>
          </div>
          <div class="biome-name" id="hud-biome-name">荧光菌林</div>
          <div class="radar-viewport">
            <canvas id="hud-radar-canvas" width="120" height="120"></canvas>
            <div class="radar-sweep"></div>
          </div>
          <div class="radar-legend"><span><i class="legend-player"></i>你</span><span><i class="legend-resource"></i>资源</span><span><i class="legend-hostile"></i>威胁</span></div>
          <div class="view-distance-control">
            <div class="view-distance-meta">
              <span>${icon('eye')}<span>视距</span></span>
              <output id="hud-view-distance-value" for="hud-view-distance">${Math.round(this.viewDistance)}%</output>
            </div>
            <div class="view-distance-row">
              <button class="view-distance-step" type="button" data-view-step="-5" aria-label="缩短视距" title="缩短视距">${icon('minus')}</button>
              <input id="hud-view-distance" type="range" min="85" max="140" step="5" value="${Math.round(this.viewDistance)}" aria-label="视距" />
              <button class="view-distance-step" type="button" data-view-step="5" aria-label="扩大视距" title="扩大视距">${icon('plus')}</button>
            </div>
          </div>
        </div>

        <div class="bounty-tracker-box" id="hud-bounty-tracker">
          <div class="tracker-header"><span>${bountyIcon('tracker-header-icon')}</span><span>进行中悬赏</span><small>ACTIVE CONTRACTS</small></div>
          <div class="tracker-list" id="hud-tracker-list">
          </div>
        </div>

        <div class="tutorial-box hidden" id="hud-tutorial"></div>
      </div>

      <div class="hud-bottom-bar">
        <button class="hud-btn" data-action="camp" title="扎营烹饪 (Camp & Cook) [C]">
          <span class="btn-icon">${icon('camp')}</span>
          <span class="btn-label">营地烹饪</span><kbd>C</kbd>
        </button>
        <button class="hud-btn" data-action="inventory" title="猎人背包 (Backpack) [B]">
          <span class="btn-icon">${icon('backpack')}</span>
          <span class="btn-label">物资背包</span><kbd>B</kbd>
        </button>
        <button class="hud-btn" data-action="bounties" title="米其林悬赏榜 (Michelin Bounties) [Q]">
          <span class="btn-icon">${icon('scroll')}</span>
          <span class="btn-label">星级悬赏</span><kbd>Q</kbd>
        </button>
        <button class="hud-btn" data-action="recipes" title="美食食谱图鉴 (Recipe Codex) [R]">
          <span class="btn-icon">${icon('book')}</span>
          <span class="btn-label">食谱图鉴</span><kbd>R</kbd>
        </button>
        <button class="hud-btn" data-action="roster" title="主厨营帐 (Chef Roster) [X]">
          <span class="btn-icon">${icon('chef')}</span>
          <span class="btn-label">主厨营帐</span><kbd>X</kbd>
        </button>
        <button class="hud-btn" data-action="sound" title="宇宙点唱机 [M]" id="hud-btn-sound">
          <span class="btn-icon">${icon('music')}</span>
          <span class="btn-label">星际电台</span><kbd>M</kbd>
        </button>
      </div>

      <!-- 主厨技能槽：环形冷却 + 技能名 -->
      <button class="skill-orb" id="hud-skill-orb" type="button" title="主厨技能 [F]">
        <span class="skill-orb-ring" id="hud-skill-ring"></span>
        <span class="skill-orb-core">
          <span class="skill-orb-key">F</span>
          <span class="skill-orb-cd" id="hud-skill-cd"></span>
        </span>
        <span class="skill-orb-name" id="hud-skill-name">星裂斩</span>
      </button>

      <!-- Boss 血条：仅终极评鉴期间显示 -->
      <div class="boss-bar hidden" id="hud-boss-bar">
        <div class="boss-bar-head">
          <span class="boss-name" id="hud-boss-name">虚空母龙</span>
          <span class="boss-phase" id="hud-boss-phase">苏醒</span>
        </div>
        <div class="boss-bar-track">
          <div class="boss-bar-fill" id="hud-boss-fill"></div>
          <span class="boss-tick" style="left:66%"></span>
          <span class="boss-tick" style="left:33%"></span>
        </div>
        <div class="boss-bar-foot"><span id="hud-boss-hp">0 / 0</span><span id="hud-boss-def">护甲 0</span></div>
      </div>

      <!-- Toast Container -->
      <div class="toast-container" id="hud-toast-container"></div>
    `;

    this.container.appendChild(this.hudElement);

    // Elements
    this.elHpFill = this.hudElement.querySelector('#hud-hp-fill');
    this.elHpText = this.hudElement.querySelector('#hud-hp-text');
    this.elStaFill = this.hudElement.querySelector('#hud-sta-fill');
    this.elStaText = this.hudElement.querySelector('#hud-sta-text');
    this.elBuffsTray = this.hudElement.querySelector('#hud-buffs-tray');
    this.elBiomeName = this.hudElement.querySelector('#hud-biome-name');
    this.elTimeClock = this.hudElement.querySelector('#hud-time-clock');
    this.elTrackerList = this.hudElement.querySelector('#hud-tracker-list');
    this.elTutorial = this.hudElement.querySelector('#hud-tutorial');
    this.radarCanvas = this.hudElement.querySelector('#hud-radar-canvas');
    this.radarCtx = this.radarCanvas.getContext('2d');
    this.viewDistanceInput = this.hudElement.querySelector('#hud-view-distance');
    this.viewDistanceValue = this.hudElement.querySelector('#hud-view-distance-value');
    this.toastContainer = this.hudElement.querySelector('#hud-toast-container');
    this.bossBar = this.hudElement.querySelector('#hud-boss-bar');
    this.bossFill = this.hudElement.querySelector('#hud-boss-fill');
    this.bossHpText = this.hudElement.querySelector('#hud-boss-hp');
    this.bossDefText = this.hudElement.querySelector('#hud-boss-def');
    this.bossPhaseText = this.hudElement.querySelector('#hud-boss-phase');
    this.bossNameText = this.hudElement.querySelector('#hud-boss-name');
    this.chefName = this.hudElement.querySelector('#hud-chef-name');
    this.chefRole = this.hudElement.querySelector('#hud-chef-role');
    this.chefAvatar = this.hudElement.querySelector('#hud-chef-avatar');
    this.skillOrb = this.hudElement.querySelector('#hud-skill-orb');
    this.skillRing = this.hudElement.querySelector('#hud-skill-ring');
    this.skillCd = this.hudElement.querySelector('#hud-skill-cd');
    this.skillNameText = this.hudElement.querySelector('#hud-skill-name');
    this.skillOrb?.addEventListener('click', () => this.onActionClick('skill'));

    // Bind Hotbar buttons
    this.hudElement.querySelectorAll('.hud-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = btn.dataset.action;
        this.onActionClick(action);
      });
    });

    // 悬赏追踪里直接领取，不必回营地
    this.elTrackerList?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-claim]');
      if (btn) this.onActionClick('claim-bounty', btn.dataset.claim);
    });

    this.viewDistanceInput?.addEventListener('input', () => {
      const value = Number(this.viewDistanceInput.value);
      this.setViewDistance(value);
      this.onViewDistanceChange(value);
    });

    this.hudElement.querySelectorAll('[data-view-step]').forEach(btn => {
      btn.addEventListener('click', () => {
        const value = Number(this.viewDistanceInput?.value || this.viewDistance) + Number(btn.dataset.viewStep || 0);
        this.setViewDistance(value);
        this.onViewDistanceChange(this.viewDistance);
      });
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Avoid hotkeys when typing in inputs
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      const key = e.key.toLowerCase();
      if (key === 'c') this.onActionClick('camp');
      if (key === 'b') this.onActionClick('inventory');
      if (key === 'q') this.onActionClick('bounties');
      if (key === 'r') this.onActionClick('recipes');
      if (key === 'g') this.onActionClick('workshop');
      if (key === 'x') this.onActionClick('roster');
      if (key === 'z') this.onActionClick('armory');
      if (key === 'm') this.onActionClick('sound');
    });
  }

  /** 绑定当前主厨与技能运行时，HUD 每帧读它刷新环形冷却。 */
  setSkill(character, runtime) {
    this.character = character;
    this.skillRuntime = runtime;
    if (this.chefName) this.chefName.textContent = `${character.name} · ${character.title}`;
    if (this.chefRole) this.chefRole.textContent = `${character.en} / ${character.role}`;
    if (this.skillNameText) this.skillNameText.textContent = character.skill.name;
    if (this.skillOrb) this.skillOrb.style.setProperty('--skill-theme', character.theme);
    if (this.chefAvatar) this.chefAvatar.style.setProperty('--chef-theme', character.theme);
    this.refreshSkillOrb();
  }

  /**
   * 引导卡片。内容只在步骤或进度变化时重建，其余帧不碰 DOM。
   */
  refreshTutorial() {
    if (!this.elTutorial) return;
    const d = this.gameState;
    const t = ensureTutorial(d);

    if (!isActive(d)) {
      if (this._tutoKey !== 'off') {
        this._tutoKey = 'off';
        this.elTutorial.classList.add('hidden');
        this.elTutorial.innerHTML = '';
      }
      return;
    }

    const step = currentStep(d);
    if (!step) return;

    const key = `${t.step}|${t.progress}|${t.collapsed ? 1 : 0}`;
    if (key === this._tutoKey) return;
    this._tutoKey = key;

    this.elTutorial.classList.remove('hidden');
    this.elTutorial.classList.toggle('is-collapsed', t.collapsed);

    const pct = Math.min(100, Math.round((t.progress / step.goal) * 100));
    this.elTutorial.innerHTML = `
      <div class="tuto-head">
        <span class="tuto-idx">${String(t.step + 1).padStart(2, '0')}/${String(TUTORIAL_STEPS.length).padStart(2, '0')}</span>
        <span class="tuto-kicker">新手引导</span>
        <button class="tuto-fold" type="button" title="${t.collapsed ? '展开' : '收起'}">${icon(t.collapsed ? 'plus' : 'minus')}</button>
        <button class="tuto-skip" type="button" title="跳过引导">${icon('close')}</button>
      </div>
      <div class="tuto-body">
        <strong class="tuto-title">${step.title}</strong>
        <span class="tuto-hint">${step.hint}</span>
        <div class="tuto-bar"><i style="width:${pct}%"></i></div>
        <div class="tuto-foot">
          <span>${Math.min(t.progress, step.goal)} / ${step.goal} ${step.unit}</span>
          <span class="tuto-reward">${icon('coin')}<b>${step.credits}</b></span>
        </div>
        <p class="tuto-tip">${step.tip}</p>
      </div>`;

    this.elTutorial.querySelector('.tuto-fold').addEventListener('click', () => {
      toggleCollapsed(d);
      this._tutoKey = null;
      this.refreshTutorial();
    });
    this.elTutorial.querySelector('.tuto-skip').addEventListener('click', () => {
      skipTutorial(d);
      this.showToast('已跳过新手引导。随时可以在星历里查看进度。', 'info', icon('close'));
      this._tutoKey = null;
      this.refreshTutorial();
    });
  }

  refreshSkillOrb() {
    if (!this.skillOrb || !this.skillRuntime) return;
    const pct = this.skillRuntime.chargePct;
    this.skillRing.style.setProperty('--charge', `${(pct * 100).toFixed(1)}%`);
    const ready = this.skillRuntime.ready;
    this.skillOrb.classList.toggle('is-ready', ready);
    this.skillCd.textContent = ready ? '' : String(Math.ceil(this.skillRuntime.cooldown));
  }

  setViewDistance(value) {
    const numericValue = Number(value);
    const steppedValue = Number.isFinite(numericValue) ? Math.round(numericValue / 5) * 5 : 110;
    this.viewDistance = Math.max(85, Math.min(140, steppedValue));
    if (this.viewDistanceInput) {
      this.viewDistanceInput.value = String(this.viewDistance);
      this.viewDistanceInput.setAttribute('aria-valuetext', `${this.viewDistance}%`);
    }
    if (this.viewDistanceValue) this.viewDistanceValue.textContent = `${this.viewDistance}%`;
  }

  update(playerState, bountyManager, worldInfo = {}) {
    const state = playerState?.data || playerState || {};
    const player = state.player || state;

    // 1. Health Bar
    const hp = Math.max(0, Math.round(player.hp || 100));
    const maxHp = Math.round(player.maxHp || 100);
    const hpPct = Math.min(100, Math.max(0, (hp / maxHp) * 100));
    this.elHpFill.style.width = `${hpPct}%`;
    this.elHpText.innerText = `${hp} / ${maxHp}`;

    // 2. Stamina Bar
    const sta = Math.max(0, Math.round(player.stamina || 100));
    const maxSta = Math.round(player.maxStamina || 100);
    const staPct = Math.min(100, Math.max(0, (sta / maxSta) * 100));
    this.elStaFill.style.width = `${staPct}%`;
    this.elStaText.innerText = `${sta} / ${maxSta}`;

    // 3. Active Buff Tray
    const activeBuffs = BuffManager.getActiveBuffs(playerState);
    this.elBuffsTray.innerHTML = '';
    if (activeBuffs.length === 0) {
      this.elBuffsTray.innerHTML = '<span class="buff-empty-hint">暂无饱食Buff (No Buff)</span>';
    } else {
      activeBuffs.forEach(buff => {
        const badge = document.createElement('div');
        badge.className = `buff-pill ${buff.remainingTime < 15 ? 'expiring' : ''}`;
        badge.title = `${buff.dishName}: ${buff.label} (${buff.timeDisplay} 剩余)`;
        badge.innerHTML = `
          <span class="buff-icon">${dishIcon()}</span>
          <span class="buff-text">${buff.label.split(' ')[0]}</span>
          <span class="buff-timer">${buff.timeDisplay}</span>
          <div class="buff-meter-fill" style="width: ${buff.percentRemaining}%;"></div>
        `;
        this.elBuffsTray.appendChild(badge);
      });
    }

    // 4. World & Biome
    if (worldInfo.biomeName) {
      this.elBiomeName.innerText = worldInfo.biomeName;
      const location = this.hudElement.querySelector('#hud-location-label');
      if (location) location.innerText = String(worldInfo.biomeName).toUpperCase();
    }
    if (worldInfo.timeString) {
      this.elTimeClock.innerText = worldInfo.timeString;
    }

    // 5. Active Bounty Tracker
    if (bountyManager) {
      const activeBounties = bountyManager.getActiveBountiesDetailed();
      if (activeBounties.length === 0) {
        this.elTrackerList.innerHTML = `<div class="tracker-empty"><span class="empty-mark">${icon('plus')}</span><span>按 Q 接取新的公会悬赏</span></div>`;
      } else {
        this.elTrackerList.innerHTML = activeBounties.map(b => {
          const pct = Math.min(100, Math.round((b.currentProgress / b.targetCount) * 100));
          const verb = TRACKER_VERBS[b.type] || '完成';
          const short = String(b.title).replace(/^【[^】]*】/, '');
          return `
            <div class="tracker-item ${b.isReadyToClaim ? 'ready' : ''}">
              <div class="tracker-row">
                <span class="tracker-name">${bountyIcon('tracker-item-icon')}<span>${short}</span></span>
                <span class="tracker-count">${b.currentProgress}/${b.targetCount}</span>
              </div>
              <div class="tracker-goal">${verb} <b>${b.targetName}</b> ×${b.targetCount}</div>
              <div class="tracker-track">
                <div class="tracker-fill" style="width: ${pct}%"></div>
              </div>
              ${b.isReadyToClaim
                ? `<button class="tracker-claim" data-claim="${b.id}" type="button">${icon('star')}<span>点击领取</span><b>+${b.rewardCredits}</b></button>`
                : `<div class="tracker-reward">奖励 ${b.rewardCredits} 星币 · ${b.rewardRep} 口碑</div>`}
            </div>
          `;
        }).join('');
      }
    }

    // 6. Draw Minimap Radar
    this.drawRadar(playerState, worldInfo);
  }

  /**
   * 终极评鉴期间在顶部显示 Boss 血条；boss 为 null 时隐藏。
   */
  updateBossBar(boss, phaseLabel) {
    if (!this.bossBar) return;
    if (!boss || boss.hp <= 0) {
      this.bossBar.classList.add('hidden');
      return;
    }
    this.bossBar.classList.remove('hidden');
    const pct = Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100));
    this.bossFill.style.width = `${pct}%`;
    this.bossHpText.textContent = `${Math.max(0, Math.round(boss.hp))} / ${boss.maxHp}`;
    this.bossDefText.textContent = `护甲 ${boss.defense}`;
    this.bossPhaseText.textContent = phaseLabel || '';
    this.bossNameText.textContent = String(boss.name || '').split(' (')[0];
  }

  drawRadar(playerState, worldInfo) {
    // 圆心必须是玩家实体的实时坐标。gameData.player 上只有一份从不更新的
    // position 快照，读它会让所有光点按世界绝对坐标画，雷达就成了死图。
    const player = {
      x: Number.isFinite(worldInfo.playerX) ? worldInfo.playerX : 0,
      y: Number.isFinite(worldInfo.playerY) ? worldInfo.playerY : 0
    };
    const ctx = this.radarCtx;
    const w = this.radarCanvas.width;
    const h = this.radarCanvas.height;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    // Background circle
    ctx.fillStyle = '#0a0d18';
    ctx.beginPath();
    ctx.arc(cx, cy, cx - 2, 0, Math.PI * 2);
    ctx.fill();

    // Radar rings
    ctx.strokeStyle = '#1e2846';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 25, 0, Math.PI * 2);
    ctx.arc(cx, cy, 45, 0, Math.PI * 2);
    ctx.stroke();

    // Crosshairs
    ctx.strokeStyle = '#1e2846';
    ctx.beginPath();
    ctx.moveTo(cx, 4);
    ctx.lineTo(cx, h - 4);
    ctx.moveTo(4, cy);
    ctx.lineTo(w - 4, cy);
    ctx.stroke();

    // Draw Camp Landmark
    if (worldInfo.campPos) {
      const dx = (worldInfo.campPos.x - (player.x || 0)) * 0.05;
      const dy = (worldInfo.campPos.y - (player.y || 0)) * 0.05;
      const dist = Math.hypot(dx, dy);
      if (dist < cx - 10) {
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath();
        ctx.arc(cx + dx, cy + dy, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw Nearby Creature / Resource blips
    if (worldInfo.entities) {
      const pulse = 0.5 + Math.sin(performance.now() / 260) * 0.5;
      worldInfo.entities.forEach(ent => {
        const dx = (ent.x - (player.x || 0)) * 0.05;
        const dy = (ent.y - (player.y || 0)) * 0.05;
        if (Math.hypot(dx, dy) >= cx - 8) return;

        // 悬赏目标画成脉冲金环，比普通血点显眼
        if (ent.isBountyTarget) {
          ctx.strokeStyle = `rgba(251, 191, 36, ${0.45 + pulse * 0.55})`;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(cx + dx, cy + dy, 4 + pulse * 2.6, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(cx + dx, cy + dy, 3, 0, Math.PI * 2);
          ctx.fill();
          return;
        }

        ctx.fillStyle = ent.isHostile ? '#ef4444' : (ent.isResource ? '#10b981' : '#38bdf8');
        ctx.beginPath();
        ctx.arc(cx + dx, cy + dy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Center Player dot
    ctx.fillStyle = '#38bdf8';
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  showToast(message, type = 'info', iconMarkup = '') {
    const toast = document.createElement('div');
    toast.className = `hud-toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${String(iconMarkup || '').trim().startsWith('<svg') ? iconMarkup : icon(type === 'success' ? 'spark' : type === 'warning' ? 'bolt' : 'compass')}</span>
      <span class="toast-msg">${message}</span>
    `;

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 3200);
  }
}
