/* ============================================================
 * 菜鸡修仙传 · 数据层 (DATA)
 * 所有静态配置：种族 / 境界 / 伙伴 / 装备 / 法宝 / 敌人 / 道具 / 商店
 * 通过 globalThis.CJ.P 暴露，浏览器与 Node 均可加载。
 * ============================================================ */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const CJ = (G.CJ = G.CJ || {});

  // ---------- 通用常量 ----------
  const ELEMENTS = ['金', '木', '水', '火', '土'];
  // 克制：key 被 value 克制 (value 攻击 key 时 +伤害)
  const BEATS = { 金: '木', 木: '土', 土: '水', 水: '火', 火: '金' };
  const QMAP = { 白: 0, 绿: 1, 蓝: 2, 紫: 3, 金: 4, 红: 5 };
  const ROLES = { atk: '输出', tank: '坦克', heal: '治疗', ctrl: '控制' };
  const RACE = {
    human: {
      name: '人族', passive: 'hu', intro: '沉默掌控',
      nid: '人·灵气刃', uid: '人·镇魂域',
      normal: { name: '灵气刃', text: '攻击当前敌人，造成100%法术伤害。' },
      ultimate: { name: '镇魂领域', text: '攻击全体敌人，造成150%伤害，并有35%概率使其沉默6秒。' }
    },
    demon: {
      name: '魔族', passive: 'de', intro: '高爆输出',
      nid: '魔·魔爪', uid: '魔·魔吞天地',
      normal: { name: '魔爪', text: '攻击当前敌人，造成100%物理伤害。' },
      ultimate: { name: '魔吞天地', text: '攻击全体敌人，造成175%伤害，并提高自身50%攻击，持续6秒。' }
    },
    dragon: {
      name: '龙人族', passive: 'dr', intro: '肉盾守护',
      nid: '龙·龙爪', uid: '龙·真龙威',
      normal: { name: '龙爪', text: '攻击当前敌人，造成100%物理伤害。' },
      ultimate: { name: '真龙威', text: '嘲讽敌人攻击自己，提高自身50%防御持续6秒，同时对敌人造成180%伤害。' }
    },
    elf: {
      name: '精灵族', passive: 'el', intro: '治疗续航',
      nid: '精·自然之箭', uid: '精·圣光普照',
      normal: { name: '自然之箭', text: '攻击当前敌人，造成100%法术伤害。' },
      ultimate: { name: '圣光普照', text: '治疗全体队友，回复相当于自身攻击60%的治疗量，提升全体队友5%攻击持续6秒，并驱散3名队友的减益buff。' }
    }
  };

  // ---------- 境界体系 ----------
  // 每一大境界含 9 层（一层~九层），渡劫成功进入下一大境界
  const REALMS = [
    { name: '炼气', tier: 0, mult: 1.0 },
    { name: '筑基', tier: 1, mult: 2.6 },
    { name: '金丹', tier: 2, mult: 6.8 },
    { name: '元婴', tier: 3, mult: 18 },
    { name: '化神', tier: 4, mult: 48 },
    { name: '炼虚', tier: 5, mult: 128 },
    { name: '合体', tier: 6, mult: 340 },
    { name: '大乘', tier: 7, mult: 900 },
    { name: '渡劫', tier: 8, mult: 2400 }
  ];
  const MAX_REALM = 8; // 渡劫 圆满后飞升

  // ---------- 五行本源石用途 ----------
  const ELEM_NAME = { 金: '庚金', 木: '甲木', 水: '癸水', 火: '丙火', 土: '戊土' };

  // ---------- 伙伴库 ----------
  // quality: 2=蓝 3=紫 4=金 5=红
  // role: atk/tank/heal/ctrl
  const PARTNERS = [
    // ---- 蓝 (2) 基础卡 ----
    { id: 'b01', name: '青衣剑侍', q: 2, role: 'atk', el: '金', hp: 120, atk: 32, def: 12, spd: 105, skills: ['锐剑', '斩钢'], desc: '青衫仗剑，剑势锋锐。' },
    { id: 'b02', name: '赤焰童子', q: 2, role: 'atk', el: '火', hp: 100, atk: 36, def: 10, spd: 112, skills: ['火弹', '焰爆'], desc: '顽童驭火，灼热难挡。' },
    { id: 'b03', name: '碧水灵侍', q: 2, role: 'heal', el: '水', hp: 105, atk: 24, def: 11, spd: 98, skills: ['甘霖', '润泽'], desc: '碧波为引，疗愈众生。' },
    { id: 'b04', name: '磐石力士', q: 2, role: 'tank', el: '土', hp: 180, atk: 22, def: 22, spd: 85, skills: ['石肤', '撼地'], desc: '身如磐石，稳如泰山。' },
    { id: 'b05', name: '荆棘藤姬', q: 2, role: 'ctrl', el: '木', hp: 110, atk: 28, def: 12, spd: 96, skills: ['缠绕', '荆棘'], desc: '藤蔓缠绵，困敌于无形。' },
    { id: 'b06', name: '金甲侍卫', q: 2, role: 'tank', el: '金', hp: 165, atk: 24, def: 20, spd: 90, skills: ['金盾', '横扫'], desc: '甲胄森然，金气凛冽。' },
    { id: 'b07', name: '流云散人', q: 2, role: 'atk', el: '木', hp: 105, atk: 33, def: 10, spd: 108, skills: ['风刃', '青藤'], desc: '闲云野鹤，出手飘逸。' },
    { id: 'b08', name: '寒潭蛙仙', q: 2, role: 'ctrl', el: '水', hp: 112, atk: 27, def: 12, spd: 94, skills: ['冰缚', '寒潭'], desc: '蛙鸣一响，寒气逼人。' },

    // ---- 紫 (3) 中坚卡 ----
    { id: 'p01', name: '雷霆剑修', q: 3, role: 'atk', el: '金', hp: 168, atk: 54, def: 20, spd: 118, skills: ['雷剑', '雷狱', '引雷'], desc: '一剑引九天之雷。' },
    { id: 'p02', name: '幽冥行者', q: 3, role: 'atk', el: '火', hp: 155, atk: 60, def: 17, spd: 126, skills: ['冥火', '魂噬', '焚魂'], desc: '行走幽冥，噬魂夺魄。' },
    { id: 'p03', name: '青莲仙子', q: 3, role: 'heal', el: '水', hp: 160, atk: 40, def: 18, spd: 102, skills: ['青莲', '净世', '普济'], desc: '青莲出水，净世渡人。' },
    { id: 'p04', name: '镇岳玄武', q: 3, role: 'tank', el: '土', hp: 300, atk: 38, def: 42, spd: 82, skills: ['玄武甲', '镇岳', '地裂'], desc: '玄武镇岳，万法不侵。' },
    { id: 'p05', name: '摄魂女修', q: 3, role: 'ctrl', el: '木', hp: 165, atk: 46, def: 18, spd: 112, skills: ['迷魂', '幻梦', '摄魂'], desc: '一颦一笑，摄人魂魄。' },
    { id: 'p06', name: '烈焰枪皇', q: 3, role: 'atk', el: '火', hp: 170, atk: 58, def: 20, spd: 116, skills: ['炎枪', '燎原', '焚天'], desc: '一枪燎原，烈火焚天。' },
    { id: 'p07', name: '枯木药师', q: 3, role: 'heal', el: '木', hp: 175, atk: 42, def: 22, spd: 96, skills: ['回春', '枯荣', '春生'], desc: '枯木逢春，妙手回春。' },

    // ---- 金 (4) 精英卡 ----
    { id: 'g01', name: '太虚剑尊', q: 4, role: 'atk', el: '金', hp: 260, atk: 96, def: 34, spd: 132, skills: ['无相剑', '太虚斩', '剑破虚空'], desc: '剑出太虚，斩断因果。' },
    { id: 'g02', name: '九幽魔帝', q: 4, role: 'atk', el: '火', hp: 250, atk: 104, def: 30, spd: 128, skills: ['魔焰', '九幽狱', '魔帝降世'], desc: '九幽之主，魔焰滔天。' },
    { id: 'g03', name: '太阴月神', q: 4, role: 'heal', el: '水', hp: 265, atk: 68, def: 30, spd: 112, skills: ['月华', '太阴咒', '普度众生'], desc: '月华如练，普度苍生。' },
    { id: 'g04', name: '不动明王', q: 4, role: 'tank', el: '土', hp: 520, atk: 70, def: 76, spd: 92, skills: ['明王金身', '梵音镇魔', '金刚不坏'], desc: '明王不动，金刚不坏。' },
    { id: 'g05', name: '雪域冰皇', q: 4, role: 'ctrl', el: '水', hp: 280, atk: 82, def: 34, spd: 124, skills: ['冰封', '万里雪飘', '极寒领域'], desc: '冰封万里，雪国无双。' },
    { id: 'g06', name: '万花谷主', q: 4, role: 'ctrl', el: '木', hp: 275, atk: 84, def: 30, spd: 122, skills: ['花语', '百花杀', '万花天幕'], desc: '万花齐放，杀机暗藏。' },
    { id: 'g07', name: '大日雷君', q: 4, role: 'atk', el: '火', hp: 268, atk: 100, def: 32, spd: 126, skills: ['大日炎', '天雷罚', '焚城龙焰'], desc: '大日当空，雷罚万里。' },

    // ---- 红 (5) 传说卡 ----
    { id: 'r01', name: '鸿蒙道祖', q: 5, role: 'atk', el: '金', hp: 420, atk: 190, def: 60, spd: 140, skills: ['开天', '鸿蒙剑气', '道祖临尘'], desc: '开天辟地，鸿蒙第一人。' },
    { id: 'r02', name: '混沌魔祖', q: 5, role: 'atk', el: '火', hp: 400, atk: 205, def: 55, spd: 136, skills: ['混沌火', '魔噬天穹', '灭世魔祖'], desc: '混沌之中，魔祖独尊。' },
    { id: 'r03', name: '南华仙尊', q: 5, role: 'heal', el: '木', hp: 430, atk: 132, def: 52, spd: 124, skills: ['造化', '万物归元', '起死回生'], desc: '南华无量，万物归元。' },
    { id: 'r04', name: '不灭金神', q: 5, role: 'tank', el: '土', hp: 900, atk: 140, def: 130, spd: 104, skills: ['不灭金身', '翻江倒海', '永世不灭'], desc: '金身不灭，永世长存。' },
    { id: 'r05', name: '轮回妖皇', q: 5, role: 'ctrl', el: '水', hp: 430, atk: 160, def: 58, spd: 134, skills: ['轮回', '因果律', '轮回禁锢'], desc: '执掌轮回，颠倒因果。' },
    { id: 'r06', name: '青帝玄祖', q: 5, role: 'ctrl', el: '木', hp: 420, atk: 165, def: 55, spd: 132, skills: ['青帝掌', '生生不息', '万象归墟'], desc: '青帝掌天，万象皆由。' }
  ];

  // ---------- 技能库 (以 id 引用) ----------
  const SKILLS = {
    // 主角 / 通用
    basic: { name: '普通攻击', type: 'dmg', mult: 1.0, cd: 0, target: 'one', desc: '挥出一击。' },
    // ---- 蓝卡技能 ----
    '锐剑': { name: '锐剑', type: 'dmg', mult: 1.5, cd: 2, target: 'one' },
    '斩钢': { name: '斩钢', type: 'dmg', mult: 2.0, cd: 3, target: 'one' },
    '火弹': { name: '火弹', type: 'dmg', mult: 1.5, cd: 2, target: 'one' },
    '焰爆': { name: '焰爆', type: 'dmg', mult: 1.8, cd: 3, target: 'all' },
    '甘霖': { name: '甘霖', type: 'heal', mult: 1.4, cd: 2, target: 'allylow' },
    '润泽': { name: '润泽', type: 'heal', mult: 1.6, cd: 3, target: 'all' },
    '石肤': { name: '石肤', type: 'buff', buff: 'def', pct: 60, dur: 2, cd: 2, target: 'self' },
    '撼地': { name: '撼地', type: 'dmg', mult: 1.6, cd: 3, target: 'one' },
    '缠绕': { name: '缠绕', type: 'dmg', mult: 1.2, cd: 2, stun: 0.45, dur: 1, target: 'one' },
    '荆棘': { name: '荆棘', type: 'dmg', mult: 1.5, cd: 3, burn: 0.4, dur: 2, target: 'one' },
    '金盾': { name: '金盾', type: 'buff', buff: 'def', pct: 55, dur: 2, cd: 2, target: 'self' },
    '横扫': { name: '横扫', type: 'dmg', mult: 1.5, cd: 3, target: 'two' },
    '风刃': { name: '风刃', type: 'dmg', mult: 1.6, cd: 2, target: 'one' },
    '青藤': { name: '青藤', type: 'dmg', mult: 1.4, cd: 3, stun: 0.4, dur: 1, target: 'one' },
    '冰缚': { name: '冰缚', type: 'dmg', mult: 1.3, cd: 2, freeze: 0.45, dur: 1, target: 'one' },
    '寒潭': { name: '寒潭', type: 'dmg', mult: 1.5, cd: 3, target: 'one' },
    // ---- 紫卡技能 ----
    '雷剑': { name: '雷剑', type: 'dmg', mult: 1.8, cd: 2, target: 'one' },
    '雷狱': { name: '雷狱', type: 'dmg', mult: 1.8, cd: 3, stun: 0.5, dur: 1, target: 'all' },
    '引雷': { name: '引雷', type: 'dmg', mult: 2.4, cd: 4, target: 'one' },
    '冥火': { name: '冥火', type: 'dmg', mult: 1.7, cd: 2, burn: 0.45, dur: 2, target: 'one' },
    '魂噬': { name: '魂噬', type: 'dmg', mult: 2.0, cd: 3, lifesteal: 0.5, target: 'one' },
    '焚魂': { name: '焚魂', type: 'dmg', mult: 2.5, cd: 4, target: 'all' },
    '青莲': { name: '青莲', type: 'heal', mult: 1.8, cd: 2, target: 'allylow' },
    '净世': { name: '净世', type: 'heal', mult: 1.6, cd: 3, clear: true, target: 'all' },
    '普济': { name: '普济', type: 'heal', mult: 2.2, cd: 4, regen: 0.2, dur: 3, target: 'all' },
    '玄武甲': { name: '玄武甲', type: 'buff', buff: 'def', pct: 90, dur: 2, cd: 2, target: 'self' },
    '镇岳': { name: '镇岳', type: 'dmg', mult: 1.8, cd: 3, stun: 0.5, dur: 1, target: 'one' },
    '地裂': { name: '地裂', type: 'dmg', mult: 1.8, cd: 3, target: 'all' },
    '迷魂': { name: '迷魂', type: 'dmg', mult: 1.4, cd: 2, silence: 0.4, dur: 2, target: 'one' },
    '幻梦': { name: '幻梦', type: 'dmg', mult: 1.6, cd: 3, freeze: 0.5, dur: 1, target: 'one' },
    '摄魂': { name: '摄魂', type: 'dmg', mult: 2.2, cd: 4, stun: 0.6, dur: 1, target: 'one' },
    '炎枪': { name: '炎枪', type: 'dmg', mult: 1.9, cd: 2, target: 'one' },
    '燎原': { name: '燎原', type: 'dmg', mult: 1.7, cd: 3, burn: 0.5, dur: 2, target: 'all' },
    '焚天': { name: '焚天', type: 'dmg', mult: 2.6, cd: 4, target: 'all' },
    '回春': { name: '回春', type: 'heal', mult: 1.9, cd: 2, target: 'allylow' },
    '枯荣': { name: '枯荣', type: 'dmg', mult: 1.8, cd: 3, lifesteal: 0.4, target: 'one' },
    '春生': { name: '春生', type: 'heal', mult: 2.4, cd: 4, regen: 0.25, dur: 3, target: 'all' },
    // ---- 金卡技能 ----
    '无相剑': { name: '无相剑', type: 'dmg', mult: 2.0, cd: 2, target: 'one' },
    '太虚斩': { name: '太虚斩', type: 'dmg', mult: 2.4, cd: 3, target: 'all' },
    '剑破虚空': { name: '剑破虚空', type: 'dmg', mult: 3.0, cd: 4, stun: 0.6, dur: 1, target: 'one' },
    '魔焰': { name: '魔焰', type: 'dmg', mult: 2.1, cd: 2, burn: 0.5, dur: 2, target: 'one' },
    '九幽狱': { name: '九幽狱', type: 'dmg', mult: 2.4, cd: 3, target: 'all' },
    '魔帝降世': { name: '魔帝降世', type: 'dmg', mult: 3.1, cd: 4, target: 'all' },
    '月华': { name: '月华', type: 'heal', mult: 2.0, cd: 2, target: 'allylow' },
    '太阴咒': { name: '太阴咒', type: 'dmg', mult: 2.0, cd: 3, freeze: 0.5, dur: 1, target: 'all' },
    '普度众生': { name: '普度众生', type: 'heal', mult: 2.8, cd: 4, regen: 0.3, dur: 3, target: 'all' },
    '明王金身': { name: '明王金身', type: 'buff', buff: 'def', pct: 130, dur: 2, cd: 2, target: 'self' },
    '梵音镇魔': { name: '梵音镇魔', type: 'dmg', mult: 2.0, cd: 3, stun: 0.6, dur: 1, target: 'all' },
    '金刚不坏': { name: '金刚不坏', type: 'buff', buff: 'hp', pct: 60, dur: 3, cd: 4, target: 'self' },
    '冰封': { name: '冰封', type: 'dmg', mult: 1.8, cd: 2, freeze: 0.6, dur: 1, target: 'one' },
    '万里雪飘': { name: '万里雪飘', type: 'dmg', mult: 2.1, cd: 3, freeze: 0.5, dur: 1, target: 'all' },
    '极寒领域': { name: '极寒领域', type: 'dmg', mult: 2.6, cd: 4, silence: 0.6, dur: 2, target: 'all' },
    '花语': { name: '花语', type: 'dmg', mult: 1.9, cd: 2, silence: 0.5, dur: 2, target: 'one' },
    '百花杀': { name: '百花杀', type: 'dmg', mult: 2.2, cd: 3, target: 'all' },
    '万花天幕': { name: '万花天幕', type: 'dmg', mult: 2.7, cd: 4, silence: 0.7, dur: 2, target: 'all' },
    '大日炎': { name: '大日炎', type: 'dmg', mult: 2.2, cd: 2, burn: 0.55, dur: 2, target: 'one' },
    '天雷罚': { name: '天雷罚', type: 'dmg', mult: 2.4, cd: 3, target: 'all' },
    '焚城龙焰': { name: '焚城龙焰', type: 'dmg', mult: 3.0, cd: 4, burn: 0.6, dur: 2, target: 'all' },
    // ---- 红卡技能 ----
    '开天': { name: '开天', type: 'dmg', mult: 2.6, cd: 2, target: 'all' },
    '鸿蒙剑气': { name: '鸿蒙剑气', type: 'dmg', mult: 3.2, cd: 3, target: 'all' },
    '道祖临尘': { name: '道祖临尘', type: 'dmg', mult: 4.0, cd: 4, stun: 0.7, dur: 1, target: 'all' },
    '混沌火': { name: '混沌火', type: 'dmg', mult: 2.7, cd: 2, burn: 0.6, dur: 3, target: 'one' },
    '魔噬天穹': { name: '魔噬天穹', type: 'dmg', mult: 3.2, cd: 3, target: 'all' },
    '灭世魔祖': { name: '灭世魔祖', type: 'dmg', mult: 4.2, cd: 4, silence: 0.7, dur: 2, target: 'all' },
    '造化': { name: '造化', type: 'heal', mult: 2.6, cd: 2, regen: 0.2, dur: 2, target: 'all' },
    '万物归元': { name: '万物归元', type: 'heal', mult: 2.6, cd: 3, clear: true, regen: 0.3, dur: 3, target: 'all' },
    '起死回生': { name: '起死回生', type: 'heal', mult: 3.6, cd: 4, revive: 0.35, target: 'all' },
    '不灭金身': { name: '不灭金身', type: 'buff', buff: 'atk', pct: 60, dur: 3, cd: 3, target: 'self' },
    '翻江倒海': { name: '翻江倒海', type: 'dmg', mult: 3.0, cd: 3, stun: 0.6, dur: 1, target: 'all' },
    '永世不灭': { name: '永世不灭', type: 'buff', buff: 'hp', pct: 90, dur: 4, cd: 4, target: 'self' },
    '轮回': { name: '轮回', type: 'dmg', mult: 2.6, cd: 2, freeze: 0.6, dur: 1, target: 'one' },
    '因果律': { name: '因果律', type: 'dmg', mult: 3.0, cd: 3, silence: 0.6, dur: 2, target: 'all' },
    '轮回禁锢': { name: '轮回禁锢', type: 'dmg', mult: 3.6, cd: 4, stun: 0.7, dur: 1, target: 'all' },
    '青帝掌': { name: '青帝掌', type: 'dmg', mult: 2.7, cd: 2, silence: 0.6, dur: 2, target: 'one' },
    '生生不息': { name: '生生不息', type: 'heal', mult: 2.2, cd: 3, regen: 0.4, dur: 3, target: 'all' },
    '万象归墟': { name: '万象归墟', type: 'dmg', mult: 3.8, cd: 4, freeze: 0.7, dur: 1, target: 'all' },
    // ---- 主角种族功法技能 ----
    '人·灵气刃': { name: '灵气刃', type: 'dmg', mult: 1.0, cd: 0, target: 'one', dmgType: 'magic' },
    '人·镇魂域': { name: '镇魂领域', type: 'dmg', mult: 1.5, cd: 5, target: 'all', silence: 0.35, dur: 3, dmgType: 'magic' },
    '魔·魔爪': { name: '魔爪', type: 'dmg', mult: 1.0, cd: 0, target: 'one', dmgType: 'physical' },
    '魔·魔吞天地': { name: '魔吞天地', type: 'dmg', mult: 1.75, cd: 5, target: 'all', selfBuff: 'atk', pct: 50, dur: 3, dmgType: 'physical' },
    '龙·龙爪': { name: '龙爪', type: 'dmg', mult: 1.0, cd: 0, target: 'one', dmgType: 'physical' },
    '龙·真龙威': { name: '真龙威', type: 'dmg', mult: 1.8, cd: 5, target: 'all', selfBuff: 'def', pct: 50, dur: 3, selfTaunt: 3, dmgType: 'physical' },
    '精·自然之箭': { name: '自然之箭', type: 'dmg', mult: 1.0, cd: 0, target: 'one', dmgType: 'magic' },
    '精·圣光普照': { name: '圣光普照', type: 'heal', mult: 0.6, cd: 5, target: 'all', clear: true, buffAtk: 5, dur: 3, dmgType: 'magic' },
    // ---- 功法被动 ----
    '被动·静': { name: '静心诀', type: 'passive', pstat: 'spd', amt: 12 }
  };

  // ---------- 主角功法研习 (仙府·功法) 树 ----------
  // 功法层数提升主角攻击/速度；种族专属大招为天生技能
  const GONGFAS = {
    human: ['人·镇魂域'],
    demon: ['魔·魔吞天地'],
    dragon: ['龙·真龙威'],
    elf: ['精·圣光普照']
  };

  // ---------- 装备槽位 ----------
  const SLOTS = [
    { id: 'weapon', name: '武器' },
    { id: 'armor', name: '防具' },
    { id: 'boots', name: '靴子' },
    { id: 'accessory', name: '饰品' },
    { id: 'treasure', name: '灵宝' }
  ];
  const EQUIP_QUALITY = ['白', '绿', '蓝', '紫', '金', '红'];
  // 主属性随槽位变化
  const SLOT_STAT = { weapon: 'atk', armor: 'def', boots: 'spd', accessory: 'hp', treasure: 'atk' };
  // 套装
  const SETS = {
    '青锋': { pieces: 2, bonus: { atk: 6 } },
    '玄甲': { pieces: 2, bonus: { def: 8 } },
    '流云': { pieces: 3, bonus: { spd: 8, hp: 5 } },
    '烈阳': { pieces: 3, bonus: { atk: 10, def: 6 } },
    '太初': { pieces: 5, bonus: { atk: 15, def: 15, hp: 15, spd: 10 } }
  };

  // ---------- 法宝 (水月洞天碎片合成) ----------
  const FABAO = {
    f1: { name: '乾坤镜', frag: 5, passive: { atkPct: 8 }, desc: '乾坤镜，攻击+8%' },
    f2: { name: '紫金葫芦', frag: 8, passive: { hpPct: 12 }, desc: '紫金葫芦，生命+12%' },
    f3: { name: '斩仙飞刀', frag: 10, passive: { atkPct: 12, crit: 5 }, desc: '斩仙飞刀，攻击+12% 暴击+5%' },
    f4: { name: '山河社稷图', frag: 12, passive: { defPct: 15, hpPct: 10 }, desc: '山河社稷图，防御+15% 生命+10%' },
    f5: { name: '造化玉碟', frag: 15, passive: { spd: 15, elementDmg: 10 }, desc: '造化玉碟，速度+15 五行伤害+10%' }
  };

  // ---------- 道具 ----------
  const ITEMS = {
    '招募令': { name: '招募令', desc: '招募伙伴。可单抽/十连。' },
    '渡劫丹': { name: '渡劫丹', desc: '渡劫时每颗提升8%成功率。' },
    '聚元丹': { name: '聚元丹', desc: '立刻获得当前境界一小时修为。' },
    '聚灵丹': { name: '聚灵丹', desc: '立刻获得500灵气。' },
    '回春丹': { name: '回春丹', desc: '立刻恢复全体战力（仙府治疗）。' },
    '强化石': { name: '强化石', desc: '装备强化材料' },
    '精炼石': { name: '精炼石', desc: '装备精炼材料' },
    '附魔石': { name: '附魔石', desc: '装备附魔材料' },
    '五行石': { name: '五行石', desc: '提升五行本源，得克制加成。' },
    '醒神丹': { name: '醒神丹', desc: '回复30体力。' }
  };

  // ---------- 体力 / 副本 ----------
  const STAMINA_MAX = 100;
  const STAMINA_REGEN_MIN = 1; // 每 min 回 1

  // ---------- 五行山 / 日常副本 ----------
  const WUXING_STAGES = 20;
  const DAILY = [
    { id: 'xiuwei', name: '修为秘境' },
    { id: 'tongqian', name: '铜钱洞天' },
    { id: 'equip', name: '装备峡谷' }
  ];

  // 商店商品
  const SHOPS = {
    market: {
      name: '普通集市', currency: 'copper',
      goods: [
        { id: 'd', item: '渡劫丹', price: 500, qty: 1, limit: 0 },
        { id: 'juyuan', item: '聚元丹', price: 200, qty: 1, limit: 0 },
        { id: 'juling', item: '聚灵丹', price: 120, qty: 1, limit: 0 },
        { id: 'qianghua', item: '强化石', price: 100, qty: 5, limit: 0 },
        { id: 'jinglian', item: '精炼石', price: 150, qty: 5, limit: 0 },
        { id: 'fuomo', item: '附魔石', price: 200, qty: 3, limit: 0 },
        { id: 'xingshen', item: '醒神丹', price: 100, qty: 1, limit: 10 }
      ]
    },
    purple: {
      name: '鸿蒙紫气阁', currency: 'ziqi',
      goods: [
        { id: 'zhao', item: '招募令', price: 6, qty: 1, limit: 0 },
        { id: 'jun', item: '金卡伙伴包', price: 30, qty: 1, limit: 3 },
        { id: 'hongdong', item: '红卡伙伴包', price: 100, qty: 1, limit: 1 },
        { id: 'xian', item: '仙品装备箱', price: 50, qty: 1, limit: 5 },
        { id: 'lian', item: '精炼石·百', price: 20, qty: 100, limit: 0 },
        { id: 'qiang', item: '强化石·百', price: 15, qty: 100, limit: 0 }
      ]
    },
    five: {
      name: '五行天坊', currency: 'wuxing',
      goods: [
        { id: 'wxs', item: '五行石', price: 10, qty: 1, limit: 0 },
        { id: 'zhaoling', item: '招募令', price: 20, qty: 1, limit: 0 },
        { id: 'linggen', item: '灵根升级券', price: 15, qty: 1, limit: 0 },
        { id: 'mop', item: '五行装备箱', price: 40, qty: 1, limit: 3 }
      ]
    }
  };

  // 仙府建筑
  const MANOR = {
    zuiyue: { name: '醉月樽', res: '琼浆', desc: '产出琼浆玉液', baseHr: 1 },
    lingmai: { name: '灵脉', res: '琼浆', desc: '主角核心：提升主角品质颜色', baseHr: 0 },
    linggen: { name: '灵根', res: '灵气', desc: '全体攻防血百分比加成', baseHr: 4 },
    fazhen: { name: '法阵', res: '修为', desc: '挂机修为产出提升', baseHr: 5 },
    juling: { name: '聚灵阵', res: '修为', desc: '闲置伙伴按比例加成全队', baseHr: 0 },
    gongfa: { name: '功法', res: '修为', desc: '研习主角主动被动功法', baseHr: 0 },
    qiankun: { name: '造化乾坤殿', res: '灵气', desc: '丹房炼丹 + 器宝炼器', baseHr: 0 }
  };

  CJ.P = {
    ELEMENTS, BEATS, QMAP, ROLES, RACE, REALMS, MAX_REALM,
    ELEM_NAME, PARTNERS, SKILLS, GONGFAS, SLOTS, EQUIP_QUALITY,
    SLOT_STAT, SETS, FABAO, ITEMS, STAMINA_MAX, STAMINA_REGEN_MIN,
    WUXING_STAGES, DAILY, SHOPS, MANOR
  };
})();
