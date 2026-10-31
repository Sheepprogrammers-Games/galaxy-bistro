// 银河系米其林指南：核心数据定义 (Data Catalog)

export const PATRONS = [
  {
    id: 'blobby',
    name: '波波 (Blobby)',
    title: '海山二等离子史莱姆',
    species: '等离子体/胶质生命',
    avatar: '👾',
    themeColor: '#a855f7',
    desc: '来自温度接近绝对零度的深海暗星云。极其怕烫，嗜甜且对发光冷萃饮料毫无抵抗力。',
    dialogues: {
      greeting: '咕噜噜~ 呼… 这里的恒温系统好舒服！主厨，能给我来点冰凉又亮晶晶的东西吗？',
      orderHint: '想要一份极寒冷凝、酸甜适中，最好还闪烁着星光粒子的甜点或冷饮！',
      success: '（幸福地冒出粉色气泡）哇啊啊！舌尖像滑过一整条超新星极光！五星好评！',
      fail: '嘶嘶嘶…（全身开始沸腾冒烟）太烫或者太辣了！我要化掉啦——！'
    },
    preferences: { minTemp: 0, maxTemp: 35, preferredTaste: ['sweet', 'chilled', 'sparkling'] },
    favoriteDishId: 'aurora_parfait'
  },
  {
    id: 'rust_e',
    name: '铁皮阿诺 (Rust-E)',
    title: '第7矿区退役勘探机',
    species: '硅基机械智能',
    avatar: '🤖',
    themeColor: '#eab308',
    desc: '曾连续工作300年的采矿机器人。机油齿轮有些生锈，渴望品尝高能离子与带有爆裂电弧的酥脆矿物料理。',
    dialogues: {
      greeting: '哔啵——检测到生命体聚集场所。主厨，我的味觉传感器已重置，急需补充高导电能源！',
      orderHint: '请用等离子高温大火爆炒，多加高纯度晶体盐，咬起来一定要有咔嚓咔嚓的电弧声！',
      success: '【系统提示】：核心能量过载999%！这比高浓缩核聚变电池还要带劲！赞美主厨！',
      fail: '【错误报警】：滋滋… 料理水分过高导致短路！需要呼叫维修无人机…'
    },
    preferences: { minTemp: 70, maxTemp: 100, preferredTaste: ['salty', 'crispy', 'electric'] },
    favoriteDishId: 'pulsar_skewer'
  },
  {
    id: 'luna',
    name: '露娜上尉 (Capt. Luna)',
    title: '深空巡航舰队王牌',
    species: '费里亚太空狐',
    avatar: '🦊',
    themeColor: '#f97316',
    desc: '常年在零重力巡逻前线。性格豪迈干练，热衷大块多汁的高维异兽肉和能把喉咙点燃的超新星辣味。',
    dialogues: {
      greeting: '呼，把飞船停在重力泊位可真费劲！老板，听说你这里的拉面连星际海盗吃了都流泪？',
      orderHint: '给我来一碗热气腾腾、大块肉质、反物质辣度拉满的硬派拉面！',
      success: '哈哈哈哈爽快！这股冲击波从舌尖直冲天灵盖！干得漂亮，小费少不了你的！',
      fail: '喂喂老板，你在逗我吗？软绵绵又清淡，这连空间站的营养膏都不如啊！'
    },
    preferences: { minTemp: 60, maxTemp: 95, preferredTaste: ['spicy', 'savory', 'hearty'] },
    favoriteDishId: 'supernova_ramen'
  },
  {
    id: 'ethel',
    name: '艾瑟尔 (Ethel)',
    title: '星环流浪灵咏者',
    species: '纯能量高维灵体',
    avatar: '✨',
    themeColor: '#38bdf8',
    desc: '跨越千万光年的静谧观察者。只摄取纯粹的星光谐振，偏爱晶莹剔透、优雅平衡的分子料理。',
    dialogues: {
      greeting: '（伴随着空灵的风铃音）在喧嚣的群星之间，只有你的灶台能奏出和谐的频率。',
      orderHint: '不需要凡俗的油烟，我寻求纯净的光尘与虚空薄荷，温润而谐美的平衡。',
      success: '星辰在味蕾上轻声歌唱……主厨，你在凡尘中触摸到了神圣的谐振。',
      fail: '能量紊乱了……焦糊与过载的杂质打碎了星光的安宁。'
    },
    preferences: { minTemp: 20, maxTemp: 60, preferredTaste: ['pure', 'balanced', 'ethereal'] },
    favoriteDishId: 'stellar_dew_tart'
  },
  {
    id: 'inspector_x',
    name: '审查官 X (Inspector X)',
    title: '银河米其林匿名评委',
    species: '未知高等文明',
    avatar: '🕶️',
    themeColor: '#e11d48',
    desc: '身披漆黑风衣、佩戴反光墨镜的神秘访客。手握《银河系米其林指南》生杀大权，极其严苛。',
    dialogues: {
      greeting: '……（掏出星际记事板）别紧张，我只是个普通的过路旅人。把你引以为傲的招牌菜端上来吧。',
      orderHint: '色泽、温控、火候、星尘配比必须分毫不差。平庸在这里就是原罪。',
      success: '……妙不可言。哪怕在仙女座皇室盛宴上，我也未曾尝过如此惊艳的料理。这颗星你当之无愧！',
      fail: '……令人遗憾。粗糙的刀工与失控的温标。《指南》不会收录这样的平庸之作。'
    },
    preferences: { minTemp: 45, maxTemp: 85, preferredTaste: ['perfect', 'refined', 'masterpiece'] },
    favoriteDishId: null // 动态抽查
  }
];

