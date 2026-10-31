// Galaxy Hunter: Gourmet Odyssey - Recipe & Culinary Database
// Comprehensive culinary database with 20+ dishes across 4 tiers and full buff system

export const INGREDIENT_CATEGORIES = {
  MEAT: 'meat',
  VEG: 'veg',
  SPICE: 'spice',
  BASE: 'base'
};

export const BUFF_TYPES = {
  ATK_BOOST: 'atk_boost',           // Attack power increase (%)
  SPEED_BOOST: 'speed_boost',       // Move speed increase (%)
  MAX_HP_BOOST: 'max_hp_boost',     // Maximum HP boost (+)
  STAMINA_REGEN: 'stamina_regen',   // Stamina recovery speed (%)
  ELEM_RESIST: 'elem_resist',       // Elemental resistance (%)
  NIGHT_VISION: 'night_vision',     // Exploration light radius (%)
  LOOT_MAGNET: 'loot_magnet',       // Ingredient pickup magnetic radius (%)
  DEFENSE_BOOST: 'defense_boost',   // Damage reduction (%)
  CRIT_BOOST: 'crit_boost'          // Critical strike rate (%)
};

export const ALL_INGREDIENTS = [
  // --- BASES ---
  {
    id: 'nebula_noodle',
    name: '星云拉面',
    nameEn: 'Nebula Noodles',
    category: INGREDIENT_CATEGORIES.BASE,
    icon: '🍜',
    tier: 1,
    desc: '微重力下由超光速麦粉拉制，柔韧顺滑，浸泡在高汤中折射星轨倒影。',
    prepType: 'slice',
    tempTarget: 80,
    cost: 15,
    tags: ['savory', 'hearty', 'warm']
  },
  {
    id: 'comet_ice_crystal',
    name: '彗星冰晶碎',
    nameEn: 'Comet Ice Shards',
    category: INGREDIENT_CATEGORIES.BASE,
    icon: '🧊',
    tier: 1,
    desc: '采集自哈雷彗星核心的万年玄冰，蕴含纯净太空甘甜与绝对零度寒气。',
    prepType: 'grind',
    tempTarget: 15,
    cost: 18,
    tags: ['chilled', 'sweet', 'pure']
  },
  {
    id: 'cosmic_rice',
    name: '引力恒星米',
    nameEn: 'Graviton Stellar Rice',
    category: INGREDIENT_CATEGORIES.BASE,
    icon: '🍚',
    tier: 2,
    desc: '在强引力农场培育的高密度珍珠米，每一粒都饱满弹牙，香气四溢。',
    prepType: 'chop',
    tempTarget: 75,
    cost: 25,
    tags: ['hearty', 'savory', 'balanced']
  },
  {
    id: 'star_batter',
    name: '超空间星光酥皮',
    nameEn: 'Hyperspace Star Batter',
    category: INGREDIENT_CATEGORIES.BASE,
    icon: '🥐',
    tier: 2,
    desc: '融合星光黄油与星粉揉制而成的起酥面皮，烘烤后层层金黄薄脆。',
    prepType: 'slice',
    tempTarget: 65,
    cost: 30,
    tags: ['crispy', 'sweet', 'rich']
  },

  // --- MEATS ---
  {
    id: 'quantum_meat',
    name: '量子恐龙肉排',
    nameEn: 'Quantum Dino Steak',
    category: INGREDIENT_CATEGORIES.MEAT,
    icon: '🥩',
    tier: 1,
    desc: '处于多重态叠加的高维恐龙肉，入口同时呈现鲜嫩与焦香双重口感。',
    prepType: 'slice',
    tempTarget: 85,
    cost: 30,
    tags: ['savory', 'hearty', 'juicy']
  },
  {
    id: 'electro_hare_leg',
    name: '孢子电兔后腿',
    nameEn: 'Electro-Hare Drumstick',
    category: INGREDIENT_CATEGORIES.MEAT,
    icon: '🍗',
    tier: 1,
    desc: '奔跑在菌林深处的电兔肉质紧实，自带微微酥麻的离子电荷。',
    prepType: 'chop',
    tempTarget: 75,
    cost: 22,
    tags: ['electric', 'lean', 'crispy']
  },
  {
    id: 'plasma_tentacle',
    name: '等离子巨鱿触手',
    nameEn: 'Plasma Squid Tentacle',
    category: INGREDIENT_CATEGORIES.MEAT,
    icon: '🦑',
    tier: 2,
    desc: '在等离子海中巡游的深空巨鱿触须，极度Q弹爽脆，嚼劲十足。',
    prepType: 'slice',
    tempTarget: 70,
    cost: 35,
    tags: ['chewy', 'savory', 'pure']
  },
  {
    id: 'thunder_wing',
    name: '雷霆飞龙薄翼肉',
    nameEn: 'Thunder Drake Wing',
    category: INGREDIENT_CATEGORIES.MEAT,
    icon: '🦇',
    tier: 2,
    desc: '沐浴暴风雷暴的飞龙肉，肉质纹理如同闪电，富含高能蛋白质。',
    prepType: 'chop',
    tempTarget: 85,
    cost: 45,
    tags: ['electric', 'hearty', 'rich']
  },
  {
    id: 'magma_tail',
    name: '熔岩巨蜥炙尾肉',
    nameEn: 'Magma Lizard Tail',
    category: INGREDIENT_CATEGORIES.MEAT,
    icon: '🦎',
    tier: 3,
    desc: '沉浸在沸腾熔岩中的巨蜥尾，外皮坚硬如甲，内里油脂滚烫流淌。',
    prepType: 'slice',
    tempTarget: 95,
    cost: 60,
    tags: ['fiery', 'fatty', 'savory']
  },
  {
    id: 'frost_mammoth_rib',
    name: '极寒雪绒猛犸肋排',
    nameEn: 'Cryo-Mammoth Prime Rib',
    category: INGREDIENT_CATEGORIES.MEAT,
    icon: '🍖',
    tier: 3,
    desc: '永冻冰川中封存千年的极品雪花霜降肋排，脂肪如大理石般温润。',
    prepType: 'slice',
    tempTarget: 80,
    cost: 65,
    tags: ['rich', 'tender', 'hearty']
  },
  // --- 星球独占食材：只能在特定星球采到 ---
  {
    id: 'hephaestus_core_honey',
    name: '赫菲斯托斯熔心蜜',
    nameEn: 'Hephaestus Core Honey',
    category: INGREDIENT_CATEGORIES.SPICE,
    icon: '🍯',
    tier: 4,
    desc: '只在熔核带的喷气孔边缘结晶。半流动的赤金色糖浆，入口先是灼热，再是回甘。',
    prepType: 'season',
    tempTarget: 92,
    cost: 140,
    tags: ['sweet', 'fiery', 'exotic'],
    planetOnly: 'hephaestus_4'
  },
  {
    id: 'ceto_void_roe',
    name: '刻托虚空鱼子',
    nameEn: 'Ceto Void Roe',
    category: INGREDIENT_CATEGORIES.MEAT,
    icon: '🫧',
    tier: 4,
    desc: '冰晶环带的裂隙深处冻着一层黑色鱼子，咬破的瞬间在舌尖炸出一小片星空。',
    prepType: 'plate',
    tempTarget: 8,
    cost: 150,
    tags: ['briny', 'ethereal', 'cold'],
    planetOnly: 'ceto_7'
  },
  {
    id: 'void_matriarch_heart',
    name: '虚空母龙心核',
    nameEn: 'Void Matriarch Heart',
    category: INGREDIENT_CATEGORIES.MEAT,
    icon: '💠',
    tier: 5,
    desc: '仍在缓慢搏动的传奇兽心，内部封着一小片坍缩的星域。整个星系仅此一枚。',
    prepType: 'slice',
    tempTarget: 95,
    cost: 500,
    tags: ['legendary', 'trial', 'supreme']
  },
  {
    id: 'void_wyrm_meat',
    name: '虚空神龙脊髓肉',
    nameEn: 'Void Wyrm Tenderloin',
    category: INGREDIENT_CATEGORIES.MEAT,
    icon: '🐉',
    tier: 4,
    desc: '穿越黑洞视界的远古神话级巨龙髓肉，散发着七彩霓虹微光。',
    prepType: 'slice',
    tempTarget: 88,
    cost: 100,
    tags: ['legendary', 'ethereal', 'supreme']
  },

  // --- VEGGIES & HERBS ---
  {
    id: 'zero_g_mushroom',
    name: '零重力跳跳菇',
    nameEn: 'Zero-G Bouncy Mushroom',
    category: INGREDIENT_CATEGORIES.VEG,
    icon: '🍄',
    tier: 1,
    desc: '失重温室培育的伞菌，切开后会像泡泡一样在盘中轻盈弹跳。',
    prepType: 'chop',
    tempTarget: 50,
    cost: 20,
    tags: ['pure', 'balanced', 'savory']
  },
  {
    id: 'spore_herb',
    name: '荧光孢子香草',
    nameEn: 'Bioluminescent Herb',
    category: INGREDIENT_CATEGORIES.VEG,
    icon: '🌿',
    tier: 1,
    desc: '夜晚散发柔和幽蓝萤光的草本，带有山泉般清澈的芬芳。',
    prepType: 'chop',
    tempTarget: 40,
    cost: 16,
    tags: ['pure', 'aromatic', 'glowing']
  },
  {
    id: 'aurora_jelly',
    name: '极光霓虹果冻',
    nameEn: 'Aurora Rainbow Gel',
    category: INGREDIENT_CATEGORIES.VEG,
    icon: '🍮',
    tier: 1,
    desc: '汲取星门能量凝聚的胶状果肉，入口即化，流淌出五彩斑斓的糖浆。',
    prepType: 'slice',
    tempTarget: 20,
    cost: 28,
    tags: ['sweet', 'sparkling', 'chilled']
  },
  {
    id: 'sunfire_fruit',
    name: '地热炽阳炎果',
    nameEn: 'Magma Sunfire Fruit',
    category: INGREDIENT_CATEGORIES.VEG,
    icon: '🍅',
    tier: 2,
    desc: '生长在火山口旁的朱红坚果，果肉如岩浆般甘甜滚烫，充满野性。',
    prepType: 'chop',
    tempTarget: 75,
    cost: 32,
    tags: ['fiery', 'sweet', 'rich']
  },
  {
    id: 'frost_lotus',
    name: '玄冰寒霜雪莲',
    nameEn: 'Glacial Frost Lotus',
    category: INGREDIENT_CATEGORIES.VEG,
    icon: '🪷',
    tier: 2,
    desc: '千年冰川裂缝中盛开的琉璃花瓣，清凉解热，提神醒脑。',
    prepType: 'slice',
    tempTarget: 25,
    cost: 36,
    tags: ['chilled', 'pure', 'aromatic']
  },
  {
    id: 'crystal_bloom',
    name: '高维星核晶簇花',
    nameEn: 'Stellar Core Bloom',
    category: INGREDIENT_CATEGORIES.VEG,
    icon: '🌺',
    tier: 3,
    desc: '高磁场晶簇上结晶的花朵，花蕊散发着温暖柔和的恒星引力波。',
    prepType: 'grind',
    tempTarget: 55,
    cost: 50,
    tags: ['ethereal', 'balanced', 'glowing']
  },

  // --- SPICES & SEASONINGS ---
  {
    id: 'antimatter_chili',
    name: '反物质干辣椒',
    nameEn: 'Antimatter Chili Pepper',
    category: INGREDIENT_CATEGORIES.SPICE,
    icon: '🌶️',
    tier: 1,
    desc: '接触正物质时产生微型湮灭反应，释放出毁天灭地的刺激辛辣与暖意。',
    prepType: 'chop',
    tempTarget: 75,
    cost: 20,
    tags: ['spicy', 'fiery', 'electric']
  },
  {
    id: 'pulsar_crystal_salt',
    name: '脉冲星高导晶盐',
    nameEn: 'Pulsar High-Conductive Salt',
    category: INGREDIENT_CATEGORIES.SPICE,
    icon: '🧂',
    tier: 1,
    desc: '强磁场中结晶的带电矿盐，能刺激神经突触，产生酥麻电流快感。',
    prepType: 'grind',
    tempTarget: 90,
    cost: 24,
    tags: ['salty', 'electric', 'crispy']
  },
  {
    id: 'void_mint',
    name: '虚空幽光薄荷',
    nameEn: 'Void Shimmer Mint',
    category: INGREDIENT_CATEGORIES.SPICE,
    icon: '🍃',
    tier: 1,
    desc: '生长于星门缝隙的发光草本，散发出抚平灵魂躁动的清凉幽香。',
    prepType: 'chop',
    tempTarget: 35,
    cost: 18,
    tags: ['pure', 'ethereal', 'chilled']
  },
  {
    id: 'stardust_pepper',
    name: '星尘研磨彩胡椒',
    nameEn: 'Stardust Rainbow Pepper',
    category: INGREDIENT_CATEGORIES.SPICE,
    icon: '✨',
    tier: 2,
    desc: '星际流浪陨石碎屑与香辛果实研磨，带有深邃而神秘的烟熏木质香。',
    prepType: 'grind',
    tempTarget: 70,
    cost: 30,
    tags: ['aromatic', 'savory', 'balanced']
  },
  {
    id: 'supernova_essence',
    name: '超新星浓缩热原露',
    nameEn: 'Supernova Molten Essence',
    category: INGREDIENT_CATEGORIES.SPICE,
    icon: '🔥',
    tier: 3,
    desc: '恒星坍缩瞬间捕获的极端热能液滴，只需一滴便能点燃整锅浓汤。',
    prepType: 'grind',
    tempTarget: 95,
    cost: 55,
    tags: ['fiery', 'spicy', 'supreme']
  }
];

