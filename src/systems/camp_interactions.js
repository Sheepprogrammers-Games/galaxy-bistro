// Galaxy Hunter: Gourmet Odyssey - Camp Prop Interaction Prompts
// 营地设施靠近后浮出图标提示，支持 E 键、专属快捷键与鼠标点击三种触发方式。

import { drawCampGlyph } from '../world/glyphs.js';

const PROMPT_RANGE = 56;
const PROMPT_HEIGHT = 38;
const PROMPT_GAP = 18;

/** 提示气泡宽度只由文案长度决定，update 与 render 用同一套算法才能对上点击热区。 */
function promptWidth(meta) {
  const tail = meta.hotkey ? `${meta.hint} · ${meta.hotkey}` : meta.hint;
  const textW = Math.max(meta.name.length * 13, tail.length * 8.4);
  return 40 + textW + 26;
}

/** 物件的可见顶边，气泡挂在它上面。 */
function propTop(prop) {
  return prop.shape === 'circle' ? prop.y - prop.radius : prop.y - prop.height / 2;
}

/** 玩家到物件外缘的距离。 */
function edgeDistance(prop, x, y) {
  if (prop.shape === 'circle') {
    return Math.max(0, Math.hypot(x - prop.x, y - prop.y) - prop.radius);
  }
  const dx = Math.max(Math.abs(x - prop.x) - prop.width / 2, 0);
  const dy = Math.max(Math.abs(y - prop.y) - prop.height / 2, 0);
  return Math.hypot(dx, dy);
}

export class CampInteractionManager {
  constructor(map, onAction) {
    this.map = map;
    this.onAction = onAction;
    this.props = [];
    this.inRange = [];
    this.active = null;
    this.hovered = null;
    this.blocked = false;
    this.animTime = 0;
    this.pulse = new Map();
    this.refresh();
  }

  /** 换星球会重建地图，需要重新收集设施列表。 */
  refresh(map) {
    if (map) this.map = map;
    this.props = (this.map?.obstacles || []).filter(o => o.interact);
    this.inRange = [];
    this.active = null;
    this.hovered = null;
  }

  /** 气泡在世界坐标下的矩形热区。 */
  promptRect(prop) {
    const w = promptWidth(prop.interact);
    return {
      x: prop.x - w / 2,
      y: propTop(prop) - PROMPT_GAP - PROMPT_HEIGHT,
      w,
      h: PROMPT_HEIGHT
    };
  }

  update(dt, player, input, pointerWorld) {
    this.animTime += dt;

    if (this.blocked || !player || player.hp <= 0) {
      this.inRange = [];
      this.active = null;
      this.hovered = null;
      return;
    }

    this.inRange = this.props.filter(p => edgeDistance(p, player.x, player.y) <= PROMPT_RANGE);

    // 弹入弹出用各自的进度值，靠近离开都不会瞬切
    for (const p of this.props) {
      const target = this.inRange.includes(p) ? 1 : 0;
      const cur = this.pulse.get(p) ?? 0;
      const speed = target > cur ? 7 : 9;
      const next = cur + (target - cur) * Math.min(1, dt * speed);
      if (Math.abs(next - target) < 0.004) this.pulse.set(p, target);
      else this.pulse.set(p, next);
    }

    // 鼠标悬停优先，否则取离玩家最近的一件
    this.hovered = null;
    if (pointerWorld) {
      for (const p of this.inRange) {
        const r = this.promptRect(p);
        if (pointerWorld.x >= r.x && pointerWorld.x <= r.x + r.w
          && pointerWorld.y >= r.y && pointerWorld.y <= r.y + r.h) {
          this.hovered = p;
          break;
        }
      }
    }

    let nearest = null;
    let best = Infinity;
    for (const p of this.inRange) {
      const d = edgeDistance(p, player.x, player.y);
      if (d < best) { best = d; nearest = p; }
    }
    this.active = this.hovered || nearest;

    if (!this.active) return;

    if (this.hovered && input.mouse?.justClicked) {
      this.trigger(this.hovered);
      // 点提示气泡不应该顺带挥一刀
      input.mouse.justClicked = false;
      input.isAttackPressed = false;
      input.isAttackDown = false;
      return;
    }
    if (input.isInteractPressed) {
      this.trigger(this.active);
      input.isInteractPressed = false;
    }
  }

