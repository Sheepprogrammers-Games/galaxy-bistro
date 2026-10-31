# 银河系米其林指南：荒野美食猎人

一款太空主题的异星料理烹饪与经营网页游戏。迎接形态各异的星际食客，研发与烹制异星料理，经营你的深空小馆，争取银河系米其林星级评审。

## 玩法

- **迎接异星食客**：硅基晶体人、等离子发光体、多触角星际海盗、人类漂流宇航员、黑洞勘测员等，各有生理特性与口味偏好。
- **创意料理**：切配、研磨、控温翻炒、炙烤、冷凝、摆盘与调味，组合星尘晶盐、反物质干辣椒、彗星寒冰碎等异星食材。
- **叙事互动**：满足客人的隐式需求与情绪愿望，解锁宇宙奇闻。
- **星级评审**：神秘匿名评审官暗访，评定 1–3 星。
- **升级扩建**：购置装备与装饰，提升居酒屋。

## 技术栈

- 原生 JavaScript（ES Module 源码位于 `src/`），通过 `build.mjs` 打包为单文件 `game.bundle.js`。
- 随包分发 Noto Sans SC 字体，无需外部网络。

## 运行

方式一（推荐，直接游玩已打包版本），用静态服务器打开根目录：

```bash
python3 -m http.server 8000
```

浏览器访问 http://localhost:8000/ 。

方式二（重新构建后游玩），生成可双击游玩的静态目录：

```bash
node build.mjs
```

产物在 `dist/`，打开 `dist/index.html` 即可。

## 目录结构

```
galaxy-bistro/
├── index.html          入口（加载 game.bundle.js）
├── game.bundle.js      已打包的游戏脚本
├── build.mjs           构建脚本（产出 dist/）
├── src/                源码：main.js、core、entities、systems、world、ui、audio、data.js
├── assets/             图片、音频、字体
└── PRODUCT.md / DESIGN.md / GAMEPLAY_SPEC.md  设计与玩法文档
```

## 说明

- 版权与许可：作者保留所有权利（未声明开源协议）。