export const RECIPES = [
  // ================= TIER 1: NOVICE / EXPLORER DISHES =================
  {
    id: 'supernova_ramen',
    name: '超新星暴风拉面',
    nameEn: 'Supernova Storm Ramen',
    tier: 1,
    icon: '🍜🔥',
    desc: '沸腾的烈焰与反物质辛辣融合，浓郁肉香直击灵魂的招牌拉面。',
    ingredients: ['nebula_noodle', 'quantum_meat', 'antimatter_chili'],
    idealTemp: 85,
    buff: {
      type: BUFF_TYPES.ATK_BOOST,
      val: 20,
      duration: 180,
      label: '攻击力提升 +20%'
    },
    rewardGold: 95,
    rewardRep: 25
  },
  {
    id: 'aurora_parfait',
    name: '猎户座极光芭菲',
    nameEn: 'Orion Aurora Parfait',
    tier: 1,
    icon: '🍧✨',
    desc: '冰凉晶莹的彗星冰晶搭配彩虹果冻与虚空薄荷，梦幻般的星空甜品。',
    ingredients: ['comet_ice_crystal', 'aurora_jelly', 'void_mint'],
    idealTemp: 15,
    buff: {
      type: BUFF_TYPES.STAMINA_REGEN,
      val: 35,
      duration: 180,
      label: '体力恢复速度 +35%'
    },
    rewardGold: 90,
    rewardRep: 25
  },
  {
    id: 'pulsar_skewer',
    name: '脉冲电弧炙烤肉串',
    nameEn: 'Pulsar Arc Skewer',
    tier: 1,
    icon: '🍢⚡',
    desc: '高能等离子急火快烤的焦香肉排，撒满酥麻高导晶盐，咔嚓作响。',
    ingredients: ['quantum_meat', 'pulsar_crystal_salt', 'zero_g_mushroom'],
    idealTemp: 90,
    buff: {
      type: BUFF_TYPES.CRIT_BOOST,
      val: 15,
      duration: 180,
      label: '暴击率提升 +15%'
    },
    rewardGold: 110,
    rewardRep: 30
  },
  {
    id: 'spore_hare_stew',
    name: '荧光菌林电兔煲',
    nameEn: 'Glow-Shroom Hare Pot',
    tier: 1,
    icon: '🍲🌿',
    desc: '微麻电兔后腿与跳跳菇在清香荧光草中温火慢炖，口感滑嫩清鲜。',
    ingredients: ['electro_hare_leg', 'zero_g_mushroom', 'spore_herb'],
    idealTemp: 65,
    buff: {
      type: BUFF_TYPES.SPEED_BOOST,
      val: 20,
      duration: 180,
      label: '移动速度 +20%'
    },
    rewardGold: 100,
    rewardRep: 28
  },
  {
    id: 'luminous_salad',
    name: '深空幽光冷萃沙拉',
    nameEn: 'Deepspace Luminous Salad',
    tier: 1,
    icon: '🥗🌌',
    desc: '采集自森林背阳处的纯净菌草，拌以薄荷与冰晶，清脆多汁，能极大开拓夜间视野。',
    ingredients: ['spore_herb', 'comet_ice_crystal', 'void_mint'],
    idealTemp: 20,
    buff: {
      type: BUFF_TYPES.NIGHT_VISION,
      val: 80,
      duration: 240,
      label: '夜间探索视野 +80%'
    },
    rewardGold: 85,
    rewardRep: 22
  },
  {
    id: 'crispy_dino_bites',
    name: '香脆量子炸肉块',
    nameEn: 'Crispy Quantum Nuggets',
    tier: 1,
    icon: '🍗🧂',
    desc: '量子肉切丁裹上面糊急火炸制，表面泛着淡金微光，越嚼越香。',
    ingredients: ['quantum_meat', 'nebula_noodle', 'pulsar_crystal_salt'],
    idealTemp: 88,
    buff: {
      type: BUFF_TYPES.MAX_HP_BOOST,
      val: 60,
      duration: 200,
      label: '最大生命值 +60'
    },
    rewardGold: 105,
    rewardRep: 30
  },

  // ================= TIER 2: GOURMET / ADVENTURER DISHES =================
  {
    id: 'stellar_dew_tart',
    name: '星咏者纯露玉露盏',
    nameEn: 'Stellar Dew Tart',
    tier: 2,
    icon: '🧁🌟',
    desc: '剔透无瑕的能量点心，汇聚了跳跳菇的灵气与星光薄荷的纯净回甘。',
    ingredients: ['star_batter', 'zero_g_mushroom', 'void_mint'],
    idealTemp: 45,
    buff: {
      type: BUFF_TYPES.LOOT_MAGNET,
      val: 120,
      duration: 240,
      label: '素材磁吸范围 +120%'
    },
    rewardGold: 145,
    rewardRep: 45
  },
  {
    id: 'thunder_platter',
    name: '雷霆狂啸飞龙扒',
    nameEn: 'Thunder Drake Searing Steak',
    tier: 2,
    icon: '🥩⚡',
    desc: '电弧流窜的雷霆飞龙薄翼与星尘胡椒煎烤，雷电能量瞬间唤醒周身细胞。',
    ingredients: ['thunder_wing', 'cosmic_rice', 'stardust_pepper'],
    idealTemp: 82,
    buff: {
      type: BUFF_TYPES.ATK_BOOST,
      val: 30,
      duration: 240,
      label: '攻击力提升 +30%'
    },
    rewardGold: 165,
    rewardRep: 50
  },
  {
    id: 'plasma_takoyaki',
    name: '等离子脆浆炙鱿丸',
    nameEn: 'Plasma Squid Puffs',
    tier: 2,
    icon: '🧆🐙',
    desc: '巨鱿触须切块包裹在超空间酥皮中烤得金黄酥脆，淋上微麻晶盐高汤。',
    ingredients: ['plasma_tentacle', 'star_batter', 'pulsar_crystal_salt'],
    idealTemp: 78,
    buff: {
      type: BUFF_TYPES.DEFENSE_BOOST,
      val: 25,
      duration: 240,
      label: '全属性减伤 +25%'
    },
    rewardGold: 155,
    rewardRep: 45
  },
  {
    id: 'sunfire_fried_rice',
    name: '炽阳熔岩黄金炒饭',
    nameEn: 'Sunfire Magma Fried Rice',
    tier: 2,
    icon: '🍳🍅',
    desc: '饱满恒星米在烈焰中与炎果大火翻炒，每一粒米都裹挟着岩浆般的香甜。',
    ingredients: ['cosmic_rice', 'sunfire_fruit', 'antimatter_chili'],
    idealTemp: 92,
    buff: {
      type: BUFF_TYPES.ELEM_RESIST,
      val: 40,
      duration: 240,
      label: '火/熔岩抗性 +40%'
    },
    rewardGold: 150,
    rewardRep: 48
  },
  {
    id: 'frost_lotus_sherbet',
    name: '寒霜琉璃雪莲酪',
    nameEn: 'Glacial Lotus Sorbet',
    tier: 2,
    icon: '🍨🪷',
    desc: '将玄冰雪莲与极光果冻在零度分子研磨中凝冻，清透如雪，沁人心脾。',
    ingredients: ['frost_lotus', 'aurora_jelly', 'comet_ice_crystal'],
    idealTemp: 10,
    buff: {
      type: BUFF_TYPES.STAMINA_REGEN,
      val: 50,
      duration: 240,
      label: '体力恢复速度 +50%'
    },
    rewardGold: 160,
    rewardRep: 50
  },
  {
    id: 'spicy_squid_noodles',
    name: '烈焰等离子鱿鱼面',
    nameEn: 'Flaming Plasma Squid Noodles',
    tier: 2,
    icon: '🍜🦑',
    desc: '滑爽星云拉面与嚼劲十足的等离子触手，在反物质干辣椒炒制中爆发火辣热浪。',
    ingredients: ['nebula_noodle', 'plasma_tentacle', 'antimatter_chili'],
    idealTemp: 86,
    buff: {
      type: BUFF_TYPES.SPEED_BOOST,
      val: 30,
      duration: 240,
      label: '移动速度 +30%'
    },
    rewardGold: 155,
    rewardRep: 48
  },

  // ================= TIER 3: MASTER / STAR CHEF DISHES =================
  {
    id: 'magma_roaster',
    name: '熔岩巨蜥炙火盛宴',
    nameEn: 'Magma Lizard Volcano Roast',
    tier: 3,
    icon: '🍖🔥',
    desc: '取自地心熔岩巨蜥的完整尾段，涂抹超新星热原露烤至滴油脆皮，香浓无比。',
    ingredients: ['magma_tail', 'sunfire_fruit', 'supernova_essence'],
    idealTemp: 96,
    buff: {
      type: BUFF_TYPES.ATK_BOOST,
      val: 45,
      duration: 300,
      label: '攻击力提升 +45% (附带熔岩溅射)'
    },
    rewardGold: 240,
    rewardRep: 80
  },
  {
    id: 'cryo_mammoth_pot',
    name: '极寒雪绒猛犸暖心煲',
    nameEn: 'Cryo-Mammoth Hearth Pot',
    tier: 3,
    icon: '🍲❄️',
    desc: '冰封万年的霜降猛犸肋排配以星核晶簇花与恒星米文火慢煨，入口即化。',
    ingredients: ['frost_mammoth_rib', 'crystal_bloom', 'cosmic_rice'],
    idealTemp: 78,
    buff: {
      type: BUFF_TYPES.MAX_HP_BOOST,
      val: 150,
      duration: 300,
      label: '最大生命值 +150'
    },
    rewardGold: 250,
    rewardRep: 85
  },
  {
    id: 'astral_crystal_terrine',
    name: '星核晶簇光华冻',
    nameEn: 'Astral Core Crystal Terrine',
    tier: 3,
    icon: '🧊🌺',
    desc: '晶簇花与雪莲花瓣凝封在极光虹冻中，折射出恒星光芒，能极大增强感知磁力。',
    ingredients: ['crystal_bloom', 'frost_lotus', 'aurora_jelly'],
    idealTemp: 22,
    buff: {
      type: BUFF_TYPES.LOOT_MAGNET,
      val: 200,
      duration: 300,
      label: '素材磁吸范围 +200%'
    },
    rewardGold: 230,
    rewardRep: 75
  },
  {
    id: 'tempest_dragon_skewer',
    name: '暴风雷霆龙肉大串',
    nameEn: 'Tempest Thunder Skewers',
    tier: 3,
    icon: '🍢⚡',
    desc: '飞龙肉与量子肉交替串起，撒以超新星原露与高导晶盐，每一口都伴随雷鸣！',
    ingredients: ['thunder_wing', 'quantum_meat', 'supernova_essence'],
    idealTemp: 94,
    buff: {
      type: BUFF_TYPES.CRIT_BOOST,
      val: 30,
      duration: 300,
      label: '暴击率 +30%'
    },
    rewardGold: 260,
    rewardRep: 90
  },
  {
    id: 'frostfire_harmony_bowl',
    name: '冰火同源阴阳双生羹',
    nameEn: 'Frostfire Harmony Soup',
    tier: 3,
    icon: '🥣☯️',
    desc: '熔岩炙尾肉与寒霜雪莲在星尘胡椒调和下完美共存，冷热交织，抗性拉满。',
    ingredients: ['magma_tail', 'frost_lotus', 'stardust_pepper'],
    idealTemp: 55,
    buff: {
      type: BUFF_TYPES.ELEM_RESIST,
      val: 60,
      duration: 300,
      label: '全元素抗性 +60%'
    },
    rewardGold: 255,
    rewardRep: 88
  },

  // ================= TIER 4: COSMIC / LEGENDARY 3-STAR DISHES =================
  {
    id: 'cosmic_fusion_supreme',
    name: '银河创世至尊宴 (米其林特选)',
    nameEn: 'Galaxy Genesis Grand Banquet',
    tier: 4,
    icon: '👑🌌',
    desc: '汇聚宇宙四极之味：冰与火、实与虚完美交融的终极艺术之作。吃上一口，宛若置身宇宙大爆炸中心。',
    ingredients: ['quantum_meat', 'antimatter_chili', 'comet_ice_crystal', 'void_mint'],
    idealTemp: 60,
    buff: {
      type: BUFF_TYPES.ATK_BOOST,
      val: 50,
      duration: 360,
      label: '攻击力 +50%, 移速 +30%, 最大HP +100'
    },
    rewardGold: 380,
    rewardRep: 150
  },
  {
    id: 'void_dragon_ambrosia',
    name: '虚空太古神龙琼浆',
    nameEn: 'Void Wyrm Astral Ambrosia',
    tier: 4,
    icon: '🐉✨',
    desc: '采用虚空神龙脊髓肉，搭配星核晶簇花与超新星热原露，神圣光华照亮整片星域。',
    ingredients: ['void_wyrm_meat', 'crystal_bloom', 'supernova_essence'],
    idealTemp: 88,
    buff: {
      type: BUFF_TYPES.MAX_HP_BOOST,
      val: 250,
      duration: 400,
      label: '最大生命值 +250, 体力回复 +100%'
    },
    rewardGold: 450,
    rewardRep: 200
  },
  {
    id: 'celestial_god_ramen',
    name: '太初食神万象拉面',
    nameEn: 'Celestial Omniverse Ramen',
    tier: 4,
    icon: '🍜👑',
    desc: '神龙肉与猛犸肋排熬制千万年的原汤，浸润星云拉面，点缀星尘胡椒，米其林三星评委终生难忘。',
    ingredients: ['nebula_noodle', 'void_wyrm_meat', 'frost_mammoth_rib', 'stardust_pepper'],
    idealTemp: 84,
    buff: {
      type: BUFF_TYPES.DEFENSE_BOOST,
      val: 45,
      duration: 400,
      label: '全属性减伤 +45%, 移速 +40%'
    },
    rewardGold: 500,
    rewardRep: 220
  },
  {
    id: 'multiverse_eternal_pie',
    name: '多元宇宙永恒星光派',
    nameEn: 'Multiverse Eternal Star Pie',
    tier: 4,
    icon: '🥧🌌',
    desc: '酥皮层叠无穷维度，内馅封存着彗星冰晶与虚空神龙髓，散发不灭恒星光芒。',
    ingredients: ['star_batter', 'void_wyrm_meat', 'comet_ice_crystal', 'void_mint'],
    idealTemp: 50,
    buff: {
      type: BUFF_TYPES.LOOT_MAGNET,
      val: 300,
      duration: 400,
      label: '全图素材磁吸, 夜视范围 +150%'
    },
    rewardGold: 480,
    rewardRep: 210
  },
  // ================= 终极评鉴专属 =================
  {
    id: 'matriarch_grand_feast',
    name: '虚空母龙 · 终焉盛宴',
    nameEn: 'Void Matriarch Grand Feast',
    tier: 5,
    icon: '💠🔥',
    desc: '以传奇兽心为主轴，佐以恒星米与炽阳炎果收汁。评审团面前只有一次机会。',
    ingredients: ['void_matriarch_heart', 'cosmic_rice', 'sunfire_fruit', 'pulsar_crystal_salt'],
    idealTemp: 95,
    buff: {
      type: BUFF_TYPES.ATK_BOOST,
      val: 60,
      duration: 480,
      label: '攻击力提升 +60%'
    },
    rewardGold: 1200,
    rewardRep: 400,
    isFinale: true
  }
];

