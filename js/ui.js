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
    game: null, tab: 'main', race: null,
    slotSel: -1, equipUnit: 'hero', shop: 'market', manorSub: 'build',
    logMain: [], logDungeon: [], autoPush: true,
    lastPush: 0
  };

  // ---------- 开始界面 ----------
  function renderStart() {
    $('#start').classList.remove('hide');
    const box = $('#race-cards');
    box.innerHTML = '';
    Object.keys(RACE).forEach(rk => {
      const r = RACE[rk];
      const card = el('<div class="race-card" data-race="' + rk + '"><h3>' + r.name + '</h3><small>' + r.desc + '</small></div>');
      card.onclick = () => { S.race = rk; box.querySelectorAll('.race-card').forEach(c => c.classList.remove('sel')); card.classList.add('sel'); $('#btn-start').disabled = false; $('#start-err').textContent = ''; };
      box.appendChild(card);
    });
    $('#btn-start').onclick = () => {
      if (!S.race) { $('#start-err').textContent = '请先选择种族'; return; }
      startNewGame(S.race);
    };
  }

  function startNewGame(race) {
    const g = C.newGame(race);
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
    $('#realm-tag').textContent = C.realmLabel(g) + ' · 战力' + F(C.teamPower(g));
    const res = g.res;
    $('#resbar').innerHTML =
      '<div class="res"><span class="ico">▲</span>修为<b>' + F(res.xiuwei) + '</b></div>' +
      '<div class="res"><span class="ico">文</span>铜钱<b>' + F(res.copper) + '</b></div>' +
      '<div class="res"><span class="ico">玉</span>玉液<b>' + F(res.qiongjiang) + '</b></div>' +
      '<div class="res"><span class="ico">灵</span>灵气<b>' + F(res.lingqi) + '</b></div>' +
      '<div class="res"><span class="ico">紫</span>紫气<b>' + F(res.ziqi) + '</b></div>' +
      '<div class="res"><span class="ico">行</span>五行<b>' + F(res.wuxing) + '</b></div>';
    $('#stamline').textContent = '体力 ' + Math.floor(res.stamina) + '/' + DATA.STAMINA_MAX + ' · 离线上限12小时';
  }

  // ---------- 导航 ----------
  const NAV = [
    { id: 'main', ico: '☯', name: '修仙' },
    { id: 'manor', ico: '府', name: '仙府' },
    { id: 'partner', ico: '友', name: '伙伴' },
    { id: 'equip', ico: '剑', name: '装备' },
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
  function render() {
    renderHeader();
    const v = $('#cview');
    v.innerHTML = '';
    const fn = { main: renderMain, manor: renderManor, partner: renderPartner, equip: renderEquip, dungeon: renderDungeon, shop: renderShop, settings: renderSettings }[S.tab];
    if (fn) fn(v);
  }

  // ---------- 主页 / 修仙 ----------
  function renderMain(v) {
    const g = S.game;
    const st = C.unitStats(g, 'hero');
    const r = C.rates(g);
    const stage = g.mainline.stage;
    const heroEl = g.heroEl;
    const isMaxLayer = g.realm.layer >= 9;
    const ti = isMaxLayer ? C.tribulationInfo(g) : null;

    // 角色卡
    const race = RACE[g.race];
    const eleOpt = DATA.ELEMENTS.map(e =>
      '<option value="' + e + '"' + (e === heroEl ? ' selected' : '') + '>' + e + '</option>').join('');
    v.innerHTML = `
      <div class="card">
        <div class="row xl">
          <div><b class="gold">${race.name} · 主角</b> <span class="tag">${C.realmLabel(g)}</span></div>
          <div class="muted">战力 <b style="color:var(--gold)">${F(C.teamPower(g))}</b></div>
        </div>
        <div class="statsrow">
          <div class="stat"><span>生命</span><b>${F(st.hp)}</b></div>
          <div class="stat"><span>攻击</span><b>${F(st.atk)}</b></div>
          <div class="stat"><span>防御</span><b>${F(st.def)}</b></div>
          <div class="stat"><span>速度</span><b>${Math.round(st.spd)}</b></div>
          <div class="stat"><span>等级</span><b>${F(g.hero.level)}</b></div>
          <div class="stat"><span>五行</span><b style="color:${ELEMC[heroEl] || '#fff'}">${heroEl}</b></div>
        </div>
        <div class="row mt8">
          <span class="muted">主角五行属性（克制克彼，策略关键）</span>
          <select id="hero-el" class="btn btn-sm">${eleOpt}</select>
        </div>
        <div class="row mt8">
          <span class="muted">升级主角</span>
          <button class="btn btn-blue btn-sm" data-act="hero-up">升一级（修为 ${F(C.heroLevelCost(g.hero.level))}）</button>
        </div>
      </div>

      <div class="card">
        <div class="sec-title" style="margin:0">境界修为 <span class="muted">第${g.realm.layer}/9层</span></div>
        <div class="bar${isMaxLayer ? ' red-bar' : ''}"><i style="width:${layerPct(g)}%"></i></div>
        <div class="row mt8">
          <span class="muted">${isMaxLayer ? '圆满！可渡劫突破大境界（失败损失10%修为）' : '搜集修为突破到下一层（需 ${F(C.layerCost(g))}）'}</span>
          ${isMaxLayer
            ? `<button class="btn btn-gold btn-sm" data-act="trib">渡劫（成功率 ${Math.round(ti.chance * 100)}% · 丹×${g.items['渡劫丹'] || 0}）</button>`
            : `<button class="btn btn-sm" data-act="layerup">突破（${F(C.layerCost(g))}修为）</button>`}
        </div>
      </div>

      <div class="card">
        <div class="sec-title" style="margin:0">挂机收益</div>
        <div class="statsrow">
          <div class="stat"><span>修为/秒</span><b>${F(r.xiuwei)}</b></div>
          <div class="stat"><span>铜钱/秒</span><b>${F(r.copper)}</b></div>
          <div class="stat"><span>玉液/秒</span><b>${r.qiongjiang.toFixed(1)}</b></div>
        </div>
        <div class="row mt8">
          <span class="muted">仙府法阵/境界/主角等级越高，挂机越多</span>
          <button class="btn btn-sm ${S.autoPush ? 'btn-green' : ''}" data-act="auto">${S.autoPush ? '自动推关：开' : '自动推关：关'}</button>
        </div>
      </div>

      <div class="card">
        <div class="sec-title" style="margin:0">主线·成仙之路 <span class="tag">第 ${stage} 关</span></div>
        <div class="toolbar">
          <button class="btn btn-gold" data-act="push">挑战当前关（${stage}）</button>
          <button class="btn btn-sm" data-act="pushx10">连打10次</button>
        </div>
        <div class="dim">挂机自动推关直到打不过；打不过请升级、养仙府、抽伙伴、渡劫。</div>
        <div id="battle-log" class="battle-log mt8"></div>
      </div>
    `;
    renderLog('#battle-log', S.logMain);
    $('#hero-el').onchange = (e) => { g.heroEl = e.target.value; C.recomputeStats(g); C.save(g); render(); };
  }

  function layerPct(g) {
    if (g.realm.layer >= 9) return 100;
    const cost = C.layerCost(g);
    return Math.min(100, Math.round(g.res.xiuwei / cost * 100));
  }

  // ---------- 仙府 ----------
  function renderManor(v) {
    const g = S.game;
    const MANOR = DATA.MANOR;
    const show = S.manorSub;
    let html = '<div class="sec-title">仙府·资源根基</div>';
    html += '<div class="sec-tabs">' +
      '<button class="btn ' + (show === 'build' ? 'btn-gold' : '') + '" data-act="msub" data-a="build">建筑</button>' +
      '<button class="btn ' + (show === 'gongfa' ? 'btn-gold' : '') + '" data-act="msub" data-a="gongfa">功法</button>' +
      '<button class="btn ' + (show === 'dan' ? 'btn-gold' : '') + '" data-act="msub" data-a="dan">丹房</button>' +
      '<button class="btn ' + (show === 'qi' ? 'btn-gold' : '') + '" data-act="msub" data-a="qi">器宝</button>' +
      '</div>';

    if (show === 'build') {
      const icons = { zuiyue: '樽', lingmai: '脉', linggen: '根', fazhen: '阵', juling: '聚', gongfa: '功', qiankun: '殿' };
      ['zuiyue', 'lingmai', 'linggen', 'fazhen', 'juling', 'gongfa', 'qiankun'].forEach(bid => {
        const b = MANOR[bid];
        const lv = g.manor[bid];
        const cost = C.manorCost(bid, lv);
        let eff = '';
        if (bid === 'lingmai') eff = '主角品质：' + colorName(C.lingmaiColor(lv)) + '（' + C.lingmaiMult(lv).toFixed(1) + 'x）';
        if (bid === 'linggen') eff = '全体攻击/防御/生命 +' + (lv * 3) + '%';
        if (bid === 'zuiyue') eff = '玉液 +' + (0.2 + lv * 0.22).toFixed(2) + '/秒';
        if (bid === 'fazhen') eff = '修为产出 x' + (1 + lv * 0.25).toFixed(2);
        if (bid === 'juling') eff = '闲置伙伴加成：全队+' + C.julingBonus(g).toFixed(1) + '%';
        if (bid === 'gongfa') eff = '已研习 ' + lv + '/' + DATA.GONGFAS[g.race].length + ' 层功法';
        if (bid === 'qiankun') eff = '炼丹炼器等级 +' + lv + '，解锁更高阶';
        const costStr = costText(cost);
        html += '<div class="card"><div class="row"><div><b class="gold">' + icons[bid] + ' ' + b.name + '</b> <span class="tag">Lv.' + lv + '</span></div><button class="btn btn-sm btn-gold" data-act="mup" data-a="' + bid + '">升级</button></div>' +
          '<div class="dim mt8">' + b.desc + '</div><div class="green mt8">' + eff + '</div><div class="dim">升级消耗：' + costStr + '</div></div>';
      });
    } else if (show === 'gongfa') {
      const list = DATA.GONGFAS[g.race];
      html += '<div class="card"><div class="row"><div><b class="gold">功法研习</b></div><button class="btn btn-sm btn-gold" data-act="mup" data-a="gongfa">研习（消耗修为）</button></div>' +
        '<div class="dim mt8">主角主动技能随功法逐层解锁，战斗更有利。</div><div class="mt8">';
      list.forEach((sid, i) => {
        const sk = DATA.SKILLS[sid];
        const unlocked = g.gongfa > i;
        html += '<div class="row mt8"><span>' + (unlocked ? '<span class="green">✔</span> ' : '<span class="dim">🔒</span> ') + sk.name + '（' + sk.target + '· 倍率' + sk.mult + '）</span><span class="' + (unlocked ? 'green' : 'dim') + '">' + (unlocked ? '已解锁' : '功法' + (i + 1) + '层解锁') + '</span></div>';
      });
      html += '</div></div>';
    } else if (show === 'dan') {
      html += '<div class="card"><div class="row"><div><b class="gold">丹房·造化乾坤殿 (Lv.' + g.manor.qiankun + ')</b></div><button class="btn btn-sm btn-gold" data-act="mup" data-a="qiankun">升级乾坤殿</button></div><div class="dim mt8">炼制渡劫丹、聚元丹等，渡劫丹是渡劫关键。</div></div>';
      ['渡劫丹', '聚元丹', '聚灵丹', '回春丹'].forEach(dn => {
        const cost = { 渡劫丹: 80, 聚元丹: 30, 聚灵丹: 20, 回春丹: 15 }[dn];
        html += '<div class="shop-item"><span>' + dn + ' <span class="dim">(持有 ' + (g.items[dn] || 0) + ')</span></span><span><span class="price">灵气' + cost + '</span> <button class="btn btn-sm btn-blue" data-act="alc" data-a="' + dn + '">炼制</button></span></div>';
      });
      html += '<div class="sec-title" style="margin:12px 0 4px">背包道具</div>';
      ['聚元丹', '聚灵丹', '醒神丹'].forEach(dn => {
        if ((g.items[dn] || 0) > 0) html += '<div class="shop-item"><span>' + dn + ' ×' + g.items[dn] + '</span><button class="btn btn-sm btn-blue" data-act="use" data-a="' + dn + '">使用</button></div>';
      });
    } else if (show === 'qi') {
      html += '<div class="card"><div class="row"><div><b class="gold">器宝·造化乾坤殿 (Lv.' + g.manor.qiankun + ')</b></div><button class="btn btn-sm btn-gold" data-act="mup" data-a="qiankun">升级乾坤殿</button></div><div class="dim mt8">消耗灵气锻造装备，乾坤殿等级越高品阶越高。</div></div>';
      const cost = 40 + g.manor.qiankun * 15;
      html += '<div class="shop-item"><span>锻造一件装备（当前灵气消耗 ' + cost + '）</span><button class="btn btn-sm btn-gold" data-act="forge">锻造</button></div>';
    }
    v.innerHTML = html;
  }
  function colorName(c) { return { blue: '蓝', purple: '紫', gold: '金', red: '红' }[c] || c; }
  function costText(cost) {
    const a = [];
    if (cost.copper) a.push('铜钱' + F(cost.copper));
    if (cost.qiongjiang) a.push('玉液' + F(cost.qiongjiang));
    if (cost.lingqi) a.push('灵气' + F(cost.lingqi));
    if (cost.xiuwei) a.push('修为' + F(cost.xiuwei));
    return a.join(' / ') || '免费';
  }

  // ---------- 伙伴 ----------
  function renderPartner(v) {
    const g = S.game;
    let html = '<div class="sec-title">伙伴·阵容搭配（速度/控制/治疗/五行克制是胜负核心）</div>';
    html += '<div class="card"><div class="row"><div><b class="gold">招募</b> <span class="dim">招募令×' + (g.items['招募令'] || 0) + ' ／ 紫气' + F(g.res.ziqi) + '</span></div></div>' +
      '<div class="toolbar"><button class="btn btn-gold" data-act="sum" data-a="1">单抽（1令/30紫）</button><button class="btn btn-gold" data-act="sum" data-a="10">十连（10令/280紫）</button></div>' +
      '<div class="dim">品质 蓝→紫→金→红 · 保底：10抽必出金 · 重复伙伴自动进阶★</div></div>';
    // 阵容
    html += '<div class="card"><div class="sec-title" style="margin:0">上阵阵容 <span class="muted">' + g.formation.length + '/6</span></div><div class="slot-grid">';
    for (let i = 0; i < 6; i++) {
      const iid = g.formation[i];
      if (iid) {
        const p = g.partners.find(x => x.iid === iid); const tpl = DATA.PARTNERS.find(x => x.id === p.pid);
        html += '<div class="f-slot" data-slot="' + i + '"><div class="pos">' + (i === 0 ? '前排' : '') + '</div><h5 style="color:' + qColor(tpl.q) + '">' + tpl.name + '</h5><small>' + tpl.role + '·' + tpl.el + '</small></div>';
      } else {
        html += '<div class="f-slot empty" data-slot="' + i + '">空位</div>';
      }
    }
    html += '</div><div class="dim mt8">点击伙伴下阵；先点的排前（越前越挨打，也越先出手）。</div></div>';

    // 聚灵阵
    html += '<div class="card"><div class="sec-title" style="margin:0">聚灵阵 <span class="muted">闲置伙伴加成全队 ' + C.julingBonus(g).toFixed(1) + '%</span></div><div class="slot-grid">';
    if (g.juling.length) {
      g.juling.forEach(iid => {
        const p = g.partners.find(x => x.iid === iid); const tpl = DATA.PARTNERS.find(x => x.id === p.pid);
        html += '<div class="f-slot" data-juling="' + iid + '"><h5 style="color:' + qColor(tpl.q) + '">' + tpl.name + '</h5><small>Lv.' + p.level + '</small></div>';
      });
    } else {
      html += '<div class="f-slot empty" style="grid-column:1/4">暂无极闲伙伴</div>';
    }
    html += '</div><div class="dim mt8">点击聚灵阵中的伙伴可移出。</div></div>';

    // 伙伴列表
    html += '<div class="sec-title">伙伴名录</div>';
    g.partners.forEach(p => {
      const tpl = DATA.PARTNERS.find(x => x.id === p.pid);
      const inF = g.formation.includes(p.iid);
      const inJ = g.juling.includes(p.iid);
      const st = C.unitStats(g, p.iid);
      html += '<div class="partner-card"><div class="p-cardleft" style="color:' + qColor(tpl.q) + ';border-color:currentColor">' + tpl.el + '</div>' +
        '<div class="p-cardmid"><h4 style="color:' + qColor(tpl.q) + '">' + tpl.name + ' <span class="tag">' + C.colorName(tpl.q) + '</span></h4>' +
        '<small>' + ROLES[tpl.role] + ' · Lv.' + p.level + ' · ★' + p.stars + ' · 攻' + F(st.atk) + ' 生命' + F(st.hp) + '</small></div>' +
        '<div class="p-btncol"><button class="btn btn-sm ' + (inF ? 'btn-red' : 'btn-green') + '" data-act="fld" data-a="' + p.iid + '">' + (inF ? '下阵' : '上阵') + '</button><br>' +
        '<button class="btn btn-sm mt8 ' + (inJ ? 'btn-red' : 'btn-blue') + '" data-act="jld" data-a="' + p.iid + '">' + (inJ ? '移出' : '聚灵') + '</button><br>' +
        '<button class="btn btn-sm mt8" data-act="plv" data-a="' + p.iid + '">升级(修为' + F(C.levelCost(p.level)) + ')</button></div></div>';
    });
    v.innerHTML = html;
  }

  function qColor(q) { return { 2: 'var(--blue)', 3: 'var(--purple)', 4: 'var(--gold)', 5: 'var(--red)' }[q] || 'var(--ink)'; }

  // ---------- 装备 / 法宝 ----------
  function renderEquip(v) {
    const g = S.game;
    const unitKey = S.equipUnit;
    const unitName = unitKey === 'hero' ? '主角' : (g.partners.find(p => p.iid === unitKey) ? DATA.PARTNERS.find(x => x.id === g.partners.find(p => p.iid === unitKey).pid).name : '?');
    let html = '<div class="sec-title">装备 · 法宝</div>';
    // 单位选择
    html += '<div class="sec-tabs"><button class="btn ' + (unitKey === 'hero' ? 'btn-gold' : '') + '" data-act="equnit" data-a="hero">主角</button>';
    g.formation.forEach(iid => { const p = g.partners.find(x => x.iid === iid); const tpl = DATA.PARTNERS.find(x => x.id === p.pid); html += '<button class="btn ' + (unitKey === iid ? 'btn-gold' : '') + '" data-act="equnit" data-a="' + iid + '">' + tpl.name + '</button>'; });
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
    v.innerHTML = html;
  }

  // ---------- 副本 ----------
  function renderDungeon(v) {
    const g = S.game;
    const d = g.dungeons;
    let html = '<div class="sec-title">副本 · 挑战</div>';
    // 主线
    html += '<div class="card"><div class="row"><div><b class="gold">主线·成仙之路</b></div><span class="tag">第 ' + g.mainline.stage + ' 关</span></div><div class="dim mt8">无限爬塔推关；打不过就回仙府/副本提升实力。</div><div class="toolbar"><button class="btn btn-gold btn-sm" data-act="push">挑战</button></div></div>';
    // 水月洞天
    html += '<div class="card"><div class="row"><div><b class="blue">水月洞天</b> <span class="dim">打boss刷法宝碎片+紫气</span></div></div><div class="row mt8"><span class="muted">当前首领 ' + (d.shuiyue.bestBoss || 0) + ' 阶 · 体力-10</span><button class="btn btn-sm btn-blue" data-act="dungeon" data-a="shuiyue">挑战</button></div></div>';
    // 五行山
    html += '<div class="card"><div class="row"><div><b class="purple">五行山挑战</b> <span class="dim">五行克制副本，拿五行材料</span></div></div><div class="row mt8"><span class="muted">已通 ' + d.wuxing.bestStage + '/20 层 · 体力-10</span><button class="btn btn-sm btn-blue" data-act="dungeon" data-a="wuxing">挑战</button></div><div class="dim">敌人五行克制我方，记得切换主力五行属性！</div></div>';
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
    const curName = { copper: '铜钱', ziqi: '鸿蒙紫气', wuxing: '五行币' }[shop.currency];
    html += '<div class="card"><div class="row"><div><b class="gold">' + shop.name + '</b></div><span class="muted">持有 <b class="gold">' + F(g.res[shop.currency]) + '</b> ' + curName + '</span></div></div>';
    shop.goods.forEach(gd => {
      const limitStr = gd.limit ? '（限购' + gd.limit + '）' : '';
      html += '<div class="shop-item"><span>' + gd.item + (gd.qty > 1 ? ' x' + gd.qty : '') + '</span><span><span class="price">' + gd.price + ' ' + curName + '</span><button class="btn btn-sm btn-blue" data-act="buy" data-a="' + S.shop + '" data-b="' + gd.id + '">购买' + limitStr + '</button></span></div>';
    });
    v.innerHTML = html;
  }

  // ---------- 设置 ----------
  function renderSettings(v) {
    const g = S.game;
    v.innerHTML = '<div class="sec-title">更多</div>' +
      '<div class="card"><div class="sec-title" style="margin:0">玩法要诀</div><div class="help-block">' +
      '<p><b>【循环】</b>挂机攒资源 → 仙府/伙伴/装备/功法 → 推主线 → 副本/活动 → 渡劫突破 → 冲击更高关卡。</p>' +
      '<p><b>【种族】</b>人族控制、魔族爆发、龙人肉盾、精灵续航，玩法各异。</p>' +
      '<p><b>【战斗】</b>回合文字战斗。看速度、控制（晕/冻/沉默）、治疗、五行克制。<b>硬扛打不过，要靠先手控住敌人。</b></p>' +
      '<p><b>【仙府】</b>资源根基。灵脉决定主角品质；灵根、法阵、聚灵阵、功法、乾坤殿全面提升。</p>' +
      '<p><b>【渡劫】</b>境界圆满后渡劫；失败损失10%修为，备<渡劫丹>提升成功率。</p>' +
      '<p><b>【伙伴】</b>招募令/紫气抽卡，蓝紫金红；多余伙伴进聚灵阵加成全队。</p>' +
      '<p><b>【灵石】</b>水月洞天刷法宝碎片、五行山拿五行石、每日副本扫荡。</p>' +
      '</div></div>' +
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
      if (r.ok) {
        count++;
        addLog('main', '✔ 通关第 ' + r.stage + ' 关，修为+' + F(r.reward.xiuwei) + ' 铜钱+' + F(r.reward.copper), 'bl-system');
      } else {
        addLog('main', '✘ 第 ' + r.stage + ' 关挑战失败，队伍实力不足', 'bl-system');
        break;
      }
    }
    if (cb) cb(count);
  }

  const act = {
    'push': function () { runMainline(() => { C.save(S.game); render(); }, 1); },
    'pushx10': function () { runMainline(() => { C.save(S.game); render(); }, 10); },
    'auto': function () { S.autoPush = !S.autoPush; C.save(S.game); render(); },
    'hero-up': function () { const r = C.upgradeHero(S.game); toast(r.msg); C.save(S.game); render(); },
    'layerup': function () { const r = C.breakthroughLayer(S.game); toast(r.msg); if (r.ok) { addLog('main', r.msg, 'bl-system'); C.save(S.game); } render(); },
    'sum': function (a) {
      const n = +a || 1;
      const g = S.game;
      let used = null;
      if ((g.items['招募令'] || 0) >= n) { C.takeItem(g, '招募令', n); used = '招募令×' + n; }
      else if (g.res.ziqi >= (n === 1 ? 30 : 280)) { g.res.ziqi -= (n === 1 ? 30 : 280); used = '紫气' + (n === 1 ? 30 : 280); }
      else { toast('招募令或鸿蒙紫气不足'); return; }
      const res = C.summon(g, null, n);
      const summary = res.map(r => r.label).join(' / ');
      toast('消耗' + used + '，获得：' + summary.slice(0, 90));
      C.save(g); render();
    },
    'trib': function () {
      const info = C.tribulationInfo(S.game);
      const usePill = info.pills > 0;
      if (usePill) toast('使用渡劫丹，成功率提升…');
      const r = C.tribulate(S.game, usePill);
      toast(r.msg);
      addLog('main', r.msg, r.ok ? 'bl-system' : 'bl-dmg');
      C.save(S.game); render();
    },
    'msub': function (a) { S.manorSub = a; render(); },
    'mup': function (a) { const r = C.upgradeManor(S.game, a); toast(r.msg); if (r.ok) { C.save(S.game); } render(); },
    'alc': function (a) { const r = C.alchemy(S.game, a); toast(r.msg); if (r.ok) C.save(S.game); render(); },
    'use': function (a) { const r = C.useItem(S.game, a); toast(r.msg); if (r.ok) C.save(S.game); render(); },
    'forge': function () { const r = C.forgeEquip(S.game); toast(r.msg); if (r.ok) C.save(S.game); render(); },
    'plv': function (a) { const r = C.upgradePartner(S.game, a); toast(r.msg); if (r.ok) C.save(S.game); render(); },
    'fld': function (a) {
      const g = S.game;
      if (g.formation.includes(a)) { g.formation = g.formation.filter(x => x !== a); }
      else { if (g.formation.length >= 6) { toast('上阵已满'); return; } g.formation.push(a); g.juling = g.juling.filter(x => x !== a); }
      C.recomputeStats(g); C.save(g); render();
    },
    'jld': function (a) {
      const g = S.game;
      if (g.juling.includes(a)) { g.juling = g.juling.filter(x => x !== a); }
      else { if (g.juling.length >= 12) { toast('聚灵阵已满'); return; } g.juling.push(a); g.formation = g.formation.filter(x => x !== a); }
      C.recomputeStats(g); C.save(g); render();
    },
    'equnit': function (a) { S.equipUnit = a; render(); },
    'eq': function (a) { const r = C.equipTo(S.game, a, S.equipUnit); toast(r.msg); if (r.ok) C.save(S.game); render(); },
    'enh': function (a) { const r = C.enhanceEquip(S.game, a); toast(r.msg); if (r.ok) C.save(S.game); render(); },
    'ref': function (a) { const r = C.refineEquip(S.game, a); toast(r.msg); if (r.ok) C.save(S.game); render(); },
    'fum': function (a) { const r = C.fumoEquip(S.game, a); toast(r.msg); if (r.ok) C.save(S.game); render(); },
    'dec': function (a) { const r = C.decomposeEquip(S.game, a); toast(r ? '分解获得材料' : '请先卸下'); if (r) C.save(S.game); render(); },
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
    'export': function () { const s = C.exportSave(S.game); if (navigator.clipboard) navigator.clipboard.writeText(s); toast('存档已复制'); },
    'import': function () { const txt = prompt('粘贴存档字符串'); if (txt) { const im = C.importSave(txt); if (im) { C.wipe(); localStorage.setItem('caiji_xiuxian_save_v1', JSON.stringify(im)); location.reload(); } else toast('存档无效'); } },
    'reset': function () { if (confirm('确定重置全部进度？无法恢复！')) { C.wipe(); location.reload(); } }
  };

  // 事件委托
  document.addEventListener('click', function (e) {
    const t = e.target.closest('[data-act]');
    if (t && act[t.dataset.act]) { act[t.dataset.act](t.dataset.a, t.dataset.b); return; }
    // 聚灵阵点击移出
    const j = e.target.closest('[data-juling]');
    if (j) { act.jld(j.dataset.juling); return; }
    // 阵容槽：点击已占用 → 下阵
    const sl = e.target.closest('[data-slot]');
    if (sl) {
      const iid = S.game.formation[+sl.dataset.slot];
      if (iid) act.fld(iid);
    }
  });

  // ---------- 游戏循环 ----------
  let tickCounter = 0;
  setInterval(() => {
    if (!S.game) return;
    const g = S.game;
    C.tick(g, Date.now());
    // 自动推关
    if (S.autoPush) {
      const now = Date.now();
      if (now - S.lastPush > 3500) {
        S.lastPush = now;
        const r = C.challengeMainline(g, (line) => addLog('main', line.msg, 'bl-' + line.cls));
        if (r.ok) {
          addLog('main', '✔ 自动通关第 ' + r.stage + ' 关', 'bl-system');
          C.recomputeStats(g);
        }
      }
    }
    C.save(g);
    renderHeader();
    // 若在主界面，轻量更新（不整页重绘）
    if (S.tab === 'main') {
      tickCounter++;
      if (tickCounter % 20 === 0) renderMain($('#cview'));
    }
  }, 1000);

  // ---------- 启动 ----------
  function boot() {
    bindMusic();
    updateMusicBtn();
    const saved = C.load();
    if (saved && saved.v) {
      S.game = saved;
      $('#start').classList.add('hide');
      $('#game').classList.remove('hide');
      buildNav();
      // 离线结算
      const now = Date.now();
      const dt = (now - (saved.lastTick || now)) / 1000;
      if (dt > 5) {
        const gains = C.offlineGains(saved, dt);
        saved.res.xiuwei += gains.xiuwei;
        saved.res.copper += gains.copper;
        saved.res.qiongjiang += gains.qiongjiang;
        saved.res.lingqi += gains.lingqi;
        saved.lastTick = now;
        C.save(saved);
        alert('欢迎回来！离线 ' + C.formatDuration(gains.seconds) + '\n修为+' + F(gains.xiuwei) + ' 铜钱+' + F(gains.copper) + '\n琼浆玉液+' + F(gains.qiongjiang) + ' 灵气+' + F(gains.lingqi));
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
