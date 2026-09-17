// ===== app =====
const yen = (n) => { const v = Math.round(n || 0); return (v < 0 ? '−¥' : '¥') + Math.abs(v).toLocaleString('ja-JP'); };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const nowIso = () => new Date().toISOString();

const DEFAULT_CATS = [
  { id: 'food', name: '食費', icon: '🛒', budget: 45000 }, { id: 'eat', name: '外食', icon: '🍽️', budget: 20000 },
  { id: 'daily', name: '日用品', icon: '🧻', budget: 10000 }, { id: 'rent', name: '住居', icon: '🏠', budget: 0 },
  { id: 'util', name: '光熱費', icon: '💡', budget: 0 }, { id: 'comm', name: '通信', icon: '📱', budget: 0 },
  { id: 'trans', name: '交通', icon: '🚃', budget: 0 }, { id: 'fun', name: '娯楽', icon: '🎬', budget: 0 },
  { id: 'other', name: 'その他', icon: '📦', budget: 0 }, { id: 'salary', name: '給与', icon: '💴', budget: 0, income: true },
];
const TEMPLATES = [['スーパー', 'food'], ['コンビニ', 'food'], ['外食', 'eat'], ['ガソリン', 'trans'], ['日用品', 'daily']];
const STATUS = { in_stock: '在庫あり', low: '残り少ない', out_of_stock: '在庫切れ' };
const COLS = ['members', 'tx', 'rec', 'shop', 'hist', 'inv', 'goals', 'contrib', 'settle', 'meals'];

const S = { uid: null, key: null, keyInvalid: false, creating: false, loadError: false, ready: false, error: null, cfg: null, view: 'home', ym: D.ym(D.tokyoToday()), tab: {}, q: '', filter: 'all', pending: false, offline: false, loaded: new Set() };
COLS.forEach(c => S[c] = []);

const today = () => D.tokyoToday();
const cats = () => (S.cfg?.categories || DEFAULT_CATS);
const cat = (id) => cats().find(c => c.id === id) || { name: '未分類', icon: '・' };
const members = () => [...S.members].sort((a, b) => (a.joinedAt || '').localeCompare(b.joinedAt || '') || a.id.localeCompare(b.id)).slice(0, 2);
const mA = () => members()[0]?.id || null;
const mB = () => members()[1]?.id || null;
const nick = (id) => S.members.find(m => m.id === id)?.nickname || (id ? '？' : '未設定');
const me = () => S.uid;
const partner = () => members().find(m => m.id !== me())?.id || null;
const isA = () => mA() === me();
const splitAFromMine = (mine) => isA() ? mine : 100 - mine;
const mineFromSplitA = (sa) => isA() ? sa : 100 - sa;
const fixedMonthly = () => S.rec.filter(r => r.active !== false).reduce((s, r) => s + (r.amount || 0), 0);

function summary(ym = S.ym) {
  const budget = S.cfg?.budget || 0, t = today();
  const spent = D.calculateMonthlySpending(S.tx, ym), income = D.calculateMonthlyIncome(S.tx, ym);
  const remaining = D.calculateRemainingBudget(budget, spent);
  const left = D.daysLeft(ym, t);
  const daily = D.calculateDailyAllowance(remaining, left);
  const forecast = D.calculateMonthEndForecast({ txs: S.tx, ym, today: t, fixedMonthly: fixedMonthly() });
  const dim = D.daysInMonth(ym);
  const elapsedPct = Math.round((dim - left) / dim * 100);
  return { budget, spent, income, remaining, left, daily, forecast, endBalance: budget - forecast, elapsedPct };
}
function forecastByCat(ym) {
  const t = today(), out = {};
  if (D.ym(t) !== ym) return out;
  const day = Number(t.slice(8, 10)), dim = D.daysInMonth(ym);
  const m = D.sumByCat(S.tx.filter(x => !x.recurringId), ym);
  for (const k in m) out[k] = Math.round(m[k] / day * dim);
  return out;
}
const settlement = () => (mA() && mB()) ? D.calculateSettlement(S.tx, S.settle, mA(), mB()) : null;
const openShop = () => S.shop.filter(i => !i.isPurchased);

