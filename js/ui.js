/* ============================================================
 * 菜鸡修仙传 · 界面层 (UI)
 * 渲染 / 交互 / 游戏循环。仅浏览器运行。
 * ============================================================ */
(function () {
  const C = (window.CJ || {}).Core;
  const DATA = (window.CJ || {}).P;
  if (!C || !DATA) { document.body.innerHTML = '<p style="color:#ff6b6b;padding:20px">资源加载失败</p>'; return; }

  const $ = (sel) => document.querySelector(sel);
  const el = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; };
  const F = C.helpers.fmt;
  const ROLES = DATA.ROLES;
  const RACE = DATA.RACE;
  const QCOLOR = { 0: 'q0', 1: 'q1', 2: 'q2', 3: 'q3', 4: 'q4', 5: 'q5' };
  const ELEMC = { 金: '#f0c75e', 木: '#7fe08a', 水: '#7fb8ff', 火: '#ff8c6b', 土: '#c9a0ff' };

  const S = {
    game: null, tab: 'main', race: null, elem: null,
    slotSel: -1, equipUnit: 'hero', shop: 'market', manorSub: 'lingmai', dimSub: 'items', selUnit: 'hero', autoPill: false, singlePill: false, qiankunSub: 'qkup',
    eqFilter: '', eqSel: {}, equipModal: null, formMode: false, swapFrom: null, cancelBattle: false, battleMode: '',
    logMain: [], logDungeon: [], autoPush: false, battleRounds: 0, battleStage: 0, animating: false,
    lastPush: 0
  };

  // ---------- 开始界面 ----------
  function renderStart() {
    $('#start').classList.remove('hide');
    const box = $('#race-cards');
    box.innerHTML = '';
    Object.keys(RACE).forEach(rk => {
      const r = RACE[rk];
      const card = el(
        '<div class="race-card" data-race="' + rk + '"><h3>' + r.name + ' <span class="tag">' + r.intro + '</span></h3>' +
        '<div class="sk"><b class="gold">普通技能·' + r.normal.name + '</b><div class="dim">' + r.normal.text + '</div></div>' +
        '<div class="sk"><b class="red">专属技能·' + r.ultimate.name + '</b><div class="dim">' + r.ultimate.text + '</div></div></div>'
      );
      card.onclick = () => { S.race = rk; box.querySelectorAll('.race-card').forEach(c => c.classList.remove('sel')); card.classList.add('sel'); $('#start-err').textContent = ''; updateStartBtn(); };
      box.appendChild(card);
    });
    const ebox = $('#elem-cards');
    ebox.innerHTML = '';
    const elemDesc = { 金: '克木', 木: '克土', 水: '克火', 火: '克金', 土: '克水' };
    DATA.ELEMENTS.forEach(en => {
      const e = el('<div class="elem-card" data-elem="' + en + '" style="color:' + (ELEMC[en] || '#fff') + '">' + en + '<small>' + (elemDesc[en] || '') + '</small></div>');
      e.onclick = () => { S.elem = en; ebox.querySelectorAll('.elem-card').forEach(c => c.classList.remove('sel')); e.classList.add('sel'); $('#start-err').textContent = ''; updateStartBtn(); };
      ebox.appendChild(e);
    });
    $('#btn-start').onclick = () => {
      if (!S.race) { $('#start-err').textContent = '请先选择种族'; return; }
      if (!S.elem) { $('#start-err').textContent = '请先赋予主角五行'; return; }
      startNewGame(S.race);
    };
  }
  function updateStartBtn() {
    $('#btn-start').disabled = !(S.race && S.elem);
  }

  function startNewGame(race) {
    const g = C.newGame(race);
    g.heroEl = S.elem || '金';
    g.heroName = ($('#hero-name').value || '').trim();
    S.game = g;
    C.save(g);
    $('#start').classList.add('hide');
    $('#game').classList.remove('hide');
    S.logMain = []; S.logDungeon = [];
    buildNav();
    showTab('main');
    toast('欢迎踏入仙途，' + RACE[race].name + '道友！');
    C.recomputeStats(g);
    renderHeader();
    startMusic();
    updateMusicBtn();
  }

  // 回到选种族起始界面（重置后使用）
  function goToStart() {
    S.game = null;
    S.logMain = [];
    S.logDungeon = [];
    S.race = null;
    S.elem = null;
    $('#game').classList.add('hide');
    $('#start').classList.remove('hide');
    $('#btn-start').disabled = true;
    $('#start-err').textContent = '';
    const nm = $('#hero-name'); if (nm) nm.value = '';
    renderStart();
    updateMusicBtn();
  }

  // ---------- 背景音乐 ----------
  function isMuted() { try { return localStorage.getItem('caiji_muted') === '1'; } catch (e) { return false; } }
  function setMuted(m) { try { localStorage.setItem('caiji_muted', m ? '1' : '0'); } catch (e) {} }
  function updateMusicBtn() { const b = $('#music-btn'); if (b) b.textContent = isMuted() ? '🔇' : '🔊'; }
  function startMusic() {
    const a = $('#bgm');
    if (!a) return;
    a.volume = 0.5;
    a.muted = isMuted();
    if (!isMuted()) a.play().catch(() => {});
  }
  function bindMusic() {
    const b = $('#music-btn');
    if (b) b.onclick = () => {
      const m = !isMuted();
      setMuted(m);
      const a = $('#bgm');
      if (a) { a.muted = m; if (!m) a.play().catch(() => {}); }
      updateMusicBtn();
    };
    const once = () => startMusic();
    document.addEventListener('pointerdown', once, { once: true });
    document.addEventListener('keydown', once, { once: true });
  }

  // ---------- 顶栏 ----------
  function renderHeader() {
    const g = S.game;
    if (!g) return;
    const nameEl = $('#hero-name-hdr');
    if (nameEl) nameEl.textContent = g.heroName || RACE[g.race].name + '道友';
    const vb = $('#vip-badge');
    if (vb) {
      if (g.vip >= 1) { vb.classList.remove('hide'); vb.textContent = 'VIP' + g.vip; }
      else vb.classList.add('hide');
    }
    const res = g.res;
    const set = (id, v) => { const e = $(id); if (e) e.textContent = F(v); };
    set('#hdr-copper', res.copper);
    set('#hdr-xiuwei', res.xiuwei);
    set('#hdr-ziqi', res.ziqi);
  }

  // ---------- 导航 ----------
  const NAV = [
    { id: 'main', ico: '友', name: '道友' },
    { id: 'manor', ico: '府', name: '仙府' },
    { id: 'dimension', ico: '次', name: '次元空间' },
    { id: 'dungeon', ico: '战', name: '副本' },
    { id: 'shop', ico: '市', name: '仙宝阁' },
    { id: 'settings', ico: '⋯', name: '更多' }
  ];
  function buildNav() {
    const nav = $('#bottomnav');
    nav.innerHTML = '';
    NAV.forEach(n => {
      const it = el('<div class="nav-item" data-tab="' + n.id + '"><span class="ico">' + n.ico + '</span>' + n.name + '</div>');
      it.onclick = () => showTab(n.id);
      nav.appendChild(it);
    });
  }
  function updateNav() {
    document.querySelectorAll('#bottomnav .nav-item').forEach(i => i.classList.toggle('on', i.dataset.tab === S.tab));
  }

  function showTab(id) {
    S.tab = id;
    updateNav();
    render();
  }

  // ---------- 战报 ----------
  function addLog(key, msg, cls) {
    const arr = key === 'dungeon' ? S.logDungeon : S.logMain;
    arr.push({ msg, cls });
    if (arr.length > 500) arr.shift();
    const boxId = key === 'dungeon' ? '#battle-log-d' : '#battle-log';
    const box = $(boxId);
    if (box) {
      const line = document.createElement('div');
      line.className = cls || '';
      line.textContent = msg;
      box.appendChild(line);
      box.scrollTop = box.scrollHeight;
    }
  }
  function renderLog(boxId, arr) {
    const box = $(boxId);
    if (!box) return;
    box.innerHTML = '';
    arr.forEach(l => {
      const d = document.createElement('div');
      d.className = l.cls || '';
      d.textContent = l.msg;
      box.appendChild(d);
    });
    box.scrollTop = box.scrollHeight;
  }

  // ---------- 通用渲染入口 ----------
  // 战斗窗口：在所有底部标签页顶部固定展示
  function battleWindowHtml() {
    const g = S.game;
    if (!g) return '';
    const stage = g.mainline.stage;
    const heroEl = g.heroEl;
    const race = RACE[g.race];
    const heroNm = g.heroName || race.name + '道友';
    const heroSt = C.unitStats(g, 'hero');
    const pu = C.formationUnits(g);
    const slotHtml = (side, idx, nm, color, realm, hp, maxh, hero, boss, startPct, q, qName, regen, ult) => {
      const hpPct = Math.max(0, Math.min(100, hp / maxh * 100));
      const qBadge = q ? '<span class="slot-q" style="color:' + qColor(q) + '">' + qName + '</span> ' : '';
      return '<div class="slot' + (hero ? ' slot-hero' : boss ? ' slot-boss' : '') + '" data-side="' + side + '" data-idx="' + idx + '" data-hp="' + Math.round(hp) + '" data-maxh="' + Math.round(maxh) + '" data-regen="' + (regen || 0) + '" data-ult="' + (ult || '专属技能') + '">' +
        '<div class="slot-name" style="color:' + color + '">' + qBadge + nm + '</div>' +
        '<div class="slot-hp"><i style="width:' + hpPct + '%"></i><span class="slot-hp-num">' + Math.round(hp) + '</span></div>' +
        '<div class="slot-energy"><i style="width:0%"></i><span class="slot-energy-txt">' + realm + '</span></div></div>';
    };
    let ph = '';
    const heroUlt = DATA.SKILLS[RACE[g.race].uid].name;
    pu.forEach((u, i) => {
      if (u.isHero) { const hps = heroSt ? heroSt.hp : 100; ph += slotHtml(0, i, heroNm, ELEMC[heroEl] || '#fff', C.realmLabel(g), hps, Math.max(1, hps), true, false, 30, 0, '', 110, heroUlt); }
      else { const p = g.partners.find(x => x.iid === u.iid); const tpl = DATA.PARTNERS.find(x => x.id === p.pid); const ps = C.unitStats(g, u.iid); const hps = ps ? ps.hp : 100; ph += slotHtml(0, i, tpl.name, ELEMC[tpl.el] || '#fff', C.partnerRealmLabel(p), hps, Math.max(1, hps), false, false, 20, tpl.q, C.colorName(tpl.q), 95, tpl.name + '·技'); }
    });
    for (let i = pu.length; i < 6; i++) ph += '<div class="slot empty" data-side="0" data-idx="' + i + '">空位</div>';
    const enemies = C.enemyForStage(stage, stage > (g.mainline.cleared || 0), S.battleMode === 'farm');
    // Boss 站位回归到阵型后方中间（保留原 data-idx，战斗动画按原索引定位）
    const disp = enemies.map((en, idx) => ({ en, idx }));
    const bp = disp.findIndex(x => x.en.boss);
    if (bp >= 0 && disp.length > 1) { const b = disp.splice(bp, 1)[0]; disp.splice(Math.ceil(disp.length / 2), 0, b); }
    let eh = '';
    disp.forEach(({ en, idx }) => { const hps = en.hp || en.maxHp || 100; eh += slotHtml(1, idx, en.name, REALM_COLORS[realmTier(stage)], stageRealm(stage), hps, en.maxHp || Math.max(1, hps), false, en.boss, 15, en.q, en.qName, 80, en.boss ? '妖王秘技' : '妖技'); });
    for (let i = enemies.length; i < 6; i++) eh += '<div class="slot empty" data-side="1" data-idx="' + i + '">空位</div>';
    const autoUnlocked = stage >= 30;
    const autoHtml = '<span class="bf-auto" data-act="auto"><input type="checkbox"' +
      (S.autoPush ? ' checked' : '') + (autoUnlocked ? '' : ' disabled') + '> 自动推关' +
      (autoUnlocked ? '' : '<small>(30关解锁)</small>') + '</span>';
    return '<div class="battle-field"><div class="bf-round"><span>第 ' + stage + ' 关 · ' + S.battleRounds + '/30回合</span></div><div class="bf-body">' +
      '<div class="bf-side">' + ph + '</div><div class="bf-vs">⚔</div><div class="bf-side">' + eh + '</div></div>' +
      '<div class="bf-ctrl"><div class="bf-left"><button class="btn btn-sm ' + (S.formMode ? 'btn-gold' : '') + '" data-act="formation">' + (S.formMode ? '✔ 开始战斗' : '🔀 布阵') + '</button></div>' +
      '<div class="bf-mid">' + autoHtml + '</div>' +
      '<div class="bf-right"><button class="btn btn-gold btn-sm" data-act="push">挑战下一层</button></div></div></div>' +
      formationBoardHtml(g);
  }

  function formationBoardHtml(g) {
    const units = C.formationUnits(g);
    const heroEl = g.heroEl;
    let row = '';
    for (let i = 0; i < 6; i++) {
      const u = units[i];
      if (u) {
        let name, realm, color, qBadge = '';
        let ridx;
        if (u.isHero) {
          const race = RACE[g.race];
          name = g.heroName || race.name + '道友';
          realm = C.realmLabel(g);
          color = ELEMC[heroEl] || '#fff';
          ridx = g.realm.idx;
        } else {
          const p = g.partners.find(x => x.iid === u.iid);
          const tpl = DATA.PARTNERS.find(x => x.id === p.pid);
          name = tpl.name;
          realm = C.partnerRealmLabel(p);
          color = ELEMC[tpl.el] || '#fff';
          qBadge = '<span class="slot-q" style="color:' + qColor(tpl.q) + '">' + C.colorName(tpl.q) + '</span>';
          ridx = p.realm.idx;
        }
        const selCls = (S.formMode && S.swapFrom === u.iid) || (!S.formMode && S.selUnit === u.iid) ? ' sel' : '';
        const selStyle = ((S.formMode && S.swapFrom === u.iid) || (!S.formMode && S.selUnit === u.iid)) ? ' style="border-color:' + REALM_COLORS[ridx] + '; box-shadow:0 0 8px ' + REALM_COLORS[ridx] + '"' : '';
        row += '<div class="fm-slot filled' + selCls + '" data-fm="' + u.iid + '"' + selStyle + '><div class="fm-name" style="color:' + color + '">' + qBadge + name + '</div><div class="fm-realm">' + realm + '</div></div>';
      } else {
        row += '<div class="fm-slot empty"><div class="fm-name">空位</div></div>';
      }
    }
    return '<div class="bf-fm"><div class="bf-fm-t">上阵阵容 <small>' + (S.formMode ? '点击两个道友互换位置，完成后点“开始战斗”' : '点击模块选中 · 在次元空间·道友 上阵/下阵') + '</small></div><div class="bf-fm-row">' + row + '</div></div>';
  }
  function showReward(rw) {
    const bf = document.querySelector('.battle-field');
    if (!bf || !rw) return;
    const d = document.createElement('div');
    d.className = 'bf-reward';
    d.innerHTML = '<div>获得铜钱 <b>' + F(rw.copper) + '</b></div><div>获得修为 <b>' + F(rw.xiuwei) + '</b></div>';
    bf.appendChild(d);
    setTimeout(() => { if (d.parentNode) d.remove(); }, 2600);
  }

  function render() {
    renderHeader();
    if (!S.equipModal) { const m = document.getElementById('equip-modal'); if (m) m.remove(); }
    if (!S.animating) {
      const bw = $('#battle-win');
      if (bw) bw.innerHTML = battleWindowHtml();
    }
    const v = $('#cview');
    v.innerHTML = '';
    const fn = { main: renderMain, manor: renderManor, dungeon: renderDungeon, shop: renderShop, dimension: renderDimension, settings: renderSettings }[S.tab] || renderMain;
    if (fn) fn(v);
  }

  // ---------- 主页 / 修仙 ----------
  const REALM_COLORS = ['#8fe08a', '#7fb8ff', '#c39dff', '#f0c75e', '#ff9a5c', '#ff6b6b', '#e07bff', '#ffe27a', '#ff3b3b'];
  function realmTier(stage) {
    const caps = [30, 70, 120, 180, 250, 330, 430, 560, Infinity];
    for (let i = 0; i < caps.length; i++) if (stage <= caps[i]) return i;
    return caps.length - 1;
  }
  function stageRealm(stage) {
    const tiers = [[30, '炼气'], [70, '筑基'], [120, '金丹'], [180, '元婴'], [250, '化神'], [330, '炼虚'], [430, '合体'], [560, '大乘'], [Infinity, '渡劫']];
    let t = 0;
    for (let i = 0; i < tiers.length; i++) { if (stage <= tiers[i][0]) { t = i; break; } t = i; }
    const layers = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十'];
    const l = layers[Math.max(0, Math.min(layers.length - 1, Math.floor(stage % layers.length)))] || '一';
    return tiers[t][1] + '·' + l + '层';
  }

  function renderMain(v) {
    const g = S.game;
    const r = C.rates(g);
    const stage = g.mainline.stage;
    const race = RACE[g.race];
    const selId = S.selUnit || 'hero';
    let selName, selRealm, selEl, selIdx, selLayer, selNeed, selSuccess, selFail, selFailPct, actTrib, tribA, isMaxLayer, st;
    if (selId === 'hero') {
      st = C.unitStats(g, 'hero');
      selName = g.heroName || race.name + '道友';
      selRealm = C.realmLabel(g);
      selEl = g.heroEl;
      selIdx = g.realm.idx; selLayer = g.realm.layer;
      isMaxLayer = g.realm.layer >= 20;
      selNeed = isMaxLayer ? C.tribulationCost(g) : C.layerCost(g);
      selSuccess = Math.round(C.realmChance(g) * 100);
      selFail = 100 - selSuccess;
      selFailPct = 10 + selIdx * 10;
      actTrib = isMaxLayer ? 'trib' : 'layerup';
      tribA = '';
    } else {
      const p = g.partners.find(x => x.iid === selId) || g.partners[0];
      const tpl = p ? DATA.PARTNERS.find(x => x.id === p.pid) : null;
      if (!p || !tpl) {
        st = C.unitStats(g, 'hero');
        selName = g.heroName || race.name + '道友'; selRealm = C.realmLabel(g); selEl = g.heroEl;
        selIdx = g.realm.idx; selLayer = g.realm.layer; isMaxLayer = g.realm.layer >= 20;
        selNeed = isMaxLayer ? C.tribulationCost(g) : C.layerCost(g);
        selSuccess = Math.round(C.realmChance(g) * 100); selFail = 100 - selSuccess; selFailPct = 10 + selIdx * 10;
        actTrib = isMaxLayer ? 'trib' : 'layerup'; tribA = '';
      } else {
        st = C.unitStats(g, p.iid);
        selName = tpl.name; selRealm = C.partnerRealmLabel(p); selEl = tpl.el;
        selIdx = p.realm.idx; selLayer = p.realm.layer; isMaxLayer = p.realm.layer >= 20;
        selNeed = C.partnerLayerCost(p);
        selSuccess = Math.round((0.95 - selIdx * 0.08) * 100); selFail = 100 - selSuccess; selFailPct = 10 + selIdx * 8;
        actTrib = 'tribp'; tribA = ' data-a="' + p.iid + '"';
      }
    }
    const barPct = isMaxLayer ? 100 : Math.min(100, Math.round(g.res.xiuwei / selNeed * 100));

    // 角色属性 + 境界：合并为一行，左右两块，压缩
    v.innerHTML = `
      <div class="main-duo">
        <div class="card md-left">
          <div class="md-name"><b class="gold">${selName}</b> <span class="md-realm">${selRealm}</span></div>
          <div class="md-stats">
            <div class="md-stat"><span>生命</span><b>${Math.round(st.hp)}</b></div>
            <div class="md-stat"><span>攻击</span><b>${F(st.atk)}</b></div>
            <div class="md-stat"><span>物防</span><b>${F(st.def)}</b></div>
            <div class="md-stat"><span>法防</span><b>${F(st.def)}</b></div>
            <div class="md-stat"><span>速度</span><b>${Math.round(st.spd)}</b></div>
            <div class="md-stat"><span>五行</span><b style="color:${ELEMC[selEl] || '#fff'}">${selEl}</b></div>
          </div>
          <div class="md-power">战力 ${F(C.teamPower(g))}</div>
        </div>
        <div class="card md-right">
          <div class="md-realm">${selRealm} <span class="dim">第${selLayer}/20层</span></div>
          <div class="bar md-bar${isMaxLayer ? ' red-bar' : ''}"><i style="width:${barPct}%"></i></div>
          <button class="btn btn-sm md-trib${isMaxLayer ? ' btn-red' : ''}" data-act="${actTrib}"${tribA}>${isMaxLayer ? '渡劫·破大境' : '渡劫'}</button>
          <div class="md-need">需${F(selNeed)} · 成功${selSuccess}% · 失败${selFail}%</div>
          <div class="md-pills"><button class="btn btn-xs btn-blue" data-act="usepill">用丹</button><button class="btn btn-xs ${S.autoPill ? 'btn-green' : ''}" data-act="autopill">${S.autoPill ? '自动·开' : '自动·关'}</button>${S.singlePill ? '<span class="green">已装备</span>' : ''}</div>
          <div class="dim">丹×${g.items['渡劫丹'] || 0} · 失败损失${selFailPct}%</div>
        </div>
      </div>

      ${equipConfigHtml(g)}

      <div class="card">
        <div class="sec-title" style="margin:0">挂机收益</div>
        <div class="statsrow">
          <div class="stat"><span>修为/秒</span><b>${F(r.xiuwei)}</b></div>
          <div class="stat"><span>铜钱/秒</span><b>${F(r.copper)}</b></div>
          <div class="stat"><span>玉液/秒</span><b>${r.qiongjiang.toFixed(1)}</b></div>
        </div>
        <div class="row mt8">
          <span class="muted">仙府法阵/境界/关卡越高，挂机越多</span>
        </div>
      </div>

      <div class="card">
        <div class="sec-title" style="margin:0">战报 <span class="tag">第 ${stage} 关</span></div>
        <div id="battle-log" class="battle-log"></div>
      </div>
    `;
    // 合并道友 + 装备页
    v.insertAdjacentHTML('beforeend', renderPartner());
    renderLog('#battle-log', S.logMain);
  }

  function layerPct(g) {
    if (g.realm.layer >= 20) return 100;
    const cost = C.layerCost(g);
    return Math.min(100, Math.round(g.res.xiuwei / cost * 100));
  }

  // ---------- 仙府 ----------
  function renderManor(v) {
    const g = S.game;
    const MANOR = DATA.MANOR;
    const show = S.manorSub || 'lingmai';
    let html = '<div class="sec-title">仙府·七大玩法</div>';
    html += '<div class="sec-tabs">';
    [['lingmai', '灵脉'], ['gongfa', '功法'], ['linggen', '灵根'], ['wanxiang', '万象化宇'], ['juling', '聚灵阵'], ['qiankun', '造化乾坤殿'], ['zuiyue', '醉月樽']].forEach(t => {
      html += '<button class="btn ' + (show === t[0] ? 'btn-gold' : '') + '" data-act="msub" data-a="' + t[0] + '">' + t[1] + '</button>';
    });
    html += '</div>';
    const timerOf = (bid) => g.buildTimers[bid] ? '<span class="green">升级中·还差 ' + C.formatDuration(Math.max(0, (g.buildTimers[bid].endAt - Date.now()) / 1000)) + '</span>' : '';
    const upBtn = (bid, label) => {
      const lv = g.manor[bid] || 0;
      const tm = timerOf(bid);
      const maxLv = (bid === 'lingmai') ? 9 : 99;
      const dis = (tm || lv >= maxLv) ? ' disabled' : '';
      return '<button class="btn btn-sm btn-gold" data-act="mup" data-a="' + bid + '"' + dis + '>' + label + '（玉液' + F((C.manorCost(bid, lv).qiongjiang || 0)) + '）</button> ' + tm + (lv >= maxLv && !tm ? '<span class="dim">已满级</span>' : '');
    };
    const trainCard = (cat) => {
      const isLian = cat === 'lian';
      const rank = isLian ? (g.manor.lianlv || 1) : (g.manor.duanlv || 1);
      const exp = isLian ? (g.manor.lianExp || 0) : (g.manor.duanExp || 0);
      const need = C.trainNeed(rank);
      const nm = isLian ? '炼丹师' : '锻造师';
      const tr = g.training[cat];
      const countdown = tr ? '修炼中·还差 ' + C.formatDuration(Math.max(0, (tr.endAt - Date.now()) / 1000)) : '';
      return '<div class="card"><div class="row"><div><b class="gold">' + nm + '</b> <span class="tag">' + pinName(rank) + '</span></div><span class="green">经验 ' + exp + ' / ' + need + '</span></div>' +
        '<div class="row mt8"><button class="btn btn-sm btn-blue" data-act="train" data-a="' + cat + '" data-b="5"' + (tr ? ' disabled' : '') + (rank >= 10 ? ' disabled' : '') + '>修炼5年(50万铜·50经验·25分)</button>' +
        '<button class="btn btn-sm btn-blue" data-act="train" data-a="' + cat + '" data-b="50"' + (tr ? ' disabled' : '') + (rank >= 10 ? ' disabled' : '') + '>修炼50年(500万铜·500经验·4时10分)</button></div>' +
        '<div class="dim mt8">' + countdown + (rank >= 10 ? ' · 已达十品' : '') + '</div></div>';
    };
    if (show === 'lingmai') {
      const lv = g.manor.lingmai || 0;
      const rank = lv <= 2 ? '黄' : lv <= 4 ? '玄' : lv <= 6 ? '地' : '天';
      html += '<div class="card"><div class="row"><div><b class="gold">灵脉</b> <span class="tag">Lv.' + lv + '/9 · ' + rank + '阶</span></div>' + upBtn('lingmai', '升级') + '</div>' +
        '<div class="green mt8">主角品质：<b style="color:' + qColor({ blue: 2, purple: 3, gold: 4, red: 5 }[C.lingmaiColor(lv)] || '#fff') + '">' + colorName(C.lingmaiColor(lv)) + '</b> · ' + C.lingmaiMult(lv).toFixed(2) + 'x</div>' +
        '<div class="dim mt8">黄阶1-2=蓝 · 玄阶3-4=紫 · 地阶5-6=金 · 天阶7-9=红</div></div>';
    } else if (show === 'gongfa') {
      const rc = DATA.RACE[g.race];
      const ult = DATA.SKILLS[rc.uid];
      const lv = g.gongfa || 0;
      if (!g.gongfaLearned) {
        html += '<div class="card"><div class="dim">未学习功法。请到「仙宝阁→功法商店」购买【功法·秘籍】，再到「次元空间→物品」使用后即可升级。</div>' +
          '<div class="row mt8"><span><b class="gold">种族专属·' + ult.name + '</b></span><span class="green">天生掌握</span></div>' +
          '<div class="dim">' + rc.ultimate.text + '</div></div>';
      } else {
        html += '<div class="card"><div class="row"><div><b class="gold">功法</b> <span class="tag">Lv.' + lv + '</span></div>' + upBtn('gongfa', '升级') + '</div>' +
          '<div class="green mt8">主角 攻击+' + (lv * 1.2).toFixed(1) + '% · 速度+' + lv + '</div>' +
          '<div class="row mt8"><span><b class="gold">种族专属·' + ult.name + '</b></span><span class="green">天生掌握</span></div>' +
          '<div class="dim">' + rc.ultimate.text + '</div></div>';
      }
    } else if (show === 'linggen') {
      const lv = g.manor.linggen || 1;
      html += '<div class="card"><div class="row"><div><b class="gold">灵根</b> <span class="tag">Lv.' + lv + '</span></div>' + upBtn('linggen', '升级') + '</div>' +
        '<div class="green mt8">主角属性加成 +' + (lv * 3) + '% · 产出灵气 ' + ((1 + lv * 1.2) / 60).toFixed(2) + '/秒</div></div>';
    } else if (show === 'wanxiang') {
      const wx = C.wanxiangBonus(g);
      html += '<div class="card"><div class="row"><div><b class="gold">万象化宇</b> <span class="tag">Lv.' + (g.manor.wanxiang || 1) + '</span></div>' + upBtn('wanxiang', '升级') + '</div>' +
        '<div class="green mt8">已驻 ' + wx.cnt + '/' + wx.slots + ' · 上阵伙伴属性 +' + wx.pct.toFixed(1) + '%</div>' +
        '<div class="dim mt8">道友列表：</div>';
      g.partners.forEach(p => {
        const tpl = DATA.PARTNERS.find(x => x.id === p.pid);
        const inWx = g.wanxiang.includes(p.iid);
        const inF = g.formation.includes(p.iid);
        html += '<div class="shop-item"><span style="color:' + qColor(tpl.q) + '">' + tpl.name + (inF ? ' <span class="dim">(上阵)</span>' : '') + '</span><span>' + (inWx ? '<button class="btn btn-sm btn-red" data-act="wxrm" data-a="' + p.iid + '">移出万象</button>' : '<button class="btn btn-sm btn-blue" data-act="wxadd" data-a="' + p.iid + '">放入万象</button>') + '</span></div>';
      });
    } else if (show === 'juling') {
      const lv = g.manor.juling || 1;
      const r = C.rates(g);
      html += '<div class="card"><div class="row"><div><b class="gold">聚灵阵</b> <span class="tag">Lv.' + lv + '</span></div>' + upBtn('juling', '升级') + '</div>' +
        '<div class="green mt8">产出修为 ' + r.xiuwei + '/秒</div></div>';
    } else if (show === 'qiankun') {
      const qs = S.qiankunSub || 'qkup';
      html += '<div class="sec-tabs"><button class="btn ' + (qs === 'qkup' ? 'btn-gold' : '') + '" data-act="qksub" data-a="qkup">造化乾坤殿</button><button class="btn ' + (qs === 'qkdan' ? 'btn-gold' : '') + '" data-act="qksub" data-a="qkdan">炼丹阁</button><button class="btn ' + (qs === 'qkfor' ? 'btn-gold' : '') + '" data-act="qksub" data-a="qkfor">锻造阁</button></div>';
      if (qs === 'qkup') {
        html += trainCard('lian');
        html += trainCard('duan');
        html += '<div class="card"><div class="dim mt8">炼丹师/锻造师 可由一品修炼至十品；普通集市可购买 1品炼丹炉(玄铁丹炉)/1品锻造炉(黑铁锻炉) 提升相应炼丹师/锻造师等级。</div></div>';
      } else if (qs === 'qkdan') {
        html += '<div class="card"><div class="row"><div><b class="gold">炼丹阁</b></div></div><div class="dim mt8">暂无丹方——新的丹药正在筹备中，敬请期待。</div></div>';
      } else {
        html += '<div class="card"><div class="row"><div><b class="gold">锻造阁</b></div></div><div class="dim">消耗灵气打造装备。</div></div>';
        const cost = 40 + g.manor.qiankun * 15;
        html += '<div class="shop-item"><span>打造一件装备（当前灵气消耗 ' + cost + '）</span><button class="btn btn-sm btn-gold" data-act="forge">打造</button></div>';
      }
    } else if (show === 'zuiyue') {
      const lv = g.manor.zuiyue || 1;
      const r = C.rates(g);
      html += '<div class="card"><div class="row"><div><b class="gold">醉月樽</b> <span class="tag">Lv.' + lv + '</span></div>' + upBtn('zuiyue', '升级') + '</div>' +
        '<div class="green mt8">产出琼浆玉液 ' + r.qiongjiang.toFixed(2) + '/秒</div></div>';
    }
    v.innerHTML = html;
  }
  function colorName(c) { return { blue: '蓝', purple: '紫', gold: '金', red: '红' }[c] || c; }
  function pinName(r) { return ['', '一品', '二品', '三品', '四品', '五品', '六品', '七品', '八品', '九品', '十品'][r] || r; }
  function costText(cost) {
    const a = [];
    if (cost.copper) a.push('铜钱' + F(cost.copper));
    if (cost.qiongjiang) a.push('玉液' + F(cost.qiongjiang));
    if (cost.lingqi) a.push('灵气' + F(cost.lingqi));
    if (cost.xiuwei) a.push('修为' + F(cost.xiuwei));
    return a.join(' / ') || '免费';
  }

  // ---------- 道友 ----------
  function renderPartner() {
    const g = S.game;
    let html = '<div class="sec-title">道友 · 名录与聚灵</div>';
    const freeRemain = (g.freeSummonAt || 0) - Date.now();
    const freeReady = freeRemain <= 0;
    const freeTxt = freeReady ? '免费单抽' : ('免费(' + Math.floor((freeRemain / 60000)) + '分)');
    html += '<div class="card"><div class="row"><div><b class="gold">招募</b> <span class="dim">紫气' + F(g.res.ziqi) + ' · 招募令×' + (g.items['招募令'] || 0) + '</span></div></div>' +
      '<div class="toolbar"><button class="btn btn-sm btn-blue" data-act="sumfree"' + (freeReady ? '' : ' disabled') + '>' + freeTxt + '</button>' +
      '<button class="btn btn-sm btn-gold" data-act="sum" data-a="1">单抽（1令/200紫）</button>' +
      '<button class="btn btn-sm btn-gold" data-act="sum" data-a="10">十连（1800紫）</button></div>' +
      '<div class="dim">概率：' + (g.vip ? '蓝39% 紫40% 金18.5% 红2.5%' : '蓝40% 紫40% 金18% 红2%') + ' · 每10抽必出金/十连必含金 · 免费单抽每8小时1次 · 重复道友自动进阶★</div></div>';

    // 聚灵阵
    html += '<div class="card"><div class="sec-title" style="margin:0">聚灵阵 <span class="muted">闲置道友加成全队 ' + C.julingBonus(g).toFixed(1) + '%</span></div><div class="slot-grid">';
    if (g.juling.length) {
      g.juling.forEach(iid => {
        const p = g.partners.find(x => x.iid === iid); const tpl = DATA.PARTNERS.find(x => x.id === p.pid);
        html += '<div class="f-slot" data-juling="' + iid + '"><h5 style="color:' + qColor(tpl.q) + '">' + tpl.name + '</h5><small>' + C.partnerRealmLabel(p) + '</small></div>';
      });
    } else {
      html += '<div class="f-slot empty" style="grid-column:1/4">暂无极闲道友</div>';
    }
    html += '</div><div class="dim mt8">点击聚灵阵中的道友可移出。</div></div>';

    return html;
  }

  function qColor(q) { return { 1: 'var(--green)', 2: 'var(--blue)', 3: 'var(--purple)', 4: 'var(--gold)', 5: 'var(--red)' }[q] || 'var(--ink)'; }

  // ---------- 装备配置 ----------
  function equipSlots() { return ['weapon', 'armor', 'accessory', 'necklace']; }
  function equipStatName(slot) { return { weapon: '攻击', armor: '物防', accessory: '生命', necklace: '法防' }[slot] || '属性'; }
  function equipStatVal(e) { const q = DATA.QMAP[e.quality]; return Math.round(e.baseValue * [1, 1.4, 2, 3, 4.5, 7][q] * (1 + e.enh * 0.06 + e.ref * 0.09)); }
  function equipOn(g, key) { return g.equipment.find(x => x.iid && g.equipped[x.iid] === key); }
  function equipConfigHtml(g) {
    const key = S.selUnit || 'hero';
    const uname = key === 'hero' ? (g.heroName || (RACE[g.race].name + '道友')) : (DATA.PARTNERS.find(x => x.id === g.partners.find(p => p.iid === key).pid).name);
    let html = '<div class="sec-title">装备配置 <span class="muted">' + uname + '</span></div>';
    html += '<div class="card"><div class="eq-worn">';
    equipSlots().forEach(sid => {
      const sl = DATA.SLOTS.find(s => s.id === sid);
      const eq = g.equipment.find(x => x.slot === sid && g.equipped[x.iid] === key);
      const q = eq ? DATA.QMAP[eq.quality] : 0;
      const style = eq ? ' style="border-color:' + qColor(q) + '"' : '';
      const cls = 'eq-slot-line' + (eq ? ' filled' : '');
      const inner = eq ? '<span class="eq-slot-name" style="color:' + qColor(q) + '">' + sl.name + '</span><span class="eq-q" style="color:' + qColor(q) + '">' + eq.quality + '</span>' : '<span class="eq-slot-name">' + sl.name + '</span><span class="eq-q dim">空</span>';
      html += '<div class="' + cls + '" data-slotopen="' + sid + '"' + style + '>' + inner + '</div>';
    });
    html += '</div><div class="dim mt8">点击部位：查看属性/强化/精炼/附魔/换装。</div></div>';
    return html;
  }
  function equipInventoryHtml(g, clickable) {
    let html = '<div class="card"><div class="sec-title" style="margin:0">装备库 <span class="muted">' + g.equipment.length + ' 件 · 已选 ' + Object.keys(S.eqSel).filter(k => S.eqSel[k]).length + '</span></div>';
    html += '<div class="eq-toolbar">';
    html += '<button class="btn btn-sm ' + (S.eqFilter === '' ? 'btn-gold' : '') + '" data-act="eqfilter" data-a="">全部</button>';
    for (let q = 1; q <= 5; q++) html += '<button class="btn btn-sm ' + (S.eqFilter === q ? 'btn-gold' : '') + '" data-act="eqfilter" data-a="' + q + '" style="color:' + qColor(q) + ';border-color:currentColor">' + C.colorName(q) + '</button>';
    html += '<button class="btn btn-sm btn-green" data-act="eqselall">全选</button>';
    html += '<button class="btn btn-sm btn-blue" data-act="eqsell">一键出售</button>';
    html += '<button class="btn btn-sm btn-red" data-act="eqdecom">一键分解</button>';
    html += '</div>';
    const list = g.equipment.filter(e => !S.eqFilter || DATA.QMAP[e.quality] === S.eqFilter);
    if (!list.length) html += '<div class="dim mt8">暂无符合的装备。</div>';
    list.forEach(e => {
      const q = DATA.QMAP[e.quality];
      const sl = DATA.SLOTS.find(s => s.id === e.slot);
      const on = !!g.equipped[e.iid];
      const checked = S.eqSel[e.iid] ? ' checked' : '';
      html += '<div class="eq-row' + (on ? ' worn' : '') + '"' + (clickable ? ' data-eqopen="' + e.iid + '"' : '') + '><label class="eq-check"><input type="checkbox" data-eqsel="' + e.iid + '"' + checked + '></label>' +
        '<span class="eq-name" style="color:' + qColor(q) + '"><b class="' + QCOLOR[q] + '">' + sl.name + '·' + e.quality + '</b>' + (on ? '<span class="green"> 已穿</span>' : '') + '</span>' +
        '<span class="eq-meta">强化' + e.enh + ' 精炼' + e.ref + ' 附魔' + e.fumo + '</span>' +
        '<span class="eq-stat">' + equipStatName(e.slot) + '+' + equipStatVal(e) + '</span>' +
        (clickable ? '<span class="eq-go">✎</span>' : '') + '</div>';
    });
    html += '</div>';
    return html;
  }
  function renderEquipModal() {
    const old = document.getElementById('equip-modal');
    if (old) old.remove();
    if (!S.equipModal) return;
    const g = S.game;
    const slot = S.equipModal;
    const sl = DATA.SLOTS.find(s => s.id === slot);
    const key = S.selUnit || 'hero';
    const worn = g.equipment.find(x => x.slot === slot && g.equipped[x.iid] === key);
    const targetName = (key === 'hero') ? (g.heroName || (RACE[g.race].name + '道友')) : (() => { const p = g.partners.find(x => x.iid === key); return p ? DATA.PARTNERS.find(x => x.id === p.pid).name : ''; })();
    let detail;
    if (worn) {
      const q = DATA.QMAP[worn.quality];
      detail = '<div class="eq-modal-title" style="color:' + qColor(q) + '">' + sl.name + ' · ' + worn.quality + '</div>' +
        '<div class="eq-modal-stat">' + equipStatName(slot) + ' +' + equipStatVal(worn) + ' <span class="dim">强化' + worn.enh + ' 精炼' + worn.ref + ' 附魔' + worn.fumo + (worn.set ? ' · ' + worn.set : '') + '</span></div>' +
        '<div class="eq-modal-btns"><button class="btn btn-sm" data-act="enh" data-a="' + worn.iid + '">强化</button><button class="btn btn-sm" data-act="ref" data-a="' + worn.iid + '">精炼</button><button class="btn btn-sm" data-act="fum" data-a="' + worn.iid + '">附魔</button></div>';
    } else {
      detail = '<div class="eq-modal-title">' + sl.name + '（空）</div><div class="dim">该部位暂无装备，可更换装备。</div>';
    }
    let changeHtml = '';
    if (S.eqChange) {
      const avail = g.equipment.filter(x => x.slot === slot);
      changeHtml = '<div class="eq-change"><div class="dim">选择装备穿戴到 ' + targetName + '：</div>';
      if (!avail.length) changeHtml += '<div class="dim">暂无该部位装备</div>';
      avail.forEach(e => {
        const q = DATA.QMAP[e.quality];
        const owner = g.equipped[e.iid];
        let whoTxt = '';
        if (owner === key) whoTxt = '<span class="green"> 已穿</span>';
        else if (owner) { const op = g.partners.find(x => x.iid === owner); whoTxt = '<span class="dim"> 穿于 ' + (owner === 'hero' ? (g.heroName || '主角') : (op ? (DATA.PARTNERS.find(x => x.id === op.pid) || {}).name || '' : '')) + '</span>'; }
        changeHtml += '<div class="eq-change-item" data-emwear="' + e.iid + '" style="color:' + qColor(q) + '">' + sl.name + '·' + e.quality + ' ' + equipStatName(slot) + '+' + equipStatVal(e) + whoTxt + '</div>';
      });
      changeHtml += '</div>';
    }
    const d = document.createElement('div');
    d.id = 'equip-modal';
    d.className = 'eq-modal';
    d.innerHTML = '<div class="eq-modal-card">' + detail +
      '<div class="eq-modal-btns mt8">' + (worn ? '<button class="btn btn-sm btn-red" data-act="emunequip">卸下装备</button>' : '') + '<button class="btn btn-sm btn-blue" data-act="emchange">更换装备</button><button class="btn btn-sm" data-act="emclose">关闭</button></div>' +
      changeHtml + '</div>';
    document.body.appendChild(d);
  }
  function renderVipModal() {
    const old = document.getElementById('vip-modal');
    if (old) old.remove();
    const g = S.game;
    const lv = g.vip || 0;
    if (lv < 1) { toast('未开通VIP，请联系作者兑换激活码'); return; }
    const d = document.createElement('div');
    d.id = 'vip-modal';
    d.className = 'vip-modal';
    d.innerHTML = '<div class="vip-card"><div class="vip-modal-title">VIP' + lv + ' 特权</div>' +
      '<div class="vip-bonus">角色与道友：攻击 / 生命 / 物防 / 法防 +' + lv + '%</div>' +
      '<div class="vip-bonus">挂机获得：铜钱 / 修为 +' + lv + '%</div>' +
      '<div class="vip-bonus">招募概率：蓝 39% · 紫 40% · 金 18.5% · 红 2.5%</div>' +
      '<button class="btn btn-sm" data-act="closevip">关闭</button></div>';
    document.body.appendChild(d);
  }

  // ---------- 次元空间 ----------
  function renderDimension(v) {
    const g = S.game;
    const tabs = [['items', '物品'], ['equip', '装备'], ['partner', '道友'], ['fabao', '法宝']];
    let html = '<div class="sec-title">次元空间</div>';
    html += '<div class="sec-tabs">';
    tabs.forEach(t => { html += '<button class="btn ' + (S.dimSub === t[0] ? 'btn-gold' : '') + '" data-act="dimsub" data-a="' + t[0] + '">' + t[1] + '</button>'; });
    html += '</div>';
    const key = S.dimSub === 'equip' ? dimEquipHtml(g) : S.dimSub === 'partner' ? dimPartnerHtml(g) : S.dimSub === 'fabao' ? dimFabaoHtml(g) : dimItemsHtml(g);
    html += key;
    v.innerHTML = html;
  }
  function dimItemsHtml(g) {
    let html = '<div class="card"><div class="sec-title" style="margin:0">物品 <span class="muted">持有道具一览</span></div>';
    const keys = Object.keys(g.items).filter(k => (g.items[k] || 0) > 0);
    if (!keys.length) html += '<div class="dim mt8">暂无物品</div>';
    keys.forEach(k => {
      const use = ['聚元丹', '聚灵丹', '功法·秘籍', '1品炼丹炉·玄铁丹炉', '1品锻造炉·黑铁锻炉'].includes(k) ? '<button class="btn btn-sm btn-green" data-act="use" data-a="' + k + '">使用</button>' : '';
      html += '<div class="shop-item"><span>' + k + '</span><span><b class="gold">×' + (g.items[k] || 0) + '</b> ' + use + '</span></div>';
    });
    html += '</div>';
    return html;
  }
  function dimEquipHtml(g) {
    return equipInventoryHtml(g, false);
  }
  function dimPartnerHtml(g) {
    let html = '<div class="card"><div class="sec-title" style="margin:0">道友 <span class="muted">共 ' + g.partners.length + ' 位</span></div>';
    if (!g.partners.length) html += '<div class="dim mt8">暂无敌友，用招募令或紫气招募。</div>';
    g.partners.forEach(p => {
      const tpl = DATA.PARTNERS.find(x => x.id === p.pid);
      const st = C.unitStats(g, p.iid) || { atk: 0, hp: 0 };
      const inF = g.formation.includes(p.iid), inJ = g.juling.includes(p.iid);
      html += '<div class="partner-card"><div class="p-cardleft" style="color:' + qColor(tpl.q) + ';border-color:currentColor">' + tpl.el + '</div>' +
        '<div class="p-cardmid"><h4 style="color:' + qColor(tpl.q) + '">' + tpl.name + ' <span class="tag">' + C.colorName(tpl.q) + '</span></h4>' +
        '<small>' + ROLES[tpl.role] + ' · ' + C.partnerRealmLabel(p) + ' · ★' + p.stars + ' · 攻' + F(st.atk) + ' 生命' + Math.round(st.hp) + '</small></div>' +
        '<div class="p-btncol"><button class="btn btn-sm ' + (inF ? 'btn-red' : 'btn-green') + '" data-act="fld" data-a="' + p.iid + '">' + (inF ? '下阵' : '上阵') + '</button><br>' +
        '<button class="btn btn-sm mt8 ' + (inJ ? 'btn-red' : 'btn-blue') + '" data-act="jld" data-a="' + p.iid + '">' + (inJ ? '移出' : '聚灵') + '</button><br>' +
        '<button class="btn btn-sm mt8" data-act="tribp" data-a="' + p.iid + '">渡劫</button><br>' +
        '<button class="btn btn-sm mt8 btn-red" data-act="dismiss" data-a="' + p.iid + '">遣散</button></div></div>';
    });
    html += '</div>';
    return html;
  }
  function dimFabaoHtml(g) {
    let html = '<div class="card"><div class="sec-title" style="margin:0">法宝 <span class="muted">碎片合成·强力被动·上限3件</span></div>';
    html += '<div class="row"><div><b class="gold">已装备</b></div></div><div class="dim mt8">';
    if (g.equippedFabao.length) html += g.equippedFabao.map(x => DATA.FABAO[x].name).join('、');
    else html += '暂无法宝';
    html += '</div>';
    Object.keys(DATA.FABAO).forEach(fid => {
      const f = DATA.FABAO[fid];
      const have = g.items['法宝碎片·' + f.name] || 0;
      const owned = (g.fabao.find(x => x.id === fid) || {}).count || 0;
      const eq = g.equippedFabao.includes(fid);
      html += '<div class="shop-item"><span><b class="gold">' + f.name + '</b> <span class="dim">' + f.desc + '</span></span><span><span class="dim">碎片' + have + '/' + f.frag + ' · 持有' + owned + '</span><button class="btn btn-sm' + (have >= f.frag ? ' btn-gold' : '') + '" data-act="craft" data-a="' + fid + '">合成</button> ' + (eq ? '<span class="green">已装备</span>' : '<button class="btn btn-sm" data-act="fab" data-a="' + fid + '">装备</button>') + '</span></div>';
    });
    html += '</div>';
    return html;
  }

  // ---------- 装备 / 法宝 ----------
  function renderEquip() {
    const g = S.game;
    const unitKey = S.equipUnit;
    const unitName = unitKey === 'hero' ? '主角' : (g.partners.find(p => p.iid === unitKey) ? DATA.PARTNERS.find(x => x.id === g.partners.find(p => p.iid === unitKey).pid).name : '?');
    let html = '<div class="sec-title">装备 · 法宝</div>';
    // 单位选择
    html += '<div class="sec-tabs"><button class="btn ' + (unitKey === 'hero' ? 'btn-gold' : '') + '" data-act="equnit" data-a="hero">主角</button>';
    g.formation.forEach(iid => { const p = g.partners.find(x => x.iid === iid); if (!p) return; const tpl = DATA.PARTNERS.find(x => x.id === p.pid); html += '<button class="btn ' + (unitKey === iid ? 'btn-gold' : '') + '" data-act="equnit" data-a="' + iid + '">' + tpl.name + '</button>'; });
    html += '</div>';
    html += '<div class="card"><div class="row"><div><b class="gold">' + unitName + ' 装备</b></div><span class="dim">品质：白绿蓝紫金红</span></div>';
    // 已装备槽
    DATA.SLOTS.forEach(sl => {
      const e = g.equipment.find(x => x.iid && g.equipped[x.iid] === unitKey && x.slot === sl.id);
      if (e) {
        html += '<div class="eq-slot filled" data-act="einfo" data-a="' + e.iid + '"><div class="row"><div><b class="' + QCOLOR[DATA.QMAP[e.quality]] + '">' + sl.name + '·' + e.quality + '</b> <span class="dim">+' + e.enh + ' / 精炼' + e.ref + ' / 附魔' + e.fumo + '</span></div><span class="dim">' + (e.set || '') + '</span></div></div>';
      } else {
        html += '<div class="eq-slot"><span class="dim">' + sl.name + '（空）</span></div>';
      }
    });
    html += '</div>';
    // 装备库
    html += '<div class="sec-title">装备库 <span class="muted">共 ' + g.equipment.length + ' 件</span></div>';
    if (!g.equipment.length) html += '<div class="card dim">暂无装备，挂机主线掉落或仙府·器宝锻造。</div>';
    g.equipment.forEach(e => {
      const equ = g.equipped[e.iid];
      const on = equ ? (equ === unitKey ? '<span class="green">（已装备于' + unitName + '）</span>' : '<span class="muted">（装备于他人）</span>') : '';
      html += '<div class="shop-item"><span><b class="' + QCOLOR[DATA.QMAP[e.quality]] + '">' + DATA.SLOTS.find(s => s.id === e.slot).name + '·' + e.quality + '</b> ' + (e.set ? '<span class="tag">' + e.set + '</span>' : '') + ' 强化' + e.enh + ' 精炼' + e.ref + ' 附魔' + e.fumo + '</span><span>' + on + '<button class="btn btn-sm btn-green" data-act="eq" data-a="' + e.iid + '">装备</button> <button class="btn btn-sm" data-act="enh" data-a="' + e.iid + '">强化</button> <button class="btn btn-sm" data-act="ref" data-a="' + e.iid + '">精炼</button> <button class="btn btn-sm" data-act="fum" data-a="' + e.iid + '">附魔</button> <button class="btn btn-sm btn-red" data-act="dec" data-a="' + e.iid + '">分解</button></span></div>';
    });
    // 法宝
    html += '<div class="sec-title">法宝 <span class="muted">碎片合成·强力被动·上限3件</span></div>';
    html += '<div class="card"><div class="row"><div><b class="gold">已装备法宝</b></div></div><div class="dim">';
    if (g.equippedFabao.length) html += g.equippedFabao.map(x => DATA.FABAO[x].name).join('、');
    else html += '暂无法宝';
    html += '</div></div>';
    Object.keys(DATA.FABAO).forEach(fid => {
      const f = DATA.FABAO[fid];
      const have = g.items['法宝碎片·' + f.name] || 0;
      const owned = (g.fabao.find(x => x.id === fid) || {}).count || 0;
      const eq = g.equippedFabao.includes(fid);
      html += '<div class="shop-item"><span><b class="gold">' + f.name + '</b> <span class="dim">' + f.desc + '</span></span><span><span class="dim">碎片' + have + '/' + f.frag + ' · 持有' + owned + '</span><button class="btn btn-sm' + (have >= f.frag ? ' btn-gold' : '') + '" data-act="craft" data-a="' + fid + '">合成</button> <button class="btn btn-sm" data-act="fab" data-a="' + fid + '" disabled>装备</button></span></div>';
    });
    return html;
  }

  // ---------- 副本 ----------
  function renderDungeon(v) {
    const g = S.game;
    const d = g.dungeons;
    let html = '<div class="sec-title">副本 · 挑战</div>';
    // 主线
    html += '<div class="card"><div class="row"><div><b class="gold">主线·成仙之路</b></div><span class="tag">第 ' + g.mainline.stage + ' 关</span></div><div class="dim mt8">无限爬塔推关；打不过就回仙府/副本提升实力。</div><div class="toolbar"><button class="btn btn-gold btn-sm" data-act="push">挑战</button></div></div>';
    // 水月洞天
    html += '<div class="card"><div class="row"><div><b class="blue">水月洞天</b> <span class="dim">打boss刷法宝碎片+紫气</span></div></div><div class="row mt8"><span class="muted">当前首领 ' + (d.shuiyue.bestBoss || 0) + ' 阶</span><button class="btn btn-sm btn-blue" data-act="dungeon" data-a="shuiyue">挑战</button></div></div>';
    // 五行山
    html += '<div class="card"><div class="row"><div><b class="purple">五行山挑战</b> <span class="dim">五行克制副本，拿五行材料</span></div></div><div class="row mt8"><span class="muted">已通 ' + d.wuxing.bestStage + '/20 层</span><button class="btn btn-sm btn-blue" data-act="dungeon" data-a="wuxing">挑战</button></div><div class="dim">敌人五行克制我方，记得切换主力五行属性！</div></div>';
    // 日常
    html += '<div class="sec-title">每日副本（扫荡）</div>';
    DATA.DAILY.forEach(dd => {
      const left = d.daily[dd.id];
      html += '<div class="shop-item"><span>' + dd.name + ' <span class="dim">今日' + left + '/3次</span></span><button class="btn btn-sm btn-green" data-act="daily" data-a="' + dd.id + '" ' + (left <= 0 ? 'disabled' : '') + '>扫荡</button></div>';
    });
    // 战报
    html += '<div class="sec-title">战报</div><div id="battle-log-d" class="battle-log"></div>';
    v.innerHTML = html;
    renderLog('#battle-log-d', S.logDungeon);
  }

  // ---------- 商店 ----------
  function renderShop(v) {
    const g = S.game;
    const shops = DATA.SHOPS;
    let html = '<div class="sec-title">仙宝阁</div><div class="sec-tabs">';
    Object.keys(shops).forEach(k => { html += '<button class="btn ' + (S.shop === k ? 'btn-gold' : '') + '" data-act="shop" data-a="' + k + '">' + shops[k].name + '</button>'; });
    html += '</div>';
    const shop = shops[S.shop];
    const curName = { copper: '铜钱', ziqi: '鸿蒙紫气', wuxing: '五行币', qiongjiang: '琼浆玉液', fabao: '法宝碎片' }[shop.currency];
    html += '<div class="card"><div class="row"><div><b class="gold">' + shop.name + '</b></div><span class="muted">持有 <b class="gold">' + F(g.res[shop.currency]) + '</b> ' + curName + '</span></div></div>';
    shop.goods.forEach(gd => {
      const limitStr = gd.limit ? '（限购' + gd.limit + '）' : '';
      html += '<div class="shop-item"><span>' + gd.item + (gd.qty > 1 ? ' x' + gd.qty : '') + '</span><span><span class="price">' + gd.price + ' ' + curName + '</span><button class="btn btn-sm btn-blue" data-act="buy" data-a="' + S.shop + '" data-b="' + gd.id + '">购买' + limitStr + '</button></span></div>';
    });
    if (!shop.goods.length) html += '<div class="card dim mt8">暂无商品 · 敬请期待</div>';
    v.innerHTML = html;
  }

  // ---------- 设置 ----------
  function renderSettings(v) {
    const g = S.game;
    v.innerHTML = '<div class="sec-title">更多</div>' +
      '<div class="card"><div class="sec-title" style="margin:0">玩法要诀</div><div class="help-block">' +
      '<p><b>【循环】</b>挂机攒资源 → 仙府/道友/装备/功法 → 推主线 → 副本/活动 → 渡劫突破 → 冲击更高关卡。</p>' +
      '<p><b>【种族】</b>人族控制、魔族爆发、龙人肉盾、精灵续航，玩法各异。</p>' +
      '<p><b>【战斗】</b>回合文字战斗。看速度、控制（晕/冻/沉默）、治疗、五行克制。<b>硬扛打不过，要靠先手控住敌人。</b></p>' +
      '<p><b>【仙府】</b>资源根基。灵脉决定主角品质；灵根、法阵、聚灵阵、功法、乾坤殿全面提升。</p>' +
      '<p><b>【渡劫】</b>每大境界20小层，每层与破大境都需渡劫。炼气成功率95%，每提升一大境界-10%；失败损失“本阶段所需修为”的10%起、每大境界+10%；渡劫丹每次渡劫最多1颗、+8%成功率。</p>' +
      '<p><b>【道友】</b>招募令/紫气抽卡，蓝紫金红；多余道友进聚灵阵加成全队。</p>' +
      '<p><b>【灵石】</b>水月洞天刷法宝碎片、五行山拿五行石、每日副本扫荡。</p>' +
      '</div></div>' +
      '<div class="card"><div class="sec-title" style="margin:0">兑换激活码</div>' +
      '<div class="row mt8"><input id="redeem-input" class="name-input" placeholder="输入一次性激活码"><button class="btn btn-gold" data-act="redeem">确定</button></div>' +
      '<div class="dim mt8">向作者领取激活码，输入后点“确定”即可获得对应物品（一次性，过期/用过即失效）。</div></div>' +
      '<div class="card"><div class="row"><div><b class="gold">存档导出</b></div><button class="btn btn-sm" data-act="export">复制存档</button></div><div class="dim mt8">把这段字符串发给朋友可在其设备继续玩。</div></div>' +
      '<div class="card"><div class="row"><div><b class="gold">存档导入</b></div><button class="btn btn-sm" data-act="import">粘贴导入</button></div></div>' +
      '<div class="card"><div class="row"><div><b class="red">重置进度</b></div><button class="btn btn-sm btn-red" data-act="reset">重置</button></div></div>' +
      '<div class="card dim">菜鸡修仙传 · 纯文字MUD放置修仙 · 策略战斗<br>离线收益上限12小时 · 存档保存在本地浏览器</div>';
  }

  // ---------- 动作 ----------
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.remove('hide');
    clearTimeout(toast._h);
    toast._h = setTimeout(() => t.classList.add('hide'), 2200);
  }

  function runMainline(cb, n) {
    let count = 0;
    for (let i = 0; i < (n || 1); i++) {
      const r = C.challengeMainline(S.game, (line) => addLog('main', line.msg, 'bl-' + line.cls));
      S.battleRounds = (r.res && r.res.rounds) || 0;
      if (r.ok) {
        count++;
        addLog('main', '✔ 通关第 ' + r.stage + ' 关，修为+' + F(r.reward.xiuwei) + ' 铜钱+' + F(r.reward.copper), 'bl-system');
      } else {
        addLog('main', (r.res && r.res.timeout) ? '✘ 30回合未击破敌人，挑战失败，退回第 ' + S.game.mainline.stage + ' 关' : '✘ 第 ' + r.stage + ' 关挑战失败，队伍实力不足', 'bl-system');
        break;
      }
    }
    if (cb) cb(count);
  }

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  function popDamage(slot, text, crit, heal) {
    const d = document.createElement('div');
    d.className = 'dmg-pop' + (crit ? ' crit' : '') + (heal ? ' heal' : '');
    d.textContent = text;
    slot.appendChild(d);
    setTimeout(() => d.remove(), 900);
  }
  // 战斗动画：按事件回放，站位碰撞 + 伤害/暴击飘字 + 回合计数
  async function playBattle(events, onDone, outcome) {
    const bf = document.querySelector('.battle-field');
    if (!bf) { if (onDone) onDone(); return; }
    S.animating = true;
    // 每场新战斗：能量从 0 开始
    bf.querySelectorAll('.slot:not(.empty)').forEach(slot => {
      slot.__energy = 0;
      const bar = slot.querySelector('.slot-energy i');
      if (bar) bar.style.width = '0%';
    });
    const roundEl = bf.querySelector('.bf-round');
    const slotEl = (side, idx) => bf.querySelector('[data-side="' + side + '"][data-idx="' + idx + '"]');
    const adjustHp = (el, delta) => {
      const mh = parseFloat(el.dataset.maxh) || 1;
      let cur = parseFloat(el.dataset.hp) || mh;
      cur = Math.max(0, Math.min(mh, cur + delta));
      el.dataset.hp = cur;
      const bar = el.querySelector('.slot-hp i');
      if (bar) bar.style.width = (cur / mh * 100) + '%';
      const numEl = el.querySelector('.slot-hp-num');
      if (numEl) numEl.textContent = Math.round(cur);
      const hpEl = el.querySelector('.slot-hp');
      if (hpEl) hpEl.classList.toggle('low', (cur / mh) < 0.30);
      el.classList.toggle('dead', cur <= 0);
    };
    for (const ev of events) {
      if (S.cancelBattle) { S.cancelBattle = false; S.animating = false; return; }
      if (ev.type === 'round') {
        if (roundEl) roundEl.textContent = '第 ' + (S.battleStage || (S.game && S.game.mainline.stage) || '') + ' 关 · ' + ev.n + '/30回合';
        await sleep(150); continue;
      }
      const aSide = ev.team === 'ally' ? 0 : 1;
      const aEl = slotEl(aSide, ev.idx);
      if (aEl) aEl.classList.add(aSide === 0 ? 'lunge-right' : 'lunge-left');
      (ev.targets || []).forEach(t => {
        const tSide = t.team === 'ally' ? 0 : 1;
        const tEl = slotEl(tSide, t.idx);
        if (!tEl) return;
        if (ev.type === 'dmg') { if (t.dmg > 0) { popDamage(tEl, '-' + F(t.dmg), t.crit, false); adjustHp(tEl, -t.dmg); } else if (t.miss) { popDamage(tEl, '闪避', false, false); } }
        else if (ev.type === 'heal') { popDamage(tEl, '+' + F(t.amount), false, true); adjustHp(tEl, t.amount); }
      });
      if (ev.type === 'buff' && aEl) { aEl.classList.add('buff-flash'); setTimeout(() => aEl.classList.remove('buff-flash'), 450); }
      await sleep(330);
      if (S.cancelBattle) { S.cancelBattle = false; S.animating = false; return; }
      if (aEl) aEl.classList.remove('lunge-right', 'lunge-left');
    }
    if (outcome && bf) {
      const res = document.createElement('div');
      res.className = 'bf-result ' + (outcome === 'win' ? 'win' : 'lose');
      res.textContent = outcome === 'win' ? '胜！' : outcome === 'lose' ? '败…' : '超时·退回';
      bf.appendChild(res);
      await sleep(750);
      if (res.parentNode) res.remove();
    }
    S.animating = false;
    if (onDone) onDone();
  }

  // 渡劫破境全屏动画：雷电交加 → 五彩神光自地面冲天 → 苍穹冲击波
  function playCine() {
    if (document.getElementById('tribcine')) return;
    let streaks = '';
    for (let i = 0; i < 12; i++) streaks += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%; animation-delay:' + (4.6 + Math.random() * 1.1).toFixed(2) + 's"></i>';
    let bolts = '';
    for (let i = 0; i < 4; i++) {
      const l = (8 + Math.random() * 84).toFixed(1);
      const h = Math.round(150 + Math.random() * 150);
      const d = (Math.random() * 0.7).toFixed(2);
      bolts += '<svg class="tc-bolt" style="left:' + l + '%; height:' + h + 'px; animation-delay:' + d + 's" width="46" viewBox="0 0 42 200"><polyline points="16,0 34,60 10,72 32,150 18,200" fill="none" stroke="#d6e8ff" stroke-width="3.5"/></svg>';
    }
    const mask = el('<div id="tribcine" class="tribcine"><div class="tc-ray"></div><div class="tc-flash"></div>' + bolts +
      '<div class="tc-beam"></div>' +
      '<div class="tc-burst"></div><div class="tc-shock"></div>' +
      '<div class="tc-streaks">' + streaks + '</div>' +
      '<div class="tc-text"><div class="tc-title">渡劫成功</div></div></div>');
    document.body.appendChild(mask);
    setTimeout(() => { if (mask) mask.classList.add('fade-out'); }, 8900);
    setTimeout(() => { if (mask && mask.parentNode) mask.remove(); }, 9700);
  }

  const act = {
'push': function () {
  if (S.animating) return;
  S.battleMode = 'push';
  const r = C.challengeMainline(S.game, (line) => addLog('main', line.msg, 'bl-' + line.cls));
      S.battleRounds = (r.res && r.res.rounds) || 0;
      S.battleStage = r.stage;
      if (r.ok) addLog('main', '✔ 通关第 ' + r.stage + ' 关，修为+' + F(r.reward.xiuwei) + ' 铜钱+' + F(r.reward.copper), 'bl-system');
      playBattle((r.res && r.res.events) || [], () => { C.save(S.game); render(); if (r.ok) showReward(r.reward); }, r.ok ? 'win' : 'lose');
    },
    'auto': function () {
      if (S.game.mainline.stage < 30) { toast('自动推关需先通关第30关后解锁'); return; }
      S.autoPush = !S.autoPush; C.save(S.game); render();
    },
    'formation': function () {
      const g = S.game;
      if (!S.formMode) {
        // 进入布阵模式（暂停战斗）
        if (S.animating) S.cancelBattle = true;
        S.formMode = true;
        S.swapFrom = null;
        render();
        toast('布阵模式：点击两个道友即可互换位置');
      } else {
        // 退出布阵模式并重新开战当前关卡
S.formMode = false;
S.swapFrom = null;
render();
S.battleMode = 'farm';
const r = C.farmMainline(g, (line) => addLog('main', line.msg, 'bl-' + line.cls));
        S.battleRounds = (r.res && r.res.rounds) || 0;
        S.battleStage = r.stage;
        playBattle((r.res && r.res.events) || [], () => { C.save(g); render(); if (r.ok) showReward(r.reward); }, r.ok ? 'win' : 'lose');
      }
    },
    'swap': function (a) {
      const g = S.game;
      if (S.swapFrom === a) { S.swapFrom = null; render(); return; }
      if (!S.swapFrom) { S.swapFrom = a; render(); toast('已选中，再点另一个道友互换'); return; }
      const i1 = g.formation.indexOf(S.swapFrom), i2 = g.formation.indexOf(a);
      if (i1 >= 0 && i2 >= 0) { const t = g.formation[i1]; g.formation[i1] = g.formation[i2]; g.formation[i2] = t; }
      S.swapFrom = null;
      C.recomputeStats(g); C.save(g);
      render();
      toast('已互换位置');
    },
    'sel': function (a) { S.selUnit = a; render(); },
    'vip': function () { renderVipModal(); },
    'closevip': function () { const m = document.getElementById('vip-modal'); if (m) m.remove(); },
    'cine': function () { playCine(); },
    'layerup': function () {
      const r = C.breakthroughLayer(S.game, S.autoPill || S.singlePill);
      S.singlePill = false;
      toast(r.msg); if (r.ok) { addLog('main', r.msg, 'bl-system'); C.save(S.game); }
      render();
    },
    'sum': function (a) {
      const n = +a || 1;
      const g = S.game;
      let used = null;
      if (n === 1) {
        if ((g.items['招募令'] || 0) >= 1) { C.takeItem(g, '招募令', 1); used = '招募令×1'; }
        else if (g.res.ziqi >= 200) { g.res.ziqi -= 200; used = '紫气200'; }
        else { toast('单抽需1招募令或200鸿蒙紫气'); return; }
      } else {
        if (g.res.ziqi >= 1800) { g.res.ziqi -= 1800; used = '紫气1800'; }
        else { toast('十连需1800鸿蒙紫气'); return; }
      }
      const res = C.summon(g, null, n);
      const summary = res.map(r => r.label).join(' / ');
      toast('消耗' + used + '，获得：' + summary.slice(0, 90));
      C.save(g); render();
    },
    'sumfree': function () {
      const g = S.game;
      if (Date.now() < (g.freeSummonAt || 0)) { toast('免费抽奖冷却中'); return; }
      g.freeSummonAt = Date.now() + 8 * 3600 * 1000;
      const res = C.summon(g, null, 1);
      toast('免费单抽：' + res[0].label);
      C.save(g); render();
    },
    'trib': function () {
      const r = C.tribulate(S.game, S.autoPill || S.singlePill);
      S.singlePill = false;
      if (r.ok) playCine();
      toast(r.msg);
      addLog('main', r.msg, r.ok ? 'bl-system' : 'bl-dmg');
      C.save(S.game); render();
    },
    'usepill': function () {
      if ((S.game.items['渡劫丹'] || 0) < 1) { toast('没有渡劫丹'); return; }
      S.singlePill = true;
      toast('已装备1颗渡劫丹：下次渡劫自动使用（+8%成功率）');
      render();
    },
    'autopill': function () {
      S.autoPill = !S.autoPill;
      toast(S.autoPill ? '已开启：每次渡劫自动使用渡劫丹' : '已关闭自动使用渡劫丹');
      render();
    },
    'msub': function (a) { S.manorSub = a; render(); },
    'qksub': function (a) { S.qiankunSub = a; render(); },
    'train': function (a, b) { const r = C.startTrain(S.game, a, +b); toast(r.msg); if (r.ok) C.save(S.game); render(); },
    'wxadd': function (a) {
      const g = S.game;
      if (g.formation.includes(a)) { toast('上阵中的道友请先下阵，才能放入万象化宇'); return; }
      const wx = C.wanxiangBonus(g);
      if (g.wanxiang.includes(a)) return;
      if (g.wanxiang.length >= wx.slots) { toast('万象化宇已满，升级可加位置'); return; }
      g.wanxiang.push(a); C.recomputeStats(g); C.save(g); render();
    },
    'wxrm': function (a) { const g = S.game; g.wanxiang = g.wanxiang.filter(x => x !== a); C.recomputeStats(g); C.save(g); render(); },
    'mup': function (a) { const r = C.upgradeManor(S.game, a); toast(r.msg); if (r.ok) { C.save(S.game); } render(); },
    'alc': function (a) { const r = C.alchemy(S.game, a); toast(r.msg); if (r.ok) C.save(S.game); render(); },
    'use': function (a) { const r = C.useItem(S.game, a); toast(r.msg); if (r.ok) C.save(S.game); render(); },
    'forge': function () { const r = C.forgeEquip(S.game); toast(r.msg); if (r.ok) C.save(S.game); render(); },
    'tribp': function (a) { const r = C.partnerTribulate(S.game, a, S.autoPill || S.singlePill); S.singlePill = false; toast(r.msg); if (r.ok) { C.save(S.game); render(); } },
    'dismiss': function (a) {
      const g = S.game;
      const p = g.partners.find(x => x.iid === a);
      if (!p) return;
      const worn = Object.keys(g.equipped).filter(k => g.equipped[k] === a).length;
      if (!confirm('确定遣散「' + DATA.PARTNERS.find(x => x.id === p.pid).name + '」吗？' + (worn ? '身上 ' + worn + ' 件装备将退回背包。' : ''))) { toast('已取消'); return; }
      const r = C.dismissPartner(g, a);
      toast(r.msg);
      if (r.ok) { C.save(g); render(); }
    },
    'fld': function (a) {
      const g = S.game;
      if (g.formation.includes(a)) { g.formation = g.formation.filter(x => x !== a); }
else {
if (g.formation.length >= 6) { toast('上阵已满（最多6位）'); return; }
if (a !== 'hero' && g.juling.includes(a)) g.juling = g.juling.filter(x => x !== a);
if (a !== 'hero' && g.wanxiang.includes(a)) g.wanxiang = g.wanxiang.filter(x => x !== a);
g.formation.push(a);
}
      C.recomputeStats(g); C.save(g); render();
    },
    'jld': function (a) {
      const g = S.game;
      if (g.juling.includes(a)) { g.juling = g.juling.filter(x => x !== a); }
      else {
        if (g.formation.includes(a)) { toast('上阵中的道友请先下阵，才能放入聚灵阵'); return; }
        if (g.juling.length >= 3) { toast('聚灵阵最多容3位闲置道友'); return; }
        g.juling.push(a);
      }
      C.recomputeStats(g); C.save(g); render();
    },
    'equnit': function (a) { S.equipUnit = a; render(); },
    'eq': function (a) { const r = C.equipTo(S.game, a, S.selUnit || 'hero'); toast(r.msg); if (r.ok) C.save(S.game); render(); if (S.equipModal) renderEquipModal(); },
    'enh': function (a) { const r = C.enhanceEquip(S.game, a); toast(r.msg); if (r.ok) C.save(S.game); render(); if (S.equipModal) renderEquipModal(); },
    'ref': function (a) { const r = C.refineEquip(S.game, a); toast(r.msg); if (r.ok) C.save(S.game); render(); if (S.equipModal) renderEquipModal(); },
    'fum': function (a) { const r = C.fumoEquip(S.game, a); toast(r.msg); if (r.ok) C.save(S.game); render(); if (S.equipModal) renderEquipModal(); },
    'dec': function (a) { const r = C.decomposeEquip(S.game, a); toast(r ? '分解获得材料' : '请先卸下'); if (r) { C.save(S.game); if (S.equipModal) S.equipModal = null; } render(); },
    'sell': function (a) { const r = C.sellEquip(S.game, a); toast(r.msg); if (r.ok) { C.save(S.game); if (S.equipModal) S.equipModal = null; } render(); },
    'eqfilter': function (a) { S.eqFilter = a === '' ? '' : +a; render(); },
    'eqselall': function () { const g = S.game; const list = g.equipment.filter(e => !S.eqFilter || DATA.QMAP[e.quality] === S.eqFilter); const all = list.length > 0 && list.every(e => S.eqSel[e.iid]); list.forEach(e => S.eqSel[e.iid] = !all); render(); },
    'eqsell': function () { const g = S.game; let n = 0, copper = 0; Object.keys(S.eqSel).forEach(k => { if (S.eqSel[k]) { const r = C.sellEquip(g, k); if (r.ok) { n++; copper += r.copper || 0; } } }); S.eqSel = {}; if (S.equipModal) S.equipModal = null; toast('出售 ' + n + ' 件，铜钱 +' + copper); C.save(g); render(); },
    'eqdecom': function () { const g = S.game; let n = 0; Object.keys(S.eqSel).forEach(k => { if (S.eqSel[k]) { if (C.decomposeEquip(g, k)) n++; } }); S.eqSel = {}; if (S.equipModal) S.equipModal = null; toast('分解 ' + n + ' 件获得材料'); C.save(g); render(); },
    'slotopen': function (a) { S.equipModal = a; S.eqChange = false; renderEquipModal(); },
    'emchange': function () { S.eqChange = !S.eqChange; renderEquipModal(); },
    'emunequip': function () { const g = S.game, key = S.selUnit || 'hero'; const worn = g.equipment.find(x => x.slot === S.equipModal && g.equipped[x.iid] === key); if (worn) { C.unequip(g, worn.iid); C.recomputeStats(g); C.save(g); } render(); renderEquipModal(); },
    'emwear': function (a) {
      const g = S.game, key = S.selUnit || 'hero';
      const owner = g.equipped[a];
      if (owner && owner !== key) {
        const ownerP = g.partners.find(x => x.iid === owner);
        const oname = (owner === 'hero') ? (g.heroName || '主角') : (ownerP ? (DATA.PARTNERS.find(x => x.id === ownerP.pid) || {}).name || '' : '');
        if (!confirm('该装备目前由「' + oname + '」穿戴，确定换给当前单位吗？')) return;
      }
      C.equipTo(g, a, key); C.recomputeStats(g); C.save(g); S.eqChange = false; render(); renderEquipModal();
    },
    'emclose': function () { S.equipModal = null; S.eqChange = false; render(); },
    'craft': function (a) { const r = C.craftFabao(S.game, a); toast(r.msg); if (r.ok) C.save(S.game); render(); },
    'fab': function (a) { const r = C.equipFabao(S.game, a); toast(r.msg); if (r.ok) C.save(S.game); render(); },
    'buy': function (a, b) { const r = C.buyShop(S.game, a, b); toast(r.msg); if (r.ok) C.save(S.game); render(); },
    'dungeon': function (a) {
      if (a === 'shuiyue') {
        S.logDungeon = [];
        const r = C.challengeShuiyue(S.game, (l) => addLog('dungeon', l.msg, 'bl-' + l.cls));
        if (!r.ok && !r.msg) addLog('dungeon', '战败，秘境魔尊太强…', 'bl-system');
      } else {
        S.logDungeon = [];
        const r = C.challengeWuxing(S.game, (l) => addLog('dungeon', l.msg, 'bl-' + l.cls));
        if (!r.ok && !r.msg) addLog('dungeon', '战败，五行妖灵克制了我方…', 'bl-system');
      }
      C.save(S.game); render();
    },
    'daily': function (a) { const r = C.dailySweep(S.game, a); toast(r.msg); if (r.ok) { addLog('dungeon', r.msg, 'bl-loot'); C.save(S.game); render(); } },
    'shop': function (a) { S.shop = a; render(); },
    'dimsub': function (a) { S.dimSub = a; render(); },
    'redeem': function () {
      const inp = $('#redeem-input');
      const code = inp ? inp.value.trim() : '';
      if (!code) { toast('请输入激活码'); return; }
      const r = C.redeemCode(S.game, code);
      toast(r.msg);
      if (r.ok) { addLog('main', '🔑 兑换' + r.msg.replace('兑换成功：', ''), 'bl-loot'); C.save(S.game); }
      render();
    },
    'export': function () { const s = C.exportSave(S.game); if (navigator.clipboard) navigator.clipboard.writeText(s); toast('存档已复制'); },
    'import': function () { const txt = prompt('粘贴存档字符串'); if (txt) { const im = C.importSave(txt); if (im) { C.wipe(); localStorage.setItem('caiji_xiuxian_save_v1', JSON.stringify(im)); location.reload(); } else toast('存档无效'); } },
    'reset': function () { if (confirm('确定要重置全部进度，并重新选择种族吗？')) { C.wipe(); goToStart(); toast('已重置，请重新选择种族开始'); } }
  };

  // 事件委托
  document.addEventListener('click', function (e) {
    const t = e.target.closest('[data-act]');
    if (t && act[t.dataset.act]) { act[t.dataset.act](t.dataset.a, t.dataset.b); return; }
    // 聚灵阵点击移出
    const j = e.target.closest('[data-juling]');
    if (j) { act.jld(j.dataset.juling); return; }
    // 装备部位选中
    const so = e.target.closest('[data-slotopen]');
    if (so) { act.slotopen(so.dataset.slotopen); return; }
    // 弹窗内选装穿戴
    const ew = e.target.closest('[data-emwear]');
    if (ew) { act.emwear(ew.dataset.emwear); return; }
    // 装备勾选
    const eqchk = e.target.closest('[data-eqsel]');
    if (eqchk) { e.preventDefault(); e.stopPropagation(); const id = eqchk.dataset.eqsel; S.eqSel[id] = !S.eqSel[id]; render(); return; }
    // 上阵阵容点击选中/互换
    const fm = e.target.closest('[data-fm]');
    if (fm) { if (S.formMode) act.swap(fm.dataset.fm); else act.sel(fm.dataset.fm); return; }
    // 阵容槽：点击已占用 → 下阵
    const sl = e.target.closest('[data-slot]');
    if (sl) {
      const iid = S.game.formation[+sl.dataset.slot];
      if (iid) act.fld(iid);
    }
  });

  // ---------- 游戏循环 ----------
  let tickCounter = 0;
  // 能量条：持续注满循环，满后释放专属技能
  setInterval(() => {
    if (!S.game) return;
    const bf = document.querySelector('.battle-field');
    if (!bf) return;
    bf.querySelectorAll('.slot:not(.empty)').forEach(slot => {
      const regen = parseFloat(slot.dataset.regen) || 80;
      slot.__energy = (slot.__energy || 0) + regen * 0.25;
      const bar = slot.querySelector('.slot-energy i');
      if (bar) bar.style.width = Math.min(100, slot.__energy / 10) + '%';
      if (slot.__energy >= 1000) {
        slot.__energy = 0;
        if (!slot._ultBusy) {
          slot._ultBusy = true;
          slot.classList.add('ult');
          const pop = document.createElement('div');
          pop.className = 'ult-pop';
          pop.textContent = slot.dataset.ult || '专属技能';
          slot.appendChild(pop);
          setTimeout(() => { if (pop.parentNode) pop.remove(); slot.classList.remove('ult'); slot._ultBusy = false; }, 720);
        }
      }
    });
  }, 250);
  setInterval(() => {
    if (!S.game) return;
    const g = S.game;
    C.tick(g, Date.now());
    // 自动战斗（第30关起解锁：勾选=推进下一档，未勾选=挂机当前关卡）
    const autoUnlocked = g.mainline.stage >= 30;
    if (autoUnlocked && !S.animating && !S.formMode) {
      const now = Date.now();
if (now - S.lastPush > 3500) {
S.lastPush = now;
S.battleMode = S.autoPush ? 'push' : 'farm';
const r = S.autoPush
          ? C.challengeMainline(g, (line) => addLog('main', line.msg, 'bl-' + line.cls))
          : C.farmMainline(g, (line) => addLog('main', line.msg, 'bl-' + line.cls));
        S.battleRounds = (r.res && r.res.rounds) || 0;
        S.battleStage = r.stage;
        if (r.ok) addLog('main', S.autoPush ? ('✔ 自动通关第 ' + r.stage + ' 关') : ('✔ 挂机通关当前第 ' + r.stage + ' 关'), 'bl-system');
        playBattle((r.res && r.res.events) || [], () => { C.save(g); render(); if (r.ok) showReward(r.reward); }, r.ok ? 'win' : (r.res && r.res.timeout ? 'timeout' : 'lose'));
      }
    }
    C.save(g);
    renderHeader();
    // 若在主界面，轻量更新（不整页重绘）
    if (S.tab === 'main' && !S.animating) {
      tickCounter++;
      if (tickCounter % 20 === 0) renderMain($('#cview'));
    }
  }, 1000);

  // ---------- 启动 ----------
  function showOfflineModal(gains) {
    const g = S.game;
    const zi = g.res.ziqi;
    document.body.insertAdjacentHTML('beforeend',
      '<div class="modal-mask"><div class="modal">' +
        '<h3>离线奖励</h3>' +
        '<div class="dim">离线时长：<b class="gold">' + C.formatDuration(gains.seconds) + '</b>（最高12小时）</div>' +
        '<div class="dim mt8" style="margin-top:10px">当前收益：</div>' +
        '<div class="row mt8"><span class="muted">铜钱</span><b class="gold">+' + F(gains.copper) + '</b></div>' +
        '<div class="row"><span class="muted">修为</span><b class="gold">+' + F(gains.xiuwei) + '</b></div>' +
        '<div class="dim mt8">当前鸿蒙紫气：<b class="gold">' + F(zi) + '</b></div>' +
        '<div class="mt12"><button class="btn btn-green block" data-of="1" data-c="0">免费领取（x1）</button></div>' +
        '<div class="mt8"><button class="btn btn-blue block" data-of="2" data-c="100"' + (zi < 100 ? ' disabled' : '') + '>双倍领取（x2）· 消耗100紫气</button></div>' +
        '<div class="mt8"><button class="btn btn-gold block" data-of="3" data-c="200"' + (zi < 200 ? ' disabled' : '') + '>三倍领取（x3）· 消耗200紫气</button></div>' +
      '</div></div>'
    );
    document.querySelector('.modal-mask').querySelectorAll('[data-of]').forEach(btn => {
      btn.addEventListener('click', () => applyOffline(parseInt(btn.dataset.of), parseInt(btn.dataset.c), gains));
    });
  }

  function applyOffline(mult, cost, gains) {
    const g = S.game;
    if (cost > 0 && g.res.ziqi < cost) { toast('鸿蒙紫气不足'); return; }
    g.res.xiuwei += gains.xiuwei * mult;
    g.res.copper += gains.copper * mult;
    if (cost > 0) g.res.ziqi -= cost;
    C.save(g);
    const mask = document.querySelector('.modal-mask');
    if (mask) mask.remove();
    renderHeader();
    toast('已领取离线奖励（x' + mult + '）');
  }

  function boot() {
    bindMusic();
    updateMusicBtn();
    const saved = C.load();
    if (saved && saved.v) {
      S.game = saved;
      $('#start').classList.add('hide');
      $('#game').classList.remove('hide');
      buildNav();
      // 离线奖励：离线 ≥1 分钟重返弹出「离线奖励」弹窗
      const now = Date.now();
      const dt = (now - (saved.lastTick || now)) / 1000;
      if (dt >= 60) {
        const gains = C.offlineGains(saved, dt);
        saved.lastTick = now;
        C.save(saved);
        showOfflineModal(gains);
      }
      showTab('main');
      loadSFromGame();
    } else {
      renderStart();
    }
  }
  function loadSFromGame() { const g = S.game; /* 初始化视图状态 */ }

  // 调试/导出钩子（便于测试与高级用户）
  window.__CAIJI = { S, C, DATA, act };

  boot();
})();
