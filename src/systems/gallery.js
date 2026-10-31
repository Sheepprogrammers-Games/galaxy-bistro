// Galaxy Hunter: Gourmet Odyssey - Dish Photo Gallery
// 出餐瞬间把餐盘裁成缩略图存进存档，营地留影台可以翻看、删除，并把其中一张贴到相框上。

export const GALLERY_LIMIT = 12;
const THUMB_SIZE = 208;
const THUMB_QUALITY = 0.62;

/**
 * 把源画布上的一块方形区域裁成缩略图。
 * @param {HTMLCanvasElement} source 源画布
 * @param {{x:number,y:number,r:number}} region 逻辑坐标下的圆心与半径
 * @param {number} logicalWidth 源画布的逻辑宽度
 * @param {number} logicalHeight 源画布的逻辑高度
 * @returns {string|null} JPEG dataURL
 */
export function captureDishThumb(source, region, logicalWidth, logicalHeight) {
  if (!source || typeof document === 'undefined') return null;

  const sx = source.width / logicalWidth;
  const sy = source.height / logicalHeight;
  const pad = region.r * 1.28;
  const cropX = Math.max(0, (region.x - pad) * sx);
  const cropY = Math.max(0, (region.y - pad) * sy);
  const cropW = Math.min(source.width - cropX, pad * 2 * sx);
  const cropH = Math.min(source.height - cropY, pad * 2 * sy);
  if (cropW <= 4 || cropH <= 4) return null;

  const out = document.createElement('canvas');
  out.width = THUMB_SIZE;
  out.height = THUMB_SIZE;
  const ctx = out.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, THUMB_SIZE, THUMB_SIZE);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, cropX, cropY, cropW, cropH, 0, 0, THUMB_SIZE, THUMB_SIZE);

  try {
    return out.toDataURL('image/jpeg', THUMB_QUALITY);
  } catch {
    return null;
  }
}

export function getGallery(gameData) {
  if (!Array.isArray(gameData.gallery)) gameData.gallery = [];
  return gameData.gallery;
}

/** 存一张新照片，超出上限就挤掉最早的一张（钉住的那张不会被挤掉）。 */
export function addDishPhoto(gameData, entry) {
  const list = getGallery(gameData);
  const photo = {
    id: `shot_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    name: entry.name || '无名料理',
    stars: entry.stars || 0,
    quality: entry.quality || '',
    chef: entry.chef || '',
    style: entry.style || '',
    day: entry.day || 1,
    score: Math.round(entry.score || 0),
    thumb: entry.thumb
  };
  list.unshift(photo);

  while (list.length > GALLERY_LIMIT) {
    const dropIndex = findDroppableIndex(list, gameData.pinnedDishId);
    if (dropIndex < 0) break;
    list.splice(dropIndex, 1);
  }
  return photo;
}

function findDroppableIndex(list, pinnedId) {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].id !== pinnedId) return i;
  }
  return -1;
}

export function deleteDishPhoto(gameData, id) {
  const list = getGallery(gameData);
  const idx = list.findIndex(p => p.id === id);
  if (idx < 0) return false;
  list.splice(idx, 1);
  if (gameData.pinnedDishId === id) gameData.pinnedDishId = null;
  return true;
}

/** 钉住 / 取消钉住招牌菜，返回钉住后的照片。 */
export function pinDishPhoto(gameData, id) {
  const list = getGallery(gameData);
  if (gameData.pinnedDishId === id) {
    gameData.pinnedDishId = null;
    return null;
  }
  const photo = list.find(p => p.id === id);
  gameData.pinnedDishId = photo ? photo.id : null;
  return photo || null;
}

export function getPinnedDish(gameData) {
  const list = getGallery(gameData);
  return list.find(p => p.id === gameData.pinnedDishId) || null;
}