const LS = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { } },
};
const Store = { docs: {}, cursor: 0 };
const dbErr = (code) => Object.assign(new Error(code), { code });
async function apiReq(method, path, body) {
  let res;
  try {
    res = await fetch(path, { method, cache: 'no-store', headers: { ...(S.key ? { Authorization: 'Bearer ' + S.key } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  } catch { setOffline(true); throw dbErr('unavailable'); }
  setOffline(false);
  const j = await res.json().catch(() => ({}));
  if (res.status === 401) { S.keyInvalid = true; schedule(true); throw dbErr('unauthorized'); }
  if (!res.ok) throw dbErr(j.error || 'unavailable');
  return j;
}
function setOffline(v) { if (S.offline !== v) { S.offline = v; schedule(true); } }
function applyDoc(c, id, data) {
  const m = Store.docs[c] || (Store.docs[c] = {});
  if (data === null) delete m[id]; else m[id] = data;
}
function derive() {
  for (const c of COLS) S[c] = Object.entries(Store.docs[c] || {}).map(([id, d]) => ({ ...d, id }));
  S.cfg = Store.docs.config?.main || null;
}
let cacheTimer;
function saveCache() { clearTimeout(cacheTimer); cacheTimer = setTimeout(() => LS.set('cache', JSON.stringify(Store)), 500); }
function loadCache() {
  try { const c = JSON.parse(LS.get('cache') || 'null'); if (c && c.docs) { Store.docs = c.docs; Store.cursor = c.cursor || 0; derive(); S.ready = true; } } catch { }
}
const docPath = (c, id) => `/api/doc?col=${encodeURIComponent(c)}&id=${encodeURIComponent(id)}`;
function afterWrite() { derive(); saveCache(); schedule(true); }
const col = (c) => ({
  doc: (id) => ({
    async get() { const r = await apiReq('GET', docPath(c, id)); if (r.exists) applyDoc(c, id, r.data); return { exists: r.exists, data: () => r.data }; },
    async set(data) { await apiReq('PUT', docPath(c, id), data); applyDoc(c, id, data); afterWrite(); },
    async create(data) {
      try { await apiReq('PUT', docPath(c, id) + '&create=1', data); applyDoc(c, id, data); afterWrite(); return true; }
      catch (e) { if (e.code === 'already_exists') return false; throw e; }
    },
    async update(data) {
      const cur = Store.docs[c]?.[id];
      if (!cur) throw dbErr('invalid_argument');
      const next = { ...cur, ...data };
      await apiReq('PUT', docPath(c, id), next); applyDoc(c, id, next); afterWrite();
    },
    async delete() { await apiReq('DELETE', docPath(c, id)); applyDoc(c, id, null); afterWrite(); },
  }),
});
async function put(c, id, data) {
  try { await col(c).doc(id).set(data); return true; }
  catch (e) { toast(errMsg(e)); return false; }
}
async function create(c, id, data) {
  try { return await col(c).doc(id).create(data); }
  catch (e) { toast(errMsg(e)); return null; }
}
async function patch(c, id, data) {
  try { await col(c).doc(id).update(data); return true; }
  catch (e) { toast(errMsg(e)); return false; }
}
async function del(c, id) {
  try { await col(c).doc(id).delete(); return true; } catch (e) { toast(errMsg(e)); return false; }
}
function errMsg(e) {
  const c = e?.code;
  if (c === 'unauthorized') return '招待キーが無効です。パートナーから新しいリンクをもらってください。';
  if (c === 'invalid_argument') return '保存できませんでした。画面を開き直してもう一度お試しください。';
  if (c === 'quota_exceeded') return '保存件数の上限に達しました。古いデータを削除してください。';
  return '通信できませんでした。電波の良い場所でもう一度お試しください。';
}
async function saveEdit(c, id, data, loadedUpdatedAt) {
  try {
    const cur = await col(c).doc(id).get();
    if (cur.exists && loadedUpdatedAt && cur.data().updatedAt !== loadedUpdatedAt) {
      if (!confirm('パートナーが先にこの項目を更新しています。上書きしますか？')) return false;
    }
  } catch (e) { }
  return put(c, id, { ...data, updatedAt: nowIso() });
}

let syncing = false, recDone = false;
async function pull() {
  if (syncing || !S.key || S.keyInvalid) return;
  syncing = true; setSyncDot(true);
  let changed = false;
  try {
    let more = true;
    while (more) {
      const r = await apiReq('GET', `/api/sync?since=${Store.cursor}`);
      for (const d of r.docs) applyDoc(d.col, d.id, d.deleted ? null : d.data);
      if (r.docs.length) changed = true;
      Store.cursor = r.cursor; more = r.more;
    }
    if (!S.ready) { S.ready = true; changed = true; }
    S.loadError = false;
    if (changed) { derive(); saveCache(); }
    if (!recDone && S.cfg && S.members.some(m => m.id === me())) { recDone = true; applyRecurring(); }
  } catch (e) {
    if (!S.ready && !S.loadError) { S.loadError = true; changed = true; }
  } finally {
    syncing = false; setSyncDot(false);
    if (changed) schedule();
  }
}
function setSyncDot(on) { S.pending = on; if (typeof window !== 'undefined') document.querySelector('.sync')?.classList.toggle('on', on); }
function setKey(k) {
  if (S.key === k && !S.keyInvalid) return;
  LS.set('key', k); S.key = k; S.keyInvalid = false;
  LS.del('cache'); LS.del('member'); S.uid = null;
  Store.docs = {}; Store.cursor = 0; derive(); S.ready = false; S.loadError = false; recDone = false;
}
function parseKey(text) {
  const m = String(text || '').match(/(?:k=)?([A-Za-z0-9_-]{40,60})\s*$/);
  return m ? m[1] : null;
}
const inviteUrl = () => `${location.origin}/#k=${S.key}`;

function boot() {
  if (!LS.set('probe', '1')) S.storageBlocked = true;
  S.key = LS.get('key'); S.uid = LS.get('member');
  const m = location.hash.match(/k=([A-Za-z0-9_-]{40,60})/);
  if (m) { setKey(m[1]); history.replaceState(null, '', location.pathname); }
  if (S.key) { loadCache(); pull(); }
  render();
  setInterval(() => { if (document.visibilityState === 'visible') pull(); }, 4000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pull(); });
  addEventListener('online', pull);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { });
}
let raf = 0, deferred = false;
function schedule(force) {
  if (typeof window === 'undefined') return;
  const a = document.activeElement, app = $app();
  if (!force && a && app && app.contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) { deferred = true; return; }
  if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); });
}

async function applyRecurring() {
  const t = today(), ym = D.ym(t), day = Number(t.slice(8, 10));
  for (const r of S.rec) {
    if (r.active === false) continue;
    const dd = Math.min(r.day || 1, D.daysInMonth(ym));
    if (dd > day) continue;
    const id = `rec-${r.id}-${ym}`;
    if (S.tx.some(x => x.id === id)) continue;
    await create('tx', id, {
      amount: r.amount, type: 'expense', date: `${ym}-${String(dd).padStart(2, '0')}`, categoryId: r.categoryId, memo: r.name,
      payerId: r.payerId || me(), expenseOwnerId: r.isShared ? null : (r.payerId || me()), isShared: !!r.isShared, splitA: r.splitA ?? 50,
      createdBy: me(), recurringId: r.id, shoppingItemId: null, createdAt: nowIso(), updatedAt: nowIso(),
    });
  }
}

const $app = () => (typeof document !== 'undefined' ? document.getElementById('app') : null);