// Fallback dynamic recipe generator for freeform cooking
// 星球独占配方：材料只能在对应星球采到，因此必须跃迁过去才做得出来
RECIPES.push(
  {
    id: 'molten_core_glaze',
    name: '熔核琉金炙鳞',
    nameEn: 'Molten Core Glazed Scale',
    tier: 4,
    icon: '🔥🍯',
    desc: '熔岩巨蜥的厚鳞先用熔心蜜反复刷面，再贴着喷气孔的余温慢炙出一层琥珀脆壳。',
    ingredients: ['magma_tail', 'hephaestus_core_honey', 'antimatter_chili'],
    idealTemp: 94,
    buff: {
      type: BUFF_TYPES.ATK_BOOST,
      val: 42,
      duration: 210,
      label: '攻击力提升 +42%'
    },
    rewardGold: 320,
    rewardRep: 78,
    planetOnly: 'hephaestus_4'
  },
  {
    id: 'void_roe_terrine',
    name: '虚空鱼子冻星冻',
    nameEn: 'Void Roe Star Terrine',
    tier: 4,
    icon: '🫧❄️',
    desc: '虚空鱼子悬在雪莲清冻里，切开时断面像一小块被封住的深空。全程不得升温。',
    ingredients: ['ceto_void_roe', 'frost_lotus', 'comet_ice_crystal'],
    idealTemp: 6,
    buff: {
      type: BUFF_TYPES.CRIT_BOOST,
      val: 30,
      duration: 210,
      label: '暴击率提升 +30%'
    },
    rewardGold: 340,
    rewardRep: 82,
    planetOnly: 'ceto_7'
  }
);

