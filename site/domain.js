// ===== domain: pure functions (integer JPY only) =====
const D = {};
D.tokyoToday = (now = new Date()) => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return p; // YYYY-MM-DD
};
D.ym = (date) => date.slice(0, 7);
D.daysInMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
D.shiftMonth = (ym, n) => { let [y, m] = ym.split('-').map(Number); m += n; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return `${y}-${String(m).padStart(2, '0')}`; };
D.toInt = (v) => { const n = Math.round(Number(String(v ?? '').replace(/[^\d.-]/g, ''))); return Number.isFinite(n) ? n : 0; };

D.inMonth = (txs, ym) => txs.filter(t => t.date && t.date.slice(0, 7) === ym);
D.calculateMonthlySpending = (txs, ym) => D.inMonth(txs, ym).filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
D.calculateMonthlyIncome = (txs, ym) => D.inMonth(txs, ym).filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
D.calculateRemainingBudget = (budget, spent) => budget - spent;
D.daysLeft = (ym, today) => {
  const tym = D.ym(today), dim = D.daysInMonth(ym);
  if (ym < tym) return 0;
  if (ym > tym) return dim;
  return dim - Number(today.slice(8, 10)) + 1;
};
D.daysElapsed = (ym, today) => D.daysInMonth(ym) - D.daysLeft(ym, today) + (D.ym(today) === ym ? 1 : 0);
D.calculateDailyAllowance = (remaining, daysLeft) => (daysLeft <= 0 || remaining <= 0) ? 0 : Math.floor(remaining / daysLeft);
D.calculateMonthEndForecast = ({ txs, ym, today, fixedMonthly = 0 }) => {
  const exp = D.inMonth(txs, ym).filter(t => t.type === 'expense');
  const spent = exp.reduce((s, t) => s + t.amount, 0);
  const tym = D.ym(today);
  if (ym < tym) return spent;
  const variable = exp.filter(t => !t.recurringId).reduce((s, t) => s + t.amount, 0);
  const fixedDone = spent - variable;
  const dim = D.daysInMonth(ym);
  const elapsed = ym > tym ? 0 : Number(today.slice(8, 10));
  const projVar = elapsed === 0 ? variable : Math.round(variable / elapsed * dim);
  return Math.max(fixedDone, fixedMonthly) + projVar;
};
D.shareOf = (amount, splitA) => { const a = Math.round(amount * splitA / 100); return { a, b: amount - a }; };
D.calculateSettlement = (txs, settlements, A, B) => {
  let bal = 0;
  for (const t of txs) {
    if (t.type !== 'expense' || !t.isShared) continue;
    const { a, b } = D.shareOf(t.amount, t.splitA ?? 50);
    if (t.payerId === A) bal += b; else if (t.payerId === B) bal -= a;
  }
  for (const s of settlements || []) {
    if (s.from === B && s.to === A) bal -= s.amount;
    else if (s.from === A && s.to === B) bal += s.amount;
  }
  if (bal > 0) return { from: B, to: A, amount: bal };
  if (bal < 0) return { from: A, to: B, amount: -bal };
  return { from: null, to: null, amount: 0 };
};
D.paidBy = (txs, ym, id) => D.inMonth(txs, ym).filter(t => t.type === 'expense' && t.payerId === id).reduce((s, t) => s + t.amount, 0);
const lineEst = (i) => (i.estimatedUnitPrice || 0) * (i.quantity || 1);
D.calculateShoppingEstimate = (items) => items.filter(i => !i.isPurchased).reduce((s, i) => s + lineEst(i), 0);
D.calculateRequiredShoppingEstimate = (items) => items.filter(i => !i.isPurchased && i.priority === 'required').reduce((s, i) => s + lineEst(i), 0);
D.actualAmount = (i) => i.actualUnitPrice != null ? i.actualUnitPrice * (i.quantity || 1) : lineEst(i);
D.planVsActual = (items) => {
  const done = items.filter(i => i.isPurchased);
  const est = done.reduce((s, i) => s + lineEst(i), 0);
  const act = done.reduce((s, i) => s + D.actualAmount(i), 0);
  return { est, act, diff: act - est };
};
D.bookableItems = (items) => items.filter(i => i.isPurchased && !i.transactionId);
D.txIdForShopItem = (itemId) => 'shop-' + itemId;
D.normName = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, '');
D.priceStats = (history, name) => {
  const k = D.normName(name);
  const h = history.filter(x => D.normName(x.name) === k).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (!h.length) return null;
  const last = h[h.length - 1];
  const avg = Math.round(h.reduce((s, x) => s + x.unitPrice, 0) / h.length);
  return { last: last.unitPrice, avg, store: last.store || '', count: h.length };
};
D.restock = (inv, { unitPrice, quantity, store, date, history }) => {
  const stats = D.priceStats(history, inv.name);
  return {
    ...inv,
    status: 'in_stock',
    quantity: (inv.quantity || 0) + (quantity || 1),
    lastPrice: unitPrice,
    averagePrice: stats ? stats.avg : unitPrice,
    lastStore: store || inv.lastStore || '',
    lastPurchasedAt: date,
  };
};
D.calculateSavingsProgress = (goal, today) => {
  const target = goal.target || 0, saved = goal.saved || 0;
  const remaining = Math.max(0, target - saved);
  const rate = target > 0 ? Math.min(100, Math.floor(saved / target * 100)) : 0;
  let perMonth = null;
  if (goal.dueDate && remaining > 0) {
    const [ty, tm] = today.split('-').map(Number), [gy, gm] = goal.dueDate.split('-').map(Number);
    const months = Math.max(1, (gy - ty) * 12 + (gm - tm));
    perMonth = Math.ceil(remaining / months);
  }
  return { remaining, rate, perMonth };
};
D.sumByCat = (txs, ym, uptoDay = 31) => {
  const m = {};
  for (const t of D.inMonth(txs, ym)) if (t.type === 'expense' && Number(t.date.slice(8, 10)) <= uptoDay) m[t.categoryId] = (m[t.categoryId] || 0) + t.amount;
  return m;
};
D.insights = ({ txs, ym, today, categories, forecastByCat }) => {
  const out = [];
  const day = D.ym(today) === ym ? Number(today.slice(8, 10)) : 31;
  const cur = D.sumByCat(txs, ym, day), prev = D.sumByCat(txs, D.shiftMonth(ym, -1), day);
  for (const c of categories) {
    const a = cur[c.id] || 0, b = prev[c.id] || 0;
    if (b >= 1000 && a > 0) {
      const pct = Math.round((a - b) / b * 100);
      if (pct >= 15) out.push({ tone: 'warn', text: `${c.name}が先月の同じ時期より${pct}%増えています。` });
      else if (pct <= -15) out.push({ tone: 'good', text: `${c.name}は先月の同じ時期より${-pct}%減っています。` });
    }
    const f = forecastByCat?.[c.id];
    if (c.budget > 0 && f > c.budget) out.push({ tone: 'warn', text: `今のペースだと${c.name}が予算を約${(f - c.budget).toLocaleString('ja-JP')}円超える見込みです。` });
  }
  const exp = D.inMonth(txs, ym).filter(t => t.type === 'expense' && !t.recurringId).map(t => t.amount).sort((a, b) => a - b);
  if (exp.length >= 5) {
    const med = exp[Math.floor(exp.length / 2)];
    const big = D.inMonth(txs, ym).filter(t => t.type === 'expense' && !t.recurringId && t.amount >= med * 5 && t.amount >= 10000);
    for (const t of big.slice(0, 2)) out.push({ tone: 'info', text: `${t.date.slice(5).replace('-', '/')}の${t.amount.toLocaleString('ja-JP')}円はいつもより大きめの支出です。` });
  }
  return out;
};
D.weekly = (txs, today) => {
  const t0 = Date.parse(today + 'T00:00:00Z');
  let cur = 0, prev = 0;
  for (const t of txs) {
    if (t.type !== 'expense') continue;
    const d = (t0 - Date.parse(t.date + 'T00:00:00Z')) / 86400000;
    if (d >= 0 && d < 7) cur += t.amount; else if (d >= 7 && d < 14) prev += t.amount;
  }
  return { cur, prev };
};
if (typeof module !== 'undefined') module.exports = D;