export const INGREDIENTS = [
  {
    id: 'nebula_noodle',
    name: '星云拉面',
    category: 'base',
    icon: '🍜',
    desc: '在微重力环境下由超光速麦粉拉制，柔韧顺滑，浸泡在高汤中会折射出星轨倒影。',
    prepType: 'slice', // slice / chop / grind
    cost: 15,
    tempTarget: 80,
    tags: ['savory', 'hearty']
  },
  {
    id: 'quantum_meat',
    name: '量子恐龙肉排',
    category: 'meat',
    icon: '🥩',
    desc: '处于多重态叠加的高维肉质，入口同时呈现鲜嫩与焦香双重口感。',
    prepType: 'slice',
    cost: 30,
    tempTarget: 85,
    tags: ['savory', 'hearty', 'crispy']
  },
  {
    id: 'antimatter_chili',
    name: '反物质干辣椒',
    category: 'spice',
    icon: '🌶️',
    desc: '接触正物质时产生微型湮灭反应，释放出毁天灭地的刺激辛辣与暖意。',
    prepType: 'chop',
    cost: 20,
    tempTarget: 75,
    tags: ['spicy', 'electric']
  },
  {
    id: 'comet_ice_crystal',
    name: '彗星冰晶碎',
    category: 'base',
    icon: '🧊',
    desc: '采集自哈雷彗星核心的万年不化玄冰，蕴含纯净的太空甘甜与绝对零度寒气。',
    prepType: 'grind',
    cost: 18,
    tempTarget: 10,
    tags: ['chilled', 'sweet', 'pure']
  },
  {
    id: 'pulsar_crystal_salt',
    name: '脉冲星高导晶盐',
    category: 'spice',
    icon: '🧂',
    desc: '强磁场中结晶的带电矿盐，能刺激食客的神经突触，产生酥麻电流快感。',
    prepType: 'grind',
    cost: 25,
    tempTarget: 90,
    tags: ['salty', 'electric', 'crispy']
  },
  {
    id: 'zero_g_mushroom',
    name: '零重力跳跳菇',
    category: 'veg',
    icon: '🍄',
    desc: '失重温室培育的伞菌，切开后会像泡泡一样在盘中轻盈弹跳。',
    prepType: 'chop',
    cost: 22,
    tempTarget: 50,
    tags: ['pure', 'balanced', 'savory']
  },
  {
    id: 'aurora_jelly',
    name: '极光霓虹果冻',
    category: 'base',
    icon: '🍮',
    desc: '汲取星门能量凝聚的胶状果冻，入口即化，流淌出五彩斑斓的甜味糖浆。',
    prepType: 'slice',
    cost: 28,
    tempTarget: 20,
    tags: ['sweet', 'sparkling', 'chilled']
  },
  {
    id: 'void_mint',
    name: '虚空幽光薄荷',
    category: 'garnish',
    icon: '🌿',
    desc: '生长于星门缝隙的发光草本，散发出能抚平灵魂躁动的清凉幽香。',
    prepType: 'chop',
    cost: 15,
    tempTarget: 40,
    tags: ['pure', 'ethereal', 'balanced']
  }
];