export function matchRecipe(selectedIds) {
  if (!selectedIds || selectedIds.length === 0) return null;

  const sortedSelected = [...selectedIds].sort();

  // 1. Exact match check
  for (const recipe of RECIPES) {
    const sortedReq = [...recipe.ingredients].sort();
    if (sortedSelected.length === sortedReq.length &&
        sortedSelected.every((val, idx) => val === sortedReq[idx])) {
      return { ...recipe, exactMatch: true };
    }
  }

  // 2. Partial / Sub-combination check (if user provided a superset or subset that fits best)
  let bestMatch = null;
  let bestMatchCount = 0;

  for (const recipe of RECIPES) {
    const matchCount = recipe.ingredients.filter(id => selectedIds.includes(id)).length;
    if (matchCount > bestMatchCount && matchCount >= Math.min(2, recipe.ingredients.length)) {
      bestMatch = recipe;
      bestMatchCount = matchCount;
    }
  }

  if (bestMatch && bestMatchCount === bestMatch.ingredients.length) {
    return { ...bestMatch, exactMatch: false };
  }

  // 3. Dynamic Freeform Discovery Dish (Wilderness Stew)
  const ingredientObjs = selectedIds.map(id => ALL_INGREDIENTS.find(i => i.id === id)).filter(Boolean);
  const avgTemp = Math.round(ingredientObjs.reduce((acc, i) => acc + i.tempTarget, 0) / (ingredientObjs.length || 1));
  const hasMeat = ingredientObjs.some(i => i.category === INGREDIENT_CATEGORIES.MEAT);
  const hasSpice = ingredientObjs.some(i => i.category === INGREDIENT_CATEGORIES.SPICE);
  const hasVeg = ingredientObjs.some(i => i.category === INGREDIENT_CATEGORIES.VEG);

  let dishName = '荒野猎人乱炖星煲';
  let buffType = BUFF_TYPES.MAX_HP_BOOST;
  let buffVal = 30;
  let buffLabel = '最大生命值 +30';
  let icon = '🍲';

  if (hasMeat && hasSpice) {
    dishName = '星际野性炙热烤杂烩';
    buffType = BUFF_TYPES.ATK_BOOST;
    buffVal = 15;
    buffLabel = '攻击力提升 +15%';
    icon = '🍖';
  } else if (hasVeg && hasSpice) {
    dishName = '深空鲜蔬能量温羹';
    buffType = BUFF_TYPES.SPEED_BOOST;
    buffVal = 15;
    buffLabel = '移动速度 +15%';
    icon = '🥗';
  } else if (hasVeg) {
    dishName = '纯净星原草本清汤';
    buffType = BUFF_TYPES.STAMINA_REGEN;
    buffVal = 20;
    buffLabel = '体力恢复速度 +20%';
    icon = '🥣';
  }

  return {
    id: `custom_dish_${selectedIds.join('_')}`,
    name: dishName,
    nameEn: 'Wilderness Hunter Blend',
    tier: 1,
    icon: icon,
    desc: '利用荒野采摘的异星食材自创烹饪的温热料理，虽未入选星级菜谱，却充满冒险者的淳朴滋味。',
    ingredients: [...selectedIds],
    idealTemp: avgTemp,
    buff: {
      type: buffType,
      val: buffVal,
      duration: 150,
      label: buffLabel
    },
    rewardGold: Math.round(ingredientObjs.reduce((acc, i) => acc + i.cost, 0) * 1.5),
    rewardRep: 10,
    exactMatch: false,
    isCustom: true
  };
}

