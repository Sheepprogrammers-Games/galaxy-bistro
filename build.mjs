// 打包 dist：产出可直接双击 index.html 游玩的静态目录。
// 用法：node build.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = dirname(new URL(import.meta.url).pathname);
const DIST = join(ROOT, 'dist');

// 源码里真正从磁盘读取的资源。其余精灵图已经以 base64 内嵌在 bundle 里。
const RUNTIME_ASSETS = [
  'assets/favicon.svg',
  'assets/cover.jpg',
  'assets/sprites/camp_pot.png',
  'assets/sprites/player_hunter.png',
  'assets/fonts/NotoSansSC-400.woff2',
  'assets/fonts/NotoSansSC-500.woff2',
  'assets/fonts/NotoSansSC-600.woff2',
  'assets/fonts/NotoSansSC-700.woff2',
  'assets/fonts/DMMono-400-latin.woff2',
  'assets/fonts/DMMono-400-latin-ext.woff2',
  'assets/fonts/DMMono-500-latin.woff2',
  'assets/fonts/DMMono-500-latin-ext.woff2',
  'assets/fonts/OFL-NotoSansSC.txt',
  'assets/fonts/OFL-DMMono.txt'
];

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// 1. 重新打包一份 JS，避免 dist 落后于源码
execFileSync('npx', ['--no-install', 'esbuild', 'src/main.js', '--bundle',
  `--outfile=${join(DIST, 'game.bundle.js')}`, '--minify', '--target=es2020'],
  { cwd: ROOT, stdio: 'inherit' });

// 2. 把样式表内联进 HTML，file:// 下少一次子资源请求
const css = readFileSync(join(ROOT, 'src/styles.css'), 'utf8');
let html = readFileSync(join(ROOT, 'index.html'), 'utf8');

html = html.replace(
  /<link rel="stylesheet" href="\.\/src\/styles\.css[^"]*" \/>/,
  `<style>\n${css}\n  </style>`
);
// 缓存查询串只对 http 服务有意义，双击打开时反而多余
html = html.replace(/(\.\/game\.bundle\.js)\?v=[^"]*/, '$1');

writeFileSync(join(DIST, 'index.html'), html);

// 3. 复制运行期资源，保持相对路径不变
for (const rel of RUNTIME_ASSETS) {
  const src = join(ROOT, rel);
  if (!existsSync(src)) throw new Error(`缺少资源：${rel}`);
  mkdirSync(join(DIST, dirname(rel)), { recursive: true });
  copyFileSync(src, join(DIST, rel));
}

// 4. 自检：产物里不允许残留任何指向站外的绝对地址
const HOST_ALLOWLIST = ['www.w3.org'];
const scanTargets = ['index.html', 'game.bundle.js'];
const offenders = [];
for (const rel of scanTargets) {
  const text = readFileSync(join(DIST, rel), 'utf8');
  for (const m of text.matchAll(/https?:\/\/([a-zA-Z0-9._-]+)/g)) {
    if (!HOST_ALLOWLIST.includes(m[1])) offenders.push(`${rel} → ${m[0]}`);
  }
}
if (offenders.length) {
  throw new Error(`产物含站外引用：\n  ${[...new Set(offenders)].join('\n  ')}`);
}
console.log('外链自检通过：产物无站外请求');

const size = (p) => (readFileSync(p).length / 1024).toFixed(0);
console.log('\ndist 已生成：');
console.log(`  index.html      ${size(join(DIST, 'index.html'))} KB`);
console.log(`  game.bundle.js  ${size(join(DIST, 'game.bundle.js'))} KB`);
for (const rel of RUNTIME_ASSETS) console.log(`  ${rel.padEnd(15)} ${size(join(DIST, rel))} KB`);
