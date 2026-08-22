/* ============================================================
 * 菜鸡修仙传 · 核心引擎 (CORE)
 * 状态管理 / 存档 / 挂机经济 / 回合策略战斗 / 各系统动作
 * 纯逻辑，不依赖 DOM，浏览器与 Node 均可运行。
 * ============================================================ */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const CJ = (G.CJ = G.CJ || {});
  const P = CJ.P;

  const ELEMENTS = P.ELEMENTS;
  const BEATS = P.BEATS;
  const QMAP = P.QMAP;
  const REALMS = P.REALMS;
  const MAX_REALM = P.MAX_REALM;

  const SAVE_KEY = 'caiji_xiuxian_save_v1';
  const OFFLINE_CAP = 12 * 3600; // 离线上限 12 小时

  // ---------- 小工具 ----------
  const rnd = (a) => Math.random() * a;
  const rndInt = (a, b) => Math.floor(rnd(b - a + 1)) + a;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const fmt = (n) => {
    if (n < 1000) return String(Math.floor(n));
    if (n < 1e6) return (n / 1e3).toFixed(1) + 'k';
    if (n < 1e9) return (n / 1e6).toFixed(1) + 'M';
    if (n < 1e12) return (n / 1e9).toFixed(1) + 'B';
    return (n / 1e12).toFixed(2) + 'T';
  };

  // 五行克制
  function elemMult(attEl, defEl) {
    if (!attEl || !defEl || attEl === defEl) return 1;
    if (BEATS[attEl] === defEl) return 1.5;
    if (BEATS[defEl] === attEl) return 0.8;
    return 1;
  }

  // ---------- 状态 ----------
  function freshStats() {
    return { xiuwei: 0, copper: 200, qiongjiang: 0, lingqi: 0, ziqi: 10, wuxing: 0, stamina: 100 };
  }

  function newGame(race) {
    const now = Date.now();
    const realm = { idx: 0, layer: 1, fails: 0, realmMultCache: REALMS[0].mult };
    const state = {
      v: 1,
      race,
      heroName: '',
      heroEl: '金', // 主角五行，可在界面切换
      created: now,
      lastTick: now,
      res: freshStats(),
      realm,
      hero: { level: 1, exp: 0 },
      partners: [],
      formation: [], // instId 列表，顺序=站位(前排在先)
      juling: [],    // 聚灵阵置闲伙伴
      equipment: [], // 装备实例
      equipped: {},  // instId -> unitRefKey('hero' | partnerInstId)
      fabao: [],     // {id, count}
      equippedFabao: [], // id 列表，最多3
      manor: { zuiyue: 1, lingmai: 0, linggen: 1, fazhen: 1, juling: 0, gongfa: 0, qiankun: 1 },
      gongfa: 0,      // 已研习功法层数
      skills: ['basic'], // 主角已掌握技能 id
      mainline: { stage: 1 },
      dungeons: {
        shuiyue: { bestBoss: 0 },
        wuxing: { bestStage: 0 },
        daily: { xiuwei: 3, tongqian: 3, equip: 3, lastReset: now }
      },
      shopLimit: {},
      items: {},
      pity: 0,
      stats: null, // 缓存
      seq: 1
    };
    state.items['招募令'] = 5; // 开局赠送几次招募
    // 赠送一个引导伙伴（根据种族给不同初始伙伴）
    const starter = starterPartner(race);
    addPartner(state, starter, 1);
    addPartner(state, pickBluePartner(), 1);
    addPartner(state, pickBluePartner(), 1);
    state.formation = state.partners.map(p => p.iid);
    recomputeStats(state);
    return state;
  }

  function starterPartner(race) {
    // 种族对应初始伙伴
    const map = { human: 'b05', demon: 'b02', dragon: 'b06', elf: 'b03' };
    return P.PARTNERS.find(p => p.id === map[race]);
  }
  function pickBluePartner() {
    const blues = P.PARTNERS.filter(p => p.q === 2);
    return pick(blues);
  }

  let uid = 1000;
  function newId() { return 'i' + (uid++); }

  function addPartner(state, tpl, level) {
    const iid = newId();
    const ex = state.itemDup || {};
    state.partners.push({
      iid, pid: tpl.id, level: level || 1, stars: 0, equipped: {}
    });
    state.equipmentRef = state.equipmentRef || {};
    return iid;
  }

  // ---------- 存档 ----------
  function save(state) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      }
    } catch (e) { /* 忽略 */ }
  }
  function hasSave() {
    try {
      if (typeof localStorage === 'undefined') return false;
      return !!localStorage.getItem(SAVE_KEY);
    } catch (e) { return false; }
  }
  function load() {
    try {
      if (typeof localStorage === 'undefined') return null;
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function wipe() {
    try { if (typeof localStorage !== 'undefined') localStorage.removeItem(SAVE_KEY); } catch (e) {}
  }
  function exportSave(state) { return btoa(encodeURIComponent(JSON.stringify(state))); }
  function importSave(str) {
    try { return JSON.parse(decodeURIComponent(atob(str))); } catch (e) { return null; }
  }

  // ---------- 数据查询 ----------
  function partnerTpl(id) { return P.PARTNERS.find(p => p.id === id); }
  function partnerQ(p) { return partnerTpl(p.pid); }
  function pMaxLevel(q) { return { 2: 60, 3: 100, 4: 140, 5: 200 }[q]; }
  function skillById(name) { return P.SKILLS[name]; }

  // ---------- 团队战力计算 ----------
  function qualityMult(q) { return { 2: 1.0, 3: 1.7, 4: 2.9, 5: 5.2 }[q]; }
  function lingmaiMult(lv) {
    // 灵脉: 蓝1 -> 紫1.3 -> 金1.7 -> 红2.2
    if (lv >= 15) return 2.2;
    if (lv >= 10) return 1.7;
    if (lv >= 5) return 1.3;
    return 1.0;
  }
  function lingmaiColor(lv) {
    if (lv >= 15) return 'red';
    if (lv >= 10) return 'gold';
    if (lv >= 5) return 'purple';
    return 'blue';
  }

  // 计算一个单位的最终属性（含装备/法宝/仙府/聚灵阵加成）
  function unitStats(state, key) {
    const s = state;
    const realmMult = REALMS[s.realm.idx].mult * (1 + (s.realm.layer - 1) * 0.06);
    const lm = lingmaiMult(s.manor.lingmai);
    const linggenPct = s.manor.linggen * 3; // 每级3%
    const julingPct = julingBonus(s);
    const fabao = fabaoBonus(s);
    const equipBonus = equipTotalBonus(s, key);

    const pctAtk = (linggenPct + julingPct + (fabao.atkPct || 0) + equipBonus.atkPct) / 100;
    const pctDef = (linggenPct + julingPct + (fabao.defPct || 0) + equipBonus.defPct) / 100;
    const pctHp = (linggenPct + julingPct + (fabao.hpPct || 0) + equipBonus.hpPct) / 100;

    let base, extra;
    if (key === 'hero') {
      const h = s.hero;
      const hb = { hp: 220, atk: 52, def: 26, spd: 100 };
      base = { hp: hb.hp, atk: hb.atk, def: hb.def, spd: hb.spd };
      const m = realmMult * lm * (1 + (h.level - 1) * 0.10);
      extra = {
        hp: base.hp * m,
        atk: base.atk * m,
        def: base.def * m,
        spd: base.spd + s.manor.lingmai * 1.5 + equipBonus.spd + (fabao.spd || 0) + (h.level - 1) * 1.2
      };
      // 种族被动
      const race = P.RACE[s.race];
      if (race.passive === 'de') { extra.crit = 0.15; extra.critDmg = 0.25; }
      if (race.passive === 'dr') { extra.hpMult = 0.30; extra.defMult = 0.20; }
      if (race.passive === 'hu') { extra.ctrlAcc = 0.20; extra.silImmune = 1; }
      if (race.passive === 'el') { extra.heal = 0.30; extra.regenPct = 0.02; }
    } else {
      const p = s.partners.find(x => x.iid === key);
      if (!p) return null;
      const tpl = partnerTpl(p.pid);
      const qm = qualityMult(tpl.q);
      const lvF = 0.7 + p.level * 0.09;
      let atk, def, hp, spd;
      atk = tpl.atk * qm * lvF;
      def = tpl.def * qm * lvF;
      hp = tpl.hp * qm * lvF;
      spd = tpl.spd + p.level * 0.9;
      // 进阶 星星
      const starF = 1 + p.stars * 0.12;
      atk *= starF; def *= starF; hp *= starF;
      // 伙伴也按境界成长一部分，保持大境界推进不掉队
      const realmPt = Math.pow(realmMult, 0.72);
      extra = {
        hp: hp * realmPt,
        atk: atk * realmPt,
        def: def * realmPt,
        spd: spd,
        quality: tpl.q,
        role: tpl.role,
        element: tpl.el
      };
    }
    if (key === 'hero') {
      const race = P.RACE[s.race];
      if (race.passive === 'dr') { extra.hp *= 1.30; extra.def *= 1.20; }
      // 功法研习加成：提升攻击/速度
      extra.atk *= (1 + (s.gongfa || 0) * 0.012);
      extra.spd += (s.gongfa || 0) * 1.0;
    }
    extra.hp = Math.max(1, Math.round(extra.hp * (1 + pctHp) + equipBonus.flat.hp));
    extra.atk = Math.max(1, Math.round(extra.atk * (1 + pctAtk) + equipBonus.flat.atk));
    extra.def = Math.max(0, Math.round(extra.def * (1 + pctDef) + equipBonus.flat.def));
    extra.spd = Math.max(1, Math.round(extra.spd));
    extra.crit = (extra.crit || 0) + (equipBonus.crit || 0) + (fabao.crit || 0);
    extra.elementDmg = (fabao.elementDmg || 0) + equipBonus.elementDmg;
    extra.critDmg = extra.critDmg || 0;
    extra.heal = extra.heal || 0;
    return extra;
  }

  function equipBonusOf(state, inst) {
    // 单件装备属性
    const q = QMAP[inst.quality];
    const slot = inst.slot;
    let stat = P.SLOT_STAT[slot];
    const base = inst.baseValue; // 存储基础值
    const enh = inst.enh || 0;
    const ref = inst.ref || 0;
    const fumo = inst.fumo || 0;
    let flat = { hp: 0, atk: 0, def: 0, spd: 0 };
    let pct = { atkPct: 0, defPct: 0, hpPct: 0 };
    const qMult = [1, 1.4, 2.0, 3.0, 4.5, 7][q] || 1;
    const val = base * qMult * (1 + enh * 0.06 + ref * 0.09);
    flat[stat] = Math.round(val);
    // 附魔给随机百分比
    pct[stat === 'atk' ? 'atkPct' : stat === 'def' ? 'defPct' : stat === 'hp' ? 'hpPct' : ''] = fumo * 1.2;
    return { flat, pct, crit: ref >= 3 ? (ref - 2) * 0.5 : 0, elementDmg: ref >= 5 ? 3 : 0 };
  }

  function equipTotalBonus(state, key) {
    const flat = { hp: 0, atk: 0, def: 0, spd: 0 };
    const bonus = { atkPct: 0, defPct: 0, hpPct: 0, crit: 0, spd: 0, elementDmg: 0 };
    const list = [];
    state.equipment.forEach(e => {
      if ((state.equipped[e.iid] || '') === key) list.push(e);
    });
    list.forEach(e => {
      const b = equipBonusOf(state, e);
      flat.hp += b.flat.hp; flat.atk += b.flat.atk; flat.def += b.flat.def;
      bonus.atkPct += b.pct.atkPct; bonus.defPct += b.pct.defPct; bonus.hpPct += b.pct.hpPct;
      bonus.spd += (e.slot === 'boots' ? Math.round(flat.spd) : 0);
      bonus.crit += b.crit; bonus.elementDmg += b.elementDmg;
    });
    // 套装
    const setCount = {};
    list.forEach(e => { if (e.set) setCount[e.set] = (setCount[e.set] || 0) + 1; });
    Object.keys(setCount).forEach(sname => {
      const st = P.SETS[sname];
      if (st && setCount[sname] >= st.pieces) {
        if (st.bonus.atk) bonus.atkPct += st.bonus.atk;
        if (st.bonus.def) bonus.defPct += st.bonus.def;
        if (st.bonus.hp) bonus.hpPct += st.bonus.hp;
        if (st.bonus.spd) bonus.spd += st.bonus.spd;
      }
    });
    bonus.flat = flat;
    return bonus;
  }

  function fabaoBonus(state) {
    const out = { atkPct: 0, defPct: 0, hpPct: 0, spd: 0, crit: 0, elementDmg: 0 };
    (state.equippedFabao || []).forEach(id => {
      const f = P.FABAO[id];
      if (!f) return;
      ['atkPct', 'defPct', 'hpPct', 'spd', 'crit', 'elementDmg'].forEach(k => {
        if (f.passive[k]) out[k] += f.passive[k];
      });
    });
    return out;
  }

  function julingBonus(state) {
    // 聚灵阵: 把闲置伙伴(quality, level)换算为全队百分比
    let val = 0;
    state.juling.forEach(iid => {
      const p = state.partners.find(x => x.iid === iid);
      if (!p) return;
      const tpl = partnerTpl(p.pid);
      val += tpl.q * 2 + p.level * 0.05 + p.stars * 2;
    });
    return Math.min(50, val * 0.5);
  }

  function recomputeStats(state) {
    // 主角天生掌握：种族普通技能 + 种族专属大招
    const rc = P.RACE[state.race] || {};
    const nid = rc.nid || 'basic';
    const uid = (P.GONGFAS[state.race] || [])[0] || rc.uid;
    state.skills = [nid, uid].filter(Boolean);
    state.stats = unitStats(state, 'hero');
    return state;
  }

  // ---------- 经济速率 ----------
  function rates(state) {
    const realmMult = REALMS[state.realm.idx].mult;
    const fazhen = state.manor.fazhen;
    const heroLv = state.hero.level;
    const gongfa = state.gongfa;
    const stage = state.mainline.stage;
    // 修为/秒：随法阵、境界、关卡、主角等级
    const xiuwei = Math.round(
      realmMult * (1 + fazhen * 0.25) * (1 + stage * 0.03) * (1 + heroLv * 0.05) * (1 + gongfa * 0.1) * 0.9
    );
    const copper = Math.round(
      3 + realmMult * 0.4 + stage * 0.5
    );
    const zuiyue = state.manor.zuiyue;
    const qiongjiang = (0.2 + zuiyue * 0.22); // /秒 较慢
    const linggen = state.manor.linggen;
    const lingqi = (1 + linggen * 1.2) / 60; // /秒
    return { xiuwei, copper, qiongjiang, lingqi };
  }

  function formatDuration(sec) {
    sec = Math.max(0, Math.floor(sec));
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (d > 0) return d + '天' + h + '时';
    if (h > 0) return h + '时' + m + '分';
    if (m > 0) return m + '分' + s + '秒';
    return s + '秒';
  }

  // 在线挂机 tick
  function tick(state, now) {
    const elapsed = clamp((now - state.lastTick) / 1000, 0, 3600); // 在线最多按1小时结算，离线单独算
    applyGain(state, elapsed);
    state.lastTick = now;
    // 体力回复
    state.res.stamina = clamp(state.res.stamina + elapsed / 60 * P.STAMINA_REGEN_MIN, 0, P.STAMINA_MAX);
    recomputeStats(state);
    return state;
  }

  function applyGain(state, seconds) {
    const r = rates(state);
    state.res.xiuwei += r.xiuwei * seconds;
    state.res.copper += r.copper * seconds;
    state.res.qiongjiang += r.qiongjiang * seconds;
    state.res.lingqi += r.lingqi * seconds;
    // 少量装备掉落积累为装备材料（掉落箱）
    // （装备掉落与主线相关，在主线结算时给）
  }

  // 离线收益
  function offlineGains(state, seconds) {
    seconds = Math.min(seconds, OFFLINE_CAP);
    const r = rates(state);
    return {
      seconds,
      xiuwei: r.xiuwei * seconds,
      copper: r.copper * seconds,
      qiongjiang: r.qiongjiang * seconds,
      lingqi: r.lingqi * seconds
    };
  }

  // ---------- 装备生成 ----------
  function qualityForStage(stage) {
    const r = Math.random();
    if (stage >= 400) return r < 0.03 ? 5 : r < 0.15 ? 4 : r < 0.4 ? 3 : 2;
    if (stage >= 200) return r < 0.02 ? 5 : r < 0.1 ? 4 : r < 0.4 ? 3 : r < 0.7 ? 2 : 1;
    if (stage >= 100) return r < 0.05 ? 4 : r < 0.25 ? 3 : r < 0.6 ? 2 : 1;
    if (stage >= 50) return r < 0.1 ? 3 : r < 0.4 ? 2 : 1;
    if (stage >= 20) return r < 0.2 ? 2 : r < 0.5 ? 1 : 0;
    return r < 0.3 ? 1 : 0;
  }

  function genEquip(state, q, set) {
    q = q == null ? qualityForStage(state.mainline.stage) : q;
    const slot = pick(P.SLOTS);
    const baseVal = (state.mainline.stage * 1.8 + 10) * (1 + q * 0.3);
    const setNames = Object.keys(P.SETS);
    const sameSet = set || (Math.random() < 0.35 ? pick(setNames) : null);
    return {
      iid: newId(), slot: slot.id, quality: P.EQUIP_QUALITY[q], baseValue: baseVal,
      enh: 0, ref: 0, fumo: 0, set: sameSet, level: 1
    };
  }

  function decomposeEquip(state, iid) {
    const idx = state.equipment.findIndex(e => e.iid === iid);
    if (idx < 0) return null;
    const e = state.equipment[idx];
    if (state.equipped[iid]) return null; // 需先卸下
    state.equipment.splice(idx, 1);
    const q = QMAP[e.quality];
    state.res.copper += 50 * (q + 1);
    addItem(state, '强化石', 2 + q);
    addItem(state, '精炼石', q >= 2 ? q : 0);
    return e;
  }

  function addItem(state, name, n) { state.items[name] = (state.items[name] || 0) + (n || 1); }
  function takeItem(state, name, n) {
    if ((state.items[name] || 0) < n) return false;
    state.items[name] -= n;
    return true;
  }

  function enhanceEquip(state, iid) {
    const e = state.equipment.find(x => x.iid === iid);
    if (!e) return { ok: false, msg: '装备不存在' };
    const maxEnh = 20 + QMAP[e.quality] * 10;
    if (e.enh >= maxEnh) return { ok: false, msg: '已满级' };
    if (!takeItem(state, '强化石', 1)) return { ok: false, msg: '强化石不足' };
    e.enh++;
    return { ok: true, msg: '强化成功' };
  }
  function refineEquip(state, iid) {
    const e = state.equipment.find(x => x.iid === iid);
    if (!e) return { ok: false, msg: '装备不存在' };
    if (e.ref >= 9) return { ok: false, msg: '已满级' };
    if (!takeItem(state, '精炼石', 1)) return { ok: false, msg: '精炼石不足' };
    e.ref++;
    return { ok: true, msg: '精炼成功' };
  }
  function fumoEquip(state, iid) {
    const e = state.equipment.find(x => x.iid === iid);
    if (!e) return { ok: false, msg: '装备不存在' };
    if (e.fumo >= 10) return { ok: false, msg: '已满级' };
    if (!takeItem(state, '附魔石', 1)) return { ok: false, msg: '附魔石不足' };
    e.fumo++;
    return { ok: true, msg: '附魔成功' };
  }
  function equipTo(state, iid, key) {
    const e = state.equipment.find(x => x.iid === iid);
    if (!e) return { ok: false, msg: '装备不存在' };
    // 同一槽位替换：该 unit 旧装备卸下
    Object.keys(state.equipped).forEach(k => {
      if (k === iid) return;
      const ee = state.equipment.find(x => x.iid === k);
      if ((state.equipped[k] === key) && ee && ee.slot === e.slot) delete state.equipped[k];
    });
    state.equipped[iid] = key;
    return { ok: true, msg: '已装备' };
  }
  function unequip(state, iid) {
    if (state.equipped[iid]) { delete state.equipped[iid]; return true; }
    return false;
  }

  // ---------- 伙伴招募 ----------
  function summonOne(state, cost, minQ) {
    // 品质权重
    const w = [0, 0, 0.55, 0.30, 0.13, 0.02];
    const r = Math.random();
    let q = 5, acc = 0;
    for (let qi = 5; qi >= 2; qi--) {
      acc += w[qi];
      if (qi >= 2 && r <= acc) { if (qi >= 2) q = qi; break; }
    }
    if (minQ && q < minQ) q = minQ;
    // 保底：第10次必金
    state.pity = (state.pity || 0) + 1;
    if (state.pity >= 10) { q = Math.max(q, 4); state.pity = 0; }
    const pool = P.PARTNERS.filter(p => p.q === q);
    const tpl = pick(pool.length ? pool : P.PARTNERS.filter(p => p.q === 2));
    const existing = state.partners.find(p => p.pid === tpl.id);
    let label;
    if (existing) {
      existing.stars += 1; label = '重复伙伴→' + tpl.name + ' 进阶+1★';
    } else {
      addPartner(state, tpl, 1);
      label = '招募到 ' + tpl.name + '（' + colorName(q) + '·' + P.ROLES[tpl.role] + '·' + tpl.el + '）';
    }
    recomputeStats(state);
    return { q, tpl, label, pity: state.pity };
  }

  function colorName(q) { return ['', '', '蓝', '紫', '金', '红'][q]; }

  function summon(state, cost, times) {
    const results = [];
    for (let i = 0; i < times; i++) results.push(summonOne(state));
    return results;
  }

  function upgradePartner(state, iid) {
    const p = state.partners.find(x => x.iid === iid);
    if (!p) return { ok: false, msg: '伙伴不存在' };
    const tpl = partnerTpl(p.pid);
    const maxLv = pMaxLevel(tpl.q);
    if (p.level >= maxLv) return { ok: false, msg: '已满级' };
    const cost = levelCost(p.level);
    if (state.res.xiuwei < cost) return { ok: false, msg: '修为不足' };
    state.res.xiuwei -= cost;
    p.level++;
    recomputeStats(state);
    return { ok: true, msg: p.level + ' 级' };
  }
  function levelCost(level) { return Math.round(20 + Math.pow(level, 1.9) * 2); }

  function setFormation(state, ids) {
    // ids 为 instId，前=前排
    state.formation = ids.slice(0, 5);
    // 从聚灵阵移除 & 反向
    state.formation.forEach(id => { if (state.juling.includes(id)) state.juling = state.juling.filter(x => x !== id); });
    recomputeStats(state);
  }
  function setJuling(state, ids) {
    state.juling = ids.slice(0, 12);
    state.juling.forEach(id => { if (state.formation.includes(id)) state.formation = state.formation.filter(x => x !== id); });
    recomputeStats(state);
  }
  function formationUnits(state) {
    const hero = { iid: 'hero', isHero: true };
    return [hero].concat(state.formation.slice(0, 5).map(id => state.partners.find(p => p.iid === id)).filter(Boolean));
  }

  // ---------- 法宝 ----------
  function craftFabao(state, id) {
    const f = P.FABAO[id];
    if (!f) return { ok:false, msg:'法宝不存在' };
    const have = (state.items['法宝碎片·' + f.name] || 0);
    if (have < f.frag) return { ok:false, msg:'碎片不足（' + have + '/' + f.frag + '）' };
    takeItem(state, '法宝碎片·' + f.name, f.frag);
    const ex = state.fabao.find(x => x.id === id);
    if (ex) ex.count++; else state.fabao.push({ id, count: 1 });
    return { ok:true, msg: '合成成功：' + f.name };
  }
  function equipFabao(state, id) {
    const f = P.FABAO[id];
    const owned = state.fabao.find(x => x.id === id);
    if (!owned || owned.count < 1) return { ok:false, msg:'未拥有' };
    if (state.equippedFabao.includes(id)) return { ok:false, msg:'已装备' };
    if (state.equippedFabao.length >= 3) return { ok:false, msg:'法宝位已满(3)' };
    state.equippedFabao.push(id);
    recomputeStats(state);
    return { ok:true, msg:'已装备' };
  }

  // ---------- 仙府 ----------
  function manorCost(building, lv) {
    switch (building) {
      case 'zuiyue': return { copper: Math.round(120 * Math.pow(2, lv)), qiongjiang: 0, lingqi: 0 };
      case 'lingmai': return { copper: 0, qiongjiang: Math.round(20 * Math.pow(2.1, lv)), lingqi: 0 };
      case 'linggen': return { copper: 0, qiongjiang: 0, lingqi: Math.round(30 * Math.pow(2, lv)) };
      case 'fazhen': return { copper: Math.round(80 * Math.pow(1.8, lv)), qiongjiang: 0, lingqi: Math.round(10 * lv) };
      case 'juling': return { copper: Math.round(200 * Math.pow(2, lv)), lingqi: Math.round(20 * lv) };
      case 'gongfa': return { xiuwei: Math.round(500 * Math.pow(2.2, lv)), lingqi: Math.round(15 * lv) };
      case 'qiankun': return { copper: Math.round(150 * Math.pow(1.9, lv)), lingqi: Math.round(25 * lv) };
    }
  }
  function hasCost(state, cost) {
    if (!cost) return true;
    if (cost.copper && state.res.copper < cost.copper) return false;
    if (cost.qiongjiang && state.res.qiongjiang < cost.qiongjiang) return false;
    if (cost.lingqi && state.res.lingqi < cost.lingqi) return false;
    if (cost.xiuwei && state.res.xiuwei < cost.xiuwei) return false;
    return true;
  }
  function payCost(state, cost) {
    if (!hasCost(state, cost)) return false;
    if (cost.copper) state.res.copper -= cost.copper;
    if (cost.qiongjiang) state.res.qiongjiang -= cost.qiongjiang;
    if (cost.lingqi) state.res.lingqi -= cost.lingqi;
    if (cost.xiuwei) state.res.xiuwei -= cost.xiuwei;
    return true;
  }
  function upgradeManor(state, building) {
    const lv = state.manor[building];
    if (building === 'gongfa' && lv >= P.GONGFAS[state.race].length) return { ok:false, msg:'功法已研习完毕' };
    const cost = manorCost(building, lv);
    if (!payCost(state, cost)) return { ok:false, msg:'资源不足' };
    state.manor[building]++;
    recomputeStats(state);
    return { ok:true, msg:'升级成功' };
  }

  // ---------- 炼丹 (造化乾坤殿 - 丹房) ----------
  function alchemy(state, recipe) {
    const lv = state.manor.qiankun;
    const recipes = {
      '渡劫丹': { req: { lingqi: 80 }, qiankun: 1 },
      '聚元丹': { req: { lingqi: 30 }, qiankun: 1 },
      '聚灵丹': { req: { lingqi: 20 }, qiankun: 1 },
      '回春丹': { req: { lingqi: 15 }, qiankun: 1 }
    };
    const r = recipes[recipe];
    if (!r) return { ok:false, msg:'无此丹方' };
    if (lv < r.qiankun) return { ok:false, msg:'乾坤殿等级不足' };
    if (!payCost(state, r.req)) return { ok:false, msg:'材料不足' };
    addItem(state, recipe, 1);
    return { ok:true, msg:'炼成 ' + recipe };
  }
  // 器宝（炼器）
  function forgeEquip(state) {
    const lv = state.manor.qiankun;
    const cost = { lingqi: 40 + lv * 15 };
    const q = lv >= 12 ? 4 : lv >= 8 ? 3 : lv >= 4 ? 2 : 1;
    if (state.res.lingqi < cost.lingqi) return { ok:false, msg:'灵气不足' };
    state.res.lingqi -= cost.lingqi;
    const e = genEquip(state, q);
    state.equipment.push(e);
    return { ok:true, msg:'锻造出 ' + e.quality + '·' + slotName(e.slot) + '（' + q + '阶）', equip: e };
  }
  function slotName(id) { const s = P.SLOTS.find(x => x.id === id); return s ? s.name : id; }

  // ---------- 渡劫 ----------
  function layerCost(state) {
    const idx = state.realm.idx, layer = state.realm.layer;
    const mult = REALMS[idx].mult;
    return Math.round(150 * Math.pow(mult, 1.3) * Math.pow(layer, 1.6));
  }
  function breakthroughLayer(state) {
    if (state.realm.layer >= 9) return { ok: false, msg: '已圆满，请渡劫' };
    const cost = layerCost(state);
    if (state.res.xiuwei < cost) return { ok: false, msg: '修为不足（需 ' + fmt(cost) + '）' };
    state.res.xiuwei -= cost;
    state.realm.layer++;
    // 突破小层给少量属性奖励（等效主角等级小升）
    recomputeStats(state);
    return { ok: true, msg: '突破 ' + REALMS[state.realm.idx].name + '·' + layerName(state.realm.layer) + ' 层成功！' };
  }
  function layerName(layer) {
    const layers = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
    return layers[layer - 1];
  }
  function realmLabel(state) {
    const r = REALMS[state.realm.idx];
    return r.name + '·' + layerName(state.realm.layer) + '层';
  }
  function tribulationInfo(state) {
    if (state.realm.layer < 9) return { maxed: false };
    const baseChance = 0.55;
    const pills = state.items['渡劫丹'] || 0;
    const chance = clamp(baseChance + Math.min(pills, 6) * 0.08, 0, 0.99);
    return { maxed: true, chance, pills };
  }
  function tribulate(state, usePill) {
    const info = tribulationInfo(state);
    if (!info.maxed) return { ok:false, msg:'当前境界未圆满，无需渡劫' };
    if (usePill && info.pills > 0) { takeItem(state, '渡劫丹', 1); }
    const chance = info.chance + (usePill && info.pills > 0 ? 0 : 0);
    const success = Math.random() < info.chance;
    if (success) {
      if (state.realm.idx >= MAX_REALM) {
        state.realm.idx = MAX_REALM; state.realm.layer = 9;
        return { ok:true, msg:'已证道成仙（大圆满）', ascended:true };
      }
      state.realm.idx++;
      state.realm.layer = 1;
      state.realm.fails = 0;
      // 突破奖励修为
      const gift = rates(state).xiuwei * 60 * (state.realm.idx + 1);
      state.res.xiuwei += gift;
      recomputeStats(state);
      return { ok:true, msg:'渡劫成功！突破至' + REALMS[state.realm.idx].name + '！', gift };
    } else {
      state.realm.fails++;
      const lost = state.res.xiuwei * 0.10;
      state.res.xiuwei -= lost;
      return { ok:false, msg:'渡劫失败…损失10%修为（' + fmt(lost) + '）。可备渡劫丹提升成功率。', lost };
    }
  }

  // ---------- 商店 ----------
  function buyShop(state, shopId, goodId) {
    const shop = P.SHOPS[shopId];
    const good = shop.goods.find(g => g.id === goodId);
    if (!good) return { ok:false, msg:'商品不存在' };
    const cur = shop.currency;
    if (state.res[cur] < good.price) return { ok:false, msg:'货币不足' };
    if (good.limit) {
      const k = shopId + '/' + goodId;
      const used = state.shopLimit[k] || 0;
      if (used >= good.limit) return { ok:false, msg:'已达限购' };
      state.shopLimit[k] = used + 1;
    }
    state.res[cur] -= good.price;
    grantShopGood(state, good);
    return { ok:true, msg:'购买成功：' + good.item };
  }
  function grantShopGood(state, good) {
    const item = good.item;
    if (item === '金卡伙伴包') { summonOne(state, null, 4); return; }
    if (item === '红卡伙伴包') { summonOne(state, null, 5); return; }
    if (item === '仙品装备箱' || item === '五行装备箱') { const e = genEquip(state, item === '仙品装备箱' ? 3 : 3); state.equipment.push(e); return; }
    addItem(state, item, good.qty || 1);
  }

  // ---------- 战斗引擎 ----------
  // 构建我方战斗单元
  function buildPlayerUnit(state, iid) {
    const st = unitStats(state, iid);
    if (!st) return null;
    if (iid === 'hero') {
      return {
        name: (state.heroName || '主角') + '（' + P.RACE[state.race].name + '）',
        element: state.heroEl, role: 'atk', team: 'ally',
        maxHp: st.hp, hp: st.hp, atk: st.atk, def: st.def, spd: st.spd,
        crit: st.crit, critDmg: st.critDmg || 0, heal: st.heal || 0,
        regenPct: st.regenPct || 0,
        elementDmg: st.elementDmg || 0, ctrlAcc: st.ctrlAcc || 0, silImmune: !!st.silImmune,
        race: state.race,
        skills: state.skills.map(id => skillById(id)).filter(Boolean),
        place: state.formation ? 'front' : 'front'
      };
    }
    const p = state.partners.find(x => x.iid === iid);
    const tpl = partnerTpl(p.pid);
    return {
      name: tpl.name, element: tpl.el, role: tpl.role, team: 'ally', q: tpl.q,
      maxHp: st.hp, hp: st.hp, atk: st.atk, def: st.def, spd: st.spd,
      crit: st.crit, critDmg: st.critDmg || 0, heal: st.heal || 0,
      elementDmg: st.elementDmg || 0, ctrlAcc: st.ctrlAcc || 0, silImmune: false,
      skills: partnerSkills(tpl)
    };
  }
  function partnerSkills(tpl) {
    const arr = [];
    tpl.skills.forEach(sid => {
      const sk = skillById(sid);
      if (sk) arr.push(sk);
    });
    return arr;
  }

  function buildEnemyUnit(e) {
    return {
      name: e.name, element: e.el, role: e.role || 'atk', team: 'enemy', boss: !!e.boss,
      maxHp: e.hp, hp: e.hp, atk: e.atk, def: e.def, spd: e.spd,
      crit: e.crit || 0.05, critDmg: e.critDmg || 0, heal: 0, elementDmg: 0,
      ctrlAcc: 0, silImmune: !!e.silImmune,
      skills: e.skills || [skillById('basic')]
    };
  }

  function makeEnemies(stage) {
    const s = stage;
    const targetPower = 760 * Math.pow(1.035, s - 1);
    const count = Math.min(5, 3 + Math.floor(s / 15));
    const boss = s % 10 === 0;
    const arr = [];
    for (let i = 0; i < count; i++) {
      let share = targetPower / count;
      if (boss && i === 0) share *= 1.8;
      const el = ELEMENTS[(i + s) % 5];
      arr.push(buildEnemyUnit({
        name: ['蛮兽', '山精', '魔修', '邪祟', '鬼将', '妖王', '心魔', '冥卫'][(i + s) % 8] + (boss && i === 0 ? '·首领' : ''),
        el, boss: boss && i === 0, role: i % 3 === 0 ? 'tank' : 'atk',
        hp: Math.round(share * 0.42),
        atk: Math.round(share * 0.10),
        def: Math.round(share * 0.06),
        spd: 90 + Math.min(130, s * 1.2) + i * 6,
        crit: 0.05 + s * 0.002, critDmg: 0,
        silImmune: (boss && i === 0) ? Math.random() < 0.45 : false,
        skills: [
          { name: '妖风', type: 'dmg', mult: 1.6, cd: 2, target: 'one' },
          { name: '重击', type: 'dmg', mult: 2.0, cd: 3, target: 'one' }
        ]
      }));
    }
    return arr;
  }

  // 按“战力预算”生成敌人组（用于副本，始终与当前战力相关）
  function enemyGroupByPower(targetPower, opts) {
    opts = opts || {};
    const count = opts.count || (opts.boss ? 1 : 3);
    const arr = [];
    for (let i = 0; i < count; i++) {
      let share = targetPower / count;
      if (opts.boss && i === 0) share *= 1.6;
      arr.push(buildEnemyUnit({
        name: opts.boss && i === 0 ? (opts.name || '秘境魔尊') : (opts.minion || '守护精怪') + (i + 1),
        el: opts.el || ELEMENTS[i % 5],
        boss: opts.boss && i === 0,
        role: i % 3 === 0 ? 'tank' : 'atk',
        hp: Math.round(share * 0.42),
        atk: Math.round(share * 0.10),
        def: Math.round(share * 0.07),
        spd: (opts.spd || 100) + i * 8,
        crit: 0.08, critDmg: 0,
        silImmune: (opts.boss && i === 0) ? Math.random() < 0.5 : false,
        skills: opts.skills || [
          { name: '重击', type: 'dmg', mult: 2.0, cd: 2, target: 'one' },
          { name: '妖风', type: 'dmg', mult: 1.6, cd: 3, target: 'one' }
        ]
      }));
    }
    return arr;
  }

  // 核心回合战斗；cb(entry) 每步回调（用于日志），maxRounds 防御
  function simulateBattle(playerUnits, enemyUnits, cb, opts) {
    opts = opts || {};
    const log = [];
    const push = (msg, cls) => { if (cb) cb({ msg, cls }); log.push({ msg, cls }); };
    const events = [];
    // 记录站位序号（供前端动画定位）
    playerUnits.forEach((u, i) => u.sideIdx = i);
    enemyUnits.forEach((u, i) => u.sideIdx = i);
    let round = 0, winner = null;
    const all = playerUnits.concat(enemyUnits);
    // 每回合重置状态计时
    all.forEach(u => { u.cds = u.skills.map(() => 0); u.status = { stun: 0, freeze: 0, silence: 0, burn: 0, poison: 0, regen: 0, taunt: 0, atkBuff: 0, defBuff: 0, hpBuff: 0 }; });
    const alive = (side) => all.filter(u => u.team === side && u.hp > 0);

    const order = [...all].sort((a, b) => b.spd - a.spd || Math.random() - 0.5);
    // 银弹：给单位起手一个能量用 cd 控制：cd>0 代表技能冷却
    function pickSkill(u) {
      let best = null;
      u.skills.forEach((sk, idx) => {
        if (sk && u.cds[idx] <= 0) {
          if (!best || (sk.cd || 0) > (best.sk.cd || 0)) best = { sk, idx };
        }
      });
      return best;
    }
    // 嘲讽：敌方单体攻击会优先打我方嘲讽者
    function pickFoe(u, foes) {
      if (u.team === 'enemy') {
        const taunters = foes.filter(x => x.status.taunt > 0);
        if (taunters.length) return [taunters[Math.floor(Math.random() * taunters.length)]];
      }
      return [foes[Math.floor(Math.random() * foes.length)]];
    }
    function targetOf(u, sk) {
      const foes = alive(u.team === 'ally' ? 'enemy' : 'ally');
      const friends = alive(u.team);
      if (!foes.length) return null;
      if (sk.target === 'all') return foes;
      if (sk.target === 'two') {
        const first = pickFoe(u, foes);
        const rest = foes.filter(f => f !== first[0]);
        return rest.length ? [first[0], rest[Math.floor(Math.random() * rest.length)]] : first;
      }
      if (sk.target === 'allylow') { return [ [...friends].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] ]; }
      if (sk.target === 'allall') return all.filter(x => x.team === u.team);
      if (sk.target === 'self') return [u];
      return pickFoe(u, foes);
    }

    function dealDamage(att, def, mult) {
      let base = att.atk * (mult || 1);
      let dmg = base * (100 / (100 + Math.max(0, def.def)));
      const em = elemMult(att.element, def.element);
      dmg *= em;
      if (em > 1) dmg *= 1 + (att.elementDmg || 0) / 100;
      // 暴击
      const crit = Math.random() < (att.crit || 0.05);
      if (crit) dmg *= (1.5 + (att.critDmg || 0));
      // 冻结增伤
      if (def.status.freeze > 0) dmg *= 1.3;
      // buff
      if (att.status.atkBuff > 0) dmg *= 1 + att.status.atkBuff / 100;
      if (def.status.defBuff > 0) dmg *= 1 - def.status.defBuff / 300;
      dmg = Math.max(1, Math.round(dmg));
      def.hp = Math.max(0, def.hp - dmg);
      return { dmg, crit, em };
    }

    function applyStatus(def, eff, chance, dur, isHeroDmg) {
      if (!eff || !chance) return false;
      let c = chance;
      if (def.silImmune && eff === 'silence') c = 0;
      // 目标免控系数：boss 略抗控
      if (def.boss) c *= 0.6;
      if (Math.random() < c) {
        def.status[eff] = Math.max(def.status[eff] || 0, dur);
        return true;
      }
      return false;
    }

    for (round = 1; round <= (opts.maxRounds || 30); round++) {
      push('—— 第 ' + round + ' 回合 ——', 'bl-turn');
      events.push({ type: 'round', n: round });
      for (const u of order) {
        if (u.hp <= 0) continue;
        // 控制判定
        if (u.status.stun > 0) {
          push(u.name + ' 被眩晕，无法行动！', 'ctrl'); u.status.stun--; continue;
        }
        if (u.status.freeze > 0) {
          const tmp = u.status.freeze; u.status.freeze = 0;
          const r = dealDamage(u, u, 1.1);
          push(u.name + ' 被冻结，冰封侵蚀，损失 ' + r.dmg + ' 生命！', 'freeze');
          u.status.freeze = tmp - 1;
          continue;
        }
        // 行动
          let acted = false;
        let sel = pickSkill(u);
        // 沉默只能用普攻
        if (u.status.silence > 0) sel = null;
        if (sel) {
          const sk = sel.sk;
          u.cds[sel.idx] = (sk.cd || 0) + 1;
          const targets = targetOf(u, sk);
          if (sk.type === 'dmg') {
            if (targets && targets.length) {
              const total = targets.map(t => dealDamage(u, t, sk.mult));
              const dT = sk.dmgType === 'physical' ? '物理' : sk.dmgType === 'magic' ? '法术' : '';
              const pr = (sk.chance != null) ? sk.chance : (sk.stun || sk.freeze || sk.silence);
              targets.forEach((t, i) => {
                if (sk.stun) applyStatus(t, 'stun', sk.stun, sk.dur || 1);
                if (sk.freeze) applyStatus(t, 'freeze', sk.freeze, sk.dur || 1);
                if (sk.silence) applyStatus(t, 'silence', sk.silence, sk.dur || 1);
                if (sk.burn) { t.status.burn = Math.max(t.status.burn, sk.dur || 2); }
                if (total[i].crit) push(u.name + ' 施展『' + sk.name + '』' + (dT ? '（' + dT + '）' : '') + '暴击 ' + t.name + '，造成 ' + total[i].dmg + ' 伤害！', 'crit');
                else push(u.name + ' 施展『' + sk.name + '』' + (dT ? '（' + dT + '）' : '') + '攻击 ' + t.name + '，造成 ' + total[i].dmg + ' 伤害' + (total[i].em > 1 ? '（五行克制）' : '') + '！', 'dmg');
              });
              events.push({ type: 'dmg', team: u.team, idx: u.sideIdx, sk: sk.name, targets: targets.map((t, i) => ({ team: t.team, idx: t.sideIdx, dmg: total[i].dmg, crit: total[i].crit })) });
              if (sk.selfBuff) { const selfKey = sk.selfBuff === 'def' ? 'defBuff' : sk.selfBuff === 'atk' ? 'atkBuff' : 'hpBuff'; u.status[selfKey] = Math.max(u.status[selfKey] || 0, sk.pct || 0); push(u.name + ' 施展『' + sk.name + '』后自身' + (sk.selfBuff === 'atk' ? '攻击' : '防御') + '提升' + (sk.pct || 0) + '%！', 'buff'); }
              if (sk.selfTaunt) { u.status.taunt = Math.max(u.status.taunt || 0, sk.selfTaunt); push(u.name + ' 施展『' + sk.name + '』，嘲讽敌人攻击自己！', 'buff'); }
              if (sk.lifesteal && targets.length) {
                const gained = Math.round(total.reduce((a, b) => a + b.dmg, 0) * sk.lifesteal);
                u.hp = Math.min(u.maxHp, u.hp + gained);
                push(u.name + ' 汲取生命 +' + gained, 'heal');
              }
            }
            acted = true;
          } else if (sk.type === 'heal') {
            const healTargets = (sk.target === 'all' || sk.target === 'allall')
              ? all.filter(x => x.team === u.team && x.hp > 0)
              : [ [...alive(u.team)].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] ];
            let amt = 0;
            const amounts = [];
            healTargets.forEach(t => {
              let v = u.atk * sk.mult * (1 + (u.heal || 0) / 100);
              if (sk.regen) t.status.regen = Math.max(t.status.regen || 0, (sk.regen || 0));
              t.hp = Math.min(t.maxHp, t.hp + v);
              amt += v;
              amounts.push({ team: t.team, idx: t.sideIdx, amount: Math.round(v) });
            });
            events.push({ type: 'heal', team: u.team, idx: u.sideIdx, sk: sk.name, targets: amounts });
            if (sk.clear) healTargets.forEach(t => { t.status.stun = 0; t.status.freeze = 0; t.status.silence = 0; t.status.burn = 0; });
            if (sk.buffAtk) healTargets.forEach(t => { t.status.atkBuff = Math.max(t.status.atkBuff || 0, sk.buffAtk); });
            if (sk.revive) all.filter(x => x.team === u.team && x.hp <= 0).forEach(t => { t.hp = Math.round(t.maxHp * sk.revive); push(t.name + ' 被复活！', 'heal'); });
            push(u.name + ' 施展『' + sk.name + '』治疗，恢复全体 ' + Math.round(amt) + ' 生命！', 'heal');
            if (sk.buffAtk) push(u.name + ' 施展『' + sk.name + '』，提升全体 ' + sk.buffAtk + '% 攻击并驱散减益！', 'buff');
            acted = true;
          } else if (sk.type === 'buff') {
            const buffed = (sk.target === 'all' || sk.target === 'allall') ? all.filter(x => x.team === u.team && x.hp > 0) : [u];
            let bufKey = sk.buff === 'def' ? 'defBuff' : sk.buff === 'atk' ? 'atkBuff' : 'hpBuff';
            buffed.forEach(t => { t.status[bufKey] = Math.max(t.status[bufKey] || 0, sk.pct || 0); });
            push(u.name + ' 施展『' + sk.name + '』，' + (sk.buff === 'def' ? '提升防御' : sk.buff === 'atk' ? '提升攻击' : '提升生命') + '！', 'buff');
            events.push({ type: 'buff', team: u.team, idx: u.sideIdx, sk: sk.name });
            acted = true;
          }
        }
        if (!acted) {
          // 普通攻击
          const foes = alive(u.team === 'ally' ? 'enemy' : 'ally');
          if (!foes.length) continue;
          const t = pickFoe(u, foes)[0];
          const r = dealDamage(u, t, 1.0);
          push(u.name + ' 攻击 ' + t.name + (r.crit ? '，暴击' : '') + '，造成 ' + r.dmg + ' 伤害！', r.crit ? 'crit' : 'dmg');
          events.push({ type: 'dmg', team: u.team, idx: u.sideIdx, sk: '普攻', targets: [{ team: t.team, idx: t.sideIdx, dmg: r.dmg, crit: r.crit }] });
        }
      }
      // 回合末：burn/poison/regen
      all.forEach(u => {
        if (u.hp <= 0) return;
        if (u.regenPct > 0) { const r = Math.round(u.maxHp * u.regenPct); u.hp = Math.min(u.maxHp, u.hp + r); push(u.name + ' 种族天赋回血，恢复 ' + r + ' 生命', 'heal'); }
        if (u.status.burn > 0) { const b = Math.round(u.maxHp * 0.04); u.hp = Math.max(0, u.hp - b); push(u.name + ' 燃烧灼烧，损失 ' + b + ' 生命！', 'burn'); u.status.burn--; }
        if (u.status.regen > 0) { const r = Math.round(u.maxHp * (u.status.regen / 100)); u.hp = Math.min(u.maxHp, u.hp + r); push(u.name + ' 秘法滋养，恢复 ' + r + ' 生命', 'heal'); u.status.regen--; }
      });
      // 冷却、状态递减
      all.forEach(u => {
        u.cds = u.cds.map(c => Math.max(0, c - 1));
        if (u.status.silence > 0) u.status.silence--;
        if (u.status.stun < 0) u.status.stun = 0;
        if (u.status.freeze < 0) u.status.freeze = 0;
        if (u.status.taunt > 0) u.status.taunt--;
        if (u.status.atkBuff > 0) u.status.atkBuff--;
        if (u.status.defBuff > 0) u.status.defBuff--;
        if (u.status.hpBuff > 0) u.status.hpBuff--;
      });

      const allyAlive = alive('ally').length;
      const enemyAlive = alive('enemy').length;
      if (enemyAlive === 0) { winner = 'ally'; break; }
      if (allyAlive === 0) { winner = 'enemy'; break; }
    }
    if (!winner) {
      const ea = alive('enemy').length, aa = alive('ally').length;
      winner = ea >= aa ? 'enemy' : 'ally';
    }
    const timeout = winner !== 'ally' && alive('enemy').length > 0 && alive('ally').length > 0;
    return { winner, log, rounds: Math.min(round, opts.maxRounds || 30), timeout, events };
  }

  // ---------- 主线 ----------
  function enemyForStage(stage) { return makeEnemies(stage); }
  function stageReward(state) {
    const s = state.mainline.stage;
    const base = rates(state);
    const xi = Math.round(base.xiuwei * 60 * 0.6 * (1 + s * 0.02));
    const cu = Math.round(base.copper * 30 * (1 + s * 0.01));
    return { xiuwei: xi, copper: cu, equipChance: 0.25 };
  }
  function challengeMainline(state, cb) {
    const stage = state.mainline.stage;
    const playerUnits = formationUnits(state).map(u => buildPlayerUnit(state, u.iid)).filter(Boolean);
    const enemyUnits = enemyForStage(stage);
    const res = simulateBattle(playerUnits, enemyUnits, cb, { maxRounds: 30 });
    if (res.winner === 'ally') {
      const rw = stageReward(state);
      state.res.xiuwei += rw.xiuwei;
      state.res.copper += rw.copper;
      if (stage % 10 === 0) { // Boss 关掉落紫气
        const zi = 8 + state.realm.idx * 4;
        state.res.ziqi += zi;
        if (cb) cb({ msg: '击败 Boss！获得鸿蒙紫气 +' + zi, cls: 'loot' });
      }
      if (Math.random() < rw.equipChance) {
        const e = genEquip(state, qualityForStage(stage));
        state.equipment.push(e);
        if (cb) cb({ msg: '掉落装备：' + e.quality + '·' + slotName(e.slot), cls: 'loot' });
      }
      state.mainline.stage++;
      return { ok: true, stage, reward: rw, res };
    }
    if (res.timeout) {
      // 30 回合内未击破敌人：挑战失败，退回上一关
      state.mainline.stage = Math.max(1, state.mainline.stage - 1);
      if (cb) cb({ msg: '30 回合未击破敌人，挑战失败，退回上一关！', cls: 'system' });
    }
    return { ok: false, stage, res };
  }

  // ---------- 水月洞天 ----------
  function shuiyueStage(state) {
    const boss = state.dungeons.shuiyue.bestBoss + 1;
    return { boss, elapsed: 0 };
  }
  function challengeShuiyue(state, cb) {
    const bossLv = state.dungeons.shuiyue.bestBoss + 1;
    const cost = 10;
    if (state.res.stamina < cost) return { ok:false, res:null, msg:'体力不足' };
    state.res.stamina -= cost;
    const budget = teamPower(state) * (1.25 + bossLv * 0.08);
    const b = enemyGroupByPower(budget, { boss: true, count: 1, name: '洞天魔尊·' + bossLv + '阶', spd: 110 });
    const playerUnits = formationUnits(state).map(x => buildPlayerUnit(state, x.iid)).filter(Boolean);
    const res = simulateBattle(playerUnits, b, cb, { maxRounds: 30 });
    if (res.winner === 'ally') {
      const fragName = pick(Object.keys(P.FABAO));
      const f = P.FABAO[fragName];
      addItem(state, '法宝碎片·' + f.name, 2);
      let drop = 1 + (state.dungeons.shuiyue.bestBoss / 5 | 0);
      state.dungeons.shuiyue.bestBoss = bossLv;
      state.res.ziqi += 10 + bossLv * 2;
      if (cb) cb({ msg: '击败洞天魔尊！获得『' + f.name + '碎片×2』与鸿蒙紫气！', cls: 'loot' });
      return { ok:true, res };
    }
    return { ok:false, res };
  }

  // ---------- 五行山 ----------
  function wuxingStage(state) {
    return state.dungeons.wuxing.bestStage + 1;
  }
  function challengeWuxing(state, cb) {
    const stage = wuxingStage(state);
    const cost = 10;
    if (state.res.stamina < cost) return { ok:false, res:null, msg:'体力不足' };
    state.res.stamina -= cost;
    // 五行山：敌人元素克制我方（若我方有克制它的元素则优势）
    const enemyEl = ELEMENTS[(stage + 1) % 5];
    const budget = teamPower(state) * (1.2 + stage * 0.03);
    const bArr = enemyGroupByPower(budget, { boss: true, count: 3, el: enemyEl, name: '五行妖灵·' + P.ELEM_NAME[enemyEl], minion: '五行妖灵', spd: 100 + stage * 2 });
    const playerUnits = formationUnits(state).map(x => buildPlayerUnit(state, x.iid)).filter(Boolean);
    const res = simulateBattle(playerUnits, bArr, cb, { maxRounds: 30 });
    if (res.winner === 'ally') {
      state.dungeons.wuxing.bestStage = stage;
      state.res.wuxing += 15 + stage * 3;
      addItem(state, '五行石', stage % 4 === 0 ? 3 : 1);
      if (cb) cb({ msg: '五行降服！获得五行晶石 ×' + (stage % 4 === 0 ? 3 : 1) + '、五行币+' + (15 + stage * 3), cls: 'loot' });
      return { ok:true, res };
    }
    return { ok:false, res };
  }

  // ---------- 日常副本 ----------
  function resetDaily(state, now) {
    const d = state.dungeons.daily;
    const day = new Date(now).toDateString();
    if (d.lastResetDay !== day) {
      d.lastResetDay = day;
      d.xiuwei = 3; d.tongqian = 3; d.equip = 3;
    }
  }
  function dailySweep(state, id) {
    resetDaily(state, Date.now());
    const d = state.dungeons.daily;
    if (d[id] <= 0) return { ok:false, msg:'今日次数已用完' };
    d[id]--;
    const base = rates(state);
    if (id === 'xiuwei') { const g = base.xiuwei * 300; state.res.xiuwei += g; return { ok:true, msg:'修为 +' + fmt(g) }; }
    if (id === 'tongqian') { const g = base.copper * 200; state.res.copper += g; return { ok:true, msg:'铜钱 +' + fmt(g) }; }
    if (id === 'equip') { const q = qualityForStage(state.mainline.stage + 10); const e = genEquip(state, q); state.equipment.push(e); return { ok:true, msg:'获得装备：' + e.quality + '·' + slotName(e.slot) }; }
    return { ok:false, msg:'未知' };
  }

  // ---------- 物品使用 ----------
  function useItem(state, name) {
    if ((state.items[name] || 0) < 1) return { ok:false, msg:'没有 ' + name };
    takeItem(state, name, 1);
    if (name === '聚元丹') { const r = rates(state); const g = r.xiuwei * 3600; state.res.xiuwei += g; return { ok:true, msg:'修为 +' + fmt(g) }; }
    if (name === '聚灵丹') { state.res.lingqi += 500; return { ok:true, msg:'灵气 +500' }; }
    if (name === '醒神丹') { state.res.stamina = clamp(state.res.stamina + 30, 0, P.STAMINA_MAX); return { ok:true, msg:'体力 +30' }; }
    if (name === '渡劫丹') return { ok:true, msg:'渡劫丹留待渡劫使用' };
    return { ok:false, msg:'暂不可用' };
  }

  // ---------- 主角升级（含境界加成） ----------
  function heroLevelCost(level) { return Math.round(30 + Math.pow(level, 2.1) * 3); }
  function upgradeHero(state) {
    const maxLv = 500;
    if (state.hero.level >= maxLv) return { ok:false, msg:'已满级' };
    const cost = heroLevelCost(state.hero.level);
    if (state.res.xiuwei < cost) return { ok:false, msg:'修为不足' };
    state.res.xiuwei -= cost;
    state.hero.level++;
    recomputeStats(state);
    return { ok:true, msg: state.hero.level + ' 级' };
  }

  // ---------- 汇总战力 ----------
  function teamPower(state) {
    let pow = 0;
    formationUnits(state).forEach(x => {
      const st = unitStats(state, x.iid);
      if (st) pow += st.hp * 1 + st.atk * 4 + st.def * 3 + st.spd;
    });
    return Math.round(pow);
  }

  CJ.Core = {
    newGame, hasSave, load, save, wipe, exportSave, importSave,
    tick, offlineGains, rates, applyGain, recomputeStats, unitStats,
    realmLabel, tribulationInfo, tribulate,
    formationUnits, buildPlayerUnit, simulateBattle, enemyForStage, challengeMainline, stageReward,
    setFormation, setJuling, julingBonus,
    summon, summonOne, upgradePartner, levelCost,
    upgradeManor, manorCost, hasCost, payCost,
    alchemy, forgeEquip, genEquip, qualityForStage, decomposeEquip,
    enhanceEquip, refineEquip, fumoEquip, equipTo, unequip,
    craftFabao, equipFabao, fabaoBonus,
    buyShop, grantShopGood, useItem,
    challengeShuiyue, challengeWuxing, dailySweep, resetDaily, wuxingStage, shuiyueStage,
    upgradeHero, heroLevelCost, teamPower, formatDuration,
    layerCost, breakthroughLayer, layerName,
    partnerTpl, partnerQ, pMaxLevel, slotName, colorName, qualityMult,
    lingmaiMult, lingmaiColor, elemMult, addItem, takeItem,
    helpers: { fmt, rndInt, pick, clamp }
  };
})();