export function getIngredientById(id) {
  return ALL_INGREDIENTS.find(i => i.id === id) || null;
}

export function getRecipeById(id) {
  return RECIPES.find(r => r.id === id) || null;
}

// ================= 食谱解锁 =================
// 声望到线即自动写进图鉴，不必先误打误撞做出来。等级由星级和累计出餐折算。

const TIER_UNLOCK_REP = { 1: 0, 2: 70, 3: 190, 4: 380, 5: 620 };

// 星球独占配方要等那颗星球也解锁了才进图鉴，否则会出现"看得到做不出"的菜
const PLANET_GATE_REP = { hephaestus_4: 180, ceto_7: 420 };

/** 一道菜进图鉴所需的声望。 */
export function recipeUnlockRep(recipe) {
  if (!recipe || recipe.isCustom) return 0;
  const base = TIER_UNLOCK_REP[recipe.tier] ?? 0;
  const gate = recipe.planetOnly ? (PLANET_GATE_REP[recipe.planetOnly] ?? 0) : 0;
  return Math.max(base, gate);
}

/** 该食谱当前是否已在图鉴里。 */
export function isRecipeUnlocked(gameData, recipeId) {
  return (gameData?.discoveredRecipes || []).includes(recipeId);
}

/**
 * 按当前声望补齐图鉴，返回这次新解锁的食谱列表。
 */
