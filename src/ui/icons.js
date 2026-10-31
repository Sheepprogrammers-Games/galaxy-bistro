// Small, dependency-free line icon set for the interface.
// Keeping icons inline makes the game work from file:// without a network font.

const PATHS = {
  brand: '<path d="M12 2.5 14.7 9l6.8 3-6.8 3-2.7 6.5L9.3 15 2.5 12l6.8-3L12 2.5Z"/><path d="m19 3 .6 1.4L21 5l-1.4.6L19 7l-.6-1.4L17 5l1.4-.6L19 3Z"/>',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="m14.8 9.2-1.7 4-4 1.7 1.7-4 4-1.7Z"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>',
  camp: '<path d="m3 19 9-15 9 15H3Z"/><path d="m9 19 3-5 3 5M5.5 19h13"/>',
  backpack: '<path d="M7 8.5V7a5 5 0 0 1 10 0v1.5"/><rect x="4" y="7" width="16" height="13" rx="3"/><path d="M8 12h8M8 16h5"/>',
  scroll: '<path d="M6 4h11a2 2 0 0 1 2 2v12H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"/><path d="M7 20a3 3 0 0 1 0-6h12M9 8h6M9 11h4"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z"/><path d="M4 18h16M8 7h7M8 10h5"/>',
  music: '<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
  chef: '<path d="M6 11h12v8H6z"/><path d="M6 11a3 3 0 1 1 2-5 4 4 0 0 1 8 0 3 3 0 1 1 2 5"/><path d="M9 15h6"/>',
  heart: '<path d="M20.8 8.8c0 5-8.8 10-8.8 10s-8.8-5-8.8-10A4.8 4.8 0 0 1 12 6.4a4.8 4.8 0 0 1 8.8 2.4Z"/>',
  bolt: '<path d="m13 2-9 11h7l-1 9 9-12h-7l1-8Z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>',
  dish: '<path d="M3 14h18"/><path d="M5 14a7 7 0 0 1 14 0"/><path d="M4 18h16M7 18v2h10v-2"/>',
  flame: '<path d="M12 21a6 6 0 0 0 6-6c0-4-3-6-3-10-2 1-3 3-3 5-2-1-3-3-3-5-2 2-4 5-4 9a7 7 0 0 0 7 7Z"/><path d="M12 21a3 3 0 0 0 3-3c0-1.8-1.4-2.8-2.3-4.2-.8.8-1.7 1.7-1.7 3.2a3 3 0 0 0 1 4Z"/>',
  knife: '<path d="m4 20 7-7"/><path d="m11 13 7.8-7.8a2.8 2.8 0 0 1 4 4L15 17l-4-4Z"/><path d="m4 20 3-1 1-3"/>',
  snow: '<path d="M12 2v20M4.9 6.1l14.2 11.8M19.1 6.1 4.9 17.9M5 12h14"/><path d="m12 2 1.8 2M12 2 10.2 4M12 22l1.8-2M12 22l-1.8-2"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.5 8.5c-.6-.6-1.4-.9-2.5-.9-1.5 0-2.5.8-2.5 1.8 0 2.8 5 1.1 5 3.8 0 1.1-1 1.9-2.6 1.9-1.1 0-2-.3-2.8-1"/><path d="M12 6.5v11"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
  spark: '<path d="m12 2 1.7 7.3L21 12l-7.3 1.7L12 21l-1.7-7.3L3 12l7.3-2.7L12 2Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  arrow: '<path d="M5 12h13M13 6l6 6-6 6"/>',
  box: '<path d="m4 7 8-4 8 4-8 4-8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/>',
  leaf: '<path d="M20 4C11 4 5 8 5 14c0 3 2 5 5 5 6 0 10-6 10-15Z"/><path d="M4 20c3-4 7-7 12-9"/>',
  meat: '<path d="M4 14c0-4 3-7 7-7 2.2 0 3.8.8 5.2 2.2C18 10.6 20 12 20 15c0 3-2 5-5 5-2.6 0-4-1.6-5.8-2.8C7.6 16.1 4 17 4 14Z"/><circle cx="15.5" cy="14.5" r="1.5"/>',
  spice: '<path d="M8 4h8l-1 4H9L8 4Z"/><path d="M9 8h6l2 11H7L9 8Z"/><path d="M10 12h4M10 15h4"/>',
  base: '<path d="M4 10h16l-1 8H5l-1-8Z"/><path d="M6 10a6 6 0 0 1 12 0M8 6h8"/><path d="M8 14h8"/>',
  veg: '<path d="M12 20c-4-2-6-5-6-9 0-3 2-5 6-7 4 2 6 4 6 7 0 4-2 7-6 9Z"/><path d="M12 4v12M9 9l3 3 3-3"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4M12 14v4M8 21h8M9 18h6"/>',
  radio: '<circle cx="12" cy="12" r="3"/><path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8M2.8 2.8a13 13 0 0 0 0 18.4M21.2 2.8a13 13 0 0 1 0 18.4"/>',
  eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.4 2.4 0 1 1 4.3 1.5c-.8 1-2 1.3-2 2.8M12 16.5h.01"/>',
  tent: '<path d="m12 3 9 17H3l9-17Z"/><path d="M12 9v11"/><path d="m12 20 4-6M12 20l-4-6"/>',
  volume: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4v-5Z"/><path d="M15.5 9.5a4 4 0 0 1 0 5M18 7a8 8 0 0 1 0 10"/>',
  swap: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  shield: '<path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
  skull: '<path d="M12 3a8 8 0 0 0-8 8c0 2.6 1.2 4.6 3 5.9V20a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 17 20v-3.1c1.8-1.3 3-3.3 3-5.9a8 8 0 0 0-8-8Z"/><circle cx="9" cy="11.5" r="1.4"/><circle cx="15" cy="11.5" r="1.4"/><path d="M12 15.5v2M10 21.5v-2M14 21.5v-2"/>'
};

export function icon(name, label = '', className = '') {
  const body = PATHS[name] || PATHS.spark;
  const accessible = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="ui-icon ui-icon-${name} ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${accessible}>${body}</svg>`;
}

export function ingredientIcon(item, className = '') {
  const type = item?.category;
  const name = type === 'meat' ? 'meat' : type === 'spice' ? 'spice' : type === 'base' ? 'base' : 'veg';
  return icon(name, item?.name || '食材', className);
}

export function dishIcon(className = '') {
  return icon('dish', '料理', className);
}

export function bountyIcon(className = '') {
  return icon('target', '悬赏', className);
}
