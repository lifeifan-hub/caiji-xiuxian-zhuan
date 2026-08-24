// 激活码生成器（作者用）：node gen_code.js <物品或资源> <数量> [有效天数=7]
// 物品示例：渡劫丹 招募令 强化石 精炼石 附魔石 聚元丹 聚灵丹
// 资源示例：copper xiuwei ziqi qiongjiang lingqi wuxing fabao
// VIP 激活：VIP <等级1-18>，例如: node gen_code.js VIP 3 365
const SECRET = 'CJXS-2026-REDEEM-#58#xQ';
function codeHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return ('00000000' + h.toString(16)).slice(-8);
}
function b64urlEncode(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function makeCode(g, q, days) {
  const e = Date.now() + (days || 7) * 86400000;
  const s = codeHash(SECRET + g + '|' + q + '|' + e);
  return b64urlEncode(JSON.stringify({ g, q, e, s }));
}
const g = process.argv[2], q = parseInt(process.argv[3] || '1', 10), days = parseInt(process.argv[4] || '7', 10);
if (!g) { console.log('用法: node gen_code.js <物品|资源> <数量> <有效天数>'); process.exit(1); }
console.log('物品:', g, ' 数量:', q, ' 有效:', days, '天');
console.log('激活码:', makeCode(g, q, days));