export const RECIPES = [
  {
    id: 'supernova_ramen',
    name: '超新星暴风拉面',
    tier: 1,
    icon: '🍜🔥',
    desc: '沸腾的烈焰与反物质辛辣融合，浓郁肉香直击灵魂的招牌拉面。',
    reqIngredients: ['nebula_noodle', 'quantum_meat', 'antimatter_chili'],
    idealTemp: 85,
    rewardGold: 95,
    rewardRep: 35
  },
  {
    id: 'aurora_parfait',
    name: '猎户座极光芭菲',
    tier: 1,
    icon: '🍨✨',
    desc: '冰凉晶莹的彗星冰晶搭配彩虹果冻与虚空薄荷，梦幻般的星空甜品。',
    reqIngredients: ['comet_ice_crystal', 'aurora_jelly', 'void_mint'],
    idealTemp: 15,
    rewardGold: 85,
    rewardRep: 30
  },
  {
    id: 'pulsar_skewer',
    name: '脉冲电弧炙烤肉串',
    tier: 1,
    icon: '🍢⚡',
    desc: '高能等离子急火快烤的焦香肉排，撒满酥麻高导晶盐，咔嚓作响。',
    reqIngredients: ['quantum_meat', 'pulsar_crystal_salt', 'zero_g_mushroom'],
    idealTemp: 90,
    rewardGold: 110,
    rewardRep: 40
  },
  {
    id: 'stellar_dew_tart',
    name: '星咏者纯露玉露盏',
    tier: 2,
    icon: '🥮🌟',
    desc: '剔透无瑕的能量点心，汇聚了跳跳菇的灵气与星光薄荷的纯净回甘。',
    reqIngredients: ['zero_g_mushroom', 'aurora_jelly', 'void_mint'],
    idealTemp: 35,
    rewardGold: 140,
    rewardRep: 50
  },
  {
    id: 'cosmic_fusion_supreme',
    name: '银河创世至尊宴 (米其林特选)',
    tier: 3,
    icon: '👑🌌',
    desc: '汇聚宇宙四极之味：冰与火、实与虚完美交融的终极艺术之作。',
    reqIngredients: ['quantum_meat', 'antimatter_chili', 'comet_ice_crystal', 'void_mint'],
    idealTemp: 60,
    rewardGold: 260,
    rewardRep: 100
  }
];

export const UPGRADES = [
  {
    id: 'cryo_cooler',
    name: '超导急冻液氮机',
    icon: '❄️',
    desc: '烹饪降温速度提升 100%，制作冷饮甜品更精准。',
    cost: 200,
    effect: 'cool_speed_up'
  },
  {
    id: 'plasma_torch',
    name: '等离子激光炙烤枪',
    icon: '🔥',
    desc: '升温速度提升 80%，爆炒与烤串更容易达成完美金黄度。',
    cost: 300,
    effect: 'heat_speed_up'
  },
  {
    id: 'tachyon_board',
    name: '反重力激光砧板',
    icon: '🔪',
    desc: '刀工研磨阶段点击判定范围扩大 50%，食材出肉率更高。',
    cost: 450,
    effect: 'prep_boost'
  },
  {
    id: 'cosmic_jukebox',
    name: '星辰黑胶唱片机',
    icon: '📻',
    desc: '居酒屋氛围拉满！食客等待耐心提升 40%，小费增加 20%。',
    cost: 600,
    effect: 'patience_boost'
  }
];
