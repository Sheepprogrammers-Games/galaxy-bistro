/*
 * Small procedural glyphs used by the canvas layer.
 * They keep world markers crisp and consistent on systems without an emoji font.
 */

function glyphKind(value = '') {
  const key = String(value).toLowerCase();
  if (/mushroom|shroom|spore/.test(key)) return 'mushroom';
  if (/mint|herb|leaf|bloom|lotus|flower|fruit|veg|plant/.test(key)) return 'leaf';
  if (/crystal|salt|gem|diamond|marrow/.test(key)) return 'crystal';
  if (/ice|frost|snow|comet|cryo/.test(key)) return 'ice';
  if (/wheat|noodle|rice|grain|base|batter/.test(key)) return 'grain';
  if (/chili|spice|pepper/.test(key)) return 'chili';
  if (/meat|steak|rib|tail|wing|mammoth|wyrm|dragon|hare|dino|tentacle|squid/.test(key)) return 'meat';
  if (/jelly|gel|pudding/.test(key)) return 'jelly';
  return 'spark';
}

function lineStyle(ctx, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.55;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function drawStarPath(ctx, radius = 8, points = 4) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const angle = -Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 === 0 ? radius : radius * 0.36;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Draw an ingredient/resource marker centered at x/y. */
export function drawIngredientGlyph(ctx, value, x, y, size = 20, color = '#f0c77c') {
  const kind = glyphKind(value);
  const scale = size / 24;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  lineStyle(ctx, color);
  ctx.shadowColor = color;
  ctx.shadowBlur = 5;

  if (kind === 'mushroom') {
    ctx.beginPath();
    ctx.moveTo(-3, 1);
    ctx.lineTo(-3, 8);
    ctx.quadraticCurveTo(0, 10, 3, 8);
    ctx.lineTo(3, 1);
    ctx.closePath();
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(0, 1, 8, Math.PI, 0);
    ctx.lineTo(7, 2);
    ctx.quadraticCurveTo(0, 5, -7, 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f5efdf';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(-3, 0, 1, 0, Math.PI * 2);
    ctx.arc(2, -1, 1.1, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'leaf') {
    ctx.beginPath();
    ctx.moveTo(-9, 5);
    ctx.quadraticCurveTo(-7, -7, 8, -8);
    ctx.quadraticCurveTo(8, 5, -1, 9);
    ctx.quadraticCurveTo(-7, 9, -9, 5);
    ctx.closePath();
    ctx.globalAlpha = 0.28;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(-8, 7);
    ctx.quadraticCurveTo(-1, 0, 7, -6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-2, 2);
    ctx.lineTo(-3, -3);
    ctx.moveTo(2, -2);
    ctx.lineTo(4, -5);
    ctx.stroke();
  } else if (kind === 'crystal') {
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7, -2);
    ctx.lineTo(4, 9);
    ctx.lineTo(-4, 9);
    ctx.lineTo(-7, -2);
    ctx.closePath();
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(0, 9);
    ctx.moveTo(-7, -2);
    ctx.lineTo(0, 2);
    ctx.lineTo(7, -2);
    ctx.stroke();
  } else if (kind === 'ice') {
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(7, -5);
    ctx.lineTo(8, 5);
    ctx.lineTo(0, 10);
    ctx.lineTo(-8, 5);
    ctx.lineTo(-7, -5);
    ctx.closePath();
    ctx.globalAlpha = 0.28;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(0, 10);
    ctx.moveTo(-7, -5);
    ctx.lineTo(0, 0);
    ctx.lineTo(7, -5);
    ctx.stroke();
  } else if (kind === 'grain') {
    ctx.beginPath();
    ctx.moveTo(-6, 9);
    ctx.quadraticCurveTo(-2, 0, 1, -9);
    ctx.stroke();
    for (let i = 0; i < 4; i += 1) {
      const yy = 5 - i * 4;
      ctx.beginPath();
      ctx.ellipse(-2 + i * 0.8, yy, 3, 1.4, -0.5, 0, Math.PI * 2);
      ctx.ellipse(3 + i * 0.4, yy - 2, 3, 1.4, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'chili') {
    ctx.beginPath();
    ctx.moveTo(-5, -7);
    ctx.quadraticCurveTo(7, -8, 7, 1);
    ctx.quadraticCurveTo(7, 9, -2, 10);
    ctx.quadraticCurveTo(-8, 9, -6, 3);
    ctx.quadraticCurveTo(-4, -1, -5, -7);
    ctx.closePath();
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-5, -7);
    ctx.quadraticCurveTo(-2, -11, 2, -8);
    ctx.stroke();
  } else if (kind === 'meat') {
    ctx.beginPath();
    ctx.moveTo(-9, 3);
    ctx.quadraticCurveTo(-8, -7, 0, -8);
    ctx.quadraticCurveTo(6, -9, 9, -3);
    ctx.quadraticCurveTo(11, 4, 5, 8);
    ctx.quadraticCurveTo(-1, 11, -5, 7);
    ctx.quadraticCurveTo(-10, 7, -9, 3);
    ctx.closePath();
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
    ctx.fillStyle = '#f5efdf';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(3, 0, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'jelly') {
    ctx.beginPath();
    ctx.moveTo(-8, -4);
    ctx.quadraticCurveTo(0, -10, 8, -4);
    ctx.lineTo(6, 7);
    ctx.quadraticCurveTo(0, 11, -6, 7);
    ctx.closePath();
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-5, 3);
    ctx.quadraticCurveTo(0, 0, 5, 3);
    ctx.stroke();
  } else {
    drawStarPath(ctx, 9, 4);
    ctx.globalAlpha = 0.3;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.stroke();
  }

  ctx.restore();
}

/** Draw the small pictogram on camp workstations. */
export function drawCampGlyph(ctx, kind, x, y, size = 16, color = '#f0c77c') {
  const scale = size / 24;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  lineStyle(ctx, color);
  ctx.shadowColor = color;
  ctx.shadowBlur = 4;

  if (kind === 'stove') {
    ctx.strokeRect(-9, -7, 18, 14);
    ctx.beginPath();
    ctx.moveTo(-5, -4); ctx.lineTo(-5, 4);
    ctx.moveTo(0, -4); ctx.lineTo(0, 4);
    ctx.moveTo(5, -4); ctx.lineTo(5, 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -9, 3, Math.PI, 0);
    ctx.stroke();
  } else if (kind === 'crate') {
    ctx.strokeRect(-9, -7, 18, 14);
    ctx.beginPath();
    ctx.moveTo(-9, -7); ctx.lineTo(9, 7);
    ctx.moveTo(9, -7); ctx.lineTo(-9, 7);
    ctx.stroke();
  } else if (kind === 'anvil') {
    ctx.beginPath();
    ctx.moveTo(-10, -3); ctx.lineTo(10, -3); ctx.lineTo(6, 2);
    ctx.lineTo(3, 2); ctx.lineTo(3, 7); ctx.lineTo(-4, 7);
    ctx.lineTo(-4, 2); ctx.lineTo(-8, 2); ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, -8); ctx.lineTo(4, -8);
    ctx.stroke();
  } else if (kind === 'board') {
    ctx.strokeRect(-9, -9, 18, 18);
    ctx.beginPath();
    ctx.moveTo(-5, -4); ctx.lineTo(5, -4);
    ctx.moveTo(-5, 0); ctx.lineTo(5, 0);
    ctx.moveTo(-5, 4); ctx.lineTo(1, 4);
    ctx.stroke();
  } else if (kind === 'camera') {
    ctx.strokeRect(-10, -5, 20, 13);
    ctx.beginPath();
    ctx.moveTo(-4, -5); ctx.lineTo(-2, -9); ctx.lineTo(3, -9); ctx.lineTo(5, -5);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 2, 4, 0, Math.PI * 2);
    ctx.stroke();
  } else if (kind === 'tent') {
    ctx.beginPath();
    ctx.moveTo(0, -9); ctx.lineTo(9, 7); ctx.lineTo(-9, 7); ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -3); ctx.lineTo(4, 7); ctx.lineTo(-4, 7); ctx.closePath();
    ctx.stroke();
  } else if (kind === 'flame') {
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.bezierCurveTo(7, -3, 8, 3, 3, 7);
    ctx.bezierCurveTo(0, 9, -5, 8, -6, 3);
    ctx.bezierCurveTo(-7, -2, -2, -4, 0, -10);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.arc(0, 0, 11, -0.8, 0.8);
    ctx.stroke();
  }
  ctx.restore();
}

/** Draw a compact rotating stun marker without text glyphs. */
export function drawStunGlyph(ctx, x, y, radius = 10, color = '#f0c77c', rotation = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  lineStyle(ctx, color);
  ctx.shadowColor = color;
  ctx.shadowBlur = 5;
  for (let i = 0; i < 3; i += 1) {
    ctx.save();
    ctx.rotate((i * Math.PI * 2) / 3);
    ctx.translate(radius, 0);
    drawStarPath(ctx, 4.5, 4);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

export function drawBossGlyph(ctx, x, y, size = 12, color = '#fbbf24') {
  const s = size / 16;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  lineStyle(ctx, color);
  ctx.shadowColor = color;
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.moveTo(-8, -5);
  ctx.lineTo(-4, 1);
  ctx.lineTo(0, -5);
  ctx.lineTo(4, 1);
  ctx.lineTo(8, -5);
  ctx.lineTo(7, 6);
  ctx.lineTo(-7, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