export function refreshRecipeUnlocks(gameData) {
  if (!gameData) return [];
  if (!Array.isArray(gameData.discoveredRecipes)) gameData.discoveredRecipes = [];

  const rep = gameData.reputation || 0;
  const fresh = [];
  for (const r of RECIPES) {
    if (gameData.discoveredRecipes.includes(r.id)) continue;
    if (rep < recipeUnlockRep(r)) continue;
    gameData.discoveredRecipes.push(r.id);
    fresh.push(r);
  }
  return fresh;
}

/** 图鉴进度：已解锁 / 总数，以及下一档的门槛。 */
export function recipeProgress(gameData) {
  const have = (gameData?.discoveredRecipes || []).filter(id => RECIPES.some(r => r.id === id)).length;
  const rep = gameData?.reputation || 0;
  const nextTier = [1, 2, 3, 4, 5].find(t => TIER_UNLOCK_REP[t] > rep);
  return {
    have,
    total: RECIPES.length,
    nextRep: nextTier ? TIER_UNLOCK_REP[nextTier] : null,
    nextTier: nextTier || null
  };
}

// ================= 生食 =================
// 不下锅直接吃：回一点血和耐力，没有任何 Buff。
// 数值刻意压得比料理低很多，只作为野外应急，不能替代烹饪。

const RAW_BY_CATEGORY = {
  [INGREDIENT_CATEGORIES.MEAT]: { hp: 14, stamina: 5, note: '生肉腥得很，但顶饿' },
  [INGREDIENT_CATEGORIES.VEG]: { hp: 5, stamina: 20, note: '嚼着清爽，缓过一口气' },
  [INGREDIENT_CATEGORIES.BASE]: { hp: 8, stamina: 16, note: '干噎下去，好歹垫了底' },
  [INGREDIENT_CATEGORIES.SPICE]: { hp: 1, stamina: 9, note: '呛得整个人精神了' }
};

/**
 * 一份生食材直接吃能回多少。品阶越高回得越多。
 */
export function rawFoodValue(ingredient) {
  if (!ingredient) return null;
  const base = RAW_BY_CATEGORY[ingredient.category] || RAW_BY_CATEGORY[INGREDIENT_CATEGORIES.BASE];
  const scale = 1 + ((ingredient.tier || 1) - 1) * 0.35;
  return {
    hp: Math.round(base.hp * scale),
    stamina: Math.round(base.stamina * scale),
    note: base.note
  };
}
