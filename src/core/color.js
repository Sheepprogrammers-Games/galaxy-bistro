// Galaxy Hunter: Gourmet Odyssey - 颜色变换
// 十六进制与 HSL 互转，用于按星球整体偏移地表与生物配色。

const NAMED = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function hexToHsl(hex) {
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
  if (max === r) hue = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) hue = (b - r) / d + 2;
  else hue = (r - g) / d + 4;
  return { h: hue * 60, s, l };
}

export function hslToHex({ h, s, l }) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
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
 * 按 { hue, sat, light } 偏移一个颜色。hue 是角度增量，
 * sat/light 是乘数。非 #rrggbb 的输入原样返回。
 */
export function shiftHex(hex, shift) {
  if (!shift || typeof hex !== 'string' || !NAMED.test(hex)) return hex;
  const c = hexToHsl(hex);
  return hslToHex({
    h: c.h + (shift.hue || 0),
    s: Math.max(0, Math.min(1, c.s * (shift.sat ?? 1))),
    l: Math.max(0.02, Math.min(0.97, c.l * (shift.light ?? 1)))
  });
}
