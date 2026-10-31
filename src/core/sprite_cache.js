/**
 * Galaxy Hunter: Gourmet Odyssey
 * 精灵图滤镜烘焙缓存
 * File: src/core/sprite_cache.js
 *
 * 变体染色与受击闪白都是固定的滤镜字符串，把结果一次性画进离屏 canvas 后复用，
 * 绘制时只做普通 drawImage。
 */

// image -> Map<filterString, canvas>
const bakedSprites = new WeakMap();

/**
 * 取得应用了 filter 的精灵图。无滤镜或环境不支持时原样返回。
 * 图片尺寸为 0（尚未解码）时不写入缓存，留给下一帧重试。
 */
export function getFilteredSprite(image, filter) {
  if (!image) return null;

  const key = typeof filter === 'string' ? filter.trim() : '';
  if (!key || key === 'none') return image;
  if (typeof document === 'undefined') return image;

  let byFilter = bakedSprites.get(image);
  if (!byFilter) {
    byFilter = new Map();
    bakedSprites.set(image, byFilter);
  }

  const cached = byFilter.get(key);
  if (cached) return cached;

  const w = image.naturalWidth || image.width;
  const h = image.naturalHeight || image.height;
  if (!w || !h) return image;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;

  const bakeCtx = canvas.getContext('2d');
  if (!bakeCtx) return image;

  bakeCtx.filter = key;
  bakeCtx.drawImage(image, 0, 0);
  bakeCtx.filter = 'none';

  byFilter.set(key, canvas);
  return canvas;
}