  trigger(prop) {
    if (!prop?.interact) return;
    this.lastTriggerAt = this.animTime;
    this.onAction?.(prop.interact.action, prop);
  }

  render(ctx, camera) {
    if (!this.props.length) return;

    for (const prop of this.props) {
      const t = this.pulse.get(prop) ?? 0;
      if (t <= 0.01) continue;

      const meta = prop.interact;
      const rx = prop.x - camera.x;
      const ry = prop.y - camera.y;
      const isActive = prop === this.active;
      const isHover = prop === this.hovered;

      ctx.save();

      // 脚下的可交互光环
      const ringR = (prop.shape === 'circle' ? prop.radius : Math.max(prop.width, prop.height) / 2) + 10;
      ctx.strokeStyle = meta.color;
      ctx.globalAlpha = t * (isActive ? 0.55 : 0.25);
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 6]);
      ctx.lineDashOffset = -(this.animTime * 22) % 22;
      ctx.beginPath();
      ctx.ellipse(rx, ry + (prop.shape === 'circle' ? 0 : prop.height / 2 - 4), ringR, ringR * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // 气泡：随距离弹入，悬停时再抬高一点
      const w = promptWidth(meta);
      const bob = Math.sin(this.animTime * 3 + prop.x * 0.02) * 2;
      const topY = propTop(prop) - camera.y - PROMPT_GAP - PROMPT_HEIGHT + bob - (isHover ? 3 : 0);
      const bx = rx - w / 2;

      // 非焦点的气泡整体压暗压小，同时进入范围的几件不会互相抢眼
      const focus = isActive ? 1 : 0.42;
      const scale = (0.75 + t * 0.25) * (isActive ? 1 : 0.9);
      ctx.globalAlpha = t * focus;
      ctx.translate(rx, topY + PROMPT_HEIGHT);
      ctx.scale(scale, scale);
      ctx.translate(-rx, -(topY + PROMPT_HEIGHT));

      ctx.fillStyle = isActive ? 'rgba(15, 18, 32, 0.94)' : 'rgba(15, 18, 32, 0.7)';
      ctx.strokeStyle = meta.color;
      ctx.lineWidth = isActive ? 2 : 1;
      roundRect(ctx, bx, topY, w, PROMPT_HEIGHT, 7);
      ctx.fill();
      ctx.stroke();

      // 指向物件的小尖角
      ctx.beginPath();
      ctx.moveTo(rx - 5, topY + PROMPT_HEIGHT);
      ctx.lineTo(rx, topY + PROMPT_HEIGHT + 6);
      ctx.lineTo(rx + 5, topY + PROMPT_HEIGHT);
      ctx.closePath();
      ctx.fill();

      drawCampGlyph(ctx, meta.glyph, bx + 19, topY + PROMPT_HEIGHT / 2, 16, meta.color);

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isActive ? '#f8fafc' : '#cbd5e1';
      ctx.font = 'bold 13px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText(meta.name, bx + 34, topY + 13);

      ctx.fillStyle = isActive ? meta.color : 'rgba(148, 163, 184, 0.7)';
      ctx.font = '10px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText(meta.hotkey ? `${meta.hint} · 或按 ${meta.hotkey}` : meta.hint, bx + 34, topY + 27);

      // 靠近时统一按 E 触发，专属快捷键写在副行里
      const badgeX = bx + w - 19;
      const badgeY = topY + PROMPT_HEIGHT / 2;
      ctx.fillStyle = isActive ? meta.color : 'rgba(148, 163, 184, 0.5)';
      roundRect(ctx, badgeX - 10, badgeY - 10, 20, 20, 5);
      ctx.fill();
      ctx.fillStyle = '#0b1020';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('E', badgeX, badgeY + 0.5);

      ctx.restore();
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
